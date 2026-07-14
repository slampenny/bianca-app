#!/bin/bash

# Production userdata script for Bianca application
# This script sets up the production environment using Docker Compose
# SECRETS ARE LOADED AT RUNTIME BY THE APPLICATION, NOT HARDCODED HERE

set -e

# Variables - Terraform templatefile passes lowercase, convert to uppercase for use in script
REGION="${region}"
AWS_ACCOUNT_ID="${aws_account_id}"
ENVIRONMENT="${environment}"

# Export ENVIRONMENT to /etc/environment so it's available to CodeDeploy scripts
echo "ENVIRONMENT=$${ENVIRONMENT}" >> /etc/environment
echo "AWS_REGION=$${REGION}" >> /etc/environment
export ENVIRONMENT="$${ENVIRONMENT}"
export AWS_REGION="$${REGION}"

# Get instance metadata
# Use EIP if provided (from Terraform), otherwise fall back to instance metadata
# This ensures we always use the correct IP even if instance is recreated
if [ -n "${eip_address}" ]; then
  PUBLIC_IP="${eip_address}"
else
  PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
fi
PRIVATE_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker

# Configure Docker log rotation to prevent disk space issues
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
systemctl restart docker

usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# Install jq for JSON parsing
yum install -y jq

# Install Ruby (required for CodeDeploy agent installer)
echo "Installing Ruby (required for CodeDeploy agent)..."
yum install -y ruby

# Install CodeDeploy agent (CRITICAL - must not fail)
echo "==================================="
echo "Installing CodeDeploy agent (REQUIRED)..."
echo "==================================="
cd /tmp
# Use region from Terraform template variable
REGION="${region}"

# Download and install with retries
MAX_RETRIES=3
RETRY_COUNT=0
INSTALL_SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES: Downloading CodeDeploy agent installer..."
    if wget https://aws-codedeploy-$${REGION}.s3.$${REGION}.amazonaws.com/latest/install -O install 2>&1; then
        chmod +x ./install
        echo "Installing CodeDeploy agent..."
        if sudo ./install auto 2>&1; then
            INSTALL_SUCCESS=true
            echo "✅ CodeDeploy agent installed successfully"
            break
        else
            echo "⚠️  Installation failed, retrying..."
        fi
    else
        echo "⚠️  Download failed, retrying..."
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 5
done

if [ "$INSTALL_SUCCESS" != "true" ]; then
    echo "❌ CRITICAL ERROR: Failed to install CodeDeploy agent after $MAX_RETRIES attempts"
    echo "This will prevent deployments from working!"
    # Continue anyway - instance should still be usable, but deployments will fail
fi

# Enable and start (with error handling)
echo "Enabling and starting CodeDeploy agent..."
sudo systemctl enable codedeploy-agent || echo "⚠️  Failed to enable codedeploy-agent service"

if ! sudo systemctl start codedeploy-agent; then
    echo "❌ ERROR: Failed to start CodeDeploy agent"
    sudo systemctl status codedeploy-agent --no-pager || true
    # Try one more time after a delay
    sleep 5
    sudo systemctl start codedeploy-agent || echo "⚠️  Second start attempt also failed"
fi

# Wait and verify with extended timeout
echo "Verifying CodeDeploy agent is running..."
sleep 10
for i in {1..10}; do
    if sudo systemctl is-active --quiet codedeploy-agent; then
        echo "✅ CodeDeploy agent is running"
        sudo systemctl status codedeploy-agent --no-pager | head -10
        break
    fi
    echo "Waiting for agent to start (attempt $i/10)..."
    sleep 5
done

if ! sudo systemctl is-active --quiet codedeploy-agent; then
    echo "❌ WARNING: CodeDeploy agent failed to start after multiple attempts"
    echo "Checking logs..."
    sudo systemctl status codedeploy-agent --no-pager || true
    sudo tail -50 /var/log/aws/codedeploy-agent/codedeploy-agent.log 2>&1 || echo "Log file not found"
    echo "⚠️  Instance will continue, but CodeDeploy deployments may fail"
    echo "⚠️  Manual installation may be required:"
    echo "   sudo yum install -y ruby && cd /tmp && wget https://aws-codedeploy-$${REGION}.s3.$${REGION}.amazonaws.com/latest/install && sudo ./install auto"
fi

# Create application directory
mkdir -p /opt/bianca-production
cd /opt/bianca-production

# Fetch secrets for bootstrap compose (full stack is regenerated later by CodeDeploy / regenerate-host-stack.sh)
echo "Fetching secrets from Secrets Manager..."
SECRET_ARN="arn:aws:secretsmanager:${region}:${aws_account_id}:secret:MySecretsManagerSecret-*"
SECRET_VALUE=$(aws secretsmanager get-secret-value --region ${region} --secret-id MySecretsManagerSecret --query SecretString --output text)
ARI_PASSWORD=$(echo "$SECRET_VALUE" | jq -r .ARI_PASSWORD)
BIANCA_PASSWORD=$(echo "$SECRET_VALUE" | jq -r .BIANCA_PASSWORD)
STRIPE_PUBLISHABLE_KEY=$(echo "$SECRET_VALUE" | jq -r '.STRIPE_PUBLISHABLE_KEY // empty')
if [ -z "$STRIPE_PUBLISHABLE_KEY" ] || [ "$STRIPE_PUBLISHABLE_KEY" = "null" ]; then
  echo "ERROR: STRIPE_PUBLISHABLE_KEY missing from Secrets Manager secret MySecretsManagerSecret — fail closed"
  exit 1
fi

# Create docker-compose.yml - Asterisk passwords loaded from Secrets Manager
cat > docker-compose.yml <<EOF
version: '3.8'

services:
  mongodb:
    image: mongo:4.4
    container_name: production_mongodb
    restart: unless-stopped
    ports:
      - "127.0.0.1:27017:27017"
    command: mongod --wiredTigerCacheSizeGB 0.5
    volumes:
      - /opt/mongodb-data:/data/db
    networks:
      - bianca-network

  asterisk:
    image: ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/bianca-app-asterisk:production
    container_name: production_asterisk
    restart: unless-stopped
    ports:
      - "5060:5060/udp"
      - "5061:5061/tcp"
      - "10000-10100:10000-10100/udp"
      - "8088:8088"
    environment:
      - EXTERNAL_ADDRESS=$${PUBLIC_IP}
      - PRIVATE_ADDRESS=$${PRIVATE_IP}
      - RTP_START_PORT=10000
      - RTP_END_PORT=10100
      - ARI_PASSWORD=$${ARI_PASSWORD}
      - BIANCA_PASSWORD=$${BIANCA_PASSWORD}
    volumes:
      - asterisk_logs:/var/log/asterisk
    networks:
      - bianca-network

  app:
    image: ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/bianca-app-backend:production
    container_name: production_app
    restart: unless-stopped
    ports:
      - "3000:3000"
    command: ["yarn", "start"]
    environment:
      - AWS_REGION=${region}
      - AWS_SECRET_ID=MySecretsManagerSecret
      - MONGODB_URL=mongodb://mongodb:27017/bianca-service
      - NODE_ENV=production
      - API_BASE_URL=https://api.biancawellness.com
      - WEBSOCKET_URL=wss://api.biancawellness.com
      - FRONTEND_URL=https://app.biancawellness.com
      - MOBILE_APP_URL=https://mobile.biancawellness.com
      - ASTERISK_URL=http://asterisk:8088
      - ASTERISK_PRIVATE_IP=asterisk
      - ASTERISK_PUBLIC_IP=$${PUBLIC_IP}
      - AWS_SES_REGION=${region}
      - EMAIL_FROM=no-reply@biancawellness.com
      - TWILIO_PHONENUMBER=+16047060134
      - TWILIO_ACCOUNTSID=TWILIO_ACCOUNT_SID_PLACEHOLDER_REMOVED
      - STRIPE_PUBLISHABLE_KEY=$${STRIPE_PUBLISHABLE_KEY}
      - RTP_LISTENER_HOST=0.0.0.0
      - RTP_BIANCA_HOST=production_app
      - RTP_ASTERISK_HOST=asterisk
      - USE_PRIVATE_NETWORK_FOR_RTP=true
      - NETWORK_MODE=DOCKER_COMPOSE
      - APP_RTP_PORT_RANGE=20002-30000
      - EMERGENCY_SNS_TOPIC_ARN=arn:aws:sns:${region}:${aws_account_id}:bianca-emergency-alerts
    volumes:
      - ~/.aws:/root/.aws:ro
    depends_on:
      - mongodb
      - asterisk
    networks:
      - bianca-network

  frontend:
    image: ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/bianca-app-frontend:production
    container_name: production_frontend
    restart: unless-stopped
    ports:
      - "3001:80"
    depends_on:
      - app
    networks:
      - bianca-network

  nginx:
    image: nginx:alpine
    container_name: production_nginx
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

volumes:
  asterisk_logs:

networks:
  bianca-network:
    driver: bridge
EOF

# Create nginx config
cat > nginx.conf <<'EOF'
server {
    listen 80;
    server_name app.biancawellness.com;
    
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
    server_name api.biancawellness.com;
    
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

# Login to ECR (as root for systemd)
echo "Logging into ECR..."
aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${aws_account_id}.dkr.ecr.${region}.amazonaws.com

# Format and mount EBS volume for MongoDB data (same behavior as staging-userdata.sh).
# The Terraform-tagged volume (bianca-production-mongodb-data) is attached as /dev/sdf by
# blue/green swap; on Nitro instances it may appear as /dev/nvme1n1 (see buildspec-swap-and-terminate.yml).
# Do NOT store MongoDB data on the root volume — if the EBS volume is missing, swap Step 0 must attach it first.
echo "Setting up EBS volume for MongoDB..."
MONGO_DEV=""
for cand in /dev/nvme1n1 /dev/nvme2n1 /dev/sdf /dev/xvdf; do
  if [ -b "$cand" ]; then
    MONGO_DEV="$cand"
    break
  fi
done

if [ -n "$MONGO_DEV" ]; then
  if ! blkid "$MONGO_DEV" >/dev/null 2>&1; then
    echo "Formatting EBS volume $MONGO_DEV..."
    mkfs.ext4 -F "$MONGO_DEV"
  fi
  mkdir -p /opt/mongodb-data
  if ! mount "$MONGO_DEV" /opt/mongodb-data 2>/dev/null; then
    mount -o nouuid "$MONGO_DEV" /opt/mongodb-data
  fi
  chown 999:999 /opt/mongodb-data
  chmod 755 /opt/mongodb-data
  if ! grep -q '/opt/mongodb-data' /etc/fstab; then
    echo "$MONGO_DEV /opt/mongodb-data ext4 defaults,nofail 0 2" >> /etc/fstab
  fi
  echo "EBS volume mounted successfully at $MONGO_DEV -> /opt/mongodb-data"
else
  echo "CRITICAL: bianca-production-mongodb-data EBS not attached — MongoDB must not use the root volume."
  echo "Attach the Terraform volume (tag Name=bianca-production-mongodb-data) before starting MongoDB."
  echo "Blue/green swap Step 0 handles attach/mount on green instances."
fi

mkdir -p /opt/redis-data
chown 999:999 /opt/redis-data

# Create asterisk recordings directory
mkdir -p /opt/asterisk-recordings
chown 1000:1000 /opt/asterisk-recordings

# Pull and start containers
echo "Starting containers..."
docker-compose pull
docker-compose up -d

# Copy source code to host for editing (after containers are running)
echo "Copying source code to host for editing..."
docker run --rm --user root -v /opt/bianca-production/app:/target ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/bianca-app-backend:production sh -c "cp -r /usr/src/bianca-app/* /target/"

# Debug: Check what we copied
echo "Checking copied files on host:"
ls -la /opt/bianca-production/
ls -la /opt/bianca-production/app/

# Create systemd service
cat > /etc/systemd/system/bianca-production.service <<EOF
[Unit]
Description=Bianca Production
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/bianca-production
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
StandardOutput=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
systemctl enable bianca-production.service

# Create log rotation
cat > /etc/logrotate.d/bianca-production <<EOF
/var/log/bianca-production.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ec2-user ec2-user
}
EOF

# Set up monitoring script
cat > /opt/bianca-production/monitor.sh <<'EOF'
#!/bin/bash

# Aggressive health check and recovery script
HEALTH_URL="http://localhost:3000/health"
LOG_FILE="/var/log/bianca-production.log"
MAX_FAILURES=3
FAILURE_COUNT_FILE="/tmp/health_check_failures"

# Initialize failure count
if [ ! -f "$FAILURE_COUNT_FILE" ]; then
    echo "0" > "$FAILURE_COUNT_FILE"
fi

# Check if containers are running
if ! docker ps | grep -q "production_app"; then
    echo "$(date): CRITICAL - App container not running! Restarting all services..." >> "$LOG_FILE"
    cd /opt/bianca-production
    docker-compose up -d
    echo "0" > "$FAILURE_COUNT_FILE"
    exit 0
fi

# Health check
if curl -f -s --max-time 5 "$HEALTH_URL" > /dev/null 2>&1; then
    # Health check passed - reset failure count
    echo "0" > "$FAILURE_COUNT_FILE"
else
    # Health check failed - increment failure count
    FAILURES=$(cat "$FAILURE_COUNT_FILE")
    FAILURES=$((FAILURES + 1))
    echo "$FAILURES" > "$FAILURE_COUNT_FILE"
    
    echo "$(date): Health check failed ($FAILURES/$MAX_FAILURES)" >> "$LOG_FILE"
    
    if [ "$FAILURES" -ge "$MAX_FAILURES" ]; then
        echo "$(date): Max failures reached. Restarting services..." >> "$LOG_FILE"
        cd /opt/bianca-production
        docker-compose restart app
        echo "0" > "$FAILURE_COUNT_FILE"
    fi
fi
EOF

chmod +x /opt/bianca-production/monitor.sh

# Add cron job for monitoring - check every minute
echo "* * * * * /opt/bianca-production/monitor.sh" | crontab -u ec2-user -

# HIPAA backups: scripts installed by CodeDeploy after_install.sh
cat > /opt/bianca-production/backup.sh <<'EOF'
#!/bin/bash
if [ -x /opt/bianca-production/hipaa-backup.sh ]; then
  /opt/bianca-production/hipaa-backup.sh daily
else
  echo "$(date): hipaa-backup.sh not deployed yet" >> /var/log/bianca-production.log
fi
EOF

chmod +x /opt/bianca-production/backup.sh

# Daily HIPAA backup cron (noon Pacific; scripts deployed via CodeDeploy)
cat > /opt/bianca-production/install-hipaa-backup-cron.sh <<'CRON_EOF'
#!/bin/bash
if [ ! -x /opt/bianca-production/hipaa-backup.sh ]; then
  exit 0
fi
(
  crontab -u ec2-user -l 2>/dev/null | grep -v hipaa-backup | grep -v 'CRON_TZ=America/Los_Angeles' || true
  echo 'CRON_TZ=America/Los_Angeles'
  echo '0 12 * * * /opt/bianca-production/hipaa-backup.sh daily >> /var/log/bianca-production.log 2>&1'
) | crontab -u ec2-user -
CRON_EOF
chmod +x /opt/bianca-production/install-hipaa-backup-cron.sh

echo "Production environment setup completed!"