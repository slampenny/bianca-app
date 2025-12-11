#!/bin/bash
# Seed script with logging

exec > /tmp/seed-execution.log 2>&1

PROFILE="jordan"
REGION="us-east-2"

echo "=== Starting seed script execution ==="
date

# Find SSH key
SSH_KEY=""
for key in "$HOME/.ssh/bianca-key-pair.pem" "/home/jordanlapp/.ssh/bianca-key-pair.pem" "./bianca-key-pair.pem" "bianca-key-pair.pem"; do
    if [ -f "$key" ]; then
        SSH_KEY="$key"
        echo "Found SSH key at: $SSH_KEY"
        break
    fi
done

if [ -z "$SSH_KEY" ]; then
    echo "ERROR: SSH key not found"
    exit 1
fi

chmod 600 "$SSH_KEY" 2>/dev/null

# Get IPs
echo "Finding instances..."
PROD_IP=$(aws ec2 describe-instances --profile $PROFILE --region $REGION --filters "Name=tag:Environment,Values=production" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>&1)
STAGING_IP=$(aws ec2 describe-instances --profile $PROFILE --region $REGION --filters "Name=tag:Environment,Values=staging" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>&1)

echo "Production IP: $PROD_IP"
echo "Staging IP: $STAGING_IP"

# Run on production
if [ -n "$PROD_IP" ] && [ "$PROD_IP" != "None" ] && [ "$PROD_IP" != "null" ]; then
    echo ""
    echo "=== Seeding PRODUCTION ==="
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ec2-user@$PROD_IP << 'PROD_EOF'
cd /opt/bianca-app-backend 2>/dev/null || cd /home/ec2-user/bianca-app-backend 2>/dev/null || { echo "ERROR: Could not find app directory"; exit 1; }
export NODE_ENV=production
echo "Running seed script in production..."
docker exec -i $(docker ps -q --filter 'name=app' | head -1) node src/scripts/seedDatabase.js
echo "Production seed completed"
PROD_EOF
    echo "Production seed script exit code: $?"
else
    echo "Skipping production - no IP found"
fi

# Run on staging
if [ -n "$STAGING_IP" ] && [ "$STAGING_IP" != "None" ] && [ "$STAGING_IP" != "null" ]; then
    echo ""
    echo "=== Seeding STAGING ==="
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ec2-user@$STAGING_IP << 'STAGING_EOF'
cd /opt/bianca-app-backend 2>/dev/null || cd /home/ec2-user/bianca-app-backend 2>/dev/null || { echo "ERROR: Could not find app directory"; exit 1; }
export NODE_ENV=staging
echo "Running seed script in staging..."
docker exec -i $(docker ps -q --filter 'name=app' | head -1) node src/scripts/seedDatabase.js
echo "Staging seed completed"
STAGING_EOF
    echo "Staging seed script exit code: $?"
else
    echo "Skipping staging - no IP found"
fi

echo ""
echo "=== Seed execution complete ==="
date


