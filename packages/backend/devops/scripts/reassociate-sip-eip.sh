#!/usr/bin/env bash
# Emergency: re-attach Terraform-managed SIP Elastic IP to the live Bianca EC2 instance.
# Use when blue/green left the EIP unassociated (e.g. old swap order) or manual instance churn.
#
# Production (default):
#   ./reassociate-sip-eip.sh production
# Staging:
#   ./reassociate-sip-eip.sh staging
#
# Requires: aws CLI, IAM ec2:AssociateAddress, ec2:DescribeInstances, ec2:DescribeAddresses
set -euo pipefail

ENV_NAME="${1:-production}"
REGION="${AWS_REGION:-us-east-2}"

if [ "$ENV_NAME" = "production" ]; then
  NAME_TAG="bianca-production"
  EIP_TAG="bianca-production-eip"
elif [ "$ENV_NAME" = "staging" ]; then
  NAME_TAG="bianca-staging"
  EIP_TAG="bianca-staging-eip"
else
  echo "Usage: $0 [production|staging]"
  exit 1
fi

echo "Region=$REGION  instance Name=$NAME_TAG  EIP tag Name=$EIP_TAG"

ALLOC_ID=$(aws ec2 describe-addresses --region "$REGION" \
  --filters "Name=tag:Name,Values=$EIP_TAG" \
  --query 'Addresses[0].AllocationId' --output text)
if [ -z "$ALLOC_ID" ] || [ "$ALLOC_ID" = "None" ]; then
  echo "ERROR: No EIP found with tag Name=$EIP_TAG"
  exit 1
fi
echo "AllocationId: $ALLOC_ID"

IID=$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=$NAME_TAG" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)
if [ -z "$IID" ] || [ "$IID" = "None" ]; then
  echo "ERROR: No running instance with tag Name=$NAME_TAG"
  exit 1
fi
echo "Target instance: $IID"

aws ec2 associate-address --region "$REGION" \
  --instance-id "$IID" \
  --allocation-id "$ALLOC_ID" \
  --allow-reassociation

echo "OK: EIP $ALLOC_ID -> $IID"
echo "Next: on the instance, ensure docker-compose EXTERNAL_ADDRESS / ASTERISK_PUBLIC_IP match metadata public IP (see application_start.sh / SSM in swap buildspec)."
