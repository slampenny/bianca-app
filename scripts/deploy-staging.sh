#!/bin/bash
# Deploy staging environment script
#
# AWS Credential Setup:
# To avoid having to re-login every time, set up AWS credential caching:
# 1. For AWS SSO: Run 'aws sso login' once per day
# 2. For long-term credentials: Configure with 'aws configure'
# 3. For credential caching: Install aws-vault or similar tool

# Helper function to check and login to ECR
check_and_login_ecr() {
    local context="$1"
    echo "🔐 Checking ECR access for $context..."
    
    # Check if Docker is already logged into ECR
    if docker info | grep -q "730335291008.dkr.ecr.us-east-2.amazonaws.com" 2>/dev/null; then
        echo "✅ ECR credentials are still valid for $context, skipping login"
        return 0
    fi
    
    echo "🔐 Logging into ECR for $context..."
    aws ecr get-login-password --region us-east-2 --profile jordan | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com
    
    if [ $? -ne 0 ]; then
        echo "❌ ECR login failed for $context. Please check your AWS credentials and try again."
        return 1
    fi
    echo "✅ ECR login successful for $context"
    return 0
}

echo "🚀 Deploying Bianca Staging Environment..."

# Step 1: Build and push Docker images (backend and frontend)
echo "🐳 Building and pushing backend Docker image..."
docker build -t bianca-app-backend:staging .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed. Please check the error above."
    exit 1
fi

docker tag bianca-app-backend:staging 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:staging

echo "🔐 Checking AWS credentials..."
export AWS_PROFILE=jordan

# Check if AWS credentials are valid
if ! aws sts get-caller-identity --profile jordan >/dev/null 2>&1; then
    echo "❌ AWS credentials not valid or expired. Please run 'aws configure' or 'aws sso login'"
    exit 1
fi

echo "✅ AWS credentials are valid"

# Check and login to ECR for backend
check_and_login_ecr "backend push" || exit 1

echo "📦 Pushing backend image to ECR..."
docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:staging

if [ $? -ne 0 ]; then
    echo "❌ Backend docker push failed. Please check the error above."
    exit 1
fi

echo "🐳 Building and pushing frontend Docker image..."
cd ../bianca-app-frontend
# Build frontend with staging config for proper environment
docker build -t bianca-app-frontend:staging -f devops/Dockerfile --build-arg BUILD_ENV=staging .

if [ $? -ne 0 ]; then
    echo "❌ Frontend docker build failed. Please check the error above."
    exit 1
fi

docker tag bianca-app-frontend:staging 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:staging

# Check and login to ECR for frontend (credentials might have expired)
check_and_login_ecr "frontend push" || exit 1

echo "📦 Pushing frontend image to ECR..."
docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:staging

if [ $? -ne 0 ]; then
    echo "❌ Frontend docker push failed. Please check the error above."
    exit 1
fi

cd ../bianca-app-backend

# Step 2: Deploy staging infrastructure (preserves database)
echo "🚀 Deploying staging infrastructure..."
yarn terraform:deploy

echo "✅ Staging infrastructure deployed!"

# Step 3: Update running containers with new images
echo "🔄 Updating staging containers with new images..."
STAGING_IP=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=bianca-staging" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --profile jordan)

if [ -n "$STAGING_IP" ]; then
    echo "Updating containers on staging instance: $STAGING_IP"
    
    # Copy staging override file to the instance
    echo "Copying staging override configuration..."
    scp -i ~/.ssh/bianca-key-pair.pem docker-compose.staging.yml ec2-user@$STAGING_IP:~/ && ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@$STAGING_IP "sudo mv ~/docker-compose.staging.yml /opt/bianca-staging/ && sudo chown root:root /opt/bianca-staging/docker-compose.staging.yml"
    
    ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@$STAGING_IP "
      cd /opt/bianca-staging
      
      # Login to ECR
      aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com
      
      # Create MongoDB data directory
      sudo mkdir -p /opt/mongodb-data && sudo chown 999:999 /opt/mongodb-data
      
      # Pull latest images
      docker-compose -f docker-compose.yml -f docker-compose.staging.yml pull
      
      echo 'Stopping and removing all containers...'
      
      # Stop and remove all containers more aggressively
      docker-compose -f docker-compose.yml -f docker-compose.staging.yml down || true
      
      # Force stop all running containers
      docker stop \$(docker ps -q) 2>/dev/null || true
      
      # Force remove all containers
      docker rm \$(docker ps -aq) 2>/dev/null || true
      
      # Remove any dangling containers
      docker container prune -f
      
      # Clean up system
      docker system prune -f
      
      echo 'Starting new containers...'
      
      # Start new containers
      docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
    "
    
    if [ $? -eq 0 ]; then
        echo "✅ Staging containers updated successfully!"
    else
        echo "❌ Failed to update staging containers"
        exit 1
    fi
else
    echo "❌ Could not find staging instance IP"
    exit 1
fi

echo "🧪 Testing staging environment..."
echo "Waiting 30 seconds for deployment to complete..."
sleep 30

echo "Testing staging API..."
curl -f https://staging-api.myphonefriend.com/health && echo "✅ Staging environment is healthy!" || echo "❌ Staging environment health check failed"

echo "🎉 Staging deployment complete!"
echo "🌐 Staging API: https://staging-api.myphonefriend.com"
echo "🌐 Staging Frontend: https://staging.myphonefriend.com"
echo "🔗 SIP Endpoint: staging-sip.myphonefriend.com"