#!/bin/bash
# Script to reset MongoDB databases on production and staging

set -e

PROFILE="jordan"
REGION="us-east-2"

echo "=== Database Reset Script ==="
echo ""
echo "This will:"
echo "  1. Stop MongoDB containers on production and staging"
echo "  2. Clear all MongoDB data"
echo "  3. Restart MongoDB containers"
echo ""
read -p "Are you sure you want to reset BOTH production and staging databases? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Finding EC2 instances..."

# Get production instance
PROD_INSTANCE=$(aws ec2 describe-instances \
    --profile $PROFILE \
    --region $REGION \
    --filters "Name=tag:Environment,Values=production" "Name=tag:Name,Values=bianca-production" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text)

# Get staging instance
STAGING_INSTANCE=$(aws ec2 describe-instances \
    --profile $PROFILE \
    --region $REGION \
    --filters "Name=tag:Environment,Values=staging" "Name=tag:Name,Values=bianca-staging" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text)

if [ "$PROD_INSTANCE" == "None" ] || [ -z "$PROD_INSTANCE" ]; then
    echo "⚠️  Production instance not found or not running"
    PROD_INSTANCE=""
else
    echo "✓ Found production instance: $PROD_INSTANCE"
fi

if [ "$STAGING_INSTANCE" == "None" ] || [ -z "$STAGING_INSTANCE" ]; then
    echo "⚠️  Staging instance not found or not running"
    STAGING_INSTANCE=""
else
    echo "✓ Found staging instance: $STAGING_INSTANCE"
fi

if [ -z "$PROD_INSTANCE" ] && [ -z "$STAGING_INSTANCE" ]; then
    echo "❌ No instances found. Exiting."
    exit 1
fi

echo ""
echo "Resetting databases..."

# Function to reset database on an instance
reset_database() {
    local instance_id=$1
    local env_name=$2
    
    echo ""
    echo "=== Resetting $env_name database ==="
    
    # Use AWS Systems Manager to run commands (no SSH needed)
    echo "Stopping MongoDB container..."
    aws ssm send-command \
        --profile $PROFILE \
        --region $REGION \
        --instance-ids "$instance_id" \
        --document-name "AWS-RunShellScript" \
        --parameters 'commands=[
            "docker ps -a | grep mongodb | awk '\''{print $1}'\'' | xargs -r docker stop",
            "docker ps -a | grep mongodb | awk '\''{print $1}'\'' | xargs -r docker rm"
        ]' \
        --output text \
        --query 'Command.CommandId' > /tmp/command-id.txt
    
    COMMAND_ID=$(cat /tmp/command-id.txt)
    echo "Waiting for command to complete..."
    sleep 5
    
    # Wait for command to complete
    aws ssm wait command-executed \
        --profile $PROFILE \
        --region $REGION \
        --command-id "$COMMAND_ID" \
        --instance-id "$instance_id" || true
    
    echo "Clearing MongoDB data..."
    aws ssm send-command \
        --profile $PROFILE \
        --region $REGION \
        --instance-ids "$instance_id" \
        --document-name "AWS-RunShellScript" \
        --parameters 'commands=[
            "sudo rm -rf /opt/mongodb-data/*",
            "sudo rm -rf /opt/mongodb-data/.* 2>/dev/null || true",
            "echo '\''MongoDB data cleared'\''"
        ]' \
        --output text \
        --query 'Command.CommandId' > /tmp/command-id.txt
    
    COMMAND_ID=$(cat /tmp/command-id.txt)
    echo "Waiting for data clear to complete..."
    sleep 5
    
    aws ssm wait command-executed \
        --profile $PROFILE \
        --region $REGION \
        --command-id "$COMMAND_ID" \
        --instance-id "$instance_id" || true
    
    echo "Restarting containers (docker-compose will recreate MongoDB)..."
    aws ssm send-command \
        --profile $PROFILE \
        --region $REGION \
        --instance-ids "$instance_id" \
        --document-name "AWS-RunShellScript" \
        --parameters "commands=[
            \"cd /opt/bianca-app-backend || cd /home/ec2-user/bianca-app-backend || exit 1\",
            \"docker-compose -f docker-compose.yml -f docker-compose.${env_name}.yml up -d mongodb\",
            \"sleep 5\",
            \"docker-compose -f docker-compose.yml -f docker-compose.${env_name}.yml restart app || docker-compose -f docker-compose.yml -f docker-compose.${env_name}.yml up -d app\"
        ]" \
        --output text \
        --query 'Command.CommandId' > /tmp/command-id.txt
    
    COMMAND_ID=$(cat /tmp/command-id.txt)
    echo "Waiting for containers to restart..."
    sleep 10
    
    aws ssm wait command-executed \
        --profile $PROFILE \
        --region $REGION \
        --command-id "$COMMAND_ID" \
        --instance-id "$instance_id" || true
    
    echo "✓ $env_name database reset complete"
}

# Reset production if instance found
if [ -n "$PROD_INSTANCE" ]; then
    reset_database "$PROD_INSTANCE" "production"
fi

# Reset staging if instance found
if [ -n "$STAGING_INSTANCE" ]; then
    reset_database "$STAGING_INSTANCE" "staging"
fi

echo ""
echo "=== Database Reset Complete ==="
echo ""
echo "Note: The application containers may need a moment to reconnect to the fresh databases."
echo "You may want to restart the app containers to ensure clean connections."


