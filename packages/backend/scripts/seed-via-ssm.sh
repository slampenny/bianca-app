#!/bin/bash
PROFILE="jordan"
REGION="us-east-2"

# Get production instance
PROD_ID=$(aws ec2 describe-instances --profile $PROFILE --region $REGION --filters "Name=tag:Environment,Values=production" --query 'Reservations[0].Instances[0].InstanceId' --output text)
echo "Production: $PROD_ID"

# Get staging instance  
STAGING_ID=$(aws ec2 describe-instances --profile $PROFILE --region $REGION --filters "Name=tag:Environment,Values=staging" --query 'Reservations[0].Instances[0].InstanceId' --output text)
echo "Staging: $STAGING_ID"

# Run seed on production
if [ "$PROD_ID" != "None" ] && [ -n "$PROD_ID" ]; then
    echo "Seeding production..."
    aws ssm send-command \
        --profile $PROFILE \
        --region $REGION \
        --instance-ids "$PROD_ID" \
        --document-name "AWS-RunShellScript" \
        --parameters 'commands=["cd /opt/bianca-app-backend && docker exec -i $(docker ps -q --filter '\''name=app'\'' | head -1) node src/scripts/seedDatabase.js"]' \
        --output json > /tmp/prod-seed-cmd.json
    echo "Production command sent. Check status with the CommandId from /tmp/prod-seed-cmd.json"
fi

# Run seed on staging
if [ "$STAGING_ID" != "None" ] && [ -n "$STAGING_ID" ]; then
    echo "Seeding staging..."
    aws ssm send-command \
        --profile $PROFILE \
        --region $REGION \
        --instance-ids "$STAGING_ID" \
        --document-name "AWS-RunShellScript" \
        --parameters 'commands=["cd /opt/bianca-app-backend && docker exec -i $(docker ps -q --filter '\''name=app'\'' | head -1) node src/scripts/seedDatabase.js"]' \
        --output json > /tmp/staging-seed-cmd.json
    echo "Staging command sent. Check status with the CommandId from /tmp/staging-seed-cmd.json"
fi


