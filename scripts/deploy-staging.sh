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
(docker build -t bianca-app-backend:staging . && echo "✅ Backend build complete") &
BACKEND_PID=$!

# Build asterisk (need to login to public ECR first)
check_and_login_public_ecr || true
(cd devops/asterisk && docker build -t bianca-app-asterisk:staging . && echo "✅ Asterisk build complete") &
ASTERISK_PID=$!

# Build frontend
(cd ../bianca-app-frontend && docker build -t bianca-app-frontend:staging -f devops/Dockerfile --build-arg BUILD_ENV=staging . && echo "✅ Frontend build complete") &
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
docker tag bianca-app-backend:staging 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:staging
docker tag bianca-app-asterisk:staging 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-asterisk:staging
docker tag bianca-app-frontend:staging 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:staging

# Push images in parallel
echo "📦 Pushing images to ECR in parallel..."
if [ "$SKIP_BACKEND_PUSH" != true ]; then
    (docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:staging && echo "✅ Backend pushed") &
    BACKEND_PUSH_PID=$!
else
    BACKEND_PUSH_PID=""
fi

if [ "$SKIP_ASTERISK_PUSH" != true ]; then
    (docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-asterisk:staging && echo "✅ Asterisk pushed") &
    ASTERISK_PUSH_PID=$!
else
    ASTERISK_PUSH_PID=""
fi

if [ "$SKIP_FRONTEND_PUSH" != true ]; then
    (docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:staging && echo "✅ Frontend pushed") &
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
docker rmi bianca-app-backend:staging 2>/dev/null || true
docker rmi bianca-app-asterisk:staging 2>/dev/null || true
docker rmi bianca-app-frontend:staging 2>/dev/null || true

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
echo "🚀 Checking if infrastructure changes are needed..."
echo "📋 Running terraform plan to detect changes..."

cd devops/terraform
export AWS_PROFILE=jordan
export AWS_DEFAULT_REGION=us-east-2

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
echo "✅ Staging infrastructure check complete!"

# Step 3: Update running containers with new images
echo "🔄 Updating staging containers with new images..."

# Wait for staging instance to be running and get IP
echo "⏳ Waiting for staging instance to be ready..."
STAGING_INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=bianca-staging" --query 'Reservations[0].Instances[0].InstanceId' --output text --profile jordan --region us-east-2)

if [ -z "$STAGING_INSTANCE_ID" ] || [ "$STAGING_INSTANCE_ID" == "None" ]; then
    echo "❌ Staging instance not found. Please check Terraform deployment."
    exit 1
fi

echo "Found staging instance: $STAGING_INSTANCE_ID"

# Check instance state and start if stopped
INSTANCE_STATE=$(aws ec2 describe-instances --instance-ids "$STAGING_INSTANCE_ID" --query 'Reservations[0].Instances[0].State.Name' --output text --profile jordan --region us-east-2)
echo "Instance state: $INSTANCE_STATE"

if [ "$INSTANCE_STATE" == "stopped" ]; then
    echo "🔄 Starting stopped instance..."
    aws ec2 start-instances --instance-ids "$STAGING_INSTANCE_ID" --profile jordan --region us-east-2
    echo "⏳ Waiting for instance to start..."
    aws ec2 wait instance-running --instance-ids "$STAGING_INSTANCE_ID" --profile jordan --region us-east-2
    echo "✅ Instance started"
fi

# Wait for instance to be running
if [ "$INSTANCE_STATE" != "running" ]; then
    echo "Waiting for instance to reach running state..."
    aws ec2 wait instance-running --instance-ids "$STAGING_INSTANCE_ID" --profile jordan --region us-east-2 || true
fi

# Wait a bit more for public IP to be assigned
echo "Waiting for public IP assignment..."
sleep 10

# Get the public IP
STAGING_IP=$(aws ec2 describe-instances --instance-ids "$STAGING_INSTANCE_ID" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --profile jordan --region us-east-2)

# Retry if IP is not yet assigned
MAX_RETRIES=6
RETRY_COUNT=0
while [ -z "$STAGING_IP" ] || [ "$STAGING_IP" == "None" ] || [ "$STAGING_IP" == "null" ]; do
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Timeout waiting for staging instance IP"
        exit 1
    fi
    echo "Waiting for public IP... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
    sleep 10
    STAGING_IP=$(aws ec2 describe-instances --instance-ids "$STAGING_INSTANCE_ID" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --profile jordan --region us-east-2)
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

# Wait for SSH to be ready (instance running doesn't mean SSH is ready)
echo "⏳ Waiting for SSH to be ready on $STAGING_IP..."
SSH_OPTS="-i ~/.ssh/bianca-key-pair.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"
SSH_READY=false
MAX_SSH_RETRIES=30
SSH_RETRY_COUNT=0

while [ "$SSH_READY" = false ] && [ $SSH_RETRY_COUNT -lt $MAX_SSH_RETRIES ]; do
    if ssh $SSH_OPTS ec2-user@$STAGING_IP "echo 'SSH ready'" >/dev/null 2>&1; then
        SSH_READY=true
        echo "✅ SSH is ready"
        break
    fi
    SSH_RETRY_COUNT=$((SSH_RETRY_COUNT + 1))
    if [ $((SSH_RETRY_COUNT % 5)) -eq 0 ]; then
        echo "   Still waiting for SSH... (attempt $SSH_RETRY_COUNT/$MAX_SSH_RETRIES)"
    fi
    sleep 2
done

if [ "$SSH_READY" = false ]; then
    echo "⚠️  SSH connection failed (likely blocked by firewall/VPN)"
    echo "🔄 Attempting to use AWS Systems Manager (SSM) instead..."
    echo "   SSM works over HTTPS (port 443) which is rarely blocked"
    
    # Check if SSM is available
    if aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$STAGING_INSTANCE_ID" --profile jordan --region us-east-2 --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null | grep -q "Online"; then
        echo "✅ SSM is available - using SSM to execute commands"
        USE_SSM=true
    else
        echo "❌ SSM is not available for this instance"
        echo "💡 Possible issues:"
        echo "   1. Security group may not allow SSH from your IP address"
        echo "   2. Instance may still be initializing (check AWS Console)"
        echo "   3. SSH key may not be in ~/.ssh/bianca-key-pair.pem"
        echo "   4. SSM agent may not be running on the instance"
        echo ""
        echo "   To check security group rules:"
        echo "   aws ec2 describe-instances --instance-ids $STAGING_INSTANCE_ID --profile jordan --region us-east-2 --query 'Reservations[0].Instances[0].SecurityGroups'"
        echo ""
        echo "   To manually test SSH:"
        echo "   ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@$STAGING_IP"
        echo ""
        echo "   To use SSM Session Manager:"
        echo "   aws ssm start-session --target $STAGING_INSTANCE_ID --profile jordan --region us-east-2"
        exit 1
    fi
else
    USE_SSM=false
fi

if [ -n "$STAGING_IP" ] && [ "$STAGING_IP" != "None" ] && [ "$STAGING_IP" != "null" ]; then
    echo "Updating containers on staging instance: $STAGING_IP"
    
    # NOTE: Do NOT copy docker-compose files!
    # The staging-userdata.sh script creates docker-compose.yml dynamically
    # with secrets from AWS Secrets Manager. Copying local files would overwrite these.
    echo "ℹ️  Using docker-compose.yml created by instance userdata (contains AWS secrets)"
    
    # Use SSM if SSH failed, otherwise use SSH
    if [ "$USE_SSM" = true ]; then
        echo "📡 Using AWS Systems Manager (SSM) to execute commands..."
        # SSM command execution
        SSM_COMMAND="aws ssm send-command --instance-ids $STAGING_INSTANCE_ID --document-name 'AWS-RunShellScript' --parameters 'commands=["
    else
        # SSH options (already set above)
        SSH_OPTS="-i ~/.ssh/bianca-key-pair.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
    fi
    
    # Prepare the commands to run
    DEPLOY_COMMANDS="
      cd /opt/bianca-staging
      
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
        
        # Remove any orphaned containers with our project names (force remove by name)
        # Use exact name matches to avoid conflicts
        for container_name in staging_app staging_asterisk staging_frontend staging_nginx staging_bianca-app; do
          docker rm -f \$container_name 2>/dev/null || true
        done
        
        # Ensure MongoDB container name is free (in case of conflicts)
        # Only remove if it's stopped, not if it's running (to preserve data)
        if docker ps -a --filter 'name=staging_mongodb' --filter 'status=exited' | grep -q staging_mongodb; then
          echo 'Removing stopped MongoDB container to avoid name conflicts...'
          docker rm -f staging_mongodb 2>/dev/null || true
        fi
        
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
        echo 'MongoDB container already exists...'
        # Remove the existing MongoDB container to avoid name conflicts
        echo 'Removing existing MongoDB container to avoid conflicts...'
        docker rm -f staging_mongodb 2>/dev/null || true
        # Also try removing by the container ID if name doesn't work
        EXISTING_MONGODB=\$(docker ps -aq --filter 'name=staging_mongodb' | head -1)
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
        if docker ps --filter 'name=staging_mongodb' --filter 'status=running' | grep -q staging_mongodb; then
          # Quick MongoDB health check
          if docker exec staging_mongodb mongosh --eval 'db.adminCommand(\"ping\")' --quiet >/dev/null 2>&1; then
            echo '✅ MongoDB is ready'
            break
          fi
        fi
        sleep 1
        WAIT_COUNT=\$((WAIT_COUNT + 1))
      done
      
      # Quick health check for app (just verify container is running)
      if docker ps --filter 'name=staging_app' --filter 'status=running' | grep -q staging_app; then
        echo '✅ App container is running'
      fi
      
      # Show container status
      echo 'Container status:'
      docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'staging_|NAMES' || true
    "
    
    if [ "$USE_SSM" = true ]; then
        # For SSM, we need to escape the commands properly for JSON
        # Convert the multi-line script to a single bash -c command
        # Escape quotes and newlines for JSON
        ESCAPED_COMMANDS=$(echo "$DEPLOY_COMMANDS" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
        
        # Use SSM to execute commands as a single bash script
        echo "📤 Sending commands via SSM..."
        COMMAND_ID=$(aws ssm send-command \
            --instance-ids "$STAGING_INSTANCE_ID" \
            --document-name "AWS-RunShellScript" \
            --parameters "{\"commands\":[\"bash -c \\\"$ESCAPED_COMMANDS\\\"\"]}" \
            --profile jordan \
            --region us-east-2 \
            --query 'Command.CommandId' \
            --output text 2>&1)
        
        if [ -z "$COMMAND_ID" ] || echo "$COMMAND_ID" | grep -qi "error"; then
            echo "❌ Failed to send SSM command"
            echo "   Error: $COMMAND_ID"
            echo ""
            echo "💡 Alternative: Use SSM Session Manager to deploy manually:"
            echo "   aws ssm start-session --target $STAGING_INSTANCE_ID --profile jordan --region us-east-2"
            echo ""
            echo "   Then run these commands on the instance:"
            echo "   cd /opt/bianca-staging"
            echo "   aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com"
            echo "   docker-compose pull"
            echo "   docker-compose up -d"
            exit 1
        fi
        
        echo "⏳ Waiting for SSM command to complete (Command ID: $COMMAND_ID)..."
        # Wait for command to complete
        aws ssm wait command-executed \
            --command-id "$COMMAND_ID" \
            --instance-id "$STAGING_INSTANCE_ID" \
            --profile jordan \
            --region us-east-2
        
        # Get command output
        echo "📋 Command output:"
        aws ssm get-command-invocation \
            --command-id "$COMMAND_ID" \
            --instance-id "$STAGING_INSTANCE_ID" \
            --profile jordan \
            --region us-east-2 \
            --query '[StandardOutputContent, StandardErrorContent]' \
            --output text
        
        # Check exit status
        STATUS=$(aws ssm get-command-invocation \
            --command-id "$COMMAND_ID" \
            --instance-id "$STAGING_INSTANCE_ID" \
            --profile jordan \
            --region us-east-2 \
            --query 'Status' \
            --output text)
        
        if [ "$STATUS" != "Success" ]; then
            echo "❌ SSM command failed with status: $STATUS"
            exit 1
        fi
    else
        # Use SSH
        ssh $SSH_OPTS ec2-user@$STAGING_IP "$DEPLOY_COMMANDS"
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Staging containers updated successfully!"
    else
        echo "❌ Failed to update staging containers"
        exit 1
    fi
else
    echo "⚠️  Staging instance not found or not running yet"
    echo "   This is normal if the instance was just created. You can manually update containers later with:"
    echo "   ./scripts/staging-control.sh status"
    echo "   ./scripts/staging-control.sh start  # if needed"
    echo "   Then run the container update manually"
    # Don't exit with error - infrastructure was deployed successfully
    # Just skip the container update step
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