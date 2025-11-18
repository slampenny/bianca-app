#!/bin/bash
# AfterInstall hook - Pull Docker images and prepare deployment

set -e

echo "📥 AfterInstall: Pulling Docker images and preparing deployment..."

# Detect environment from instance Name tag
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
AWS_REGION="us-east-2"
INSTANCE_NAME=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "")

# Determine environment based on instance name
if echo "$INSTANCE_NAME" | grep -qi "production"; then
  DEPLOY_DIR="/opt/bianca-production"
else
  DEPLOY_DIR="/opt/bianca-staging"
fi

echo "   Detected deployment directory: $DEPLOY_DIR"

# Clean up Docker to free up space before pulling new images
echo "   Cleaning up Docker (removing unused images, containers, volumes)..."
docker system prune -af --volumes || {
  echo "⚠️  Docker cleanup had some issues, but continuing..."
}

# Check available disk space
AVAILABLE_SPACE=$(df -h / | awk 'NR==2 {print $4}' | sed 's/G//')
echo "   Available disk space: ${AVAILABLE_SPACE}G"

# Login to ECR if needed
ECR_TOKEN_FILE=/tmp/ecr-token-$(date +%Y%m%d)
if [ ! -f "$ECR_TOKEN_FILE" ]; then
  echo "   Logging into ECR..."
  aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin 730335291008.dkr.ecr.$AWS_REGION.amazonaws.com || {
    echo "❌ ECR login failed"
    exit 1
  }
  touch "$ECR_TOKEN_FILE"
else
  echo "   Using cached ECR token"
fi

# Note: docker-compose.yml is already on the instance at $DEPLOY_DIR/docker-compose.yml
# We just need to pull the latest images

# Pull latest images (with timeout to prevent hangs)
echo "   Pulling latest Docker images (5 min timeout)..."
cd "$DEPLOY_DIR"
timeout 300 docker-compose pull || {
  echo "⚠️  Image pull timed out or failed, but continuing..."
}

echo "✅ AfterInstall completed"

