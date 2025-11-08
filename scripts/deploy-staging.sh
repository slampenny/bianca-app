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

echo "🚀 Deploying Bianca Staging Environment..."

# Check for flags
SKIP_ECR=false
SKIP_BACKEND_PUSH=false
SKIP_FRONTEND_PUSH=false
SKIP_ASTERISK_PUSH=false
FORCE_CLEANUP=false
SKIP_GIT_CHECK=false

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
        --skip-git-check)
            echo "⚠️  Skipping git branch/status checks (--skip-git-check flag provided)"
            SKIP_GIT_CHECK=true
            ;;
    esac
done

# Git safety checks (unless skipped)
if [ "$SKIP_GIT_CHECK" = false ]; then
    echo "🔍 Checking git status..."
    
    # Check if we're in a git repo
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo "⚠️  Warning: Not in a git repository. Deploying local files as-is."
    else
        # Check current branch
        CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
        echo "   Current branch: $CURRENT_BRANCH"
        
        # Check for uncommitted changes
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            echo "⚠️  WARNING: You have uncommitted changes!"
            echo "   The deployment will include these uncommitted changes."
            echo "   Press Ctrl+C to cancel, or continue in 5 seconds..."
            sleep 5
        else
            echo "   ✓ No uncommitted changes"
        fi
        
        # Warn if not on main/master/staging branch
        if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" && "$CURRENT_BRANCH" != "staging" ]]; then
            echo "⚠️  WARNING: You're on branch '$CURRENT_BRANCH', not main/master/staging!"
            echo "   The deployment will use code from this branch."
            echo "   Press Ctrl+C to cancel, or continue in 5 seconds..."
            sleep 5
        fi
    fi
    echo ""
fi

# Step 1: Build and push Docker images (backend, frontend, and asterisk)
echo "🐳 Building and pushing backend Docker image..."

# Logout from Docker Hub to avoid credential issues in WSL2
echo "🔓 Logging out from Docker Hub to avoid credential issues..."
docker logout docker.io 2>/dev/null || true

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
    docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:staging
    if [ $? -ne 0 ]; then
        echo "❌ Backend docker push failed. Please check the error above."
        exit 1
    fi
    # Clean up local image after successful push to save space
    echo "🧹 Cleaning up local backend image..."
    docker rmi bianca-app-backend:staging 2>/dev/null || true
else
    echo "⏭️  Skipping backend ECR push"
fi

echo "🐳 Building and pushing asterisk Docker image..."
# Ensure we can pull the public ECR base image used by the Asterisk Dockerfile
check_and_login_public_ecr || true
docker build -t bianca-app-asterisk:staging ./devops/asterisk

if [ $? -ne 0 ]; then
    echo "❌ Asterisk docker build failed. Please check the error above."
    exit 1
fi

docker tag bianca-app-asterisk:staging 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-asterisk:staging

# Check and login to ECR for asterisk
if [ "$SKIP_ECR" = false ]; then
    if ! check_and_login_ecr "asterisk push"; then
        echo "⚠️  Skipping asterisk ECR push due to login failure"
        SKIP_ASTERISK_PUSH=true
    fi
else
    echo "⏭️  Skipping ECR login for asterisk push"
fi

if [ "$SKIP_ASTERISK_PUSH" != true ]; then
    echo "📦 Pushing asterisk image to ECR..."
    docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-asterisk:staging
    if [ $? -ne 0 ]; then
        echo "❌ Asterisk docker push failed. Please check the error above."
        exit 1
    fi
    # Clean up local image after successful push to save space
    echo "🧹 Cleaning up local asterisk image..."
    docker rmi bianca-app-asterisk:staging 2>/dev/null || true
else
    echo "⏭️  Skipping asterisk ECR push"
fi

echo "🐳 Building and pushing frontend Docker image..."
cd ../bianca-app-frontend

# Logout from Docker Hub to avoid credential issues in WSL2
echo "🔓 Logging out from Docker Hub to avoid credential issues..."
docker logout docker.io 2>/dev/null || true

# Build frontend with staging config for proper environment
docker build -t bianca-app-frontend:staging -f devops/Dockerfile --build-arg BUILD_ENV=staging .

if [ $? -ne 0 ]; then
    echo "❌ Frontend docker build failed. Please check the error above."
    exit 1
fi

docker tag bianca-app-frontend:staging 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:staging

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
    docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:staging
    if [ $? -ne 0 ]; then
        echo "❌ Frontend docker push failed. Please check the error above."
        exit 1
    fi
    # Clean up local image after successful push to save space
    echo "🧹 Cleaning up local frontend image..."
    docker rmi bianca-app-frontend:staging 2>/dev/null || true
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

# Step 3: Deploy staging infrastructure (preserves database)
echo "🚀 Deploying staging infrastructure..."
echo "📋 Using default terraform environment (staging)..."
yarn terraform:deploy

echo "✅ Staging infrastructure deployed!"

# Step 3: Update running containers with new images
echo "🔄 Updating staging containers with new images..."
STAGING_IP=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=bianca-staging" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --profile jordan)

if [ -n "$STAGING_IP" ]; then
    echo "Updating containers on staging instance: $STAGING_IP"
    
    # NOTE: Do NOT copy docker-compose files!
    # The staging-userdata.sh script creates docker-compose.yml dynamically
    # with secrets from AWS Secrets Manager. Copying local files would overwrite these.
    echo "ℹ️  Using docker-compose.yml created by instance userdata (contains AWS secrets)"
    
    # Add SSH options to avoid host key verification prompts
    SSH_OPTS="-i ~/.ssh/bianca-key-pair.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
    
    ssh $SSH_OPTS ec2-user@$STAGING_IP "
      cd /opt/bianca-staging
      
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
        
        # Remove any orphaned containers with our project names (force remove by name)
        # Use exact name matches to avoid conflicts
        for container_name in staging_app staging_asterisk staging_frontend staging_nginx staging_bianca-app; do
          docker rm -f \$container_name 2>/dev/null || true
        done
        
        # Also remove by filter pattern (in case names are slightly different)
        docker rm -f \$(docker ps -aq --filter 'name=staging_app') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=staging_asterisk') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=staging_frontend') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=staging_nginx') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=staging_bianca-app') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=bianca-app') 2>/dev/null || true

        # Remove network if it exists (will be recreated)
        docker network rm bianca-staging_bianca-network 2>/dev/null || true

        # Show remaining staging containers for debugging
        echo 'Remaining staging containers (if any):'
        docker ps -a --format '{{.Names}}' | grep -E '^staging_' || true
        
        # Clean up unused images and networks
        docker image prune -f
        docker network prune -f
      fi
      
      echo 'Starting new containers...'
      
      # Check if MongoDB container already exists (running or stopped)
      if docker ps -aq --filter 'name=staging_mongodb' | grep -q .; then
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
echo ""
echo "💡 Usage:"
echo "   ./scripts/deploy-staging.sh                    # Normal deployment (preserves MongoDB)"
echo "   ./scripts/deploy-staging.sh --skip-ecr         # Skip ECR login checks"
echo "   ./scripts/deploy-staging.sh --force-cleanup    # Remove ALL containers including MongoDB"
echo "   ./scripts/deploy-staging.sh --skip-git-check   # Skip git branch/status warnings"
echo "   ./scripts/deploy-staging.sh --skip-ecr --force-cleanup  # Both flags"
echo ""
echo "⚠️  IMPORTANT: This script deploys from your LOCAL working directory,"
echo "   NOT from the main branch! Make sure you're on the right branch"
echo "   and have committed/pushed your changes before deploying."