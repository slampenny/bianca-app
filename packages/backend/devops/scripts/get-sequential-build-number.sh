#!/bin/bash
# Get or increment sequential build number from S3
# This provides a global sequential build number across all CodeBuild projects
#
# Usage:
#   get-sequential-build-number.sh [pipeline-name] [read-only]
#   - pipeline-name: Name of the CodePipeline (default: bianca-staging-pipeline)
#   - read-only: If "read-only" is passed, only reads the current number without incrementing

set -e

PIPELINE_NAME="${1:-bianca-staging-pipeline}"
READ_ONLY="${2:-false}"
BUILD_COUNTER_KEY="build-counter/sequential-build-number.txt"

# Get S3 bucket from CodePipeline
S3_BUCKET=$(aws codepipeline get-pipeline --name "$PIPELINE_NAME" --query 'pipeline.artifactStore.location' --output text 2>/dev/null || echo "")

if [ -z "$S3_BUCKET" ]; then
  echo "⚠️  Could not determine S3 bucket from pipeline '$PIPELINE_NAME'"
  echo "   Falling back to CODEBUILD_BUILD_NUMBER: ${CODEBUILD_BUILD_NUMBER}"
  echo "${CODEBUILD_BUILD_NUMBER}"
  exit 0
fi

echo "Using S3 bucket: $S3_BUCKET"
echo "Build counter key: $BUILD_COUNTER_KEY"

# Try to get current build number from S3
CURRENT_BUILD_NUMBER=$(aws s3 cp "s3://${S3_BUCKET}/${BUILD_COUNTER_KEY}" - 2>/dev/null || echo "0")

# Remove any whitespace/newlines
CURRENT_BUILD_NUMBER=$(echo "$CURRENT_BUILD_NUMBER" | tr -d '[:space:]')

# Validate it's a number
if ! [[ "$CURRENT_BUILD_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "⚠️  Invalid build number in S3, starting from 1"
  CURRENT_BUILD_NUMBER=0
fi

# If read-only mode, just return the current number
if [ "$READ_ONLY" = "read-only" ]; then
  FORMATTED_BUILD_NUMBER=$(printf "%04d" "$CURRENT_BUILD_NUMBER")
  echo "📖 Read-only mode: Sequential build number: $FORMATTED_BUILD_NUMBER"
  echo "$FORMATTED_BUILD_NUMBER"
  exit 0
fi

# Increment build number
NEW_BUILD_NUMBER=$((CURRENT_BUILD_NUMBER + 1))

# Upload new build number back to S3
# Use a temporary file to ensure atomic write
TEMP_FILE=$(mktemp)
echo "$NEW_BUILD_NUMBER" > "$TEMP_FILE"
aws s3 cp "$TEMP_FILE" "s3://${S3_BUCKET}/${BUILD_COUNTER_KEY}" --content-type "text/plain" || {
  echo "❌ Failed to update build number in S3"
  rm -f "$TEMP_FILE"
  # Fallback to CODEBUILD_BUILD_NUMBER
  echo "${CODEBUILD_BUILD_NUMBER}"
  exit 0
}
rm -f "$TEMP_FILE"

# Format with leading zeros (4 digits: 0001, 0002, etc.)
FORMATTED_BUILD_NUMBER=$(printf "%04d" "$NEW_BUILD_NUMBER")

echo "✅ Sequential build number: $FORMATTED_BUILD_NUMBER (was $CURRENT_BUILD_NUMBER)"
echo "$FORMATTED_BUILD_NUMBER"

