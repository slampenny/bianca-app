#!/bin/bash
# Direct seed script execution

PROFILE="jordan"
REGION="us-east-2"

# Find SSH key
SSH_KEY=""
for key in "$HOME/.ssh/bianca-key-pair.pem" "/home/jordanlapp/.ssh/bianca-key-pair.pem" "./bianca-key-pair.pem"; do
    if [ -f "$key" ]; then
        SSH_KEY="$key"
        break
    fi
done

if [ -z "$SSH_KEY" ]; then
    echo "SSH key not found"
    exit 1
fi

chmod 600 "$SSH_KEY" 2>/dev/null

# Get IPs
PROD_IP=$(aws ec2 describe-instances --profile $PROFILE --region $REGION --filters "Name=tag:Environment,Values=production" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>/dev/null)
STAGING_IP=$(aws ec2 describe-instances --profile $PROFILE --region $REGION --filters "Name=tag:Environment,Values=staging" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>/dev/null)

echo "Production: $PROD_IP"
echo "Staging: $STAGING_IP"

# Run on production
if [ -n "$PROD_IP" ] && [ "$PROD_IP" != "None" ]; then
    echo "Seeding production..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$PROD_IP "cd /opt/bianca-app-backend && docker exec -i \$(docker ps -q --filter 'name=app' | head -1) node src/scripts/seedDatabase.js"
fi

# Run on staging
if [ -n "$STAGING_IP" ] && [ "$STAGING_IP" != "None" ]; then
    echo "Seeding staging..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$STAGING_IP "cd /opt/bianca-app-backend && docker exec -i \$(docker ps -q --filter 'name=app' | head -1) node src/scripts/seedDatabase.js"
fi

echo "Done"


