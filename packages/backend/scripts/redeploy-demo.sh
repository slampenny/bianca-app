#!/bin/bash
# Deploy demo using latest staging build artifacts
# Demo reuses the same CodeDeploy bundle as staging (env is detected on the instance)
# Run this after fixing CodeDeploy scripts so demo deploy can succeed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Deploying Demo (Using Latest Staging Build Artifacts)${NC}"
echo ""

# Configuration - demo uses staging bucket (demo instance has read access)
AWS_REGION="us-east-2"
AWS_PROFILE="jordan"
CODEDEPLOY_APP="bianca-demo"
CODEDEPLOY_GROUP="bianca-demo-ec2"
S3_BUCKET="bianca-codedeploy-artifacts-730335291008"
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

# Find a pipeline execution that has BuildOutput (iterate if needed)
echo -e "${BLUE}🔍 Finding staging pipeline execution with build artifacts...${NC}"
LATEST_EXECUTION=""
BUILD_ARTIFACT_REVISION=""
EXECUTIONS_JSON=$(aws codepipeline list-pipeline-executions \
    --pipeline-name "$PIPELINE_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --max-results 25 \
    --query 'pipelineExecutionSummaries[?status==`Succeeded`]' \
    --output json 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Failed to list pipeline executions${NC}"
    echo "   Output: $EXECUTIONS_JSON"
    exit 1
fi

# Try each successful execution until we find one with BuildOutput
for i in 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    EXEC_ID=$(echo "$EXECUTIONS_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if $i < len(data):
        print(data[$i].get('pipelineExecutionId', ''))
    else:
        print('')
except: print('')
" 2>/dev/null)
    [ -z "$EXEC_ID" ] && break

    EXECUTION_DETAILS=$(aws codepipeline get-pipeline-execution \
        --pipeline-name "$PIPELINE_NAME" \
        --pipeline-execution-id "$EXEC_ID" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --query 'pipelineExecution.artifactRevisions[*].[name,revisionId]' \
        --output json 2>&1)

    BUILD_REV=$(echo "$EXECUTION_DETAILS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for item in data:
        if item[0] == 'BuildOutput':
            print(item[1])
            sys.exit(0)
    print('')
except: print('')
" 2>/dev/null)

    if [ -n "$BUILD_REV" ]; then
        LATEST_EXECUTION="$EXEC_ID"
        BUILD_ARTIFACT_REVISION="$BUILD_REV"
        break
    fi
done

# Fallback: find latest BuildOutput in S3 (CodePipeline uses truncated prefixes e.g. bianca-staging-pipel/BuildOutpu/)
if [ -z "$BUILD_ARTIFACT_REVISION" ] || [ -z "$LATEST_EXECUTION" ]; then
    echo -e "${YELLOW}   No execution had BuildOutput in API; checking S3 for latest artifact...${NC}"
    ARTIFACT_S3_KEY=""
    for prefix in "bianca-staging-pipeline" "bianca-staging-pipel"; do
        for artifact_dir in "BuildOutput" "BuildOutpu"; do
            LIST=$(aws s3 ls "s3://$S3_BUCKET/$prefix/$artifact_dir/" --profile "$AWS_PROFILE" --region "$AWS_REGION" --recursive 2>/dev/null) || true
            if [ -n "$LIST" ]; then
                ARTIFACT_S3_KEY=$(echo "$LIST" | awk '{print $4}' | tail -1)
                if [ -n "$ARTIFACT_S3_KEY" ]; then
                    echo -e "${GREEN}✅ Found build artifact in S3: $ARTIFACT_S3_KEY${NC}"
                    break 2
                fi
            fi
        done
    done
fi

if [ -z "$BUILD_ARTIFACT_REVISION" ] && [ -z "$ARTIFACT_S3_KEY" ]; then
    echo -e "${RED}❌ Error: Could not find BuildOutput artifact${NC}"
    echo "   Tried pipeline execution API and S3 listing."
    echo "   Ensure the staging pipeline has run at least once and the Build stage produced output."
    exit 1
fi

if [ -n "$BUILD_ARTIFACT_REVISION" ] && [ -n "$LATEST_EXECUTION" ]; then
    echo -e "${GREEN}✅ Found build artifacts (execution: $LATEST_EXECUTION)${NC}"
    echo "   Artifact revision: $BUILD_ARTIFACT_REVISION"
    ARTIFACT_S3_KEY="$PIPELINE_NAME/$LATEST_EXECUTION/BuildOutput/$BUILD_ARTIFACT_REVISION.zip"
fi
echo ""

ARTIFACT_S3_URI="s3://$S3_BUCKET/$ARTIFACT_S3_KEY"
echo -e "${BLUE}📥 Verifying artifact exists in S3...${NC}"
if aws s3 ls "$ARTIFACT_S3_URI" --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Artifact found: $ARTIFACT_S3_URI${NC}"
else
    echo -e "${RED}❌ Error: Artifact not found at $ARTIFACT_S3_URI${NC}"
    exit 1
fi
echo ""

# Create CodeDeploy deployment to demo
echo -e "${BLUE}🚀 Creating CodeDeploy deployment to demo...${NC}"
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
                echo -e "${GREEN}✅ Demo deployment successful!${NC}"
                echo ""
                echo -e "${GREEN}📊 Demo:${NC}"
                echo -e "   🌐 Frontend: ${YELLOW}https://demo.biancawellness.com${NC}"
                echo -e "   📡 API: ${YELLOW}https://demo.biancawellness.com/v1${NC}"
                echo ""
                echo -e "${BLUE}💡 To reset demo data: yarn demo:up (or POST /v1/demo/reset)${NC}"
                break
                ;;
            "Failed"|"Stopped")
                echo -e "${RED}   Status: $STATUS${NC}"
                echo ""
                echo -e "${RED}❌ Deployment failed!${NC}"

                ERROR_MSG=$(aws deploy get-deployment \
                    --deployment-id "$DEPLOYMENT_ID" \
                    --profile "$AWS_PROFILE" \
                    --region "$AWS_REGION" \
                    --query 'deploymentInfo.errorInformation.message' \
                    --output text 2>&1)

                if [ -n "$ERROR_MSG" ] && [ "$ERROR_MSG" != "None" ]; then
                    echo "   Error: $ERROR_MSG"
                fi

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
echo "   Deployment ID: $DEPLOYMENT_ID"
echo "   View in AWS Console:"
echo "   https://console.aws.amazon.com/codesuite/codedeploy/deployments/$DEPLOYMENT_ID?region=$AWS_REGION"
