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

# Detect environment from instance Name tag
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
AWS_REGION="us-east-2"
INSTANCE_NAME=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "")

# Determine environment based on instance name
if echo "$INSTANCE_NAME" | grep -qi "production"; then
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
else
  # Default to staging
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
fi

echo "   Detected environment: $ENVIRONMENT"
echo "   Deployment directory: $DEPLOY_DIR"
echo "   Container prefix: $CONTAINER_PREFIX"
echo "   Image tag: $IMAGE_TAG"

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

# Ensure deployment directory exists
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Get instance metadata
PRIVATE_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Get secrets from AWS Secrets Manager
AWS_ACCOUNT_ID="730335291008"
SECRET_ID="MySecretsManagerSecret"

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
      - AWS_SECRET_ID=MySecretsManagerSecret
      - MONGODB_URL=mongodb://mongodb:27017/bianca-service
      - NODE_ENV=$NODE_ENV
      - API_BASE_URL=$API_BASE_URL
      - WEBSOCKET_URL=$WEBSOCKET_URL
      - FRONTEND_URL=$FRONTEND_URL
      - ASTERISK_URL=http://asterisk:8088
      - ASTERISK_PRIVATE_IP=asterisk
      - ASTERISK_PUBLIC_IP=$PUBLIC_IP
      - AWS_SES_REGION=$AWS_REGION
      - EMAIL_FROM=no-reply@biancawellness.com
      - TWILIO_PHONENUMBER=+19285758645
      - TWILIO_ACCOUNTSID=${TWILIO_ACCOUNTSID}
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
    depends_on:
      - app
      - frontend
    networks:
      - bianca-network

volumes:
  asterisk_logs:

networks:
  bianca-network:
    driver: bridge
EOF

# Create nginx config with maintenance mode support
echo "   Creating nginx.conf..."
cat > nginx.conf <<EOF
# Frontend server
server {
    listen 80;
    server_name $SERVER_NAME_FRONTEND;
    
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
        
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;
    }
    
    error_page 503 /maintenance.html;
}

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

