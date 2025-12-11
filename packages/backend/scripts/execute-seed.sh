#!/bin/bash
# Execute seed with full logging

LOG_FILE="/tmp/seed-full-output.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== Starting at $(date) ==="

PROFILE="jordan"
REGION="us-east-2"

# Find SSH key
SSH_KEY=""
for key in "$HOME/.ssh/bianca-key-pair.pem" "/home/jordanlapp/.ssh/bianca-key-pair.pem" "./bianca-key-pair.pem"; do
    if [ -f "$key" ]; then
        SSH_KEY="$key"
        echo "Found SSH key: $SSH_KEY"
        break
    fi
done

if [ -z "$SSH_KEY" ]; then
    echo "ERROR: SSH key not found"
    exit 1
fi

chmod 600 "$SSH_KEY"

# Get IPs
echo "Finding instances..."
PROD_IP=$(aws ec2 describe-instances --profile $PROFILE --region $REGION --filters "Name=tag:Environment,Values=production" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>&1)
STAGING_IP=$(aws ec2 describe-instances --profile $PROFILE --region $REGION --filters "Name=tag:Environment,Values=staging" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>&1)

echo "Production IP: $PROD_IP"
echo "Staging IP: $STAGING_IP"

# Run on production
if [ -n "$PROD_IP" ] && [ "$PROD_IP" != "None" ] && [ "$PROD_IP" != "null" ]; then
    echo ""
    echo "=== SEEDING PRODUCTION ==="
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 ec2-user@$PROD_IP "cd /opt/bianca-app-backend && docker exec -i \$(docker ps -q --filter 'name=app' | head -1) node src/scripts/seedDatabase.js" 2>&1
    echo "Production exit code: $?"
fi

# Run on staging  
if [ -n "$STAGING_IP" ] && [ "$STAGING_IP" != "None" ] && [ "$STAGING_IP" != "null" ]; then
    echo ""
    echo "=== SEEDING STAGING ==="
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 ec2-user@$STAGING_IP "cd /opt/bianca-app-backend && docker exec -i \$(docker ps -q --filter 'name=app' | head -1) node src/scripts/seedDatabase.js" 2>&1
    echo "Staging exit code: $?"
fi

echo ""
echo "=== Complete at $(date) ==="
echo "Full log saved to: $LOG_FILE"


