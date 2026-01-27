#!/bin/bash
# Rerun a failed CodePipeline stage by manually triggering CodeBuild
# This works around CodePipeline's limitation of not supporting stage retries

set -e

STAGE_NAME="${1}"
PROFILE="${2:-jordan}"

if [ -z "$STAGE_NAME" ]; then
  echo "Usage: $0 <stage-name> [profile]"
  echo ""
  echo "Available stages:"
  echo "  - PostDeployValidation"
  echo "  - SwapAndTerminate"
  echo ""
  echo "Example:"
  echo "  $0 PostDeployValidation jordan"
  exit 1
fi

echo "=========================================="
echo "Rerunning Failed Stage: $STAGE_NAME"
echo "Profile: $PROFILE"
echo "=========================================="
echo ""

case "$STAGE_NAME" in
  "PostDeployValidation")
    echo "⚠️  NOTE: CodeBuild projects in CodePipeline can't be run directly"
    echo "   They require artifacts from previous pipeline stages"
    echo ""
    echo "   Instead, use the standalone validation script:"
    echo "   ./packages/backend/devops/scripts/run-post-deploy-validation-standalone.sh auto $PROFILE"
    echo ""
    echo "   This runs the exact same validation logic without needing pipeline artifacts"
    exit 0
    ;;
  "SwapAndTerminate")
    echo "⚠️  NOTE: SwapAndTerminate requires green instance info from CreateGreenInstance stage"
    echo ""
    echo "   To rerun this stage, you need to:"
    echo "   1. Ensure green instance exists and is healthy"
    echo "   2. Get instance-info.txt from CreateGreenInstance stage"
    echo "   3. Or manually provide GREEN_INSTANCE_ID and BLUE_INSTANCE_ID"
    echo ""
    echo "   Alternatively, start a new pipeline execution which will run all stages"
    exit 0
    ;;
  *)
    echo "❌ Unknown stage: $STAGE_NAME"
    echo "   Available: PostDeployValidation, SwapAndTerminate"
    exit 1
    ;;
esac
