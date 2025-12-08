#!/bin/bash
# Script to run seed script on production and staging using SSH

set -e

PROFILE="jordan"
REGION="us-east-2"
# Try to find SSH key in common locations
if [ -f "$HOME/.ssh/bianca-key-pair.pem" ]; then
    SSH_KEY="$HOME/.ssh/bianca-key-pair.pem"
elif [ -f "/home/jordanlapp/.ssh/bianca-key-pair.pem" ]; then
    SSH_KEY="/home/jordanlapp/.ssh/bianca-key-pair.pem"
elif [ -f "./bianca-key-pair.pem" ]; then
    SSH_KEY="./bianca-key-pair.pem"
elif [ -f "bianca-key-pair.pem" ]; then
    SSH_KEY="bianca-key-pair.pem"
else
    echo "❌ SSH key not found. Please specify the path to bianca-key-pair.pem"
    echo "Usage: SSH_KEY=/path/to/bianca-key-pair.pem $0"
    exit 1
fi

echo "=== Running Seed Script on Production and Staging ==="
echo "Using SSH key: $SSH_KEY"
echo ""

# Set correct permissions for SSH key
chmod 600 "$SSH_KEY" 2>/dev/null || true

# Find instances
echo "Finding instances..."
PROD_INFO=$(aws ec2 describe-instances \
    --profile $PROFILE \
    --region $REGION \
    --filters "Name=tag:Environment,Values=production" "Name=tag:Name,Values=bianca-production" \
    --query 'Reservations[0].Instances[0].[InstanceId,PublicIpAddress,State.Name]' \
    --output text 2>/dev/null || echo "")

STAGING_INFO=$(aws ec2 describe-instances \
    --profile $PROFILE \
    --region $REGION \
    --filters "Name=tag:Environment,Values=staging" "Name=tag:Name,Values=bianca-staging" \
    --query 'Reservations[0].Instances[0].[InstanceId,PublicIpAddress,State.Name]' \
    --output text 2>/dev/null || echo "")

# Parse production info
if [ -n "$PROD_INFO" ] && [ "$PROD_INFO" != "None" ]; then
    PROD_INSTANCE_ID=$(echo $PROD_INFO | awk '{print $1}')
    PROD_IP=$(echo $PROD_INFO | awk '{print $2}')
    PROD_STATE=$(echo $PROD_INFO | awk '{print $3}')
    
    if [ "$PROD_STATE" == "running" ] && [ -n "$PROD_IP" ] && [ "$PROD_IP" != "None" ]; then
        echo "✓ Found production instance: $PROD_INSTANCE_ID ($PROD_IP)"
    else
        echo "⚠️  Production instance not running or no public IP"
        PROD_IP=""
    fi
else
    echo "⚠️  Production instance not found"
    PROD_IP=""
fi

# Parse staging info
if [ -n "$STAGING_INFO" ] && [ "$STAGING_INFO" != "None" ]; then
    STAGING_INSTANCE_ID=$(echo $STAGING_INFO | awk '{print $1}')
    STAGING_IP=$(echo $STAGING_INFO | awk '{print $2}')
    STAGING_STATE=$(echo $STAGING_INFO | awk '{print $3}')
    
    if [ "$STAGING_STATE" == "running" ] && [ -n "$STAGING_IP" ] && [ "$STAGING_IP" != "None" ]; then
        echo "✓ Found staging instance: $STAGING_INSTANCE_ID ($STAGING_IP)"
    else
        echo "⚠️  Staging instance not running or no public IP"
        STAGING_IP=""
    fi
else
    echo "⚠️  Staging instance not found"
    STAGING_IP=""
fi

echo ""

if [ -z "$PROD_IP" ] && [ -z "$STAGING_IP" ]; then
    echo "❌ No running instances found with public IPs"
    exit 1
fi

# Function to run seed script via SSH
run_seed() {
    local ip=$1
    local env=$2
    echo ""
    echo "=== Running seed script on $env ($ip) ==="
    
    ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        ec2-user@$ip << EOF
set -e
cd /opt/bianca-app-backend 2>/dev/null || cd /home/ec2-user/bianca-app-backend 2>/dev/null || { echo "Could not find app directory"; exit 1; }
export NODE_ENV=${env}
echo "Running seed script in ${env} environment..."
docker exec -i \$(docker ps -q --filter 'name=app' | head -1) node src/scripts/seedDatabase.js || docker-compose -f docker-compose.yml -f docker-compose.${env}.yml exec -T app node src/scripts/seedDatabase.js || { echo "Failed to run seed script"; exit 1; }
echo "✓ Seed script completed successfully on ${env}"
EOF
    
    if [ $? -eq 0 ]; then
        echo "✓ $env seed script completed successfully!"
    else
        echo "❌ $env seed script failed!"
        return 1
    fi
}

# Run seed on both environments
SUCCESS=true
[ -n "$PROD_IP" ] && run_seed "$PROD_IP" "production" || SUCCESS=false
[ -n "$STAGING_IP" ] && run_seed "$STAGING_IP" "staging" || SUCCESS=false

echo ""
if [ "$SUCCESS" = true ]; then
    echo "=== Complete ==="
    echo "Seed scripts have been executed successfully on both environments."
else
    echo "=== Complete (with errors) ==="
    echo "Some seed scripts may have failed. Check the output above."
    exit 1
fi


