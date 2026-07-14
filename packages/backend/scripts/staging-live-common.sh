#!/bin/bash
# Shared helpers for staging live-dev sync (source locally, run on EC2).

AWS_PROFILE="${AWS_PROFILE:-jordan}"
AWS_REGION="${AWS_REGION:-ca-central-1}"
STAGING_SSH_KEY="${STAGING_SSH_KEY:-$HOME/.ssh/bianca-key-pair.pem}"
STAGING_SSH_USER="${STAGING_SSH_USER:-ec2-user}"
REMOTE_DEPLOY_DIR="/opt/bianca-staging"
REMOTE_SRC_DIR="$REMOTE_DEPLOY_DIR/dev-src"
LIVE_DEV_FLAG="$REMOTE_DEPLOY_DIR/.live-dev-enabled"
STAGING_MONGODB_VOLUME_TAG="bianca-staging-mongodb-data"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Populated by staging_live_ssh_opts_init / staging_live_ensure_running
declare -a STAGING_SSH_OPTS=()

staging_live_get_instance_id() {
  aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=bianca-staging" "Name=instance-state-name,Values=running,stopped,pending,stopping" \
    --query 'sort_by(Reservations[].Instances[], &LaunchTime)[-1].InstanceId' \
    --output text \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION"
}

staging_live_get_instance_ip() {
  local instance_id="$1"
  aws ec2 describe-instances \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION"
}

staging_live_refresh_known_host() {
  local ip="$1"
  if [ -z "$ip" ] || [ "$ip" = "None" ]; then
    return 0
  fi
  # Instance replacement changes the host key; remove stale entry so accept-new works.
  ssh-keygen -f "$HOME/.ssh/known_hosts" -R "$ip" 2>/dev/null || true
}

staging_live_ssh_opts_init() {
  if [ ! -f "$STAGING_SSH_KEY" ]; then
    echo "SSH key not found: $STAGING_SSH_KEY (set STAGING_SSH_KEY)" >&2
    return 1
  fi
  STAGING_SSH_OPTS=(
    -i "$STAGING_SSH_KEY"
    -o StrictHostKeyChecking=accept-new
    -o ConnectTimeout=15
  )
}

staging_live_attach_mongodb_volume() {
  local instance_id="$1"
  local vol_id attached_to

  vol_id="$(aws ec2 describe-volumes \
    --filters "Name=tag:Name,Values=$STAGING_MONGODB_VOLUME_TAG" \
    --query 'Volumes[0].VolumeId' \
    --output text \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION")"

  if [ -z "$vol_id" ] || [ "$vol_id" = "None" ]; then
    echo "No MongoDB EBS volume tagged $STAGING_MONGODB_VOLUME_TAG (continuing without attach)."
    return 0
  fi

  attached_to="$(aws ec2 describe-volumes \
    --volume-ids "$vol_id" \
    --query 'Volumes[0].Attachments[0].InstanceId' \
    --output text \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION")"

  if [ "$attached_to" = "$instance_id" ]; then
    echo "MongoDB EBS volume already attached ($vol_id)."
    return 0
  fi

  if [ -n "$attached_to" ] && [ "$attached_to" != "None" ]; then
    echo "MongoDB EBS volume $vol_id is attached to $attached_to (not this instance)." >&2
    return 1
  fi

  echo "Attaching MongoDB EBS volume $vol_id to $instance_id (/dev/sdf)..."
  aws ec2 attach-volume \
    --volume-id "$vol_id" \
    --instance-id "$instance_id" \
    --device /dev/sdf \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" >/dev/null

  aws ec2 wait volume-in-use \
    --volume-ids "$vol_id" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION"
  sleep 5
  echo "MongoDB EBS volume attached."
}

staging_live_ensure_running() {
  local instance_id
  instance_id="$(staging_live_get_instance_id)"
  if [ -z "$instance_id" ] || [ "$instance_id" = "None" ]; then
    echo "No staging instance found (Name=bianca-staging)."
    return 1
  fi

  local status
  status="$(aws ec2 describe-instances \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION")"

  if [ "$status" = "stopped" ]; then
    echo "Starting stopped staging instance..."
    aws ec2 start-instances \
      --instance-ids "$instance_id" \
      --profile "$AWS_PROFILE" \
      --region "$AWS_REGION" >/dev/null
    aws ec2 wait instance-running \
      --instance-ids "$instance_id" \
      --profile "$AWS_PROFILE" \
      --region "$AWS_REGION"
    sleep 15
    STAGING_INSTANCE_JUST_STARTED=true
  elif [ "$status" != "running" ]; then
    echo "Staging instance is $status — wait until running, then retry."
    return 1
  fi

  STAGING_INSTANCE_ID="$instance_id"
  STAGING_INSTANCE_IP="$(staging_live_get_instance_ip "$instance_id")"
  if [ -z "$STAGING_INSTANCE_IP" ] || [ "$STAGING_INSTANCE_IP" = "None" ]; then
    echo "Staging instance has no public IP yet."
    return 1
  fi

  staging_live_ssh_opts_init || return 1

  # After instance replace/restart the host key changes (EIP stays the same).
  if [ "${STAGING_INSTANCE_JUST_STARTED:-false}" = true ]; then
    staging_live_refresh_known_host "$STAGING_INSTANCE_IP"
  fi

  staging_live_attach_mongodb_volume "$instance_id" || return 1
}

staging_live_rsync_excludes() {
  cat <<'EOF'
--exclude=.git
--exclude=node_modules
--exclude=**/node_modules
--exclude=.yarn/cache
--exclude=**/dist
--exclude=**/.expo
--exclude=packages/mobile
--exclude=coverage
--exclude=test-results
--exclude=**/*.log
--exclude=.cursor
--exclude=terminals
EOF
}

staging_live_rsync_once() {
  rsync -az --delete \
    $(staging_live_rsync_excludes) \
    -e "ssh ${STAGING_SSH_OPTS[*]}" \
    "$REPO_ROOT/" \
    "${STAGING_SSH_USER}@${STAGING_INSTANCE_IP}:${REMOTE_SRC_DIR}/"
}

staging_live_remote() {
  if ssh "${STAGING_SSH_OPTS[@]}" "${STAGING_SSH_USER}@${STAGING_INSTANCE_IP}" "$@"; then
    return 0
  fi
  local rc=$?
  local err
  err="$(ssh "${STAGING_SSH_OPTS[@]}" -o BatchMode=yes "${STAGING_SSH_USER}@${STAGING_INSTANCE_IP}" true 2>&1)" || true
  if echo "$err" | grep -qiE 'host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED'; then
    echo "Refreshing stale SSH host key for $STAGING_INSTANCE_IP..."
    staging_live_refresh_known_host "$STAGING_INSTANCE_IP"
    ssh "${STAGING_SSH_OPTS[@]}" "${STAGING_SSH_USER}@${STAGING_INSTANCE_IP}" "$@"
    return $?
  fi
  return "$rc"
}

staging_live_scp() {
  scp "${STAGING_SSH_OPTS[@]}" "$@"
}

staging_live_enable_always_on() {
  aws ssm put-parameter \
    --name "/bianca/staging/always-on" \
    --value "true" \
    --type "String" \
    --overwrite \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" >/dev/null
  echo "Auto-stop paused (/bianca/staging/always-on=true)."
}
