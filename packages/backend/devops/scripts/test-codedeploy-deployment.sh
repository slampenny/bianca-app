#!/bin/bash
# Test a CodeDeploy deployment directly to an instance
# This allows testing deployments without running the full pipeline

set -e

INSTANCE_ID="${1}"
PROFILE="${2:-jordan}"
APP_NAME="${3:-bianca-staging}"
DEPLOYMENT_GROUP="${4:-bianca-staging-green-ec2}"

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "auto" ]; then
    echo "Usage: $0 <instance-id> [aws-profile] [app-name] [deployment-group]"
    echo ""
    echo "Example:"
    echo "  $0 i-0123456789abcdef0 jordan bianca-staging bianca-staging-green-ec2"
    echo ""
    echo "This will:"
    echo "  1. Create a revision from the current code"
    echo "  2. Deploy it directly to the specified instance"
    echo "  3. Monitor the deployment status"
    exit 1
fi

echo "=========================================="
echo "Testing CodeDeploy Deployment"
echo "Instance: $INSTANCE_ID"
echo "Application: $APP_NAME"
echo "Deployment Group: $DEPLOYMENT_GROUP"
echo "Profile: $PROFILE"
echo "=========================================="
echo ""

# First, verify agent is ready (quick check)
echo "Step 1: Verifying CodeDeploy agent readiness..."
AGENT_ACTIVE=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["sudo systemctl is-active codedeploy-agent 2>&1 || echo inactive"]' \
    --profile "$PROFILE" \
    --query 'Command.CommandId' \
    --output text)

sleep 3
AGENT_STATUS=$(aws ssm get-command-invocation \
    --command-id "$AGENT_ACTIVE" \
    --instance-id "$INSTANCE_ID" \
    --profile "$PROFILE" \
    --query 'StandardOutputContent' \
    --output text 2>/dev/null | grep -q "active" && echo "active" || echo "inactive")

if [ "$AGENT_STATUS" != "active" ]; then
    echo "❌ CodeDeploy agent is not active. Run test-codedeploy-readiness.sh for details."
    exit 1
fi
echo "✅ Agent is active"
echo ""

# Check if we're in the right directory
if [ ! -f "packages/backend/devops/codedeploy/appspec.yml" ]; then
    echo "❌ ERROR: appspec.yml not found. Run this from the project root."
    exit 1
fi

# Create a deployment bundle
echo "Step 2: Creating deployment bundle..."
BUNDLE_DIR="/tmp/codedeploy-test-$(date +%s)"
mkdir -p "$BUNDLE_DIR"

# Copy appspec and scripts
cp packages/backend/devops/codedeploy/appspec.yml "$BUNDLE_DIR/"
cp -r packages/backend/devops/codedeploy/scripts "$BUNDLE_DIR/"

# Create a minimal docker-compose.yml for testing (or copy from somewhere)
# For now, we'll just create an empty one as a placeholder
if [ ! -f "$BUNDLE_DIR/docker-compose.yml" ]; then
    echo "# Placeholder docker-compose.yml for testing" > "$BUNDLE_DIR/docker-compose.yml"
fi

# Create zip bundle using Python (more portable than zip command)
BUNDLE_ZIP="/tmp/codedeploy-bundle-$(date +%s).zip"
python3 << EOF
import os
import zipfile
import sys

bundle_dir = "$BUNDLE_DIR"
bundle_zip = "$BUNDLE_ZIP"

with zipfile.ZipFile(bundle_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(bundle_dir):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, bundle_dir)
            zipf.write(file_path, arcname)

print(f"Created {bundle_zip}")
EOF

echo "✅ Bundle created: $BUNDLE_ZIP"
echo ""

# Upload to S3 (CodeDeploy requires S3)
echo "Step 3: Uploading bundle to S3..."
S3_BUCKET="bianca-codedeploy-artifacts-730335291008"
S3_KEY="test-deployments/$(basename $BUNDLE_ZIP)"

aws s3 cp "$BUNDLE_ZIP" "s3://${S3_BUCKET}/${S3_KEY}" --profile "$PROFILE"
echo "✅ Uploaded to s3://${S3_BUCKET}/${S3_KEY}"
echo ""

# Create deployment
echo "Step 4: Creating CodeDeploy deployment..."
DEPLOYMENT_ID=$(aws deploy create-deployment \
    --application-name "$APP_NAME" \
    --deployment-group-name "$DEPLOYMENT_GROUP" \
    --s3-location bucket="${S3_BUCKET}",key="${S3_KEY}",bundleType=zip \
    --profile "$PROFILE" \
    --query 'deploymentId' \
    --output text)

echo "✅ Deployment created: $DEPLOYMENT_ID"
echo "   View in console: https://console.aws.amazon.com/codedeploy/home?region=us-east-2#/deployments/$DEPLOYMENT_ID"
echo ""

# Monitor deployment
echo "Step 5: Monitoring deployment (this may take a few minutes)..."
echo ""

MAX_WAIT=600  # 10 minutes
ELAPSED=0
POLL_INTERVAL=10

while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS=$(aws deploy get-deployment \
        --deployment-id "$DEPLOYMENT_ID" \
        --profile "$PROFILE" \
        --query 'deploymentInfo.status' \
        --output text 2>/dev/null || echo "Unknown")
    
    case "$STATUS" in
        "Succeeded")
            echo "✅ Deployment SUCCEEDED!"
            echo ""
            echo "The deployment completed successfully."
            rm -rf "$BUNDLE_DIR" "$BUNDLE_ZIP"
            exit 0
            ;;
        "Failed"|"Stopped")
            echo "❌ Deployment FAILED"
            echo ""
            echo "Getting error details..."
            aws deploy get-deployment \
                --deployment-id "$DEPLOYMENT_ID" \
                --profile "$PROFILE" \
                --query 'deploymentInfo.errorInformation' \
                --output json | python3 -m json.tool
            
            echo ""
            echo "Instance details:"
            INSTANCE_STATUS=$(aws deploy get-deployment-instance \
                --deployment-id "$DEPLOYMENT_ID" \
                --instance-id "$INSTANCE_ID" \
                --profile "$PROFILE" \
                --query 'instanceSummary.[instanceStatus,lifecycleEvents[?status==`Failed`]]' \
                --output json 2>/dev/null || echo "[]")
            echo "$INSTANCE_STATUS" | python3 -m json.tool
            
            rm -rf "$BUNDLE_DIR" "$BUNDLE_ZIP"
            exit 1
            ;;
        "InProgress"|"Created"|"Queued"|"Ready")
            echo "   Status: $STATUS (${ELAPSED}s/${MAX_WAIT}s)..."
            ;;
        *)
            echo "   Status: $STATUS (${ELAPSED}s/${MAX_WAIT}s)..."
            ;;
    esac
    
    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

echo "⏱️  Deployment monitoring timed out after $MAX_WAIT seconds"
echo "Check status manually:"
echo "  aws deploy get-deployment --deployment-id $DEPLOYMENT_ID --profile $PROFILE"
rm -rf "$BUNDLE_DIR" "$BUNDLE_ZIP"
exit 1
