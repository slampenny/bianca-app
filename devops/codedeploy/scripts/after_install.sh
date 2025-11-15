#!/bin/bash
# AfterInstall hook - Pull Docker images and prepare deployment

set -e

echo "📥 AfterInstall: Pulling Docker images and preparing deployment..."

cd /opt/bianca-staging-deploy

# Login to ECR if needed
ECR_TOKEN_FILE=/tmp/ecr-token-$(date +%Y%m%d)
if [ ! -f "$ECR_TOKEN_FILE" ]; then
  echo "   Logging into ECR..."
  aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com || {
    echo "❌ ECR login failed"
    exit 1
  }
  touch "$ECR_TOKEN_FILE"
else
  echo "   Using cached ECR token"
fi

# Note: docker-compose.yml is already on the instance at /opt/bianca-staging/docker-compose.yml
# We just need to pull the latest images

# Pull latest images (with timeout to prevent hangs)
echo "   Pulling latest Docker images (5 min timeout)..."
cd /opt/bianca-staging
timeout 300 docker-compose pull || {
  echo "⚠️  Image pull timed out or failed, but continuing..."
}

echo "✅ AfterInstall completed"

