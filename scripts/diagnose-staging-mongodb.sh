#!/bin/bash
# Diagnostic script to check MongoDB connectivity on staging

set -e

AWS_PROFILE="jordan"
REGION="us-east-2"

echo "🔍 Diagnosing MongoDB connectivity on staging..."

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

echo "📦 Checking Docker containers..."
ssh $SSH_OPTS ec2-user@$STAGING_IP "
  echo '=== Container Status ==='
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'staging_|NAMES' || echo 'No staging containers found'
  echo ''
  
  echo '=== All Containers (including stopped) ==='
  docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep -E 'staging_|NAMES' || echo 'No staging containers found'
  echo ''
  
  echo '=== MongoDB Container Details ==='
  if docker ps -a | grep -q staging_mongodb; then
    echo 'MongoDB container exists'
    docker inspect staging_mongodb --format 'Status: {{.State.Status}}' 2>/dev/null || echo 'Could not inspect MongoDB container'
    docker inspect staging_mongodb --format 'Network: {{range \$k, \$v := .NetworkSettings.Networks}}{{\$k}}{{end}}' 2>/dev/null || echo 'Could not get network info'
    echo ''
    echo 'MongoDB Logs (last 30 lines):'
    docker logs staging_mongodb --tail 30 2>/dev/null || echo 'Could not get MongoDB logs'
  else
    echo '❌ MongoDB container not found'
  fi
  echo ''
  
  echo '=== App Container Details ==='
  if docker ps -a | grep -q staging_app; then
    echo 'App container exists'
    docker inspect staging_app --format 'Status: {{.State.Status}}' 2>/dev/null || echo 'Could not inspect app container'
    docker inspect staging_app --format 'Network: {{range \$k, \$v := .NetworkSettings.Networks}}{{\$k}}{{end}}' 2>/dev/null || echo 'Could not get network info'
    echo ''
    echo 'App Environment Variables (MongoDB related):'
    docker exec staging_app env | grep -E 'MONGODB|NODE_ENV' 2>/dev/null || echo 'Could not get environment variables'
    echo ''
    echo 'App Logs (last 50 lines, MongoDB related):'
    docker logs staging_app --tail 50 2>/dev/null | grep -i mongo || echo 'No MongoDB-related logs found'
  else
    echo '❌ App container not found'
  fi
  echo ''
  
  echo '=== Docker Networks ==='
  docker network ls
  echo ''
  
  echo '=== Testing MongoDB Connectivity from App Container ==='
  if docker ps | grep -q staging_app; then
    echo 'Testing if app can reach MongoDB hostname...'
    docker exec staging_app ping -c 2 mongodb 2>/dev/null || echo '❌ Cannot ping mongodb hostname'
    echo ''
    echo 'Testing if app can reach MongoDB on port 27017...'
    docker exec staging_app nc -zv mongodb 27017 2>&1 || echo '❌ Cannot connect to mongodb:27017'
    echo ''
    echo 'Testing MongoDB connection from app container...'
    docker exec staging_app node -e \"
      const mongoose = require('mongoose');
      const url = process.env.MONGODB_URL || 'mongodb://mongodb:27017/bianca-service';
      console.log('Attempting to connect to:', url);
      mongoose.connect(url, { serverSelectionTimeoutMS: 5000 })
        .then(() => {
          console.log('✅ Connected successfully!');
          console.log('Connection state:', mongoose.connection.readyState);
          process.exit(0);
        })
        .catch(err => {
          console.error('❌ Connection failed:', err.message);
          process.exit(1);
        });
    \" 2>&1 || echo '❌ MongoDB connection test failed'
  else
    echo '⚠️  App container is not running, cannot test connectivity'
  fi
  echo ''
  
  echo '=== Testing MongoDB from Host ==='
  if docker ps | grep -q staging_mongodb; then
    echo 'Testing MongoDB from host (localhost:27017)...'
    docker exec staging_mongodb mongosh --eval 'db.adminCommand(\"ping\")' --quiet 2>&1 || echo '❌ MongoDB not responding'
  else
    echo '⚠️  MongoDB container is not running'
  fi
"

echo ""
echo "✅ Diagnosis complete!"


