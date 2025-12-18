#!/bin/bash
# Quick test script to deploy CodeDeploy scripts without waiting for full pipeline
# Usage: ./test-deploy.sh

set -e

echo "🧪 Testing CodeDeploy deployment directly..."

# Configuration
APPLICATION_NAME="bianca-staging"
DEPLOYMENT_GROUP="bianca-staging-ec2"
REGION="us-east-2"
S3_BUCKET="bianca-codedeploy-artifacts-730335291008"  # Staging artifacts bucket
PROFILE="jordan"

# Get the backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ROOT_DIR="$(cd "$BACKEND_DIR/../.." && pwd)"

echo "   Backend directory: $BACKEND_DIR"
echo "   Root directory: $ROOT_DIR"

# Create temporary directory for artifacts
TEMP_DIR=$(mktemp -d)
echo "   Temp directory: $TEMP_DIR"

# Cleanup function
cleanup() {
  echo "   Cleaning up temp directory..."
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Copy CodeDeploy artifacts
echo "   Packaging CodeDeploy artifacts..."
cd "$BACKEND_DIR"

# Copy appspec.yml
cp devops/codedeploy/appspec.yml "$TEMP_DIR/appspec.yml"
echo "   ✅ Copied appspec.yml"

# Copy scripts
mkdir -p "$TEMP_DIR/scripts"
cp devops/codedeploy/scripts/*.sh "$TEMP_DIR/scripts/"
chmod +x "$TEMP_DIR/scripts"/*.sh
echo "   ✅ Copied scripts ($(ls -1 "$TEMP_DIR/scripts" | wc -l) files)"

# Create a revision file (CodeDeploy needs this structure)
cd "$TEMP_DIR"
tar -czf revision.tar.gz appspec.yml scripts/

# Upload to S3
REVISION_KEY="test-deployments/$(date +%Y%m%d-%H%M%S)/revision.tar.gz"
echo "   Uploading to S3: s3://$S3_BUCKET/$REVISION_KEY"
aws s3 cp revision.tar.gz "s3://$S3_BUCKET/$REVISION_KEY" --profile "$PROFILE" --region "$REGION"
echo "   ✅ Uploaded to S3"

# Create deployment
echo "   Creating CodeDeploy deployment..."
DEPLOYMENT_ID=$(aws deploy create-deployment \
  --application-name "$APPLICATION_NAME" \
  --deployment-group-name "$DEPLOYMENT_GROUP" \
  --s3-location bucket="$S3_BUCKET",key="$REVISION_KEY",bundleType=tar \
  --profile "$PROFILE" \
  --region "$REGION" \
  --output text \
  --query 'deploymentId')

echo "   ✅ Deployment created: $DEPLOYMENT_ID"
echo ""
echo "📊 Monitor deployment:"
echo "   AWS Console: https://console.aws.amazon.com/codedeploy/home?region=$REGION#/deployments/$DEPLOYMENT_ID"
echo ""
echo "   Or watch with:"
echo "   aws deploy get-deployment --deployment-id $DEPLOYMENT_ID --profile $PROFILE --region $REGION"
echo ""
echo "   Or tail logs:"
echo "   aws deploy get-deployment-instance --deployment-id $DEPLOYMENT_ID --instance-id i-07d3946107e994de6 --profile $PROFILE --region $REGION"

# Optionally wait and show status
read -p "   Wait for deployment to complete? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "   Waiting for deployment..."
  aws deploy wait deployment-successful \
    --deployment-id "$DEPLOYMENT_ID" \
    --profile "$PROFILE" \
    --region "$REGION" || {
    echo "   ❌ Deployment failed!"
    echo "   Checking status..."
    aws deploy get-deployment --deployment-id "$DEPLOYMENT_ID" --profile "$PROFILE" --region "$REGION" --output json | jq '{status: .deploymentInfo.status, errorInformation: .deploymentInfo.errorInformation}'
    exit 1
  }
  echo "   ✅ Deployment succeeded!"
fi
