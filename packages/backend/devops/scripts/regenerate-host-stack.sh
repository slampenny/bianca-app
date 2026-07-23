#!/bin/bash
# regenerate-host-stack.sh
# Shared secrets-fetch + docker-compose.yml / nginx.conf generation for EC2 hosts.
# Used by: CodeDeploy BeforeInstall (production) and yarn staging:deploy (SSM).
#
# Required: ENVIRONMENT in {staging,production,demo}
# Optional: AWS_REGION (defaults via resolve-aws-region.sh or ca-central-1)
# Optional: DEPLOY_GIT_SHA — written to $DEPLOY_DIR/.deployed-git-sha (no secrets)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve region: prefer sibling resolve-aws-region.sh (CodeDeploy package) then devops path
if [ -f "$SCRIPT_DIR/resolve-aws-region.sh" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/resolve-aws-region.sh"
elif [ -f "$SCRIPT_DIR/../codedeploy/scripts/resolve-aws-region.sh" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/../codedeploy/scripts/resolve-aws-region.sh"
else
  AWS_REGION="${AWS_REGION:-ca-central-1}"
  export AWS_REGION
fi

ENVIRONMENT="${ENVIRONMENT:-${1:-}}"
if [ -z "$ENVIRONMENT" ]; then
  echo "❌ ERROR: ENVIRONMENT must be set (staging|production|demo)" >&2
  exit 1
fi
ENVIRONMENT=$(echo "$ENVIRONMENT" | tr '[:upper:]' '[:lower:]')

case "$ENVIRONMENT" in
  production)
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
    ;;
  staging)
    DEPLOY_DIR="/opt/bianca-staging"
    CONTAINER_PREFIX="staging"
    IMAGE_TAG="staging"
    NODE_ENV="staging"
    API_BASE_URL="https://staging-api.biancawellness.com"
    WEBSOCKET_URL="wss://staging-api.biancawellness.com"
    FRONTEND_URL="https://staging.biancawellness.com"
    SERVER_NAME_FRONTEND="staging.biancawellness.com"
    SERVER_NAME_API="staging-api.biancawellness.com"
    YARN_COMMAND="yarn start"
    CLOUDWATCH_LOG_PREFIX="/bianca/staging"
    ;;
  demo)
    DEPLOY_DIR="/opt/bianca-demo"
    CONTAINER_PREFIX="demo"
    IMAGE_TAG="production"
    NODE_ENV="production"
    API_BASE_URL="https://demo.biancawellness.com/v1"
    WEBSOCKET_URL="wss://demo.biancawellness.com/v1"
    FRONTEND_URL="https://demo.biancawellness.com"
    SERVER_NAME_FRONTEND="demo.biancawellness.com"
    SERVER_NAME_API="demo.biancawellness.com"
    YARN_COMMAND="yarn start"
    CLOUDWATCH_LOG_PREFIX="/bianca/demo"
    ;;
  *)
    echo "❌ ERROR: Unknown ENVIRONMENT=$ENVIRONMENT" >&2
    exit 1
    ;;
esac

echo "   ✅ regenerate-host-stack: environment=$ENVIRONMENT deploy_dir=$DEPLOY_DIR image_tag=$IMAGE_TAG region=$AWS_REGION"

# Set Twilio caller ID by environment (demo uses dedicated number)
case "$ENVIRONMENT" in
  production)
    TWILIO_PHONENUMBER="+16047060134"
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

# Mobile app web origin for family portal invite emails (public URL — same pattern as FRONTEND_URL)
case "$ENVIRONMENT" in
  production)
    MOBILE_APP_URL="https://mobile.biancawellness.com"
    ;;
  staging)
    MOBILE_APP_URL="https://staging-mobile.biancawellness.com"
    ;;
  demo)
    MOBILE_APP_URL="https://mobile.biancawellness.com"
    ;;
  *)
    MOBILE_APP_URL="https://staging-mobile.biancawellness.com"
    ;;
esac

# Per-resident voice turn / server_vad tuning (non-secret; injected into app container env)
case "$ENVIRONMENT" in
  production)
    AUDIO_TURN_PERSONALIZATION_ENABLED="true"
    AUDIO_TURN_DEFAULT_SILENCE_DURATION_MS="450"
    AUDIO_TURN_MIN_SILENCE_DURATION_MS="300"
    AUDIO_TURN_MAX_SILENCE_DURATION_MS="2500"
    AUDIO_TURN_INTERRUPTION_BUMP_MS="300"
    AUDIO_TURN_SUCCESS_DECAY_MS="25"
    AUDIO_TURN_SUCCESS_DECAY_MIN_TURNS="6"
    AUDIO_TURN_SUCCESS_DECAY_MIN_CALLS="1"
    AUDIO_TURN_PROFILE_ALPHA="0.25"
    ;;
  *)
    AUDIO_TURN_PERSONALIZATION_ENABLED="true"
    AUDIO_TURN_DEFAULT_SILENCE_DURATION_MS="300"
    AUDIO_TURN_MIN_SILENCE_DURATION_MS="225"
    AUDIO_TURN_MAX_SILENCE_DURATION_MS="2000"
    AUDIO_TURN_INTERRUPTION_BUMP_MS="250"
    AUDIO_TURN_SUCCESS_DECAY_MS="50"
    AUDIO_TURN_SUCCESS_DECAY_MIN_TURNS="6"
    AUDIO_TURN_SUCCESS_DECAY_MIN_CALLS="1"
    AUDIO_TURN_PROFILE_ALPHA="0.35"
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
true

# Ensure deployment directory exists (create if it doesn't)
echo "   Ensuring deployment directory exists: $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
chown -R ec2-user:ec2-user "$DEPLOY_DIR" 2>/dev/null || true
chmod -R 755 "$DEPLOY_DIR" 2>/dev/null || true
cd "$DEPLOY_DIR"

if [ "$DEPLOY_DIR" = "/opt/bianca-staging" ] && [ -f "/opt/bianca-staging/.live-dev-enabled" ]; then
  echo "❌ ERROR: Staging live-dev is active (.live-dev-enabled)." >&2
  echo "   Disable it first: yarn staging:live:off" >&2
  echo "   Then re-run the pipeline deploy." >&2
  exit 1
fi

# Get instance metadata (EIP association makes public-ipv4 return the Elastic IP)
PRIVATE_IP=$(curl -sf --connect-timeout 2 http://169.254.169.254/latest/meta-data/local-ipv4 || true)
PUBLIC_IP=$(curl -sf --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 || true)
if [ -z "${PRIVATE_IP:-}" ] || [ -z "${PUBLIC_IP:-}" ]; then
  echo "❌ ERROR: Could not read EC2 instance metadata (private/public IP)" >&2
  exit 1
fi

# Get secrets from AWS Secrets Manager
AWS_ACCOUNT_ID="730335291008"
if [ "$ENVIRONMENT" = "staging" ]; then
  SECRET_ID="MySecretsManagerSecret-Staging"
else
  SECRET_ID="MySecretsManagerSecret"
fi

echo "   Fetching secrets from AWS Secrets Manager..."
SECRET_JSON=""
EXIT_CODE=1
RETRY_COUNT=0
MAX_RETRIES=3

while [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
  echo "   Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES..."
  set +e
  SECRET_JSON=$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$SECRET_ID" --query SecretString --output text 2>&1)
  EXIT_CODE=$?
  set -e

  if [ "$EXIT_CODE" -eq 0 ] && [ -n "$SECRET_JSON" ] && [ "$SECRET_JSON" != "None" ]; then
    echo "   ✅ Secrets fetched successfully"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; then
    echo "   ⚠️  Retry in 2 seconds..."
    sleep 2
  fi
done

if [ -z "$SECRET_JSON" ] || [ "$SECRET_JSON" = "None" ] || [ "$EXIT_CODE" -ne 0 ]; then
  echo "❌ ERROR: Failed to fetch secrets from Secrets Manager after $MAX_RETRIES attempts" >&2
  echo "   Secret ID: $SECRET_ID" >&2
  echo "   Region: $AWS_REGION" >&2
  echo "   Exit code: $EXIT_CODE" >&2
  echo "   Output: (redacted — secrets manager error; check IAM / secret id)" >&2
  exit 1
fi

# Parse secrets with error handling
ARI_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.ARI_PASSWORD // empty' 2>/dev/null)
BIANCA_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.BIANCA_PASSWORD // empty' 2>/dev/null)
TWILIO_ACCOUNTSID=$(echo "$SECRET_JSON" | jq -r '.TWILIO_ACCOUNTSID // empty' 2>/dev/null)
STRIPE_PUBLISHABLE_KEY=$(echo "$SECRET_JSON" | jq -r '.STRIPE_PUBLISHABLE_KEY // empty' 2>/dev/null)

# Verify required secrets (never print secret values)
if [ -z "$ARI_PASSWORD" ] || [ -z "$BIANCA_PASSWORD" ]; then
  echo "❌ ERROR: Required secrets are missing" >&2
  if [ -n "$ARI_PASSWORD" ]; then echo "   ARI_PASSWORD: SET" >&2; else echo "   ARI_PASSWORD: MISSING" >&2; fi
  if [ -n "$BIANCA_PASSWORD" ]; then echo "   BIANCA_PASSWORD: SET" >&2; else echo "   BIANCA_PASSWORD: MISSING" >&2; fi
  exit 1
fi

if [ -z "$STRIPE_PUBLISHABLE_KEY" ]; then
  echo "❌ ERROR: STRIPE_PUBLISHABLE_KEY missing from Secrets Manager secret '$SECRET_ID' (environment=$ENVIRONMENT). Fail closed — no key literals in compose." >&2
  exit 1
fi

echo "   ✅ Secrets fetched successfully"

# Create docker-compose.yml
echo "   Creating docker-compose.yml..."
# Must be initialized before the compose heredoc (set -u); demo path overwrites below.
DEMO_502_VOLUME=""
NGINX_502_BLOCK=""

# Enable daily digest Agenda job registration for staging and production.
# Org.dailyDigestSettings.enabled + caregiver.notificationPreferences.dailyDigestEmail
# still gate actual sends — this only registers the coordinator job.
if [ "$ENVIRONMENT" = "staging" ] || [ "$ENVIRONMENT" = "production" ]; then
  DAILY_DIGEST_SCHEDULER_ENV_LINE="      - DAILY_DIGEST_SCHEDULER_ENABLED=true"
else
  DAILY_DIGEST_SCHEDULER_ENV_LINE=""
fi

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
      - MOBILE_APP_URL=$MOBILE_APP_URL
      - ASTERISK_URL=http://asterisk:8088
      - ASTERISK_HOST=asterisk
      - DEPLOYMENT_TYPE=docker-compose
      - ASTERISK_PRIVATE_IP=asterisk
      - ASTERISK_PUBLIC_IP=$PUBLIC_IP
      - AWS_SES_REGION=$AWS_REGION
      - EMAIL_FROM=no-reply@biancawellness.com
$DAILY_DIGEST_SCHEDULER_ENV_LINE
      - TWILIO_PHONENUMBER=$TWILIO_PHONENUMBER
      - TWILIO_ACCOUNTSID=$TWILIO_ACCOUNTSID
      - STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY
      - RTP_LISTENER_HOST=0.0.0.0
      - RTP_BIANCA_HOST=${CONTAINER_PREFIX}_app
      - RTP_ASTERISK_HOST=asterisk
      - USE_PRIVATE_NETWORK_FOR_RTP=true
      - NETWORK_MODE=DOCKER_COMPOSE
      - APP_RTP_PORT_RANGE=20002-30000
      - EMERGENCY_SNS_TOPIC_ARN=arn:aws:sns:$AWS_REGION:$AWS_ACCOUNT_ID:bianca-emergency-alerts
      - TELEMETRY_ENABLED=false
      - AUDIO_TURN_PERSONALIZATION_ENABLED=$AUDIO_TURN_PERSONALIZATION_ENABLED
      - AUDIO_TURN_DEFAULT_SILENCE_DURATION_MS=$AUDIO_TURN_DEFAULT_SILENCE_DURATION_MS
      - AUDIO_TURN_MIN_SILENCE_DURATION_MS=$AUDIO_TURN_MIN_SILENCE_DURATION_MS
      - AUDIO_TURN_MAX_SILENCE_DURATION_MS=$AUDIO_TURN_MAX_SILENCE_DURATION_MS
      - AUDIO_TURN_INTERRUPTION_BUMP_MS=$AUDIO_TURN_INTERRUPTION_BUMP_MS
      - AUDIO_TURN_SUCCESS_DECAY_MS=$AUDIO_TURN_SUCCESS_DECAY_MS
      - AUDIO_TURN_SUCCESS_DECAY_MIN_TURNS=$AUDIO_TURN_SUCCESS_DECAY_MIN_TURNS
      - AUDIO_TURN_SUCCESS_DECAY_MIN_CALLS=$AUDIO_TURN_SUCCESS_DECAY_MIN_CALLS
      - AUDIO_TURN_PROFILE_ALPHA=$AUDIO_TURN_PROFILE_ALPHA
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


# Deploy markers (never secrets)
if [ -n "${DEPLOY_GIT_SHA:-}" ]; then
  echo "$DEPLOY_GIT_SHA" > "$DEPLOY_DIR/.deployed-git-sha"
  echo "   Wrote $DEPLOY_DIR/.deployed-git-sha"
fi
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$DEPLOY_DIR/.deployed-at" || true

echo "✅ regenerate-host-stack completed for $ENVIRONMENT"
