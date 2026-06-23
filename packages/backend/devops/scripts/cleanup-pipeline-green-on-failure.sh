#!/usr/bin/env bash
# Terminate orphaned green instance(s) after a failed pipeline stage, only when blue is still healthy.
# Used from CodeBuild post_build and mirrors the safety checks in lambda green_cleanup.py.
set -euo pipefail

PIPELINE="${CODEPIPELINE_NAME:-bianca-production-pipeline}"
REGION="${AWS_DEFAULT_REGION:-${AWS_REGION:-ca-central-1}}"
EXECUTION_ID="${CODEPIPELINE_EXECUTION_ID:-${PIPELINE_EXECUTION_ID:-}}"
ROLLBACK_MONGO="${ROLLBACK_MONGO:-false}"

if [ -z "$EXECUTION_ID" ] && [ -n "${CODEPIPELINE_BUILD_ID:-}" ]; then
  EXECUTION_ID="${CODEPIPELINE_BUILD_ID%%:*}"
fi

case "$PIPELINE" in
  bianca-production-pipeline)
    GREEN_TAG="${GREEN_TAG:-bianca-production-green}"
    BLUE_TAG="${BLUE_TAG:-bianca-production}"
    ROLLBACK_ENV=production
    ;;
  *)
    echo "Skipping orphan green cleanup (pipeline=$PIPELINE)"
    exit 0
    ;;
esac

if [ -z "$EXECUTION_ID" ]; then
  echo "WARNING: No pipeline execution ID — skipping orphan green cleanup."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Orphan green cleanup (pipeline=$PIPELINE, execution=$EXECUTION_ID) ==="

BLUE_INSTANCE_ID=$(aws ec2 describe-instances \
  --region "$REGION" \
  --filters "Name=tag:Name,Values=$BLUE_TAG" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text 2>/dev/null || echo "")

if [ -z "$BLUE_INSTANCE_ID" ] || [ "$BLUE_INSTANCE_ID" = "None" ]; then
  echo "No running blue instance (Name=$BLUE_TAG) — skip green termination (swap may have partially completed)."
  exit 0
fi

echo "Blue instance still running: $BLUE_INSTANCE_ID"

if [ "$ROLLBACK_MONGO" = "true" ]; then
  echo "Rolling MongoDB volume back to blue if needed..."
  bash "$SCRIPT_DIR/rollback-mongodb-volume-to-blue.sh" "$ROLLBACK_ENV" || \
    echo "⚠️  MongoDB rollback failed (non-fatal)"
fi

export CODEPIPELINE_NAME="$PIPELINE"
export CODEPIPELINE_EXECUTION_ID="$EXECUTION_ID"
export GREEN_TAG
bash "$SCRIPT_DIR/terminate-pipeline-green.sh" || \
  echo "⚠️  Green termination failed (non-fatal)"
