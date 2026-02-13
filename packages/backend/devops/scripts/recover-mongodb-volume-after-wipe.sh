#!/bin/bash
# Recovery script when data appears wiped after a blue-green deploy.
# The MongoDB EBS volume may still exist: attached to current instance but not mounted,
# or detached (available). This script helps reattach/mount and restart MongoDB.
#
# Usage:
#   AWS_PROFILE=jordan ./recover-mongodb-volume-after-wipe.sh production   # or staging
# Or run the commands manually (see BLUE_GREEN_DEPLOYMENT.md "Data wiped after deploy").

set -e
ENV="${1:-production}"
REGION="${AWS_REGION:-us-east-2}"
PROFILE="${AWS_PROFILE:-}"

if [ "$ENV" != "production" ] && [ "$ENV" != "staging" ]; then
  echo "Usage: $0 production|staging"
  exit 1
fi

NAME_TAG="bianca-$ENV"
DEPLOY_DIR="/opt/bianca-$ENV"
VOLUME_NAME="bianca-$ENV-mongodb-data"

echo "=== MongoDB volume recovery for $ENV ==="
echo ""

# Get current instance (the one serving traffic)
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=$NAME_TAG" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text --region "$REGION" ${PROFILE:+--profile $PROFILE} 2>/dev/null || echo "")

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
  echo "Could not find running instance with Name=$NAME_TAG"
  exit 1
fi

INSTANCE_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text \
  --region "$REGION" ${PROFILE:+--profile $PROFILE} 2>/dev/null || echo "")

echo "Current instance: $INSTANCE_ID (IP: ${INSTANCE_IP:-unknown})"

# Check volumes attached to this instance
echo ""
echo "Volumes attached to this instance:"
aws ec2 describe-volumes \
  --filters "Name=attachment.instance-id,Values=$INSTANCE_ID" \
  --query 'Volumes[*].[VolumeId,Attachments[0].Device,Size]' --output table \
  --region "$REGION" ${PROFILE:+--profile $PROFILE} 2>/dev/null || true

VOL_ATTACHED=$(aws ec2 describe-volumes \
  --filters "Name=attachment.instance-id,Values=$INSTANCE_ID" "Name=attachment.device,Values=/dev/sdf" \
  --query 'Volumes[0].VolumeId' --output text --region "$REGION" ${PROFILE:+--profile $PROFILE} 2>/dev/null || echo "None")

if [ -n "$VOL_ATTACHED" ] && [ "$VOL_ATTACHED" != "None" ]; then
  echo ""
  echo "MongoDB volume is attached at /dev/sdf: $VOL_ATTACHED"
  echo ""
  echo "Run these commands to mount and restart MongoDB (use the instance IP if SSH fails):"
  echo ""
  if [ -n "$INSTANCE_IP" ]; then
    echo "  ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@$INSTANCE_IP"
  fi
  echo "  sudo mount /dev/sdf /opt/mongodb-data || true"
  echo "  sudo chown -R 999:999 /opt/mongodb-data"
  echo "  cd $DEPLOY_DIR && (docker compose restart mongodb 2>/dev/null || docker-compose restart mongodb)"
  echo "  cd $DEPLOY_DIR && (docker compose up -d 2>/dev/null || docker-compose up -d)"
  exit 0
fi

# Check for available (detached) volume with our name
VOL_AVAILABLE=$(aws ec2 describe-volumes \
  --filters "Name=tag:Name,Values=$VOLUME_NAME" "Name=status,Values=available" \
  --query 'Volumes[0].VolumeId' --output text --region "$REGION" ${PROFILE:+--profile $PROFILE} 2>/dev/null || echo "None")

if [ -n "$VOL_AVAILABLE" ] && [ "$VOL_AVAILABLE" != "None" ]; then
  echo ""
  echo "Found detached MongoDB volume: $VOL_AVAILABLE"
  echo "Attaching to current instance..."
  aws ec2 attach-volume --volume-id "$VOL_AVAILABLE" --instance-id "$INSTANCE_ID" --device /dev/sdf \
    --region "$REGION" ${PROFILE:+--profile $PROFILE}
  echo "Waiting 20s for attach..."
  sleep 20
  INSTANCE_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text \
    --region "$REGION" ${PROFILE:+--profile $PROFILE} 2>/dev/null || echo "")
  echo "Now SSH and run:"
  echo "  ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@${INSTANCE_IP:-<instance-ip>}"
  echo "  sudo mount /dev/sdf /opt/mongodb-data"
  echo "  sudo chown -R 999:999 /opt/mongodb-data"
  echo "  cd $DEPLOY_DIR && (docker compose restart mongodb 2>/dev/null || docker-compose restart mongodb)"
  echo "  cd $DEPLOY_DIR && (docker compose up -d 2>/dev/null || docker-compose up -d)"
  exit 0
fi

echo ""
echo "No MongoDB volume found attached or available. Data may have been on a volume that was lost with a terminated instance."
echo "See docs/deployment/BLUE_GREEN_DEPLOYMENT.md 'Data wiped after deploy' for manual steps."
