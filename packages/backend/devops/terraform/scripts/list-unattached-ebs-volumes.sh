#!/usr/bin/env bash
# Lists available (unattached) EBS volumes — common after terminating WordPress EC2.
# Review each volume before deleting (snapshots / data loss). Does not delete anything.
set -euo pipefail
: "${AWS_PROFILE:=jordan}"
: "${AWS_REGION:=us-east-2}"
export AWS_PROFILE AWS_REGION
aws ec2 describe-volumes \
  --filters Name=status,Values=available \
  --query 'Volumes[].{Id:VolumeId,Size:Size,AZ:AvailabilityZone,Created:CreateTime,Tags:Tags}' \
  --output table
