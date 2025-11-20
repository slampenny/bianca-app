#!/bin/bash
# Script to run phone number migration on staging and production
# Usage: ./scripts/run-phone-migration.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}

# Instance IDs (update these if they change)
STAGING_INSTANCE_ID="i-0a1b2c3d4e5f6g7h8"  # Update with actual staging instance ID
PROD_INSTANCE_ID="i-0a2c5b5ad1c61d4c4"

# AWS Region
REGION="us-east-2"

# AWS Profile (use 'jordan' if available, otherwise default)
AWS_PROFILE="${AWS_PROFILE:-jordan}"

# Select instance ID based on environment
if [ "$ENVIRONMENT" == "staging" ]; then
    INSTANCE_ID="$STAGING_INSTANCE_ID"
    NODE_ENV="staging"
elif [ "$ENVIRONMENT" == "production" ]; then
    INSTANCE_ID="$PROD_INSTANCE_ID"
    NODE_ENV="production"
else
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Usage: $0 [staging|production]"
    exit 1
fi

echo "🚀 Running phone number migration on $ENVIRONMENT..."
echo "   Instance ID: $INSTANCE_ID"
echo "   Region: $REGION"
echo ""

# Check if instance is online via SSM
echo "🔍 Checking SSM status..."
SSM_STATUS=$(aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
    --profile "$AWS_PROFILE" \
    --region "$REGION" \
    --query 'InstanceInformationList[0].PingStatus' \
    --output text 2>/dev/null || echo "Error")

if [ "$SSM_STATUS" != "Online" ]; then
    echo "❌ Instance is not online via SSM (Status: $SSM_STATUS)"
    echo "💡 Please ensure:"
    echo "   1. Instance is running"
    echo "   2. SSM agent is installed and running"
    echo "   3. IAM role has SSM permissions"
    exit 1
fi

echo "✅ Instance is online via SSM"

# Create migration command
MIGRATION_COMMAND="cd /opt/bianca-app-backend && NODE_ENV=$NODE_ENV node src/scripts/migrate-phone-numbers-to-e164.js"

echo ""
echo "📋 Migration command:"
echo "   $MIGRATION_COMMAND"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "⏳ Sending migration command via SSM..."

# Run migration via SSM
COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[\"$MIGRATION_COMMAND\"]" \
    --profile "$AWS_PROFILE" \
    --region "$REGION" \
    --query 'Command.CommandId' \
    --output text 2>&1)

if [ -z "$COMMAND_ID" ] || echo "$COMMAND_ID" | grep -qi "error"; then
    echo "❌ Failed to send SSM command"
    echo "   Error: $COMMAND_ID"
    echo ""
    echo "💡 Alternative: Use SSM Session Manager:"
    echo "   aws ssm start-session --target $INSTANCE_ID --profile $AWS_PROFILE --region $REGION"
    exit 1
fi

echo "✅ Command sent (Command ID: $COMMAND_ID)"
echo "⏳ Waiting for command to complete..."

# Wait for command to complete
aws ssm wait command-executed \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --profile "$AWS_PROFILE" \
    --region "$REGION" || true

# Get command output
echo ""
echo "📋 Migration output:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --profile "$AWS_PROFILE" \
    --region "$REGION" \
    --query '[StandardOutputContent, StandardErrorContent]' \
    --output text

# Check exit status
STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --profile "$AWS_PROFILE" \
    --region "$REGION" \
    --query 'Status' \
    --output text)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$STATUS" == "Success" ]; then
    echo "✅ Migration completed successfully!"
else
    echo "❌ Migration failed with status: $STATUS"
    exit 1
fi

