#!/bin/bash

# Production deployment script for Bianca (backend + frontend)
# This script deploys both backend and frontend to production environment
# Similar to staging but for production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check and login to ECR
check_and_login_ecr() {
    local context=$1
    echo "🔐 Checking ECR login for $context..."
    
    if aws ecr get-login-password --region us-east-2 --profile jordan | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com >/dev/null 2>&1; then
        echo "✅ ECR login successful for $context"
        return 0
    else
        echo "❌ ECR login failed for $context. This is a known WSL2 issue."
        echo "💡 Try running this command manually:"
        echo "   aws ecr get-login-password --region us-east-2 --profile jordan | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com"
        echo "   Then run the deployment script again."
        return 1
    fi
}

echo "🚀 Deploying Bianca Production Environment..."

# Check for flags
SKIP_ECR=false
FORCE_CLEANUP=false

for arg in "$@"; do
    case $arg in
        --skip-ecr)
            echo "⚠️  Skipping ECR login checks (--skip-ecr flag provided)"
            echo "   Make sure you've manually logged into ECR first!"
            SKIP_ECR=true
            ;;
        --force-cleanup)
            echo "⚠️  Force cleanup mode enabled (--force-cleanup flag provided)"
            echo "   This will remove ALL containers including MongoDB!"
            FORCE_CLEANUP=true
            ;;
    esac
done

# Step 1: Build and push Docker images (backend and frontend)
echo "🐳 Building and pushing backend Docker image..."
docker build -t bianca-app-backend:production .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed. Please check the error above."
    exit 1
fi

docker tag bianca-app-backend:production 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:production

echo "🔐 Checking AWS credentials..."
export AWS_PROFILE=jordan

# Check if AWS credentials are valid
if ! aws sts get-caller-identity --profile jordan >/dev/null 2>&1; then
    echo "❌ AWS credentials not valid or expired. Please run 'aws configure' or 'aws sso login'"
    exit 1
fi

echo "✅ AWS credentials are valid"

# Check and login to ECR for backend
if [ "$SKIP_ECR" = false ]; then
    check_and_login_ecr "backend push" || exit 1
else
    echo "⏭️  Skipping ECR login for backend push"
fi

echo "📦 Pushing backend image to ECR..."
docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:production

if [ $? -ne 0 ]; then
    echo "❌ Backend docker push failed. Please check the error above."
    exit 1
fi

echo "🐳 Building and pushing frontend Docker image..."
cd ../bianca-app-frontend
# Build frontend with production config for proper environment
docker build -t bianca-app-frontend:production -f devops/Dockerfile --build-arg BUILD_ENV=production .

if [ $? -ne 0 ]; then
    echo "❌ Frontend docker build failed. Please check the error above."
    exit 1
fi

docker tag bianca-app-frontend:production 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:production

# Check and login to ECR for frontend (credentials might have expired)
if [ "$SKIP_ECR" = false ]; then
    check_and_login_ecr "frontend push" || exit 1
else
    echo "⏭️  Skipping ECR login for frontend push"
fi

echo "📦 Pushing frontend image to ECR..."
docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:production

if [ $? -ne 0 ]; then
    echo "❌ Frontend docker push failed. Please check the error above."
    exit 1
fi

cd ../bianca-app-backend

# Step 2: Deploy production infrastructure (preserves database)
echo "🚀 Deploying production infrastructure..."
yarn terraform:plan
docker run --rm -v "$(pwd):/app" -v "/home/jordanlapp/.aws:/root/.aws" -w /app/devops/terraform -e AWS_PROFILE=jordan -e AWS_SDK_LOAD_CONFIG=1 -e AWS_DEFAULT_REGION=us-east-2 hashicorp/terraform:latest apply --auto-approve

# Step 2.5: If userdata changes were made, recreate the instance
echo "🔄 Checking if instance needs to be recreated due to userdata changes..."
# This will be handled by Terraform if the userdata script changed

echo "✅ Production infrastructure deployed!"

# Step 3: Update running containers with new images
echo "🔄 Updating production containers with new images..."
PRODUCTION_IP=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=bianca-production" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --profile jordan)

if [ -n "$PRODUCTION_IP" ]; then
    echo "Updating containers on production instance: $PRODUCTION_IP"
    
    # Copy production override file to the instance
    echo "Copying production override configuration..."
    scp -i ~/.ssh/bianca-key-pair.pem docker-compose.production.yml ec2-user@$PRODUCTION_IP:~/ && ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@$PRODUCTION_IP "sudo mv ~/docker-compose.production.yml /opt/bianca-production/ && sudo chown root:root /opt/bianca-production/docker-compose.production.yml"
    
    ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@$PRODUCTION_IP "
      cd /opt/bianca-production
      
      # Login to ECR
      aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com
      
      # Create MongoDB data directory
      sudo mkdir -p /opt/mongodb-data && sudo chown 999:999 /opt/mongodb-data
      
      # Pull latest images
      docker-compose -f docker-compose.yml -f docker-compose.production.yml pull
      
      if [ '$FORCE_CLEANUP' = 'true' ]; then
        echo 'Force cleanup: Stopping and removing ALL containers...'
        
        # Stop and remove all containers
        docker-compose -f docker-compose.yml -f docker-compose.production.yml down || true
        
        # Force stop all running containers
        docker stop \$(docker ps -q) 2>/dev/null || true
        
        # Force remove all containers
        docker rm \$(docker ps -aq) 2>/dev/null || true
        
        # Clean up everything
        docker container prune -f
        docker image prune -f
        docker network prune -f
        docker system prune -f
      else
        
        
        # Stop and remove only the application containers (not MongoDB)
        docker-compose -f docker-compose.yml -f docker-compose.production.yml stop backend frontend || true
        docker-compose -f docker-compose.yml -f docker-compose.production.yml rm -f backend frontend || true
        
        # Remove any orphaned containers with our project names
        docker rm -f \$(docker ps -aq --filter 'name=production_backend') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=production_frontend') 2>/dev/null || true
        
        # Clean up unused images and networks
        docker image prune -f
        docker network prune -f
      fi
      
      echo 'Starting new containers...'
      
      # Start new containers (MongoDB will continue running if it exists)
      docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d
    "
    
    if [ $? -eq 0 ]; then
        echo "✅ Production containers updated successfully!"
    else
        echo "❌ Failed to update production containers"
        exit 1
    fi
else
    echo "❌ Could not find production instance IP"
    exit 1
fi

echo "🧪 Testing production environment..."
echo "Waiting 30 seconds for deployment to complete..."
sleep 30

echo "Testing production API..."
curl -f https://api.myphonefriend.com/health && echo "✅ Production environment is healthy!" || echo "❌ Production environment health check failed"

echo "🎉 Production deployment complete!"
echo "🌐 Production API: https://api.myphonefriend.com"
echo "🌐 Production Frontend: https://app.myphonefriend.com"
echo "🔗 SIP Endpoint: sip.myphonefriend.com"
echo ""
echo "💡 Usage:"
echo "   ./scripts/deploy-production.sh                    # Normal deployment (preserves MongoDB)"
echo "   ./scripts/deploy-production.sh --skip-ecr         # Skip ECR login checks"
echo "   ./scripts/deploy-production.sh --force-cleanup    # Remove ALL containers including MongoDB"