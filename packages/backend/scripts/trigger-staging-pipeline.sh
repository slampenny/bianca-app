#!/bin/bash
# Manually trigger AWS CodePipeline for staging
# This ensures the pipeline runs even if auto-trigger didn't work

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Manually Triggering Staging Pipeline${NC}"
echo ""

# Configuration
AWS_REGION="us-east-2"
AWS_PROFILE="jordan"
PIPELINE_NAME="bianca-staging-pipeline"

# Check AWS credentials
echo -e "${BLUE}🔐 Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: AWS credentials not configured${NC}"
    echo "   Please run: aws configure --profile $AWS_PROFILE"
    exit 1
fi
echo -e "${GREEN}✅ AWS credentials OK${NC}"
echo ""

# Check if pipeline exists
echo -e "${BLUE}🔍 Checking pipeline status...${NC}"
if ! aws codepipeline get-pipeline --name "$PIPELINE_NAME" --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${RED}❌ Pipeline '$PIPELINE_NAME' not found!${NC}"
    echo ""
    echo "   Available pipelines:"
    aws codepipeline list-pipelines --profile "$AWS_PROFILE" --region "$AWS_REGION" --query 'pipelines[*].name' --output table
    exit 1
fi

# Get current pipeline state
echo -e "${BLUE}📊 Current pipeline state:${NC}"
aws codepipeline get-pipeline-state \
    --name "$PIPELINE_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'stageStates[*].[stageName,latestExecution.status,latestExecution.lastStatusChange]' \
    --output table

echo ""
echo -e "${BLUE}🚀 Triggering pipeline execution...${NC}"

# Start pipeline execution
EXECUTION_ID=$(aws codepipeline start-pipeline-execution \
    --name "$PIPELINE_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'pipelineExecutionId' \
    --output text 2>&1)

if [ $? -eq 0 ] && [ -n "$EXECUTION_ID" ]; then
    echo -e "${GREEN}✅ Pipeline execution started!${NC}"
    echo ""
    echo -e "${BLUE}📋 Execution ID: ${EXECUTION_ID}${NC}"
    echo ""
    echo -e "${BLUE}🔗 View in AWS Console:${NC}"
    echo "   https://${AWS_REGION}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${PIPELINE_NAME}/executions/${EXECUTION_ID}/timeline?region=${AWS_REGION}"
    echo ""
    echo -e "${BLUE}💡 Monitor progress:${NC}"
    echo "   aws codepipeline get-pipeline-execution \\"
    echo "     --pipeline-name $PIPELINE_NAME \\"
    echo "     --pipeline-execution-id $EXECUTION_ID \\"
    echo "     --profile $AWS_PROFILE \\"
    echo "     --region $AWS_REGION"
    echo ""
    echo -e "${YELLOW}⏳ Pipeline typically takes 7-10 minutes to complete${NC}"
else
    echo -e "${RED}❌ Failed to trigger pipeline${NC}"
    echo "$EXECUTION_ID"
    exit 1
fi



