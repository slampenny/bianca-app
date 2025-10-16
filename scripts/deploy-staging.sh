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
    
    # Try multiple approaches for WSL2 compatibility
    local login_success=false
    
    # Approach 1: Direct pipe (most common)
    if aws ecr get-login-password --region us-east-2 --profile jordan | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com 2>/dev/null; then
        login_success=true
    else
        echo "⚠️  Direct pipe failed, trying alternative approach..."
        
        # Approach 2: Save password to temp file (WSL2 workaround)
        local temp_password_file=$(mktemp)
        if aws ecr get-login-password --region us-east-2 --profile jordan > "$temp_password_file" 2>/dev/null; then
            if docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com < "$temp_password_file" 2>/dev/null; then
                login_success=true
            fi
            rm -f "$temp_password_file"
        fi
    fi
    
    if [ "$login_success" = true ]; then
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

echo "🚀 Deploying Bianca Staging Environment..."

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
    check_and_login_ecr "backend push" || exit 1
else
    echo "⏭️  Skipping ECR login for backend push"
fi

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
if [ "$SKIP_ECR" = false ]; then
    check_and_login_ecr "frontend push" || exit 1
else
    echo "⏭️  Skipping ECR login for frontend push"
fi

echo "📦 Pushing frontend image to ECR..."
docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:staging

if [ $? -ne 0 ]; then
    echo "❌ Frontend docker push failed. Please check the error above."
    exit 1
fi

cd ../bianca-app-backend

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
      
      if [ '$FORCE_CLEANUP' = 'true' ]; then
        echo 'Force cleanup: Stopping and removing ALL containers...'
        
        # Stop and remove all containers
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml down || true
        
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
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml stop app frontend || true
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml rm -f app frontend || true
        
        # Remove any orphaned containers with our project names
        docker rm -f \$(docker ps -aq --filter 'name=staging_app') 2>/dev/null || true
        docker rm -f \$(docker ps -aq --filter 'name=staging_frontend') 2>/dev/null || true
        
        # Clean up unused images and networks
        docker image prune -f
        docker network prune -f
      fi
      
      echo 'Starting new containers...'
      
      # Check if MongoDB container already exists (running or stopped)
      if docker ps -aq --filter 'name=staging_mongodb' | grep -q .; then
        echo 'MongoDB container already exists, starting only app and frontend...'
        # Start only the app and frontend services, skip MongoDB
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d --no-deps app frontend
      else
        echo 'Starting all containers (including MongoDB)...'
        # Start all containers (MongoDB will be created)
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
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
echo "   ./scripts/deploy-staging.sh --skip-ecr --force-cleanup  # Both flags"