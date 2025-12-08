#!/bin/bash
# Redeploy production using latest build artifacts
# This reuses artifacts from the last successful pipeline build
# Perfect for debugging deploy stage without waiting 20 minutes for builds

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Redeploying Production (Using Latest Build Artifacts)${NC}"
echo ""

# Configuration
AWS_REGION="us-east-2"
AWS_PROFILE="jordan"
CODEDEPLOY_APP="bianca-production"
CODEDEPLOY_GROUP="bianca-production-ec2"
S3_BUCKET="bianca-codedeploy-production-artifacts-730335291008"
PIPELINE_NAME="bianca-production-pipeline"

# Check AWS credentials
echo -e "${BLUE}🔐 Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: AWS credentials not configured${NC}"
    echo "   Please run: aws configure --profile $AWS_PROFILE"
    exit 1
fi
echo -e "${GREEN}✅ AWS credentials OK${NC}"
echo ""

# Find latest successful pipeline execution
echo -e "${BLUE}🔍 Finding latest successful pipeline execution...${NC}"
LATEST_EXECUTION=$(aws codepipeline list-pipeline-executions \
    --pipeline-name "$PIPELINE_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --max-results 10 \
    --query 'pipelineExecutionSummaries[?status==`Succeeded`] | [0].pipelineExecutionId' \
    --output text 2>&1)

if [ -z "$LATEST_EXECUTION" ] || [ "$LATEST_EXECUTION" == "None" ]; then
    echo -e "${YELLOW}⚠️  No successful pipeline executions found${NC}"
    echo "   Looking for any recent execution..."
    
    LATEST_EXECUTION=$(aws codepipeline list-pipeline-executions \
        --pipeline-name "$PIPELINE_NAME" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --max-results 1 \
        --query 'pipelineExecutionSummaries[0].pipelineExecutionId' \
        --output text 2>&1)
    
    if [ -z "$LATEST_EXECUTION" ] || [ "$LATEST_EXECUTION" == "None" ]; then
        echo -e "${RED}❌ No pipeline executions found${NC}"
        echo "   Please run the pipeline at least once first"
        exit 1
    fi
    
    echo -e "${YELLOW}   Using latest execution (may not be successful): $LATEST_EXECUTION${NC}"
else
    echo -e "${GREEN}✅ Found successful execution: $LATEST_EXECUTION${NC}"
fi
echo ""

# Get execution details to find artifact location
echo -e "${BLUE}📦 Locating build artifacts...${NC}"
EXECUTION_DETAILS=$(aws codepipeline get-pipeline-execution \
    --pipeline-name "$PIPELINE_NAME" \
    --pipeline-execution-id "$LATEST_EXECUTION" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'pipelineExecution.artifactRevisions[*].[name,revisionId]' \
    --output json 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Failed to get pipeline execution details${NC}"
    echo "   Output: $EXECUTION_DETAILS"
    exit 1
fi

# Find BuildOutput artifact
BUILD_ARTIFACT_REVISION=$(echo "$EXECUTION_DETAILS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for item in data:
        if item[0] == 'BuildOutput':
            print(item[1])
            sys.exit(0)
    print('')
except:
    print('')
" 2>/dev/null)

if [ -z "$BUILD_ARTIFACT_REVISION" ]; then
    echo -e "${RED}❌ Error: Could not find BuildOutput artifact${NC}"
    echo "   Execution details: $EXECUTION_DETAILS"
    exit 1
fi

echo -e "${GREEN}✅ Found build artifacts${NC}"
echo "   Artifact revision: $BUILD_ARTIFACT_REVISION"
echo ""

# CodePipeline stores artifacts in S3 with a specific structure
# Format: s3://bucket/pipeline-name/execution-id/artifact-name/artifact-revision.zip
ARTIFACT_S3_KEY="$PIPELINE_NAME/$LATEST_EXECUTION/BuildOutput/$BUILD_ARTIFACT_REVISION.zip"
ARTIFACT_S3_URI="s3://$S3_BUCKET/$ARTIFACT_S3_KEY"

echo -e "${BLUE}📥 Verifying artifact exists in S3...${NC}"
if aws s3 ls "$ARTIFACT_S3_URI" --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Artifact found: $ARTIFACT_S3_URI${NC}"
else
    echo -e "${YELLOW}⚠️  Artifact not found at expected location${NC}"
    echo "   Trying alternative locations..."
    
    # Try to find the artifact by listing S3
    ALTERNATIVE_KEY=$(aws s3 ls "s3://$S3_BUCKET/$PIPELINE_NAME/$LATEST_EXECUTION/BuildOutput/" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --recursive \
        --query 'Contents[-1].Key' \
        --output text 2>&1 | head -1)
    
    if [ -n "$ALTERNATIVE_KEY" ] && [ "$ALTERNATIVE_KEY" != "None" ]; then
        ARTIFACT_S3_KEY="$ALTERNATIVE_KEY"
        ARTIFACT_S3_URI="s3://$S3_BUCKET/$ARTIFACT_S3_KEY"
        echo -e "${GREEN}✅ Found artifact at: $ARTIFACT_S3_URI${NC}"
    else
        echo -e "${RED}❌ Error: Could not find build artifacts in S3${NC}"
        echo "   Expected location: s3://$S3_BUCKET/$ARTIFACT_S3_KEY"
        echo "   Please ensure the pipeline has run at least once"
        exit 1
    fi
fi
echo ""

# Create CodeDeploy deployment using the existing artifact
echo -e "${BLUE}🚀 Creating CodeDeploy deployment...${NC}"
DEPLOYMENT_ID=$(aws deploy create-deployment \
    --application-name "$CODEDEPLOY_APP" \
    --deployment-group-name "$CODEDEPLOY_GROUP" \
    --s3-location bucket="$S3_BUCKET",key="$ARTIFACT_S3_KEY",bundleType=zip \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'deploymentId' \
    --output text 2>&1)

if [ $? -ne 0 ] || [ -z "$DEPLOYMENT_ID" ] || echo "$DEPLOYMENT_ID" | grep -qi "error"; then
    echo -e "${RED}❌ Error: Failed to create deployment${NC}"
    echo "   Output: $DEPLOYMENT_ID"
    exit 1
fi

echo -e "${GREEN}✅ Deployment created${NC}"
echo "   Deployment ID: $DEPLOYMENT_ID"
echo "   Using artifacts from execution: $LATEST_EXECUTION"
echo ""

# Monitor deployment
echo -e "${BLUE}📊 Monitoring deployment...${NC}"
echo "   (Press Ctrl+C to stop monitoring, but deployment will continue)"
echo ""

PREVIOUS_STATUS=""
while true; do
    STATUS=$(aws deploy get-deployment \
        --deployment-id "$DEPLOYMENT_ID" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --query 'deploymentInfo.status' \
        --output text 2>&1)
    
    if [ "$STATUS" != "$PREVIOUS_STATUS" ]; then
        case "$STATUS" in
            "Created")
                echo -e "${BLUE}   Status: Created${NC}"
                ;;
            "Queued")
                echo -e "${BLUE}   Status: Queued${NC}"
                ;;
            "InProgress")
                echo -e "${YELLOW}   Status: In Progress${NC}"
                ;;
            "Succeeded")
                echo -e "${GREEN}   Status: Succeeded${NC}"
                echo ""
                echo -e "${GREEN}✅ Deployment successful!${NC}"
                break
                ;;
            "Failed"|"Stopped")
                echo -e "${RED}   Status: $STATUS${NC}"
                echo ""
                echo -e "${RED}❌ Deployment failed!${NC}"
                
                # Get error details
                ERROR_MSG=$(aws deploy get-deployment \
                    --deployment-id "$DEPLOYMENT_ID" \
                    --profile "$AWS_PROFILE" \
                    --region "$AWS_REGION" \
                    --query 'deploymentInfo.errorInformation.message' \
                    --output text 2>&1)
                
                if [ -n "$ERROR_MSG" ] && [ "$ERROR_MSG" != "None" ]; then
                    echo "   Error: $ERROR_MSG"
                fi
                
                # Get instance status
                echo ""
                echo "   Instance deployment status:"
                aws deploy list-deployment-instances \
                    --deployment-id "$DEPLOYMENT_ID" \
                    --profile "$AWS_PROFILE" \
                    --region "$AWS_REGION" \
                    --query 'instancesList[*].[instanceId,instanceStatus]' \
                    --output table 2>&1 | head -20
                
                exit 1
                ;;
            *)
                echo "   Status: $STATUS"
                ;;
        esac
        PREVIOUS_STATUS="$STATUS"
    fi
    
    sleep 5
done

echo ""
echo -e "${GREEN}🎉 Production deployment complete!${NC}"
echo ""
echo "   Deployment ID: $DEPLOYMENT_ID"
echo "   View in AWS Console:"
echo "   https://console.aws.amazon.com/codesuite/codedeploy/deployments/$DEPLOYMENT_ID?region=$AWS_REGION"

