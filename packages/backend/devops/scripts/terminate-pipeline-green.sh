#!/usr/bin/env bash
# Terminate leftover green EC2 instances after a failed production pipeline (e.g. RunTests).
# Staging runs RunTests after swap; production runs RunTests before swap — only production auto-cleans here.
set -euo pipefail

PIPELINE="${CODEPIPELINE_NAME:-}"
REGION="${AWS_DEFAULT_REGION:-${AWS_REGION:-us-east-2}}"

if [ "$PIPELINE" != "bianca-production-pipeline" ]; then
  echo "Skipping green termination (pipeline=$PIPELINE; production-only cleanup)"
  exit 0
fi

GREEN_TAG="${GREEN_TAG:-bianca-production-green}"
echo "Terminating green instances (Name=$GREEN_TAG) after failed production pipeline step..."

IDS=$(aws ec2 describe-instances \
  --region "$REGION" \
  --filters "Name=tag:Name,Values=$GREEN_TAG" "Name=instance-state-name,Values=running,pending,stopping,stopped" \
  --query 'Reservations[*].Instances[*].InstanceId' \
  --output text 2>/dev/null || true)

TO_TERMINATE=""
for id in $IDS; do
  [ -z "$id" ] || [ "$id" = "None" ] && continue
  TO_TERMINATE="$TO_TERMINATE $id"
done

if [ -z "$TO_TERMINATE" ]; then
  echo "No green instances found to terminate."
  exit 0
fi

echo "Instances to terminate:$TO_TERMINATE"
aws ec2 terminate-instances --region "$REGION" --instance-ids $TO_TERMINATE
echo "Green instance termination initiated."
