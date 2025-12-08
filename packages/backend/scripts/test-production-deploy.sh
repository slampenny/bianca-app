#!/bin/bash
# Test production deployment by manually packaging artifacts
# This creates artifacts from current codebase and deploys them
# Useful when pipeline artifacts aren't available

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Production Deployment (Manual Artifact Packaging)${NC}"
echo ""

# Configuration
AWS_REGION="us-east-2"
AWS_PROFILE="jordan"
CODEDEPLOY_APP="bianca-production"
CODEDEPLOY_GROUP="bianca-production-ec2"
S3_BUCKET="bianca-codedeploy-production-artifacts-730335291008"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if we're in the backend repo
if [ ! -d "$REPO_ROOT/devops/codedeploy" ]; then
    echo -e "${RED}❌ Error: devops/codedeploy directory not found${NC}"
    echo "   Please run this script from the bianca-app-backend repository"
    exit 1
fi

# Check AWS credentials
echo -e "${BLUE}🔐 Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: AWS credentials not configured${NC}"
    exit 1
fi
echo -e "${GREEN}✅ AWS credentials OK${NC}"
echo ""

# Create temporary directory for artifacts
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${BLUE}📦 Packaging CodeDeploy artifacts from current codebase...${NC}"

# Copy appspec.yml
if [ ! -f "$REPO_ROOT/devops/codedeploy/appspec.yml" ]; then
    echo -e "${RED}❌ Error: appspec.yml not found${NC}"
    exit 1
fi
cp "$REPO_ROOT/devops/codedeploy/appspec.yml" "$TEMP_DIR/"

# Copy scripts directory (same as buildspec does)
if [ ! -d "$REPO_ROOT/devops/codedeploy/scripts" ]; then
    echo -e "${RED}❌ Error: scripts directory not found${NC}"
    exit 1
fi
mkdir -p "$TEMP_DIR/scripts"
cp -r "$REPO_ROOT/devops/codedeploy/scripts"/* "$TEMP_DIR/scripts/"
chmod +x "$TEMP_DIR/scripts"/*.sh

echo -e "${GREEN}✅ Artifacts packaged${NC}"
echo "   Files:"
ls -la "$TEMP_DIR" | tail -n +2
ls -la "$TEMP_DIR/scripts" | tail -n +2
echo ""

# Create deployment revision
echo -e "${BLUE}📤 Uploading artifacts to S3...${NC}"
DEPLOYMENT_KEY="test-deploy-$(date +%Y%m%d-%H%M%S).zip"

cd "$TEMP_DIR"
zip -r "$TEMP_DIR/deployment.zip" . >/dev/null

# Upload to S3
aws s3 cp "$TEMP_DIR/deployment.zip" \
    "s3://$S3_BUCKET/$DEPLOYMENT_KEY" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Failed to upload artifacts to S3${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Artifacts uploaded to S3${NC}"
echo "   S3 Key: $DEPLOYMENT_KEY"
echo ""

# Create CodeDeploy deployment
echo -e "${BLUE}🚀 Creating CodeDeploy deployment...${NC}"
DEPLOYMENT_ID=$(aws deploy create-deployment \
    --application-name "$CODEDEPLOY_APP" \
    --deployment-group-name "$CODEDEPLOY_GROUP" \
    --s3-location bucket="$S3_BUCKET",key="$DEPLOYMENT_KEY",bundleType=zip \
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
echo ""

# Monitor deployment
echo -e "${BLUE}📊 Monitoring deployment...${NC}"
echo "   (Press Ctrl+C to stop monitoring, but deployment will continue)"
echo ""

PREVIOUS_STATUS=""
FAILED_EVENTS=""
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
                # Check instance status for more details
                INSTANCE_STATUS=$(aws deploy list-deployment-instances \
                    --deployment-id "$DEPLOYMENT_ID" \
                    --profile "$AWS_PROFILE" \
                    --region "$AWS_REGION" \
                    --query 'instancesList[0]' \
                    --output text 2>&1 | head -1)
                
                if [ -n "$INSTANCE_STATUS" ] && [ "$INSTANCE_STATUS" != "None" ]; then
                    echo "   Instance: $INSTANCE_STATUS"
                fi
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
                
                # Get instance status and lifecycle events
                echo ""
                echo "   Instance deployment status:"
                PROD_INSTANCE="i-0a2c5b5ad1c61d4c4"
                aws deploy get-deployment-instance \
                    --deployment-id "$DEPLOYMENT_ID" \
                    --instance-id "$PROD_INSTANCE" \
                    --profile "$AWS_PROFILE" \
                    --region "$AWS_REGION" \
                    --query 'instanceSummary.[instanceStatus,lifecycleEvents[*].[lifecycleEventName,status,diagnostics.errorCode,diagnostics.message]]' \
                    --output json 2>&1 | python3 -m json.tool || true
                
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
echo -e "${GREEN}🎉 Production deployment test complete!${NC}"
echo ""
echo "   Deployment ID: $DEPLOYMENT_ID"
echo "   View in AWS Console:"
echo "   https://console.aws.amazon.com/codesuite/codedeploy/deployments/$DEPLOYMENT_ID?region=$AWS_REGION"

