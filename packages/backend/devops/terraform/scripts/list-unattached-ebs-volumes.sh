#!/usr/bin/env bash
# Lists available (unattached) EBS volumes — common after terminating WordPress EC2.
# Review each volume before deleting (snapshots / data loss). Does not delete anything.
# MongoDB data volumes (bianca-*-mongodb-data) must stay separate per environment.
set -euo pipefail
: "${AWS_PROFILE:=jordan}"
: "${AWS_REGION:=ca-central-1}"
export AWS_PROFILE AWS_REGION
echo "Protected MongoDB volumes (do not delete):"
aws ec2 describe-volumes \
  --filters "Name=tag:Name,Values=bianca-production-mongodb-data,bianca-staging-mongodb-data" \
  --query 'Volumes[].{Id:VolumeId,Name:Tags[?Key==`Name`]|[0].Value,Environment:Tags[?Key==`Environment`]|[0].Value,State:State,AttachedTo:Attachments[0].InstanceId}' \
  --output table
echo ""
echo "Other available (unattached) volumes:"
aws ec2 describe-volumes \
  --filters Name=status,Values=available \
  --query 'Volumes[?!(Tags[?Key==`Name` && (Value==`bianca-production-mongodb-data` || Value==`bianca-staging-mongodb-data`)])].{Id:VolumeId,Size:Size,AZ:AvailabilityZone,Created:CreateTime,Tags:Tags}' \
  --output table
