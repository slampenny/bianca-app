#!/usr/bin/env bash
# Reconcile Terraform state with the live production MongoDB EBS volume.
# Run from packages/backend/devops/terraform after AWS_PROFILE is set.
#
# Use when the volume was created outside Terraform or state points at a deleted volume ID.
set -euo pipefail

: "${AWS_PROFILE:=jordan}"
export AWS_PROFILE

VOLUME_ID="${1:-}"
if [ -z "$VOLUME_ID" ]; then
  VOLUME_ID=$(aws ec2 describe-volumes \
    --filters "Name=tag:Name,Values=bianca-production-mongodb-data" "Name=tag:Environment,Values=production" \
    --query 'Volumes[0].VolumeId' \
    --output text)
fi

if [ -z "$VOLUME_ID" ] || [ "$VOLUME_ID" = "None" ]; then
  echo "No production MongoDB volume found (tag Name=bianca-production-mongodb-data)."
  exit 1
fi

echo "Importing aws_ebs_volume.production_mongodb <= $VOLUME_ID"

if terraform state show aws_ebs_volume.production_mongodb >/dev/null 2>&1; then
  CURRENT_ID=$(terraform state show -no-color aws_ebs_volume.production_mongodb | awk '/^id / { print $3 }')
  if [ "$CURRENT_ID" = "$VOLUME_ID" ]; then
    echo "State already tracks $VOLUME_ID — nothing to do."
    exit 0
  fi
  echo "Removing stale state entry (was $CURRENT_ID)..."
  terraform state rm aws_ebs_volume.production_mongodb
fi

terraform import aws_ebs_volume.production_mongodb "$VOLUME_ID"
terraform plan -target=aws_ebs_volume.production_mongodb
echo "Done. Production MongoDB volume is now managed by Terraform."
