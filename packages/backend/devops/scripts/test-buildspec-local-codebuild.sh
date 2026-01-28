#!/bin/bash
# Test buildspec using AWS CodeBuild Local Agent
# This uses Docker to run the actual CodeBuild agent locally

set -e

BUILDSPEC_FILE="packages/backend/devops/buildspec-create-green-instance.yml"
OUTPUT_DIR="/tmp/codebuild-test-$(date +%s)"
IMAGE="public.ecr.aws/codebuild/amazonlinux-x86_64-standard:7.0"

echo "=========================================="
echo "Testing buildspec with CodeBuild Local Agent"
echo "Buildspec: $BUILDSPEC_FILE"
echo "=========================================="
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ ERROR: Docker is not installed or not running"
    echo "Install Docker to test buildspecs locally with CodeBuild agent"
    exit 1
fi

echo "Step 1: Pulling CodeBuild local agent..."
if ! docker pull public.ecr.aws/codebuild/local-builds:latest 2>/dev/null; then
    echo "⚠ Failed to pull latest, trying without tag..."
    docker pull public.ecr.aws/codebuild/local-builds 2>/dev/null || {
        echo "❌ Failed to pull CodeBuild local agent"
        echo "Try: docker pull public.ecr.aws/codebuild/local-builds:latest"
        exit 1
    }
fi

echo "Step 2: Pulling build image..."
if ! docker pull "$IMAGE" 2>/dev/null; then
    echo "⚠ Failed to pull $IMAGE, trying standard:7.0..."
    IMAGE="aws/codebuild/standard:7.0"
    docker pull "$IMAGE" 2>/dev/null || {
        echo "⚠ Using default image from CodeBuild agent"
        IMAGE=""
    }
fi

echo "Step 3: Downloading CodeBuild build script..."
BUILD_SCRIPT="/tmp/codebuild_build.sh"
if [ ! -f "$BUILD_SCRIPT" ]; then
    curl -o "$BUILD_SCRIPT" https://raw.githubusercontent.com/aws/aws-codebuild-docker-images/master/local_builds/codebuild_build.sh 2>/dev/null || {
        echo "❌ Failed to download build script"
        exit 1
    }
    chmod +x "$BUILD_SCRIPT"
fi

echo "Step 4: Setting up environment variables..."
export LAUNCH_TEMPLATE_NAME=${LAUNCH_TEMPLATE_NAME:-"bianca-staging-20250815133218595500000001"}
export SUBNET_ID=${SUBNET_ID:-"subnet-0f4d4fa5a767f1161"}
export SECURITY_GROUP_ID=${SECURITY_GROUP_ID:-"sg-04dfc825194f4677b"}
export INSTANCE_PROFILE_NAME=${INSTANCE_PROFILE_NAME:-"bianca-staging-instance-profile"}
export KEY_NAME=${KEY_NAME:-"bianca-key-pair"}
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-"us-east-2"}

echo "Step 5: Running CodeBuild local agent..."
echo ""
echo "This will validate the buildspec using the actual CodeBuild parser!"
echo ""

mkdir -p "$OUTPUT_DIR"

# Run the local build
cd /home/jordanlapp/code/bianca-app

if [ -n "$IMAGE" ]; then
    "$BUILD_SCRIPT" -i "$IMAGE" -a "$OUTPUT_DIR" -s . -c "$BUILDSPEC_FILE" 2>&1 | tee /tmp/codebuild-local-output.log
else
    docker run --rm \
        -v "$(pwd):/codebuild/output/src" \
        -v "$OUTPUT_DIR:/codebuild/output/artifacts" \
        -e "CODEBUILD_SRC_DIR=/codebuild/output/src" \
        -e "LAUNCH_TEMPLATE_NAME=$LAUNCH_TEMPLATE_NAME" \
        -e "SUBNET_ID=$SUBNET_ID" \
        -e "SECURITY_GROUP_ID=$SECURITY_GROUP_ID" \
        -e "INSTANCE_PROFILE_NAME=$INSTANCE_PROFILE_NAME" \
        -e "KEY_NAME=$KEY_NAME" \
        -e "AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION" \
        public.ecr.aws/codebuild/local-builds:latest \
        bash -c "cd /codebuild/output/src && cat $BUILDSPEC_FILE | head -20"
fi

echo ""
echo "=========================================="
echo "Local test complete!"
echo "Output directory: $OUTPUT_DIR"
echo "Log file: /tmp/codebuild-local-output.log"
echo "=========================================="
