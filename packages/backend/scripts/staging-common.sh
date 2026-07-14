#!/bin/bash
# Shared helpers for yarn staging:up|down|status|deploy
# No secrets printed. Defaults align with Terraform (ca-central-1).

# shellcheck disable=SC2034
STAGING_AWS_PROFILE="${AWS_PROFILE:-jordan}"
STAGING_AWS_REGION="${AWS_REGION:-ca-central-1}"
STAGING_AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-730335291008}"
STAGING_ECR_REGISTRY="${STAGING_ECR_REGISTRY:-${STAGING_AWS_ACCOUNT_ID}.dkr.ecr.${STAGING_AWS_REGION}.amazonaws.com}"
STAGING_INSTANCE_NAME_TAG="${STAGING_INSTANCE_NAME_TAG:-bianca-staging}"
STAGING_EIP_NAME_TAG="${STAGING_EIP_NAME_TAG:-bianca-staging-eip}"
STAGING_DEPLOY_DIR="/opt/bianca-staging"
STAGING_SECRET_ID="MySecretsManagerSecret-Staging"
STAGING_PHONE_E164="+19285758645"
STAGING_API_URL="https://staging-api.biancawellness.com"
STAGING_APP_URL="https://staging.biancawellness.com"
STAGING_ADMIN_URL="https://staging-admin.biancawellness.com"
STAGING_SIP_HOST="staging-sip.biancawellness.com"
STAGING_HEALTH_URL="${STAGING_API_URL}/health"
# Script upload target (instance role has s3:GetObject on *; operator needs PutObject)
STAGING_SSM_SCRIPT_BUCKET="${STAGING_SSM_SCRIPT_BUCKET:-bianca-codedeploy-production-artifacts-${STAGING_AWS_ACCOUNT_ID}-cac1}"

staging_aws() {
  aws "$@" --profile "$STAGING_AWS_PROFILE" --region "$STAGING_AWS_REGION"
}

# Return all non-terminated instance IDs with Name=bianca-staging (newest last)
staging_list_instance_ids() {
  staging_aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=${STAGING_INSTANCE_NAME_TAG}" \
      "Name=instance-state-name,Values=pending,running,stopping,stopped" \
    --query 'sort_by(Reservations[].Instances[], &LaunchTime)[].InstanceId' \
    --output text 2>/dev/null | tr '\t' '\n' | sed '/^$/d' || true
}

# Prefer instance holding the staging SIP EIP; else newest Name=bianca-staging
staging_get_instance_id() {
  local eip_instance
  eip_instance=$(staging_aws ec2 describe-addresses \
    --filters "Name=tag:Name,Values=${STAGING_EIP_NAME_TAG}" \
    --query 'Addresses[0].InstanceId' \
    --output text 2>/dev/null || true)

  if [ -n "$eip_instance" ] && [ "$eip_instance" != "None" ] && [ "$eip_instance" != "null" ]; then
    echo "$eip_instance"
    return 0
  fi

  local ids
  ids=$(staging_list_instance_ids)
  if [ -z "$ids" ]; then
    return 1
  fi
  echo "$ids" | tail -n1
}

staging_get_instance_state() {
  local instance_id=$1
  staging_aws ec2 describe-instances \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text
}

staging_get_public_ip() {
  local instance_id=$1
  staging_aws ec2 describe-instances \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text
}

staging_get_sip_eip() {
  staging_aws ec2 describe-addresses \
    --filters "Name=tag:Name,Values=${STAGING_EIP_NAME_TAG}" \
    --query 'Addresses[0].PublicIp' \
    --output text 2>/dev/null || echo ""
}

staging_wait_ssm_online() {
  local instance_id=$1
  local attempts=${2:-36}
  local i status
  for i in $(seq 1 "$attempts"); do
    status=$(staging_aws ssm describe-instance-information \
      --filters "Key=InstanceIds,Values=${instance_id}" \
      --query 'InstanceInformationList[0].PingStatus' \
      --output text 2>/dev/null || echo "Inactive")
    if [ "$status" = "Online" ]; then
      return 0
    fi
    sleep 5
  done
  echo "❌ SSM agent not Online for $instance_id after ${attempts} attempts" >&2
  return 1
}

# Run a remote shell script via S3 upload + SSM. Streams stdout/stderr. Fails loudly.
# Args: instance_id local_script_path [extra env assignments e.g. DEPLOY_GIT_SHA=abc]
staging_ssm_run_script() {
  local instance_id=$1
  local local_script=$2
  shift 2
  local extra_env=("$@")

  if [ ! -f "$local_script" ]; then
    echo "❌ Local script not found: $local_script" >&2
    return 1
  fi

  local key remote_path cmd_id status i env_exports env_line
  key="staging-ssm/$(basename "$local_script").$(date +%s).$$"
  remote_path="/tmp/$(basename "$local_script")"

  echo "   Uploading $(basename "$local_script") to s3://${STAGING_SSM_SCRIPT_BUCKET}/${key}"
  staging_aws s3 cp "$local_script" "s3://${STAGING_SSM_SCRIPT_BUCKET}/${key}" >/dev/null

  env_exports="set -euo pipefail; export AWS_REGION=${STAGING_AWS_REGION}; export ENVIRONMENT=staging;"
  for env_line in "${extra_env[@]+"${extra_env[@]}"}"; do
    [ -n "$env_line" ] || continue
    env_exports+=" export ${env_line};"
  done

  local params_file
  params_file=$(mktemp)
  cat > "$params_file" <<EOF
{
  "commands": [
    "set -euo pipefail",
    "aws s3 cp 's3://${STAGING_SSM_SCRIPT_BUCKET}/${key}' '${remote_path}'",
    "chmod +x '${remote_path}'",
    "${env_exports} bash '${remote_path}'",
    "rm -f '${remote_path}'",
    "aws s3 rm 's3://${STAGING_SSM_SCRIPT_BUCKET}/${key}' || true"
  ]
}
EOF

  cmd_id=$(staging_aws ssm send-command \
    --instance-ids "$instance_id" \
    --document-name "AWS-RunShellScript" \
    --comment "bianca staging deploy $(basename "$local_script")" \
    --parameters "file://${params_file}" \
    --query 'Command.CommandId' \
    --output text)
  rm -f "$params_file"

  echo "   SSM CommandId: $cmd_id"
  for i in $(seq 1 120); do
    status=$(staging_aws ssm get-command-invocation \
      --command-id "$cmd_id" \
      --instance-id "$instance_id" \
      --query 'Status' \
      --output text 2>/dev/null || echo "InProgress")
    case "$status" in
      Success|Failed|Cancelled|TimedOut) break ;;
    esac
    sleep 5
  done

  echo "──── SSM stdout ────"
  staging_aws ssm get-command-invocation \
    --command-id "$cmd_id" \
    --instance-id "$instance_id" \
    --query 'StandardOutputContent' \
    --output text || true
  echo "──── SSM stderr ────"
  staging_aws ssm get-command-invocation \
    --command-id "$cmd_id" \
    --instance-id "$instance_id" \
    --query 'StandardErrorContent' \
    --output text || true

  if [ "$status" != "Success" ]; then
    echo "❌ SSM command failed with status=$status" >&2
    return 1
  fi
  return 0
}

# Run inline remote commands via SSM (small snippets only)
staging_ssm_run_commands() {
  local instance_id=$1
  shift
  local params_file cmd_id status i
  params_file=$(mktemp)
  python3 - "$params_file" "$@" <<'PY'
import json, sys
path = sys.argv[1]
commands = list(sys.argv[2:])
with open(path, "w", encoding="utf-8") as f:
    json.dump({"commands": commands}, f)
PY

  cmd_id=$(staging_aws ssm send-command \
    --instance-ids "$instance_id" \
    --document-name "AWS-RunShellScript" \
    --comment "bianca staging remote check" \
    --parameters "file://${params_file}" \
    --query 'Command.CommandId' \
    --output text)
  rm -f "$params_file"

  for i in $(seq 1 60); do
    status=$(staging_aws ssm get-command-invocation \
      --command-id "$cmd_id" \
      --instance-id "$instance_id" \
      --query 'Status' \
      --output text 2>/dev/null || echo "InProgress")
    case "$status" in
      Success|Failed|Cancelled|TimedOut) break ;;
    esac
    sleep 3
  done

  staging_aws ssm get-command-invocation \
    --command-id "$cmd_id" \
    --instance-id "$instance_id" \
    --query '[Status, StandardOutputContent, StandardErrorContent]' \
    --output text

  [ "$status" = "Success" ]
}

print_staging_voice_matrix() {
  cat <<'EOF'

══════════════════════════════════════════════════════════════════
Manual voice matrix (dial the staging number — do not automate)
══════════════════════════════════════════════════════════════════
  1. Inbound call connects; Bianca greets
  2. Two-way audio (caller ↔ Bianca) with no sustained dropouts
  3. Caller speech is understood; Bianca responds on-topic
  4. Turn-taking: Bianca stops/yields when the caller speaks (barge-in)
  5. Silence / end-of-turn: Bianca resumes after a natural pause
  6. Longer turn: caller speaks 20–30s; no premature cut-off
  7. Hold noise / background speech: no double responses
  8. Clean hangup: call ends; ARI/OpenAI session tears down without stuck media
══════════════════════════════════════════════════════════════════
EOF
}

print_staging_checklist() {
  local git_sha="${1:-unknown}"
  local digests="${2:-}"
  local sip_eip
  sip_eip=$(staging_get_sip_eip || true)

  cat <<EOF

Staging checklist
─────────────────
  Dial:           ${STAGING_PHONE_E164}
  API:            ${STAGING_API_URL}
  App:            ${STAGING_APP_URL}
  Admin:          ${STAGING_ADMIN_URL}
  SIP host:       ${STAGING_SIP_HOST}
  SIP EIP:        ${sip_eip:-unknown}
  Deployed SHA:   ${git_sha}
EOF
  if [ -n "$digests" ]; then
    echo "  Image digests:"
    echo "$digests" | sed 's/^/    /'
  fi
  print_staging_voice_matrix
}
