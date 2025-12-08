#!/bin/bash
# Run fix-caregiver-relationship script on staging
# Usage: ./scripts/run-fix-relationship-staging.sh <email>
# Uses the same email for both patient and caregiver (for testing)

set -e

if [ $# -ne 1 ]; then
  echo "Usage: $0 <email>"
  echo "Example: $0 jordan@example.com"
  echo "Note: Uses the same email for both patient and caregiver"
  exit 1
fi

EMAIL=$1
PATIENT_EMAIL=$1
CAREGIVER_EMAIL=$1

AWS_PROFILE="jordan"
REGION="us-east-2"

echo "🔧 Running fix-caregiver-relationship on staging..."
echo "   Email (used for both patient and caregiver): $EMAIL"
echo ""

# Get staging instance IP
STAGING_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=bianca-staging" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text \
  --profile $AWS_PROFILE \
  --region $REGION)

if [ -z "$STAGING_IP" ] || [ "$STAGING_IP" == "None" ]; then
  echo "❌ Could not find running staging instance"
  exit 1
fi

echo "📍 Staging instance IP: $STAGING_IP"
echo ""

SSH_OPTS="-i ~/.ssh/bianca-key-pair.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# Copy script to staging if it doesn't exist
SCRIPT_PATH="src/scripts/fix-caregiver-relationship.js"
echo "📋 Copying script to staging..."
scp $SSH_OPTS $SCRIPT_PATH ec2-user@$STAGING_IP:/tmp/fix-caregiver-relationship.js

# Copy script into container
echo "📋 Copying script into container..."
ssh $SSH_OPTS ec2-user@$STAGING_IP "
  docker cp /tmp/fix-caregiver-relationship.js staging_app:/usr/src/bianca-app/src/scripts/fix-caregiver-relationship.js
  docker exec staging_app chmod +x /usr/src/bianca-app/src/scripts/fix-caregiver-relationship.js
  echo '✅ Script copied to container'
"

# Run the script in the container
echo ""
echo "🚀 Running fix-caregiver-relationship script..."
ssh $SSH_OPTS ec2-user@$STAGING_IP "
  docker exec staging_app node /usr/src/bianca-app/src/scripts/fix-caregiver-relationship.js '$PATIENT_EMAIL' '$CAREGIVER_EMAIL'
"

echo ""
echo "✅ Done!"

