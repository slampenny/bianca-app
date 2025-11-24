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
    
    local ecr_registry="730335291008.dkr.ecr.us-east-2.amazonaws.com"
    local login_success=false
    
    # Method 1: Standard AWS CLI with profile
    echo "   Trying method 1 (AWS CLI with profile)..."
    if aws ecr get-login-password --region us-east-2 --profile jordan 2>&1 | docker login --username AWS --password-stdin "$ecr_registry" 2>&1; then
        login_success=true
        echo "✅ ECR login successful for $context (method 1)"
    else
        echo "   Method 1 failed, trying method 2..."
    fi
    
    # Method 2: Try without profile (uses default credentials)
    if [ "$login_success" = false ]; then
        if aws ecr get-login-password --region us-east-2 2>&1 | docker login --username AWS --password-stdin "$ecr_registry" 2>&1; then
            login_success=true
            echo "✅ ECR login successful for $context (method 2)"
        else
            echo "   Method 2 failed, trying method 3..."
        fi
    fi
    
    # Method 3: Try with explicit credentials
    if [ "$login_success" = false ]; then
        if AWS_PROFILE=jordan aws ecr get-login-password --region us-east-2 2>&1 | docker login --username AWS --password-stdin "$ecr_registry" 2>&1; then
            login_success=true
            echo "✅ ECR login successful for $context (method 3)"
        fi
    fi
    
    # Verify login actually worked by checking Docker config
    if [ "$login_success" = true ]; then
        # Wait a moment for credentials to be written
        sleep 1
        
        # Try to verify by checking if we can access the registry (without actually pulling)
        if docker manifest inspect "$ecr_registry/bianca-app-backend:production" >/dev/null 2>&1 || \
           docker manifest inspect "$ecr_registry/bianca-app-backend:staging" >/dev/null 2>&1; then
            echo "✅ ECR credentials verified - can access registry"
            return 0
        else
            echo "⚠️  ECR login appeared successful but credentials may not be valid"
            echo "   This is a known WSL2 issue. Will attempt push anyway..."
            return 0
        fi
    fi
    
    echo "❌ ECR login failed for $context after trying multiple methods."
    echo "💡 This is a known WSL2 issue. Try running this command manually:"
    echo "   aws ecr get-login-password --region us-east-2 --profile jordan | docker login --username AWS --password-stdin $ecr_registry"
    echo "   Then run the deployment script again."
    echo "⚠️  Continuing deployment without ECR push (images will be built locally only)"
    return 1
}

check_and_login_public_ecr() {
    echo "🔐 Checking Public ECR login (public.ecr.aws)..."
    export DOCKER_CONFIG=/tmp/docker-nocreds
    mkdir -p "$DOCKER_CONFIG"
    [ -f "$DOCKER_CONFIG/config.json" ] || printf '{}' > "$DOCKER_CONFIG/config.json"
    if aws ecr-public get-login-password --region us-east-1 2>/dev/null | docker login --username AWS --password-stdin public.ecr.aws >/dev/null 2>&1; then
        echo "✅ Public ECR login successful (public.ecr.aws)"
        return 0
    fi
    echo "❌ Public ECR login failed. Base image pulls from public.ecr.aws may fail."
    return 1
}

echo "🚀 Deploying Bianca Production Environment..."

# Check for flags
SKIP_ECR=false
SKIP_BACKEND_PUSH=false
SKIP_FRONTEND_PUSH=false
SKIP_ASTERISK_PUSH=false
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

# Step 1: Build and push Docker images (backend, frontend, and asterisk) - PARALLEL
echo "🐳 Building Docker images in parallel..."

# Logout from Docker Hub to avoid credential issues in WSL2
echo "🔓 Logging out from Docker Hub to avoid credential issues..."
docker logout docker.io 2>/dev/null || true

# Login to ECR once for all images
echo "🔐 Checking AWS credentials..."
export AWS_PROFILE=jordan

# Check if AWS credentials are valid
if ! aws sts get-caller-identity --profile jordan >/dev/null 2>&1; then
    echo "❌ AWS credentials not valid or expired. Please run 'aws configure' or 'aws sso login'"
    exit 1
fi

echo "✅ AWS credentials are valid"

# Login to ECR once
if [ "$SKIP_ECR" = false ]; then
    if ! check_and_login_ecr "all images"; then
        echo "⚠️  ECR login failed. Continuing with local builds only."
        SKIP_BACKEND_PUSH=true
        SKIP_FRONTEND_PUSH=true
        SKIP_ASTERISK_PUSH=true
    fi
fi

# Build all images in parallel using background jobs
echo "🔨 Building backend, frontend, and asterisk images in parallel..."

# Build backend
(docker build -t bianca-app-backend:production . && echo "✅ Backend build complete") &
BACKEND_PID=$!

# Build asterisk (need to login to public ECR first)
check_and_login_public_ecr || true
(cd devops/asterisk && docker build -t bianca-app-asterisk:production . && echo "✅ Asterisk build complete") &
ASTERISK_PID=$!

# Build frontend
(cd ../bianca-app-frontend && docker build -t bianca-app-frontend:production -f devops/Dockerfile --build-arg BUILD_ENV=production . && echo "✅ Frontend build complete") &
FRONTEND_PID=$!

# Wait for all builds to complete
echo "⏳ Waiting for all builds to complete..."
wait $BACKEND_PID
BACKEND_EXIT=$?
wait $ASTERISK_PID
ASTERISK_EXIT=$?
wait $FRONTEND_PID
FRONTEND_EXIT=$?

# Check for build failures
if [ $BACKEND_EXIT -ne 0 ]; then
    echo "❌ Backend Docker build failed."
    exit 1
fi
if [ $ASTERISK_EXIT -ne 0 ]; then
    echo "❌ Asterisk Docker build failed."
    exit 1
fi
if [ $FRONTEND_EXIT -ne 0 ]; then
    echo "❌ Frontend Docker build failed."
    exit 1
fi

echo "✅ All Docker builds completed successfully!"

# Tag images
docker tag bianca-app-backend:production 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:production
docker tag bianca-app-asterisk:production 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-asterisk:production
docker tag bianca-app-frontend:production 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:production

# Re-authenticate with ECR right before pushing (credentials may have expired during build)
echo "🔐 Re-authenticating with ECR before push..."
export DOCKER_CONFIG=/tmp/docker-nocreds
mkdir -p "$DOCKER_CONFIG"
printf '{}' > "$DOCKER_CONFIG/config.json"
if ! aws ecr get-login-password --region us-east-2 --profile jordan 2>&1 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com 2>&1; then
    echo "⚠️  Re-authentication failed, trying without profile..."
    aws ecr get-login-password --region us-east-2 2>&1 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com 2>&1 || {
        echo "❌ ECR re-authentication failed. Cannot push images."
        exit 1
    }
fi
echo "✅ ECR re-authentication successful"

# Push images in parallel
echo "📦 Pushing images to ECR in parallel..."
if [ "$SKIP_BACKEND_PUSH" != true ]; then
    (docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:production && echo "✅ Backend pushed") &
    BACKEND_PUSH_PID=$!
else
    BACKEND_PUSH_PID=""
fi

if [ "$SKIP_ASTERISK_PUSH" != true ]; then
    (docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-asterisk:production && echo "✅ Asterisk pushed") &
    ASTERISK_PUSH_PID=$!
else
    ASTERISK_PUSH_PID=""
fi

if [ "$SKIP_FRONTEND_PUSH" != true ]; then
    (docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:production && echo "✅ Frontend pushed") &
    FRONTEND_PUSH_PID=$!
else
    FRONTEND_PUSH_PID=""
fi

# Wait for all pushes
[ -n "$BACKEND_PUSH_PID" ] && wait $BACKEND_PUSH_PID
[ -n "$ASTERISK_PUSH_PID" ] && wait $ASTERISK_PUSH_PID
[ -n "$FRONTEND_PUSH_PID" ] && wait $FRONTEND_PUSH_PID

echo "✅ All images pushed to ECR!"

# Clean up local images
echo "🧹 Cleaning up local images..."
docker rmi bianca-app-backend:production 2>/dev/null || true
docker rmi bianca-app-asterisk:production 2>/dev/null || true
docker rmi bianca-app-frontend:production 2>/dev/null || true

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
echo "🚀 Checking if infrastructure changes are needed..."
echo "📋 Running terraform plan to detect changes..."

cd devops/terraform
export AWS_PROFILE=jordan
export AWS_DEFAULT_REGION=us-east-2
export TF_VAR_environment=production

# Run terraform plan and check if there are any changes
PLAN_OUTPUT=$(terraform plan -no-color -input=false 2>&1)
PLAN_EXIT=$?

if [ $PLAN_EXIT -ne 0 ]; then
    echo "❌ Terraform plan failed. Proceeding with full apply..."
    terraform apply --auto-approve
elif echo "$PLAN_OUTPUT" | grep -q "No changes"; then
    echo "✅ No infrastructure changes detected. Skipping Terraform apply."
    echo "   (This saves ~2-3 minutes)"
else
    echo "📋 Infrastructure changes detected. Applying..."
    terraform apply --auto-approve
fi

cd ../..
echo "✅ Production infrastructure check complete!"

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
      
      # Login to ECR (cache token for 12 hours to avoid repeated logins)
      ECR_TOKEN_FILE=/tmp/ecr-token-\$(date +%Y%m%d)
      if [ ! -f \"\$ECR_TOKEN_FILE\" ]; then
        echo 'Logging into ECR...'
        aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com
        touch \"\$ECR_TOKEN_FILE\"
      else
        echo 'Using cached ECR token'
      fi
      
      # Create MongoDB data directory
      sudo mkdir -p /opt/mongodb-data && sudo chown 999:999 /opt/mongodb-data
      
      # Pull latest images in parallel (docker-compose pull already does this, but we optimize)
      echo 'Pulling latest images...'
      docker-compose pull --parallel 2>/dev/null || docker-compose pull
      
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
        echo 'MongoDB container already exists...'
        # Remove the existing MongoDB container to avoid name conflicts
        echo 'Removing existing MongoDB container to avoid conflicts...'
        docker rm -f production_mongodb 2>/dev/null || true
        # Also try removing by the container ID if name doesn't work
        EXISTING_MONGODB=\$(docker ps -aq --filter 'name=production_mongodb' | head -1)
        if [ -n \"\$EXISTING_MONGODB\" ]; then
          docker rm -f \"\$EXISTING_MONGODB\" 2>/dev/null || true
        fi
        echo 'Starting all containers (MongoDB will be recreated)...'
        docker-compose up -d
      else
        echo 'Starting all containers (including MongoDB)...'
        # Start all containers (MongoDB will be created)
        docker-compose up -d
      fi
      
      # Wait for services to be ready with optimized health checks
      echo 'Waiting for services to be ready...'
      
      # Check MongoDB (faster check - just container running, not full ping)
      MAX_WAIT=20
      WAIT_COUNT=0
      while [ \$WAIT_COUNT -lt \$MAX_WAIT ]; do
        if docker ps --filter 'name=production_mongodb' --filter 'status=running' | grep -q production_mongodb; then
          # Quick MongoDB health check
          if docker exec production_mongodb mongosh --eval 'db.adminCommand(\"ping\")' --quiet >/dev/null 2>&1; then
            echo '✅ MongoDB is ready'
            break
          fi
        fi
        sleep 1
        WAIT_COUNT=\$((WAIT_COUNT + 1))
      done
      
      # Quick check for app container
      if docker ps --filter 'name=production_app' --filter 'status=running' | grep -q production_app; then
        echo '✅ App container is running'
      fi
      
      echo 'Container status:'
      docker ps --format 'table {{.Names}}\t{{.Status}}' | grep production || true
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
echo "🔗 SIP Endpoint: sip.biancawellness.com"
echo ""
echo "💡 Usage:"
echo "   ./scripts/deploy-production.sh                    # Normal deployment (preserves MongoDB)"
echo "   ./scripts/deploy-production.sh --skip-ecr         # Skip ECR login checks"
echo "   ./scripts/deploy-production.sh --force-cleanup    # Remove ALL containers including MongoDB"