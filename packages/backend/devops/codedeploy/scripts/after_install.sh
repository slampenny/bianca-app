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
# CRITICAL: Remove ALL old images first to force fresh pull
echo "   Removing ALL old images to force fresh pull..."
cd "$DEPLOY_DIR"
docker compose down 2>/dev/null || true

# Remove ALL bianca-app images by ID (most reliable)
echo "   Removing all cached bianca-app images..."
docker images --format "{{.ID}} {{.Repository}}" | grep "bianca-app" | awk '{print $1}' | xargs -r docker rmi -f 2>/dev/null || true
docker images | grep "bianca-app" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

# Force remove dangling images
docker image prune -af || true

# CRITICAL: Pull images directly by tag to force fresh pull from ECR
# docker compose pull doesn't always pull if tag exists locally
echo "   Pulling latest Docker images directly from ECR (5 min timeout)..."
ECR_REGISTRY="730335291008.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Determine image tag based on environment
if echo "$INSTANCE_NAME" | grep -qi "production"; then
  IMAGE_TAG="production"
else
  IMAGE_TAG="staging"
fi

echo "   Pulling backend image: ${ECR_REGISTRY}/bianca-app-backend:${IMAGE_TAG}"
timeout 300 docker pull ${ECR_REGISTRY}/bianca-app-backend:${IMAGE_TAG} || {
  echo "⚠️  Backend image pull failed, trying latest tag..."
  timeout 300 docker pull ${ECR_REGISTRY}/bianca-app-backend:latest || echo "⚠️  Backend pull failed"
}

echo "   Pulling frontend image: ${ECR_REGISTRY}/bianca-app-frontend:${IMAGE_TAG}"
timeout 300 docker pull ${ECR_REGISTRY}/bianca-app-frontend:${IMAGE_TAG} || {
  echo "⚠️  Frontend image pull failed, trying latest tag..."
  timeout 300 docker pull ${ECR_REGISTRY}/bianca-app-frontend:latest || echo "⚠️  Frontend pull failed"
}

echo "   Pulling asterisk image: ${ECR_REGISTRY}/bianca-app-asterisk:${IMAGE_TAG}"
timeout 300 docker pull ${ECR_REGISTRY}/bianca-app-asterisk:${IMAGE_TAG} || {
  echo "⚠️  Asterisk image pull failed, trying latest tag..."
  timeout 300 docker pull ${ECR_REGISTRY}/bianca-app-asterisk:latest || echo "⚠️  Asterisk pull failed"
}

# Verify what we actually pulled
echo ""
echo "   =========================================="
echo "   VERIFICATION: Images pulled from ECR"
echo "   =========================================="
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Digest}}\t{{.CreatedAt}}\t{{.ID}}" | grep -E "REPOSITORY|bianca-app" || echo "   (No bianca-app images found)"
echo "   =========================================="

echo "✅ AfterInstall completed"

