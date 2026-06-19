#!/usr/bin/env bash
# Terminate green EC2 instances owned by the current CodePipeline execution.
# Set TERMINATE_LEGACY_GREEN=true to also remove untagged orphans (CreateGreenInstance pre-cleanup).
set -euo pipefail

PIPELINE="${CODEPIPELINE_NAME:-}"
REGION="${AWS_DEFAULT_REGION:-${AWS_REGION:-us-east-2}}"
EXECUTION_ID="${CODEPIPELINE_EXECUTION_ID:-${PIPELINE_EXECUTION_ID:-}}"
TERMINATE_LEGACY_GREEN="${TERMINATE_LEGACY_GREEN:-false}"

if [ -z "$EXECUTION_ID" ] && [ -n "${CODEPIPELINE_BUILD_ID:-}" ]; then
  EXECUTION_ID="${CODEPIPELINE_BUILD_ID%%:*}"
fi

case "$PIPELINE" in
  bianca-production-pipeline) GREEN_TAG="${GREEN_TAG:-bianca-production-green}" ;;
  *)
    echo "Skipping green termination (pipeline=$PIPELINE)"
    exit 0
    ;;
esac

if [ -z "$EXECUTION_ID" ]; then
  echo "WARNING: No pipeline execution ID — skipping green termination to avoid killing another run's instance."
  exit 0
fi

echo "Finding green instances (Name=$GREEN_TAG, PipelineExecutionId=$EXECUTION_ID, legacy=$TERMINATE_LEGACY_GREEN)..."

TO_TERMINATE=$(aws ec2 describe-instances \
  --region "$REGION" \
  --filters "Name=tag:Name,Values=$GREEN_TAG" "Name=instance-state-name,Values=running,pending,stopping,stopped" \
  --output json 2>/dev/null | python3 -c '
import json
import sys

execution_id = sys.argv[1]
terminate_legacy = sys.argv[2].lower() == "true"
payload = json.load(sys.stdin)

instance_ids = []
for reservation in payload.get("Reservations", []):
    for instance in reservation.get("Instances", []):
        instance_id = instance.get("InstanceId")
        if not instance_id:
            continue
        tags = {tag.get("Key"): tag.get("Value") for tag in instance.get("Tags", [])}
        pipeline_execution_id = tags.get("PipelineExecutionId")
        if pipeline_execution_id == execution_id:
            instance_ids.append(instance_id)
        elif terminate_legacy and not pipeline_execution_id:
            instance_ids.append(instance_id)

print(" ".join(instance_ids))
' "$EXECUTION_ID" "$TERMINATE_LEGACY_GREEN")

if [ -z "$TO_TERMINATE" ]; then
  echo "No matching green instances found to terminate."
  exit 0
fi

echo "Instances to terminate: $TO_TERMINATE"
aws ec2 terminate-instances --region "$REGION" --instance-ids $TO_TERMINATE
echo "Green instance termination initiated."
