#!/bin/bash
# BeforeInstall hook - Create docker-compose.yml and nginx.conf

# Don't use set -e - we want to capture and report errors properly
set +e

echo "🧹 BeforeInstall: Setting up docker-compose.yml and nginx.conf..."

# Enable maintenance mode at the start of deployment
if [ -f "/opt/bianca-deployment/devops/maintenance/enable-maintenance.sh" ]; then
    echo "   Enabling maintenance mode..."
    bash /opt/bianca-deployment/devops/maintenance/enable-maintenance.sh || {
        echo "   ⚠️  Could not enable maintenance mode, continuing anyway..."
    }
fi

# Detect environment - check environment variables first, then directories, then instance tags
AWS_REGION="us-east-2"

echo "   Detecting environment..."

# Method 1: Check /etc/environment file first (set by userdata)
# CodeDeploy scripts don't automatically source /etc/environment, so read it directly
if [ -f "/etc/environment" ]; then
  ENV_FROM_FILE=$(grep "^ENVIRONMENT=" /etc/environment 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
  # Normalize to lowercase for comparison, but preserve original for use
  ENV_FROM_FILE_LOWER=$(echo "$ENV_FROM_FILE" | tr '[:upper:]' '[:lower:]')
  if [ -n "$ENV_FROM_FILE" ]; then
    echo "   ✅ Found ENVIRONMENT in /etc/environment: $ENV_FROM_FILE"
    # Use lowercase for detection logic
    DETECTED_ENV="$ENV_FROM_FILE_LOWER"
  fi
fi

# Method 2: Check environment variables (if not already set from /etc/environment)
# These can be set via userdata, /etc/environment, or manually
if [ -z "$DETECTED_ENV" ]; then
  if [ -n "$ENVIRONMENT" ]; then
    echo "   ✅ Found ENVIRONMENT variable: $ENVIRONMENT"
    DETECTED_ENV="$ENVIRONMENT"
  elif [ -n "$DEPLOYMENT_ENVIRONMENT" ]; then
    echo "   ✅ Found DEPLOYMENT_ENVIRONMENT variable: $DEPLOYMENT_ENVIRONMENT"
    DETECTED_ENV="$DEPLOYMENT_ENVIRONMENT"
  elif [ -n "$NODE_ENV" ] && [ "$NODE_ENV" != "test" ]; then
    # NODE_ENV can indicate environment, but ignore "test" as that's for test runs
    echo "   ✅ Found NODE_ENV variable: $NODE_ENV"
    DETECTED_ENV="$NODE_ENV"
  fi
fi

# If we detected an environment from variables, use it
# Normalize DETECTED_ENV to lowercase for comparison
if [ -n "$DETECTED_ENV" ]; then
  DETECTED_ENV_LOWER=$(echo "$DETECTED_ENV" | tr '[:upper:]' '[:lower:]')
  if [ "$DETECTED_ENV_LOWER" = "production" ]; then
    ENVIRONMENT="production"
    DEPLOY_DIR="/opt/bianca-production"
    CONTAINER_PREFIX="production"
    IMAGE_TAG="production"
    NODE_ENV="production"
    API_BASE_URL="https://api.biancawellness.com"
    WEBSOCKET_URL="wss://api.biancawellness.com"
    FRONTEND_URL="https://app.biancawellness.com"
    SERVER_NAME_FRONTEND="app.biancawellness.com"
    SERVER_NAME_API="api.biancawellness.com"
    YARN_COMMAND="yarn start"
    CLOUDWATCH_LOG_PREFIX="/bianca/production"
  elif [ "$DETECTED_ENV_LOWER" = "staging" ]; then
    ENVIRONMENT="staging"
    DEPLOY_DIR="/opt/bianca-staging"
    CONTAINER_PREFIX="staging"
    IMAGE_TAG="staging"
    NODE_ENV="staging"
    API_BASE_URL="https://staging-api.biancawellness.com"
    WEBSOCKET_URL="wss://staging-api.biancawellness.com"
    FRONTEND_URL="https://staging.biancawellness.com"
    SERVER_NAME_FRONTEND="staging.biancawellness.com"
    SERVER_NAME_API="staging-api.biancawellness.com"
    YARN_COMMAND="yarn dev:staging"
    CLOUDWATCH_LOG_PREFIX="/bianca/staging"
  elif [ "$DETECTED_ENV_LOWER" = "demo" ]; then
    ENVIRONMENT="demo"
    DEPLOY_DIR="/opt/bianca-demo"
    CONTAINER_PREFIX="demo"
    IMAGE_TAG="production"  # Demo uses production images
    NODE_ENV="production"  # Demo uses production mode
    API_BASE_URL="https://demo.biancawellness.com/v1"
    WEBSOCKET_URL="wss://demo.biancawellness.com/v1"
    FRONTEND_URL="https://demo.biancawellness.com"
    SERVER_NAME_FRONTEND="demo.biancawellness.com"
    SERVER_NAME_API="demo.biancawellness.com"
    YARN_COMMAND="yarn start"  # Demo uses production mode
    CLOUDWATCH_LOG_PREFIX="/bianca/demo"
  else
    echo "   ⚠️  Unknown environment from variables: $DETECTED_ENV, falling back to other methods..."
    DETECTED_ENV=""
  fi
fi

# Method 2: Check which deployment directory exists (if not already set from env vars)
if [ -z "$DETECTED_ENV" ] && [ -d "/opt/bianca-production" ]; then
  echo "   ✅ Found /opt/bianca-production directory - using production"
  ENVIRONMENT="production"
  DEPLOY_DIR="/opt/bianca-production"
  CONTAINER_PREFIX="production"
  IMAGE_TAG="production"
  NODE_ENV="production"
  API_BASE_URL="https://api.biancawellness.com"
  WEBSOCKET_URL="wss://api.biancawellness.com"
  FRONTEND_URL="https://app.biancawellness.com"
  SERVER_NAME_FRONTEND="app.biancawellness.com"
  SERVER_NAME_API="api.biancawellness.com"
  YARN_COMMAND="yarn start"
  CLOUDWATCH_LOG_PREFIX="/bianca/production"
elif [ -z "$DETECTED_ENV" ] && [ -d "/opt/bianca-staging" ]; then
  echo "   ✅ Found /opt/bianca-staging directory - using staging"
  ENVIRONMENT="staging"
  DEPLOY_DIR="/opt/bianca-staging"
  CONTAINER_PREFIX="staging"
  IMAGE_TAG="staging"
  # CRITICAL: Set NODE_ENV=staging for staging deployment (NOT test!)
  # Tests run with NODE_ENV=test in the RunTests CodeBuild stage
  NODE_ENV="staging"
  API_BASE_URL="https://staging-api.biancawellness.com"
  WEBSOCKET_URL="wss://staging-api.biancawellness.com"
  FRONTEND_URL="https://staging.biancawellness.com"
  SERVER_NAME_FRONTEND="staging.biancawellness.com"
  SERVER_NAME_API="staging-api.biancawellness.com"
  YARN_COMMAND="yarn dev:staging"
  CLOUDWATCH_LOG_PREFIX="/bianca/staging"
elif [ -z "$DETECTED_ENV" ] && [ -d "/opt/bianca-demo" ]; then
  echo "   ✅ Found /opt/bianca-demo directory - using demo"
  ENVIRONMENT="demo"
  DEPLOY_DIR="/opt/bianca-demo"
  CONTAINER_PREFIX="demo"
  IMAGE_TAG="production"  # Demo uses production images
  NODE_ENV="production"  # Demo uses production mode
  API_BASE_URL="https://demo.biancawellness.com/v1"
  WEBSOCKET_URL="wss://demo.biancawellness.com/v1"
  FRONTEND_URL="https://demo.biancawellness.com"
  SERVER_NAME_FRONTEND="demo.biancawellness.com"
  SERVER_NAME_API="demo.biancawellness.com"
  YARN_COMMAND="yarn start"  # Demo uses production mode
  CLOUDWATCH_LOG_PREFIX="/bianca/demo"
elif [ -z "$DETECTED_ENV" ]; then
  # Fallback: Try to get instance tags (may fail due to permissions)
  echo "   ⚠️  No deployment directory found, trying instance tags..."
  INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "")
  
  # Try to get tags using instance metadata (more reliable than AWS CLI)
  # First try instance metadata tags endpoint (available on newer instances)
  INSTANCE_NAME=""
  ENVIRONMENT_TAG=""
  
  # Try instance metadata tags endpoint (preferred method)
  # Filter out HTML error responses (404 pages)
  if [ -n "$INSTANCE_ID" ]; then
    INSTANCE_NAME_RAW=$(curl -s http://169.254.169.254/latest/meta-data/tags/instance/Name 2>/dev/null || echo "")
    ENVIRONMENT_TAG_RAW=$(curl -s http://169.254.169.254/latest/meta-data/tags/instance/Environment 2>/dev/null || echo "")
    
    # Filter out HTML responses (check if response contains HTML tags)
    if [ -n "$INSTANCE_NAME_RAW" ] && ! echo "$INSTANCE_NAME_RAW" | grep -q "<html\|<!DOCTYPE"; then
      INSTANCE_NAME="$INSTANCE_NAME_RAW"
    fi
    if [ -n "$ENVIRONMENT_TAG_RAW" ] && ! echo "$ENVIRONMENT_TAG_RAW" | grep -q "<html\|<!DOCTYPE"; then
      ENVIRONMENT_TAG="$ENVIRONMENT_TAG_RAW"
    fi
  fi
  
  # Fallback to AWS CLI if metadata tags not available
  if [ -z "$INSTANCE_NAME" ] && [ -z "$ENVIRONMENT_TAG" ] && [ -n "$INSTANCE_ID" ]; then
    INSTANCE_NAME=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "")
    ENVIRONMENT_TAG=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Environment`].Value' --output text 2>/dev/null || echo "")
  fi
  
  echo "   Instance ID: $INSTANCE_ID"
  if [ -n "$INSTANCE_NAME" ]; then
    echo "   Instance Name tag: $INSTANCE_NAME"
  else
    echo "   Instance Name tag: (not available)"
  fi
  if [ -n "$ENVIRONMENT_TAG" ]; then
    echo "   Environment tag: $ENVIRONMENT_TAG"
  else
    echo "   Environment tag: (not available)"
  fi
  
  if [ "$ENVIRONMENT_TAG" = "production" ] || echo "$INSTANCE_NAME" | grep -qi "production"; then
    echo "   ✅ Detected production from tags"
    ENVIRONMENT="production"
    DEPLOY_DIR="/opt/bianca-production"
    CONTAINER_PREFIX="production"
    IMAGE_TAG="production"
    NODE_ENV="production"
    API_BASE_URL="https://api.biancawellness.com"
    WEBSOCKET_URL="wss://api.biancawellness.com"
    FRONTEND_URL="https://app.biancawellness.com"
    SERVER_NAME_FRONTEND="app.biancawellness.com"
    SERVER_NAME_API="api.biancawellness.com"
    YARN_COMMAND="yarn start"
    CLOUDWATCH_LOG_PREFIX="/bianca/production"
  elif [ "$ENVIRONMENT_TAG" = "staging" ] || echo "$INSTANCE_NAME" | grep -qi "staging"; then
    echo "   ✅ Detected staging from tags"
    ENVIRONMENT="staging"
    DEPLOY_DIR="/opt/bianca-staging"
    CONTAINER_PREFIX="staging"
    IMAGE_TAG="staging"
    NODE_ENV="staging"
    API_BASE_URL="https://staging-api.biancawellness.com"
    WEBSOCKET_URL="wss://staging-api.biancawellness.com"
    FRONTEND_URL="https://staging.biancawellness.com"
    SERVER_NAME_FRONTEND="staging.biancawellness.com"
    SERVER_NAME_API="staging-api.biancawellness.com"
    YARN_COMMAND="yarn dev:staging"
    CLOUDWATCH_LOG_PREFIX="/bianca/staging"
  elif [ "$ENVIRONMENT_TAG" = "demo" ] || echo "$INSTANCE_NAME" | grep -qi "demo"; then
    echo "   ✅ Detected demo from tags"
    ENVIRONMENT="demo"
    DEPLOY_DIR="/opt/bianca-demo"
    CONTAINER_PREFIX="demo"
    IMAGE_TAG="production"  # Demo uses production images
    NODE_ENV="production"  # Demo uses production mode
    API_BASE_URL="https://demo.biancawellness.com/v1"
    WEBSOCKET_URL="wss://demo.biancawellness.com/v1"
    FRONTEND_URL="https://demo.biancawellness.com"
    SERVER_NAME_FRONTEND="demo.biancawellness.com"
    SERVER_NAME_API="demo.biancawellness.com"
    YARN_COMMAND="yarn start"  # Demo uses production mode
    CLOUDWATCH_LOG_PREFIX="/bianca/demo"
  else
    echo "   ❌ CRITICAL ERROR: Cannot determine environment"
    echo "   Environment variables, deployment directories, and instance tags all unavailable"
    echo ""
    echo "   Debug information:"
    echo "   - Instance ID: ${INSTANCE_ID:-not available}"
    echo "   - Instance Name tag: ${INSTANCE_NAME:-not available}"
    echo "   - Environment Tag: ${ENVIRONMENT_TAG:-not available}"
    echo "   - ENVIRONMENT variable: ${ENVIRONMENT:-not set}"
    echo "   - DEPLOYMENT_ENVIRONMENT variable: ${DEPLOYMENT_ENVIRONMENT:-not set}"
    echo "   - NODE_ENV variable: ${NODE_ENV:-not set}"
    if [ -f "/etc/environment" ]; then
      echo "   - /etc/environment exists, contents:"
      grep -i environment /etc/environment 2>/dev/null || echo "      (no ENVIRONMENT found in /etc/environment)"
    else
      echo "   - /etc/environment: (file does not exist)"
    fi
    echo "   - Deployment directories:"
    [ -d "/opt/bianca-production" ] && echo "     ✅ /opt/bianca-production exists" || echo "     ❌ /opt/bianca-production does not exist"
    [ -d "/opt/bianca-staging" ] && echo "     ✅ /opt/bianca-staging exists" || echo "     ❌ /opt/bianca-staging does not exist"
    echo ""
    echo "   This deployment will FAIL to prevent misconfiguration."
    echo "   Please ensure one of the following:"
    echo "   1. /etc/environment contains ENVIRONMENT=staging or ENVIRONMENT=production (set by userdata)"
    echo "   2. Set ENVIRONMENT, DEPLOYMENT_ENVIRONMENT, or NODE_ENV environment variable"
    echo "   3. The deployment directory (/opt/bianca-production or /opt/bianca-staging) exists"
    echo "   4. Instance tags (Name and Environment) are properly set"
    echo "   5. The instance has IAM permissions to read its own tags"
    echo ""
    echo "   For staging: /opt/bianca-staging should exist or ENVIRONMENT=staging in /etc/environment"
    echo "   For production: /opt/bianca-production should exist or ENVIRONMENT=production in /etc/environment"
    exit 1
  fi
fi

# Final safety check - ensure ENVIRONMENT is set
if [ -z "$ENVIRONMENT" ]; then
  echo "   ❌ CRITICAL ERROR: Environment detection failed - ENVIRONMENT is not set"
  echo "   This should not happen - all detection methods failed"
  exit 1
fi

echo "   ✅ Detected environment: $ENVIRONMENT"
echo "   ✅ Deployment directory: $DEPLOY_DIR"
echo "   ✅ Container prefix: $CONTAINER_PREFIX"
echo "   ✅ Image tag: $IMAGE_TAG"

# Set Twilio caller ID by environment (demo uses dedicated number)
case "$ENVIRONMENT" in
  production)
    TWILIO_PHONENUMBER="+19786256514"
    ;;
  staging)
    TWILIO_PHONENUMBER="+19285758645"
    ;;
  demo)
    TWILIO_PHONENUMBER="+16047060134"
    ;;
  *)
    TWILIO_PHONENUMBER="+19285758645"
    ;;
esac

# Nginx server_name for super-admin static container (TLS). API derives admin origin from config.js (PRIMARY_DOMAIN + NODE_ENV), same as facility FRONTEND_URL.
case "$ENVIRONMENT" in
  production)
    SERVER_NAME_ADMIN="admin.biancawellness.com"
    ;;
  staging)
    SERVER_NAME_ADMIN="staging-admin.biancawellness.com"
    ;;
  *)
    SERVER_NAME_ADMIN=""
    ;;
esac

# Ensure ENVIRONMENT is set in /etc/environment for future deployments
# This helps existing instances that were created before userdata was updated
if [ -n "$ENVIRONMENT" ]; then
  if [ ! -f "/etc/environment" ] || ! grep -q "^ENVIRONMENT=" /etc/environment 2>/dev/null; then
    echo "   📝 Setting ENVIRONMENT=$ENVIRONMENT in /etc/environment for future deployments..."
    echo "ENVIRONMENT=$ENVIRONMENT" >> /etc/environment
  elif ! grep -q "^ENVIRONMENT=$ENVIRONMENT$" /etc/environment 2>/dev/null; then
    echo "   📝 Updating ENVIRONMENT in /etc/environment to $ENVIRONMENT..."
    sed -i "s/^ENVIRONMENT=.*/ENVIRONMENT=$ENVIRONMENT/" /etc/environment
  fi
fi

# Configure Docker log rotation to prevent disk space issues
echo "   Configuring Docker log rotation..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DOCKER_EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DOCKER_EOF
# Restart Docker to apply new log rotation settings
systemctl restart docker || echo "   ⚠️  Docker restart failed, continuing..."

# Ensure deployment directory exists (create if it doesn't)
echo "   Ensuring deployment directory exists: $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
chown -R ec2-user:ec2-user "$DEPLOY_DIR" 2>/dev/null || true
chmod -R 755 "$DEPLOY_DIR" 2>/dev/null || true
cd "$DEPLOY_DIR"

# Get instance metadata
PRIVATE_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Get secrets from AWS Secrets Manager
AWS_ACCOUNT_ID="730335291008"
if [ "$ENVIRONMENT" = "staging" ]; then
  SECRET_ID="MySecretsManagerSecret-Staging"
else
  SECRET_ID="MySecretsManagerSecret"
fi

echo "   Fetching secrets from AWS Secrets Manager..."
# Fetch all secrets at once - use a simple approach with error handling
# Try to fetch with a reasonable wait, but don't hang forever
SECRET_JSON=""
RETRY_COUNT=0
MAX_RETRIES=3

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  echo "   Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES..."
  SECRET_JSON=$(aws secretsmanager get-secret-value --region $AWS_REGION --secret-id $SECRET_ID --query SecretString --output text 2>&1)
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ] && [ -n "$SECRET_JSON" ] && [ "$SECRET_JSON" != "None" ]; then
    echo "   ✅ Secrets fetched successfully"
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "   ⚠️  Retry in 2 seconds..."
    sleep 2
  fi
done

if [ -z "$SECRET_JSON" ] || [ "$SECRET_JSON" = "None" ] || [ $EXIT_CODE -ne 0 ]; then
  echo "❌ ERROR: Failed to fetch secrets from Secrets Manager after $MAX_RETRIES attempts" >&2
  echo "   Secret ID: $SECRET_ID" >&2
  echo "   Region: $AWS_REGION" >&2
  echo "   Exit code: $EXIT_CODE" >&2
  echo "   Output: $SECRET_JSON" >&2
  exit 1
fi

# Parse secrets with error handling
ARI_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.ARI_PASSWORD // empty' 2>/dev/null)
BIANCA_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.BIANCA_PASSWORD // empty' 2>/dev/null)
TWILIO_ACCOUNTSID=$(echo "$SECRET_JSON" | jq -r '.TWILIO_ACCOUNTSID // empty' 2>/dev/null)
# PostHog removed - no longer used

# Verify required secrets
if [ -z "$ARI_PASSWORD" ] || [ -z "$BIANCA_PASSWORD" ]; then
  echo "❌ ERROR: Required secrets are missing" >&2
  echo "   ARI_PASSWORD: ${ARI_PASSWORD:+SET}${ARI_PASSWORD:-MISSING}" >&2
  echo "   BIANCA_PASSWORD: ${BIANCA_PASSWORD:+SET}${BIANCA_PASSWORD:-MISSING}" >&2
  exit 1
fi

echo "   ✅ Secrets fetched successfully"

# Create docker-compose.yml
echo "   Creating docker-compose.yml..."

if [ "$ENVIRONMENT" != "demo" ]; then
  ADMIN_BLOCK=$(cat <<ADMINEOF
  admin:
    image: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bianca-app-admin:${IMAGE_TAG}
    container_name: ${CONTAINER_PREFIX}_admin
    restart: unless-stopped
    ports:
      - "3002:80"
    logging:
      driver: "awslogs"
      options:
        awslogs-group: "${CLOUDWATCH_LOG_PREFIX}/admin"
        awslogs-region: "$AWS_REGION"
        awslogs-create-group: "true"
    depends_on:
      - app
    networks:
      - bianca-network

ADMINEOF
)
  NGINX_DEPENDS="      - app
      - frontend
      - admin"
else
  ADMIN_BLOCK=""
  NGINX_DEPENDS="      - app
      - frontend"
fi

cat > docker-compose.yml <<EOF
version: '3.8'

services:
  mongodb:
    image: mongo:4.4
    container_name: ${CONTAINER_PREFIX}_mongodb
    restart: unless-stopped
    ports:
      - "127.0.0.1:27017:27017"
    command: mongod --wiredTigerCacheSizeGB 0.5
    logging:
      driver: "awslogs"
      options:
        awslogs-group: "${CLOUDWATCH_LOG_PREFIX}/mongodb"
        awslogs-region: "$AWS_REGION"
        awslogs-create-group: "true"
    volumes:
      - /opt/mongodb-data:/data/db
    networks:
      - bianca-network

  asterisk:
    image: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bianca-app-asterisk:${IMAGE_TAG}
    container_name: ${CONTAINER_PREFIX}_asterisk
    restart: unless-stopped
    ports:
      - "5060:5060/udp"
      - "5061:5061/tcp"
      - "10000-10100:10000-10100/udp"
      - "8088:8088"
    logging:
      driver: "awslogs"
      options:
        awslogs-group: "${CLOUDWATCH_LOG_PREFIX}/asterisk"
        awslogs-region: "$AWS_REGION"
        awslogs-create-group: "true"
    environment:
      - EXTERNAL_ADDRESS=$PUBLIC_IP
      - PRIVATE_ADDRESS=$PRIVATE_IP
      - RTP_START_PORT=10000
      - RTP_END_PORT=10100
      - ARI_PASSWORD=$ARI_PASSWORD
      - BIANCA_PASSWORD=$BIANCA_PASSWORD
      - ASTERISK_USERNAME=myphonefriend
    volumes:
      - asterisk_logs:/var/log/asterisk
    networks:
      - bianca-network

  app:
    image: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bianca-app-backend:${IMAGE_TAG}
    container_name: ${CONTAINER_PREFIX}_app
    restart: unless-stopped
    ports:
      - "3000:3000"
    command: sh -c "$YARN_COMMAND"
    logging:
      driver: "awslogs"
      options:
        awslogs-group: "${CLOUDWATCH_LOG_PREFIX}/app"
        awslogs-region: "$AWS_REGION"
        awslogs-create-group: "true"
    environment:
      - AWS_REGION=$AWS_REGION
      - AWS_SECRET_ID=$SECRET_ID
      - MONGODB_URL=mongodb://mongodb:27017/bianca-service
      - NODE_ENV=$NODE_ENV
      - API_BASE_URL=$API_BASE_URL
      - WEBSOCKET_URL=$WEBSOCKET_URL
      - FRONTEND_URL=$FRONTEND_URL
      - ASTERISK_URL=http://asterisk:8088
      - ASTERISK_HOST=asterisk
      - DEPLOYMENT_TYPE=docker-compose
      - ASTERISK_PRIVATE_IP=asterisk
      - ASTERISK_PUBLIC_IP=$PUBLIC_IP
      - AWS_SES_REGION=$AWS_REGION
      - EMAIL_FROM=no-reply@biancawellness.com
      - TWILIO_PHONENUMBER=$TWILIO_PHONENUMBER
      - TWILIO_ACCOUNTSID=$TWILIO_ACCOUNTSID
      - STRIPE_PUBLISHABLE_KEY=pk_test_51R7r9ACpu9kuPmCAet21mRsIPqgc8iXD6oz5BrwVTEm8fd4j5z4GehmtTbMRuZyiCjJDOpLUKpUUMptDqfqdkG5300uoGHj7Ef
      - RTP_LISTENER_HOST=0.0.0.0
      - RTP_BIANCA_HOST=${CONTAINER_PREFIX}_app
      - RTP_ASTERISK_HOST=asterisk
      - USE_PRIVATE_NETWORK_FOR_RTP=true
      - NETWORK_MODE=DOCKER_COMPOSE
      - APP_RTP_PORT_RANGE=20002-30000
      - EMERGENCY_SNS_TOPIC_ARN=arn:aws:sns:$AWS_REGION:$AWS_ACCOUNT_ID:bianca-emergency-alerts
      - TELEMETRY_ENABLED=false
    volumes:
      - ~/.aws:/root/.aws:ro
    depends_on:
      - mongodb
      - asterisk
    networks:
      - bianca-network

  frontend:
    image: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bianca-app-frontend:${IMAGE_TAG}
    container_name: ${CONTAINER_PREFIX}_frontend
    restart: unless-stopped
    ports:
      - "3001:80"
    logging:
      driver: "awslogs"
      options:
        awslogs-group: "${CLOUDWATCH_LOG_PREFIX}/frontend"
        awslogs-region: "$AWS_REGION"
        awslogs-create-group: "true"
    depends_on:
      - app
    networks:
      - bianca-network

${ADMIN_BLOCK}
  nginx:
    image: nginx:alpine
    container_name: ${CONTAINER_PREFIX}_nginx
    restart: unless-stopped
    ports:
      - "80:80"
    logging:
      driver: "awslogs"
      options:
        awslogs-group: "${CLOUDWATCH_LOG_PREFIX}/nginx"
        awslogs-region: "$AWS_REGION"
        awslogs-create-group: "true"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /opt/maintenance-mode.flag:/opt/maintenance-mode.flag:ro
      - /opt/maintenance.html:/opt/maintenance.html:ro
      $DEMO_502_VOLUME
    depends_on:
${NGINX_DEPENDS}
    networks:
      - bianca-network

volumes:
  asterisk_logs:

networks:
  bianca-network:
    driver: bridge
EOF

# Demo: create helpful 502 page and set nginx/docker vars (frontend container may be down)
NGINX_502_BLOCK=""
DEMO_502_VOLUME=""
if [ "$ENVIRONMENT" = "demo" ]; then
  echo "   Creating demo 502 error page..."
  mkdir -p /opt
  cat > /opt/demo-502.html << 'HTMLEOF'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>502 - Demo Starting</title></head><body style="font-family:sans-serif;max-width:32em;margin:2em auto;">
<h1>502 Bad Gateway</h1>
<p>The demo app is starting up or a container may be down.</p>
<p>Try again in a minute, or run <code>yarn demo:update</code> from your machine to restart the demo containers.</p>
</body></html>
HTMLEOF
  NGINX_502_BLOCK="
    error_page 502 /demo-502.html;
    location = /demo-502.html {
        root /opt;
        internal;
        add_header Content-Type text/html;
    }
"
  DEMO_502_VOLUME="- /opt/demo-502.html:/opt/demo-502.html:ro"
else
  DEMO_502_VOLUME="# (no demo 502 volume - not demo env)"
fi

# Create nginx config with maintenance mode support
echo "   Creating nginx.conf..."
cat > nginx.conf <<EOF
# Frontend server
server {
    listen 80;
    server_name $SERVER_NAME_FRONTEND;
    $NGINX_502_BLOCK
    
    # Serve maintenance page
    location = /maintenance.html {
        root /opt;
        add_header Content-Type text/html;
    }
    
    # Proxy .well-known requests to backend API (for Universal Links)
    location /.well-known {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;
    }
    
    # Static assets: on 502/503 from frontend, return non-HTML body so browser does not
    # parse HTML error page as JS and throw "Unexpected token '<'".
    location ~* \.(js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|webp|svg)$ {
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;
        proxy_intercept_errors on;
        error_page 502 503 = @asset_error;
    }
    location @asset_error {
        add_header Content-Type application/octet-stream;
        return 502 "";
    }
    
    location / {
        # Check if maintenance flag exists and return 503 with maintenance page
        if (-f /opt/maintenance-mode.flag) {
            return 503 /maintenance.html;
        }
        
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;
    }
    
    error_page 503 /maintenance.html;
}
EOF

if [ -n "$SERVER_NAME_ADMIN" ]; then
cat >> nginx.conf <<EOF

# Super-admin app
server {
    listen 80;
    server_name $SERVER_NAME_ADMIN;
$NGINX_502_BLOCK
    location = /maintenance.html {
        root /opt;
        add_header Content-Type text/html;
    }
    location ~* \.(js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|webp|svg)$ {
        proxy_pass http://admin:80;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;
        proxy_intercept_errors on;
        error_page 502 503 = @admin_asset_error;
    }
    location @admin_asset_error {
        add_header Content-Type application/octet-stream;
        return 502 "";
    }
    location / {
        if (-f /opt/maintenance-mode.flag) {
            return 503 /maintenance.html;
        }
        proxy_pass http://admin:80;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;
    }
    error_page 503 /maintenance.html;
}
EOF
fi

cat >> nginx.conf <<EOF

# API server
server {
    listen 80;
    server_name $SERVER_NAME_API;
    
    # Serve maintenance page
    location = /maintenance.html {
        root /opt;
        add_header Content-Type text/html;
    }
    
    location / {
        # Check if maintenance flag exists and return 503 with maintenance page
        if (-f /opt/maintenance-mode.flag) {
            return 503 /maintenance.html;
        }
        
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;
        proxy_cache_bypass \$http_upgrade;
    }
    
    error_page 503 /maintenance.html;
}
EOF

echo "✅ BeforeInstall completed"

