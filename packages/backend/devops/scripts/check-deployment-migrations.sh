#!/bin/bash
# Check CloudWatch logs for migration verification output
# 
# Usage:
#   ./check-deployment-migrations.sh [production|staging]
#
# Requires AWS CLI with appropriate permissions to read CloudWatch logs

set -e

ENVIRONMENT="${1:-production}"
REGION="${AWS_REGION:-us-east-2}"

if [ "$ENVIRONMENT" = "production" ]; then
  LOG_GROUP="/bianca/production/app"
  CODEBUILD_PROJECT="bianca-production-build"
elif [ "$ENVIRONMENT" = "staging" ]; then
  LOG_GROUP="/bianca/staging/app"
  CODEBUILD_PROJECT="bianca-staging-build"
else
  echo "Error: Environment must be 'production' or 'staging'"
  exit 1
fi

echo "🔍 Checking migration status in CloudWatch logs for $ENVIRONMENT..."
echo "Log group: $LOG_GROUP"
echo "Region: $REGION"
echo ""

# Check if log group exists
if ! aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$REGION" --query "logGroups[?logGroupName=='$LOG_GROUP'].logGroupName" --output text | grep -q "$LOG_GROUP"; then
  echo "⚠️  Log group $LOG_GROUP not found. Checking for similar groups..."
  aws logs describe-log-groups --log-group-name-prefix "/bianca/$ENVIRONMENT" --region "$REGION" --query 'logGroups[*].logGroupName' --output table
  exit 1
fi

# Get the most recent log stream (last 1 hour)
END_TIME=$(date +%s)000
START_TIME=$((END_TIME - 3600000))  # 1 hour ago

echo "📋 Searching for migration verification strings in last hour..."
echo ""

# Search for migration verification strings
SEARCH_STRINGS=(
  "Verifying migration status"
  "All critical migrations verified"
  "Migration check reported issues"
  "Migrations completed successfully"
  "Step 2: Running database migrations"
  "yarn migrate:up"
  "migrate:check"
)

FOUND_ANY=false

for STRING in "${SEARCH_STRINGS[@]}"; do
  echo "Searching for: '$STRING'"
  RESULTS=$(aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --filter-pattern "$STRING" \
    --region "$REGION" \
    --max-items 10 \
    --query 'events[*].[timestamp,message]' \
    --output text 2>&1)
  
  if [ $? -eq 0 ] && [ -n "$RESULTS" ]; then
    echo "✅ Found matches:"
    echo "$RESULTS" | while IFS=$'\t' read -r timestamp message; do
      DATE=$(date -d "@$((timestamp / 1000))" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$timestamp")
      echo "   [$DATE] $message"
    done
    FOUND_ANY=true
  else
    echo "   (no matches)"
  fi
  echo ""
done

# Also check CodeBuild logs for migration output
echo "📋 Checking CodeBuild logs..."
CODEBUILD_LOG_GROUP="/aws/codebuild/$CODEBUILD_PROJECT"
if aws logs describe-log-groups --log-group-name-prefix "$CODEBUILD_LOG_GROUP" --region "$REGION" --query "logGroups[?logGroupName=='$CODEBUILD_LOG_GROUP'].logGroupName" --output text | grep -q "$CODEBUILD_LOG_GROUP"; then
  echo "Searching CodeBuild logs for migration output..."
  CODEBUILD_RESULTS=$(aws logs filter-log-events \
    --log-group-name "$CODEBUILD_LOG_GROUP" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --filter-pattern "migrate" \
    --region "$REGION" \
    --max-items 5 \
    --query 'events[*].message' \
    --output text 2>&1)
  
  if [ $? -eq 0 ] && [ -n "$CODEBUILD_RESULTS" ]; then
    echo "✅ Found in CodeBuild:"
    echo "$CODEBUILD_RESULTS" | head -5
  fi
else
  echo "⚠️  CodeBuild log group $CODEBUILD_LOG_GROUP not found"
fi

echo ""
if [ "$FOUND_ANY" = true ]; then
  echo "✅ Migration verification output found in logs!"
  echo ""
  echo "💡 To see full logs, run:"
  echo "   aws logs tail $LOG_GROUP --follow --region $REGION"
else
  echo "⚠️  No migration verification output found in the last hour."
  echo "   The pipeline may still be running, or migrations haven't started yet."
  echo ""
  echo "💡 To check recent logs manually:"
  echo "   aws logs tail $LOG_GROUP --since 1h --region $REGION | grep -i migrate"
fi
