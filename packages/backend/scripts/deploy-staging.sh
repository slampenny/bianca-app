#!/bin/bash
# Deploy staging via AWS CodePipeline
# This script pushes to staging branch and monitors the CodePipeline deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Deploying to Staging via AWS CodePipeline${NC}"
echo ""

# Configuration
AWS_REGION="us-east-2"
AWS_PROFILE="jordan"
PIPELINE_NAME="bianca-staging-pipeline"

# Check if we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo -e "${BLUE}📍 Current branch: ${CURRENT_BRANCH}${NC}"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo -e "${YELLOW}⚠️  WARNING: You have uncommitted changes!${NC}"
    echo "   These will NOT be deployed. Only committed changes will be pushed."
    read -p "   Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Deployment cancelled."
        exit 1
    fi
fi

# Determine deployment mode
DEPLOY_FROM_CURRENT_BRANCH=false

if [ "$CURRENT_BRANCH" != "staging" ]; then
    echo -e "${YELLOW}⚠️  You're on '$CURRENT_BRANCH', not 'staging'${NC}"
    echo "   Options:"
    echo "   1. Deploy directly from '$CURRENT_BRANCH' (without merging to staging)"
    echo "   2. Switch to staging branch and merge your changes"
    read -p "   Deploy from current branch? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        DEPLOY_FROM_CURRENT_BRANCH=true
        echo -e "${BLUE}✅ Will deploy from '$CURRENT_BRANCH' branch${NC}"
        echo -e "${YELLOW}⚠️  Note: CodePipeline is configured for 'staging' branch. You may need to manually trigger the pipeline.${NC}"
    else
        # Stash any uncommitted changes
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            echo "   Stashing uncommitted changes..."
            git stash
            STASHED=true
        fi
        
        # Switch to staging
        git checkout staging 2>/dev/null || git checkout -b staging
        
        # Merge current branch into staging
        if [ "$CURRENT_BRANCH" != "staging" ]; then
            echo "   Merging $CURRENT_BRANCH into staging..."
            git merge "$CURRENT_BRANCH" --no-edit || {
                echo -e "${RED}❌ Merge conflict! Please resolve manually.${NC}"
                [ "$STASHED" = true ] && git stash pop
                exit 1
            }
        fi
        
        # Restore stashed changes
        [ "$STASHED" = true ] && git stash pop
    fi
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found!${NC}"
    echo ""
    echo "   Install it:"
    echo "   • Ubuntu/Debian: sudo apt install awscli"
    echo "   • Or: https://aws.amazon.com/cli/"
    exit 1
fi

# Check AWS credentials
echo -e "${BLUE}🔐 Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "   Please run: aws configure --profile $AWS_PROFILE"
    exit 1
fi
echo -e "${GREEN}✅ AWS credentials OK${NC}"
echo ""

# Push to staging branch
if [ "$DEPLOY_FROM_CURRENT_BRANCH" = true ]; then
    echo ""
    echo -e "${BLUE}📤 Pushing '$CURRENT_BRANCH' branch to remote...${NC}"
    if ! git push origin "$CURRENT_BRANCH" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Branch '$CURRENT_BRANCH' not on remote yet, pushing...${NC}"
        git push -u origin "$CURRENT_BRANCH" || {
            echo -e "${RED}❌ Push failed!${NC}"
            exit 1
        }
    fi
    echo -e "${GREEN}✅ Push successful!${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Note: CodePipeline is configured for 'staging' branch.${NC}"
    echo "   To deploy from this branch, you'll need to manually trigger the pipeline or merge to staging."
else
    # Traditional deployment: push to staging branch
    echo ""
    echo -e "${BLUE}📤 Pushing to staging branch...${NC}"
    if git push origin staging; then
        echo -e "${GREEN}✅ Push successful!${NC}"
        echo ""
        echo -e "${BLUE}⏳ CodePipeline should trigger automatically...${NC}"
    else
        echo -e "${RED}❌ Push failed!${NC}"
        exit 1
    fi
fi

# Wait a moment for CodePipeline to start
echo ""
echo -e "${BLUE}⏳ Waiting for CodePipeline to start...${NC}"
sleep 5

# Check pipeline status
echo ""
echo -e "${BLUE}🔍 Checking CodePipeline status...${NC}"
if ! aws codepipeline get-pipeline --name "$PIPELINE_NAME" --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Pipeline '$PIPELINE_NAME' not found or not accessible${NC}"
    echo "   Deployment may still be in progress via auto-trigger"
    echo ""
    echo -e "${BLUE}💡 You can check pipeline status manually:${NC}"
    echo "   aws codepipeline list-pipeline-executions \\"
    echo "     --pipeline-name $PIPELINE_NAME \\"
    echo "     --profile $AWS_PROFILE \\"
    echo "     --region $AWS_REGION"
    echo ""
    echo -e "${BLUE}🔗 Or view in AWS Console:${NC}"
    echo "   https://${AWS_REGION}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${PIPELINE_NAME}/view?region=${AWS_REGION}"
    exit 0
fi

# Get latest pipeline execution
LATEST_EXECUTION=$(aws codepipeline list-pipeline-executions \
    --pipeline-name "$PIPELINE_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --max-results 1 \
    --query 'pipelineExecutionSummaries[0]' \
    --output json 2>/dev/null)

if [ -n "$LATEST_EXECUTION" ] && [ "$LATEST_EXECUTION" != "null" ]; then
    EXECUTION_ID=$(echo "$LATEST_EXECUTION" | grep -o '"pipelineExecutionId":"[^"]*"' | cut -d'"' -f4)
    STATUS=$(echo "$LATEST_EXECUTION" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    START_TIME=$(echo "$LATEST_EXECUTION" | grep -o '"startTime":"[^"]*"' | cut -d'"' -f4)
    
    echo -e "${GREEN}✅ Found pipeline execution: $EXECUTION_ID${NC}"
    echo "   Status: $STATUS"
    echo "   Started: $START_TIME"
    echo ""
    
    if [ "$STATUS" = "Succeeded" ]; then
        echo -e "${GREEN}✅ Deployment successful!${NC}"
    elif [ "$STATUS" = "InProgress" ]; then
        echo -e "${YELLOW}⏳ Deployment is still running...${NC}"
        echo ""
        echo -e "${BLUE}💡 Monitor progress:${NC}"
        echo "   aws codepipeline get-pipeline-execution \\"
        echo "     --pipeline-name $PIPELINE_NAME \\"
        echo "     --pipeline-execution-id $EXECUTION_ID \\"
        echo "     --profile $AWS_PROFILE \\"
        echo "     --region $AWS_REGION"
    elif [ "$STATUS" = "Failed" ]; then
        echo -e "${RED}❌ Deployment failed!${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}🔗 View in AWS Console:${NC}"
    echo "   https://${AWS_REGION}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${PIPELINE_NAME}/executions/${EXECUTION_ID}/timeline?region=${AWS_REGION}"
else
    echo -e "${YELLOW}⚠️  No pipeline executions found yet${NC}"
    echo "   The pipeline may still be starting, or it may not have triggered automatically."
    echo ""
    echo -e "${BLUE}💡 You can manually trigger the pipeline:${NC}"
    echo "   ./packages/backend/scripts/trigger-staging-pipeline.sh"
    echo ""
    echo -e "${BLUE}🔗 Or view in AWS Console:${NC}"
    echo "   https://${AWS_REGION}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${PIPELINE_NAME}/view?region=${AWS_REGION}"
fi

echo ""
echo -e "${GREEN}🌐 Staging API: https://staging-api.biancawellness.com${NC}"
echo -e "${GREEN}🌐 Staging Frontend: https://staging.biancawellness.com${NC}"
echo -e "${GREEN}📊 PostHog Analytics: https://staging-analytics.biancawellness.com${NC}"
echo ""
echo -e "${YELLOW}⏳ Pipeline typically takes 7-10 minutes to complete${NC}"
