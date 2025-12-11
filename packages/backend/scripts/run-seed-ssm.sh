#!/bin/bash
# Run seed script using AWS SSM

set -e

PROFILE="jordan"
REGION="us-east-2"

echo "=== Running Seed Script via AWS SSM ==="
echo ""

# Get instance IDs
echo "Finding instances..."
PROD_INSTANCE=$(aws ec2 describe-instances \
    --profile $PROFILE \
    --region $REGION \
    --filters "Name=tag:Environment,Values=production" "Name=tag:Name,Values=bianca-production" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null || echo "")

STAGING_INSTANCE=$(aws ec2 describe-instances \
    --profile $PROFILE \
    --region $REGION \
    --filters "Name=tag:Environment,Values=staging" "Name=tag:Name,Values=bianca-staging" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null || echo "")

if [ "$PROD_INSTANCE" == "None" ] || [ -z "$PROD_INSTANCE" ]; then
    echo "⚠️  Production instance not found"
    PROD_INSTANCE=""
else
    echo "✓ Production instance: $PROD_INSTANCE"
fi

if [ "$STAGING_INSTANCE" == "None" ] || [ -z "$STAGING_INSTANCE" ]; then
    echo "⚠️  Staging instance not found"
    STAGING_INSTANCE=""
else
    echo "✓ Staging instance: $STAGING_INSTANCE"
fi

echo ""

if [ -z "$PROD_INSTANCE" ] && [ -z "$STAGING_INSTANCE" ]; then
    echo "❌ No instances found"
    exit 1
fi

# Function to run seed via SSM
run_seed_ssm() {
    local instance_id=$1
    local env=$2
    
    echo ""
    echo "=== Running seed script on $env ($instance_id) ==="
    
    # Send command via SSM
    CMD_ID=$(aws ssm send-command \
        --profile $PROFILE \
        --region $REGION \
        --instance-ids "$instance_id" \
        --document-name "AWS-RunShellScript" \
        --parameters "commands=[
            \"cd /opt/bianca-app-backend 2>/dev/null || cd /home/ec2-user/bianca-app-backend 2>/dev/null || { echo 'ERROR: Could not find app directory'; exit 1; }\",
            \"export NODE_ENV=${env}\",
            \"echo 'Running seed script in ${env} environment...'\",
            \"docker exec -i \$(docker ps -q --filter 'name=app' | head -1) node src/scripts/seedDatabase.js || { echo 'Failed to run seed script'; exit 1; }\",
            \"echo 'Seed script completed successfully on ${env}'\"
        ]" \
        --output json \
        --query 'Command.CommandId' | tr -d '"')
    
    echo "Command ID: $CMD_ID"
    echo "Waiting for command to complete (this may take 1-2 minutes)..."
    
    # Wait for command to complete
    for i in {1..60}; do
        STATUS=$(aws ssm get-command-invocation \
            --profile $PROFILE \
            --region $REGION \
            --command-id "$CMD_ID" \
            --instance-id "$instance_id" \
            --query 'Status' \
            --output text 2>/dev/null || echo "Unknown")
        
        if [ "$STATUS" == "Success" ]; then
            echo ""
            echo "✓ $env seed script completed successfully!"
            echo ""
            echo "Output:"
            aws ssm get-command-invocation \
                --profile $PROFILE \
                --region $REGION \
                --command-id "$CMD_ID" \
                --instance-id "$instance_id" \
                --query 'StandardOutputContent' \
                --output text
            echo ""
            return 0
        elif [ "$STATUS" == "Failed" ]; then
            echo ""
            echo "❌ $env seed script failed!"
            echo ""
            echo "Error output:"
            aws ssm get-command-invocation \
                --profile $PROFILE \
                --region $REGION \
                --command-id "$CMD_ID" \
                --instance-id "$instance_id" \
                --query 'StandardErrorContent' \
                --output text
            echo ""
            return 1
        fi
        echo -n "."
        sleep 2
    done
    
    echo ""
    echo "⚠️  Command timed out. Check status manually:"
    echo "aws ssm get-command-invocation --profile $PROFILE --region $REGION --command-id $CMD_ID --instance-id $instance_id"
    return 1
}

# Run seed on both environments
SUCCESS=true
[ -n "$PROD_INSTANCE" ] && run_seed_ssm "$PROD_INSTANCE" "production" || SUCCESS=false
[ -n "$STAGING_INSTANCE" ] && run_seed_ssm "$STAGING_INSTANCE" "staging" || SUCCESS=false

echo ""
if [ "$SUCCESS" = true ]; then
    echo "=== Complete ==="
    echo "Seed scripts have been executed successfully on both environments."
else
    echo "=== Complete (with errors) ==="
    echo "Some seed scripts may have failed. Check the output above."
    exit 1
fi


