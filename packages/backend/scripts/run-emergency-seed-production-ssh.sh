#!/bin/bash
# Script to seed emergency phrases on production EC2 instance via SSH

set -e

PROFILE="jordan"
REGION="us-east-2"

echo "🌱 Seeding Emergency Phrases on Production"
echo "=========================================="
echo ""

# Find SSH key
SSH_KEY=""
for key in "$HOME/.ssh/bianca-key-pair.pem" "/home/jordanlapp/.ssh/bianca-key-pair.pem" "./bianca-key-pair.pem"; do
    if [ -f "$key" ]; then
        SSH_KEY="$key"
        echo "✅ Found SSH key: $SSH_KEY"
        break
    fi
done

if [ -z "$SSH_KEY" ]; then
    echo "❌ SSH key not found"
    exit 1
fi

chmod 600 "$SSH_KEY" 2>/dev/null || true

# Get production IP
echo "Finding production instance..."
PROD_IP=$(aws ec2 describe-instances \
    --profile $PROFILE \
    --region $REGION \
    --filters "Name=tag:Environment,Values=production" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text 2>&1)

if [ -z "$PROD_IP" ] || [ "$PROD_IP" == "None" ] || [ "$PROD_IP" == "null" ]; then
    echo "❌ Could not find production instance"
    exit 1
fi

echo "✅ Production IP: $PROD_IP"
echo ""

# Run the seed script on production
echo "🚀 Running emergency phrases seeder on production..."
echo ""

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 ec2-user@$PROD_IP << 'PROD_EOF'
cd /opt/bianca-production 2>/dev/null || cd /opt/bianca-app-backend 2>/dev/null || cd /home/ec2-user/bianca-app-backend 2>/dev/null || { echo "ERROR: Could not find app directory"; exit 1; }

# Find the app container
APP_CONTAINER=$(docker ps --filter "name=production_app" --format "{{.Names}}" | head -1)

if [ -z "$APP_CONTAINER" ]; then
    echo "⚠️  App container not found, trying alternative names..."
    APP_CONTAINER=$(docker ps --filter "name=app" --format "{{.Names}}" | head -1)
fi

if [ -z "$APP_CONTAINER" ]; then
    echo "❌ Could not find app container"
    echo "   Available containers:"
    docker ps --format "table {{.Names}}\t{{.Image}}" || true
    exit 1
fi

echo "✅ Found app container: $APP_CONTAINER"
echo ""

# Run the seed script
# Note: seedDatabase.js includes emergency phrases seeding and will clear all data
# Since user doesn't care about data loss, we'll use seedDatabase.js
echo "⚠️  WARNING: This will clear ALL data and re-seed everything including emergency phrases"
echo "   Running seedDatabase.js..."
docker exec -i $APP_CONTAINER node /usr/src/bianca-app/src/scripts/seedDatabase.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Emergency phrases seeded successfully!"
    echo ""
    echo "💡 The localized emergency detector will now have phrases for all supported languages:"
    echo "   en, es, fr, de, zh, ja, pt, it, ru, ar, hi, zh-cn"
else
    echo ""
    echo "❌ Failed to seed emergency phrases"
    exit 1
fi
PROD_EOF

echo ""
echo "✅ Production seed completed!"

