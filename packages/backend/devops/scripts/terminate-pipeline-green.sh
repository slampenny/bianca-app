#!/usr/bin/env bash
# Terminate leftover green EC2 instances after a failed RunTests stage (before SwapAndTerminate).
set -euo pipefail

PIPELINE="${CODEPIPELINE_NAME:-}"
REGION="${AWS_DEFAULT_REGION:-${AWS_REGION:-us-east-2}}"

case "$PIPELINE" in
  bianca-production-pipeline) GREEN_TAG="${GREEN_TAG:-bianca-production-green}" ;;
  bianca-staging-pipeline)    GREEN_TAG="${GREEN_TAG:-bianca-staging-green}" ;;
  *)
    echo "Skipping green termination (pipeline=$PIPELINE)"
    exit 0
    ;;
esac
echo "Terminating green instances (Name=$GREEN_TAG) after failed pipeline step..."

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
