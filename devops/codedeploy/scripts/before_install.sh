#!/bin/bash
# BeforeInstall hook - Create docker-compose.yml and nginx.conf

set -e

echo "🧹 BeforeInstall: Setting up docker-compose.yml and nginx.conf..."

# Ensure deployment directory exists
mkdir -p /opt/bianca-staging
cd /opt/bianca-staging

# Get instance metadata
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
PRIVATE_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Get secrets from AWS Secrets Manager
AWS_REGION="us-east-2"
AWS_ACCOUNT_ID="730335291008"
SECRET_ID="MySecretsManagerSecret"

echo "   Fetching secrets from AWS Secrets Manager..."
# Fetch all secrets at once with timeout to avoid hanging
SECRET_JSON=$(timeout 30 aws secretsmanager get-secret-value --region $AWS_REGION --secret-id $SECRET_ID --query SecretString --output text 2>&1)
if [ $? -ne 0 ] || [ -z "$SECRET_JSON" ]; then
  echo "❌ ERROR: Failed to fetch secrets from Secrets Manager"
  echo "   Error: $SECRET_JSON"
  exit 1
fi

# Parse secrets with error handling
ARI_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.ARI_PASSWORD // empty' 2>/dev/null)
BIANCA_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.BIANCA_PASSWORD // empty' 2>/dev/null)
POSTHOG_API_KEY=$(echo "$SECRET_JSON" | jq -r '.POSTHOG_API_KEY // empty' 2>/dev/null)
POSTHOG_SECRET_KEY=$(echo "$SECRET_JSON" | jq -r '.POSTHOG_SECRET_KEY // empty' 2>/dev/null)

# Verify required secrets
if [ -z "$ARI_PASSWORD" ] || [ -z "$BIANCA_PASSWORD" ]; then
  echo "❌ ERROR: Required secrets (ARI_PASSWORD or BIANCA_PASSWORD) are missing"
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
    container_name: staging_mongodb
    restart: unless-stopped
    ports:
      - "127.0.0.1:27017:27017"
    command: mongod --wiredTigerCacheSizeGB 0.5
    volumes:
      - /opt/mongodb-data:/data/db
    networks:
      - bianca-network

  asterisk:
    image: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bianca-app-asterisk:staging
    container_name: staging_asterisk
    restart: unless-stopped
    ports:
      - "5060:5060/udp"
      - "5061:5061/tcp"
      - "10000-10100:10000-10100/udp"
      - "8088:8088"
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
    image: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bianca-app-backend:staging
    container_name: staging_app
    restart: unless-stopped
    ports:
      - "3000:3000"
    command: ["yarn", "dev:staging"]
    environment:
      - AWS_REGION=$AWS_REGION
      - AWS_SECRET_ID=MySecretsManagerSecret
      - MONGODB_URL=mongodb://mongodb:27017/bianca-service
      - NODE_ENV=staging
      - API_BASE_URL=https://staging-api.myphonefriend.com
      - WEBSOCKET_URL=wss://staging-api.myphonefriend.com
      - FRONTEND_URL=https://staging.myphonefriend.com
      - ASTERISK_URL=http://asterisk:8088
      - ASTERISK_PRIVATE_IP=asterisk
      - ASTERISK_PUBLIC_IP=$PUBLIC_IP
      - AWS_SES_REGION=$AWS_REGION
      - EMAIL_FROM=no-reply@myphonefriend.com
      - TWILIO_PHONENUMBER=+19285758645
      - TWILIO_ACCOUNTSID=TWILIO_ACCOUNT_SID_PLACEHOLDER_REMOVED
      - STRIPE_PUBLISHABLE_KEY=pk_test_51R7r9ACpu9kuPmCAet21mRsIPqgc8iXD6oz5BrwVTEm8fd4j5z4GehmtTbMRuZyiCjJDOpLUKpUUMptDqfqdkG5300uoGHj7Ef
      - RTP_LISTENER_HOST=0.0.0.0
      - RTP_BIANCA_HOST=staging_app
      - RTP_ASTERISK_HOST=asterisk
      - USE_PRIVATE_NETWORK_FOR_RTP=true
      - NETWORK_MODE=DOCKER_COMPOSE
      - APP_RTP_PORT_RANGE=20002-30000
      - EMERGENCY_SNS_TOPIC_ARN=arn:aws:sns:$AWS_REGION:$AWS_ACCOUNT_ID:bianca-emergency-alerts
      - TELEMETRY_ENABLED=true
      - POSTHOG_API_KEY=$POSTHOG_API_KEY
      - POSTHOG_HOST=http://posthog:8000
    volumes:
      - ~/.aws:/root/.aws:ro
    depends_on:
      - mongodb
      - asterisk
      - posthog
    networks:
      - bianca-network

  frontend:
    image: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bianca-app-frontend:staging
    container_name: staging_frontend
    restart: unless-stopped
    ports:
      - "3001:80"
    depends_on:
      - app
    networks:
      - bianca-network

  nginx:
    image: nginx:alpine
    container_name: staging_nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app
      - frontend
    networks:
      - bianca-network

  posthog:
    image: posthog/posthog:release-1.30.0
    container_name: staging_posthog
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - POSTHOG_SECRET_KEY=$POSTHOG_SECRET_KEY
      - SITE_URL=https://staging-analytics.myphonefriend.com
      - DATABASE_URL=postgres://posthog:posthog@posthog-db:5432/posthog
      - REDIS_URL=redis://posthog-redis:6379
      - DISABLE_SECURE_SSL_REDIRECT=true
      - SECURE_COOKIES=false
      - DEBUG=1
    depends_on:
      posthog-db:
        condition: service_healthy
      posthog-redis:
        condition: service_healthy
    networks:
      - bianca-network

  posthog-db:
    image: postgres:12-alpine
    container_name: staging_posthog_db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=posthog
      - POSTGRES_PASSWORD=posthog
      - POSTGRES_DB=posthog
    volumes:
      - posthog-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U posthog"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - bianca-network

  posthog-redis:
    image: redis:7-alpine
    container_name: staging_posthog_redis
    restart: unless-stopped
    volumes:
      - posthog-redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - bianca-network

volumes:
  asterisk_logs:
  posthog-db-data:
  posthog-redis-data:

networks:
  bianca-network:
    driver: bridge
EOF

# Create nginx config
echo "   Creating nginx.conf..."
cat > nginx.conf <<'EOF'
server {
    listen 80;
    server_name staging.myphonefriend.com;
    
    location / {
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    }
}

server {
    listen 80;
    server_name staging-api.myphonefriend.com;
    
    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

echo "✅ BeforeInstall completed"

