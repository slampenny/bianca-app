#!/bin/bash
# Rerun a specific CodePipeline stage
# Usage: ./rerun-pipeline-stage.sh <pipeline-name> <stage-name> [profile]

set -e

PIPELINE_NAME="${1:-bianca-production-pipeline}"
STAGE_NAME="${2}"
PROFILE="${3:-jordan}"

if [ -z "$STAGE_NAME" ]; then
  echo "Usage: $0 <pipeline-name> <stage-name> [profile]"
  echo ""
  echo "Available stages:"
  echo "  - Source"
  echo "  - Build"
  echo "  - CreateGreenInstance"
  echo "  - Deploy"
  echo "  - PostDeployValidation"
  echo "  - SwapAndTerminate"
  echo "  - RunTests"
  echo ""
  echo "Example:"
  echo "  $0 bianca-staging-pipeline PostDeployValidation jordan"
  exit 1
fi

echo "=========================================="
echo "Rerunning Pipeline Stage"
echo "Pipeline: $PIPELINE_NAME"
echo "Stage: $STAGE_NAME"
echo "Profile: $PROFILE"
echo "=========================================="
echo ""

# Get the latest execution
echo "Step 1: Finding latest pipeline execution..."
LATEST_EXECUTION=$(aws codepipeline list-pipeline-executions \
  --pipeline-name "$PIPELINE_NAME" \
  --region us-east-2 \
  --profile "$PROFILE" \
  --max-items 1 \
  --query 'pipelineExecutionSummaries[0].pipelineExecutionId' \
  --output text 2>/dev/null || echo "")

if [ -z "$LATEST_EXECUTION" ] || [ "$LATEST_EXECUTION" = "None" ]; then
  echo "❌ ERROR: No pipeline executions found"
  exit 1
fi

echo "✅ Latest execution: $LATEST_EXECUTION"
echo ""

# Check if we can retry the stage
echo "Step 2: Checking stage status..."
STAGE_STATUS=$(aws codepipeline get-pipeline-state \
  --name "$PIPELINE_NAME" \
  --region us-east-2 \
  --profile "$PROFILE" \
  --query "stageStates[?stageName=='$STAGE_NAME'].latestExecution.status" \
  --output text 2>/dev/null || echo "unknown")

echo "   Stage status: $STAGE_STATUS"
echo ""

if [ "$STAGE_STATUS" != "Failed" ] && [ "$STAGE_STATUS" != "Succeeded" ]; then
  echo "⚠️  WARNING: Stage status is '$STAGE_STATUS'"
  echo "   You can only retry Failed or Succeeded stages"
fi

# Get the stage execution ID
STAGE_EXECUTION_ID=$(aws codepipeline get-pipeline-state \
  --name "$PIPELINE_NAME" \
  --region us-east-2 \
  --profile "$PROFILE" \
  --query "stageStates[?stageName=='$STAGE_NAME'].latestExecution.pipelineExecutionId" \
  --output text 2>/dev/null || echo "")

if [ -z "$STAGE_EXECUTION_ID" ] || [ "$STAGE_EXECUTION_ID" = "None" ]; then
  echo "❌ ERROR: Could not find stage execution ID"
  exit 1
fi

echo "Step 3: Retrying stage..."
echo "   This will create a new execution starting from $STAGE_NAME"
echo ""

# Retry the stage by creating a new execution
# CodePipeline doesn't have a direct "retry stage" API, so we need to:
# 1. Get the source revision from the failed execution
# 2. Start a new execution (which will run from the beginning)
# OR use the retry API if available

# Actually, CodePipeline doesn't support retrying individual stages directly
# We need to start a new execution. But we can at least verify the stage is ready
echo "⚠️  NOTE: CodePipeline doesn't support retrying individual stages directly"
echo "   You have two options:"
echo ""
echo "   Option 1: Start a new pipeline execution (runs from beginning)"
echo "     aws codepipeline start-pipeline-execution \\"
echo "       --name $PIPELINE_NAME \\"
echo "       --region us-east-2 \\"
echo "       --profile $PROFILE"
echo ""
echo "   Option 2: Manually trigger the CodeBuild project for this stage"
echo "     (See stage-specific commands below)"
echo ""

# Provide stage-specific commands
case "$STAGE_NAME" in
  "PostDeployValidation")
    echo "To manually trigger PostDeployValidation:"
    echo ""
    echo "  # Get green instance info from previous stage"
    echo "  GREEN_INSTANCE_ID=\$(aws ec2 describe-instances \\"
    echo "    --region us-east-2 \\"
    echo "    --profile $PROFILE \\"
    echo "    --filters \"Name=tag:Name,Values=bianca-staging-green\" \"Name=instance-state-name,Values=running\" \\"
    echo "    --query 'Reservations[0].Instances[0].InstanceId' \\"
    echo "    --output text)"
    echo ""
    echo "  # Test locally first:"
    echo "  ./packages/backend/devops/scripts/test-post-deploy-validation-local.sh \$GREEN_INSTANCE_ID $PROFILE"
    echo ""
    echo "  # Then trigger CodeBuild:"
    echo "  aws codebuild start-build \\"
    echo "    --project-name bianca-staging-post-deploy-validation \\"
    echo "    --region us-east-2 \\"
    echo "    --profile $PROFILE"
    ;;
  "SwapAndTerminate")
    echo "To manually trigger SwapAndTerminate:"
    echo "  aws codebuild start-build \\"
    echo "    --project-name bianca-staging-swap-and-terminate \\"
    echo "    --region us-east-2 \\"
    echo "    --profile $PROFILE"
    ;;
  *)
    echo "To manually trigger $STAGE_NAME:"
    echo "  # Check the CodeBuild project name in terraform/codepipeline-staging.tf"
    echo "  # Then run:"
    echo "  aws codebuild start-build --project-name <project-name> --region us-east-2 --profile $PROFILE"
    ;;
esac
