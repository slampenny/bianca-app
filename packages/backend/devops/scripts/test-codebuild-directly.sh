#!/bin/bash
# Test CodeBuild project directly without running full pipeline
# This allows quick iteration without waiting for entire pipeline

set -e

PROJECT_NAME="bianca-staging-create-green-instance"
BRANCH="staging"

echo "=========================================="
echo "Testing CodeBuild project directly"
echo "Project: $PROJECT_NAME"
echo "Branch: $BRANCH"
echo "=========================================="
echo ""
echo "This will start a CodeBuild build directly (not through pipeline)"
echo "This is faster for testing buildspec changes"
echo ""

# Get the latest commit from the branch
LATEST_COMMIT=$(git rev-parse origin/$BRANCH 2>/dev/null || git rev-parse $BRANCH)
echo "Using commit: $LATEST_COMMIT"
echo ""

# Start the build
echo "Starting CodeBuild build..."
BUILD_ID=$(aws codebuild start-build \
  --project-name $PROJECT_NAME \
  --source-location "https://github.com/slampenny/bianca-app.git" \
  --source-version $LATEST_COMMIT \
  --profile jordan \
  --query 'build.id' \
  --output text 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Failed to start build"
    echo "$BUILD_ID"
    exit 1
fi

echo "✓ Build started: $BUILD_ID"
echo ""
echo "Watch the build:"
echo "  aws codebuild batch-get-builds --ids $BUILD_ID --profile jordan --query 'builds[0].[buildStatus,currentPhase]' --output text"
echo ""
echo "View logs:"
echo "  aws logs tail /aws/codebuild/$PROJECT_NAME --follow --profile jordan"
echo ""
echo "Or check in AWS Console:"
echo "  https://console.aws.amazon.com/codesuite/codebuild/projects/$PROJECT_NAME/build/$BUILD_ID"

# Poll for status
echo ""
echo "Polling build status (Ctrl+C to stop)..."
while true; do
    STATUS=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --profile jordan --query 'builds[0].[buildStatus,currentPhase]' --output text 2>/dev/null)
    if [ -n "$STATUS" ]; then
        echo "$(date +%H:%M:%S) - $STATUS"
        if echo "$STATUS" | grep -q "FAILED\|SUCCEEDED\|STOPPED"; then
            echo ""
            echo "Build finished!"
            echo "Final status: $STATUS"
            break
        fi
    fi
    sleep 5
done
