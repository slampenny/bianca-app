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
    
    # Try multiple approaches for ECR login
    echo "🔄 Attempting ECR login..."
    
    # Method 1: Standard AWS CLI with profile
    if aws ecr get-login-password --region us-east-2 --profile jordan 2>/dev/null | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com >/dev/null 2>&1; then
        echo "✅ ECR login successful for $context (method 1)"
        return 0
    fi
    
    # Method 2: Try without profile (uses default credentials)
    if aws ecr get-login-password --region us-east-2 2>/dev/null | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com >/dev/null 2>&1; then
        echo "✅ ECR login successful for $context (method 2)"
        return 0
    fi
    
    # Method 3: Try with explicit credentials
    if AWS_PROFILE=jordan aws ecr get-login-password --region us-east-2 2>/dev/null | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com >/dev/null 2>&1; then
        echo "✅ ECR login successful for $context (method 3)"
        return 0
    fi
    
    echo "❌ ECR login failed for $context after trying multiple methods."
    echo "💡 This is a known WSL2 issue. Try running this command manually:"
    echo "   aws ecr get-login-password --region us-east-2 --profile jordan | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com"
    echo "   Then run the deployment script again."
    echo "⚠️  Continuing deployment without ECR push (images will be built locally only)"
    return 1
}

echo "🚀 Deploying Bianca Production Environment..."

# Check for flags
SKIP_ECR=false
SKIP_BACKEND_PUSH=false
SKIP_FRONTEND_PUSH=false
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

# Logout from Docker Hub to avoid credential issues in WSL2
echo "🔓 Logging out from Docker Hub to avoid credential issues..."
docker logout docker.io 2>/dev/null || true

# Simple build like staging (uses cached images if available)
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
    if ! check_and_login_ecr "backend push"; then
        echo "⚠️  Skipping backend ECR push due to login failure"
        SKIP_BACKEND_PUSH=true
    fi
else
    echo "⏭️  Skipping ECR login for backend push"
fi

if [ "$SKIP_BACKEND_PUSH" != true ]; then
    echo "📦 Pushing backend image to ECR..."
    docker tag bianca-app-backend:production 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:production
    docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:production

    if [ $? -ne 0 ]; then
        echo "❌ Backend docker push failed. Please check the error above."
        exit 1
    fi
    # Clean up local image after successful push to save space
    echo "🧹 Cleaning up local backend image..."
    docker rmi bianca-app-backend:production 2>/dev/null || true
else
    echo "⏭️  Skipping backend ECR push"
fi

echo "🐳 Building and pushing frontend Docker image..."
cd ../bianca-app-frontend

# Logout from Docker Hub again before frontend build (in case we logged back in for ECR)
docker logout docker.io 2>/dev/null || true

# Simple build like staging (uses cached images if available)
docker build -t bianca-app-frontend:production -f devops/Dockerfile --build-arg BUILD_ENV=production .

if [ $? -ne 0 ]; then
    echo "❌ Frontend docker build failed. Please check the error above."
    exit 1
fi

docker tag bianca-app-frontend:production 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:production

# Check and login to ECR for frontend (credentials might have expired)
if [ "$SKIP_ECR" = false ]; then
    if ! check_and_login_ecr "frontend push"; then
        echo "⚠️  Skipping frontend ECR push due to login failure"
        SKIP_FRONTEND_PUSH=true
    fi
else
    echo "⏭️  Skipping ECR login for frontend push"
fi

if [ "$SKIP_FRONTEND_PUSH" != true ]; then
    echo "📦 Pushing frontend image to ECR..."
    docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:production

    if [ $? -ne 0 ]; then
        echo "❌ Frontend docker push failed. Please check the error above."
        exit 1
    fi
    # Clean up local image after successful push to save space
    echo "🧹 Cleaning up local frontend image..."
    docker rmi bianca-app-frontend:production 2>/dev/null || true
else
    echo "⏭️  Skipping frontend ECR push"
fi

cd ../bianca-app-backend

# Clean up Docker build cache and untagged images to free up space
echo "🧹 Cleaning up Docker build cache and untagged images..."
docker builder prune -f 2>/dev/null || true
docker image prune -f 2>/dev/null || true
# Remove untagged ECR images
docker images | grep "730335291008.dkr.ecr.us-east-2.amazonaws.com" | grep "<none>" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

# Step 2: Build Lambda packages for HIPAA backups (if directories exist)
if [ -d "devops/terraform/lambda-backup" ]; then
    echo "📦 Building Lambda packages for HIPAA backups..."
    
    cd devops/terraform/lambda-backup
    yarn install --production --frozen-lockfile 2>/dev/null || yarn install --production
    cd ..
    zip -q -r lambda-backup.zip lambda-backup/node_modules lambda-backup/index.js lambda-backup/package.json
    echo "  ✅ lambda-backup.zip created"
    
    cd lambda-verify
    yarn install --production --frozen-lockfile 2>/dev/null || yarn install --production
    cd ..
    zip -q -r lambda-verify-backup.zip lambda-verify/node_modules lambda-verify/verify.js lambda-verify/package.json
    echo "  ✅ lambda-verify-backup.zip created"
    
    cd lambda-restore
    yarn install --production --frozen-lockfile 2>/dev/null || yarn install --production
    cd ..
    zip -q -r lambda-restore.zip lambda-restore/node_modules lambda-restore/restore.js lambda-restore/package.json
    echo "  ✅ lambda-restore.zip created"
    
    cd ../..
fi

# Step 3: Deploy production infrastructure (preserves database)
echo "🚀 Deploying production infrastructure..."
echo "📋 Setting terraform environment to production..."
export TF_VAR_environment=production

# Use yarn terraform:deploy like staging does
yarn terraform:deploy

# Step 2.5: If userdata changes were made, recreate the instance
echo "🔄 Checking if instance needs to be recreated due to userdata changes..."
# This will be handled by Terraform if the userdata script changed

echo "✅ Production infrastructure deployed!"

# Step 3: Update running containers with new images
echo "🔄 Updating production containers with new images..."
PRODUCTION_IP=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=bianca-production" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --profile jordan)

if [ -n "$PRODUCTION_IP" ]; then
    echo "Updating containers on production instance: $PRODUCTION_IP"
    
    # Wait for instance to finish initialization
    echo "⏳ Waiting for instance to finish initialization (userdata script)..."
    MAX_WAIT=300  # 5 minutes
    ELAPSED=0
    while [ $ELAPSED -lt $MAX_WAIT ]; do
        if ssh -i ~/.ssh/bianca-key-pair.pem -o ConnectTimeout=5 -o StrictHostKeyChecking=no ec2-user@$PRODUCTION_IP "test -d /opt/bianca-production && test -f /opt/bianca-production/docker-compose.yml" 2>/dev/null; then
            echo "✅ Instance initialization complete!"
            break
        fi
        echo "Still waiting for userdata script to complete... ($ELAPSED seconds)"
        sleep 10
        ELAPSED=$((ELAPSED + 10))
    done
    
    if [ $ELAPSED -ge $MAX_WAIT ]; then
        echo "❌ Instance initialization timed out after $MAX_WAIT seconds"
        echo "You may need to check the instance manually or wait longer"
        exit 1
    fi
    
    # NOTE: Do NOT copy docker-compose files!
    # The production-userdata.sh script creates docker-compose.yml dynamically
    # with secrets from AWS Secrets Manager. Copying local files would overwrite these.
    echo "ℹ️  Using docker-compose.yml created by instance userdata (contains AWS secrets)"
    
    # Add SSH options to avoid host key verification prompts
    SSH_OPTS="-i ~/.ssh/bianca-key-pair.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
    
    ssh $SSH_OPTS ec2-user@$PRODUCTION_IP "
      cd /opt/bianca-production
      
      # Login to ECR
      aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com
      
      # Create MongoDB data directory
      sudo mkdir -p /opt/mongodb-data && sudo chown 999:999 /opt/mongodb-data
      
      # Pull latest images (use only the userdata-created docker-compose.yml)
      docker-compose pull
      
      if [ '$FORCE_CLEANUP' = 'true' ]; then
        echo 'Force cleanup: Stopping and removing ALL containers...'
        
        # Stop and remove all containers
        docker-compose down || true
        
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
        echo 'Stopping and removing application containers (preserving MongoDB)...'
        
        # Stop and remove only the application containers (not MongoDB)
        # Note: docker-compose uses service names, not container names
        docker-compose stop app asterisk frontend nginx || true
        docker-compose rm -f app asterisk frontend nginx || true
        
        # Remove any orphaned containers with our project names
        docker rm -f \$(docker ps -aq --filter 'name=production_app') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=production_asterisk') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=production_frontend') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=production_nginx') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=production_bianca-app') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=bianca-app') 2>/dev/null || true
        
        # Clean up unused images and networks
        docker image prune -f
        docker network prune -f
      fi
      
      echo 'Starting new containers...'
      
      # Check if MongoDB container already exists (running or stopped)
      if docker ps -aq --filter 'name=production_mongodb' | grep -q .; then
        echo 'MongoDB container already exists, starting only app, asterisk, frontend, and nginx...'
        # Start only the application services, skip MongoDB
        docker-compose up -d --no-deps app asterisk frontend nginx
      else
        echo 'Starting all containers (including MongoDB)...'
        # Start all containers (MongoDB will be created)
        docker-compose up -d
      fi
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

# Run post-deployment validation
echo ""
echo "🔍 Running post-deployment validation..."
if [ -f "./scripts/validate-production-deployment.sh" ]; then
    ./scripts/validate-production-deployment.sh || echo "⚠️  Validation found some issues - please review above"
else
    echo "⚠️  Validation script not found, skipping..."
fi

echo "🎉 Production deployment complete!"
echo "🌐 Production API: https://api.myphonefriend.com"
echo "🌐 Production Frontend: https://app.myphonefriend.com"
echo "🔗 SIP Endpoint: sip.myphonefriend.com"
echo ""
echo "💡 Usage:"
echo "   ./scripts/deploy-production.sh                    # Normal deployment (preserves MongoDB)"
echo "   ./scripts/deploy-production.sh --skip-ecr         # Skip ECR login checks"
echo "   ./scripts/deploy-production.sh --force-cleanup    # Remove ALL containers including MongoDB"