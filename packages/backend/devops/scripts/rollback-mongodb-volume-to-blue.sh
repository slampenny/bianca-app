#!/usr/bin/env bash
# Re-attach the environment MongoDB EBS volume to the current blue instance after a failed swap.
# Prevents staging/production 502 when Step 0 detaches the volume but swap aborts before cutover.
set -euo pipefail

ENV="${1:-staging}"
REGION="${AWS_DEFAULT_REGION:-${AWS_REGION:-us-east-2}}"
BLUE_TAG="bianca-${ENV}"
DEPLOY_DIR="/opt/bianca-${ENV}"
VOLUME_NAME="bianca-${ENV}-mongodb-data"

echo "=== Rollback MongoDB volume to blue ($ENV) ==="

BLUE_INSTANCE_ID=$(aws ec2 describe-instances \
  --region "$REGION" \
  --filters "Name=tag:Name,Values=$BLUE_TAG" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text 2>/dev/null || echo "")

if [ -z "$BLUE_INSTANCE_ID" ] || [ "$BLUE_INSTANCE_ID" = "None" ]; then
  echo "No running blue instance (Name=$BLUE_TAG) — skip rollback"
  exit 0
fi

VOL_ON_BLUE=$(aws ec2 describe-volumes \
  --region "$REGION" \
  --filters "Name=attachment.instance-id,Values=$BLUE_INSTANCE_ID" "Name=tag:Name,Values=$VOLUME_NAME" \
  --query 'Volumes[0].VolumeId' \
  --output text 2>/dev/null || echo "None")

if [ -n "$VOL_ON_BLUE" ] && [ "$VOL_ON_BLUE" != "None" ]; then
  echo "Volume $VOL_ON_BLUE already attached to blue $BLUE_INSTANCE_ID — remount only"
  VOLUME_ID="$VOL_ON_BLUE"
else
  VOLUME_ID=$(aws ec2 describe-volumes \
    --region "$REGION" \
    --filters "Name=tag:Name,Values=$VOLUME_NAME" "Name=status,Values=available" \
    --query 'Volumes[0].VolumeId' \
    --output text 2>/dev/null || echo "None")
  if [ -z "$VOLUME_ID" ] || [ "$VOLUME_ID" = "None" ]; then
    echo "No available volume with Name=$VOLUME_NAME — nothing to rollback"
    exit 0
  fi
  echo "Attaching $VOLUME_ID to blue $BLUE_INSTANCE_ID at /dev/sdf..."
  aws ec2 attach-volume --region "$REGION" --volume-id "$VOLUME_ID" --instance-id "$BLUE_INSTANCE_ID" --device /dev/sdf
  for i in $(seq 1 30); do
    ST=$(aws ec2 describe-volumes --region "$REGION" --volume-ids "$VOLUME_ID" --query 'Volumes[0].Attachments[0].State' --output text 2>/dev/null || echo "")
    [ "$ST" = "attached" ] && break
    sleep 3
  done
  sleep 15
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOUNT="$SCRIPT_DIR/remount-mongodb-on-instance.sh"
if [ ! -f "$REMOUNT" ]; then
  echo "⚠️  remount-mongodb-on-instance.sh not found — volume attached but not mounted"
  exit 0
fi

SCRIPT_B64=$(base64 -w0 "$REMOUNT")
CMD_ID=$(aws ssm send-command \
  --region "$REGION" \
  --instance-ids "$BLUE_INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "{\"commands\":[\"echo $SCRIPT_B64 | base64 -d > /tmp/remount-mongo.sh\",\"chmod +x /tmp/remount-mongo.sh\",\"DEPLOY_DIR=$DEPLOY_DIR bash /tmp/remount-mongo.sh\"]}" \
  --timeout-seconds 900 \
  --query 'Command.CommandId' \
  --output text 2>/dev/null || echo "")

if [ -z "$CMD_ID" ]; then
  echo "⚠️  SSM remount failed to start"
  exit 0
fi

echo "Remount SSM: $CMD_ID (waiting up to 10m)..."
for i in $(seq 1 60); do
  ST=$(aws ssm get-command-invocation --region "$REGION" --command-id "$CMD_ID" --instance-id "$BLUE_INSTANCE_ID" --query 'Status' --output text 2>/dev/null || echo "Pending")
  if [ "$ST" = "Success" ]; then
    echo "✅ MongoDB volume rolled back to blue"
    exit 0
  fi
  if [ "$ST" = "Failed" ] || [ "$ST" = "TimedOut" ] || [ "$ST" = "Cancelled" ]; then
    echo "⚠️  Rollback remount SSM ended with: $ST"
    aws ssm get-command-invocation --region "$REGION" --command-id "$CMD_ID" --instance-id "$BLUE_INSTANCE_ID" --query '{Stdout:StandardOutputContent,Stderr:StandardErrorContent}' --output text 2>/dev/null | head -c 4000 || true
    exit 0
  fi
  sleep 10
done
echo "⚠️  Rollback remount still in progress (SSM $CMD_ID)"
