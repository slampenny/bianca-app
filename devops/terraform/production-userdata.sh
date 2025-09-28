#!/bin/bash

# Production userdata script for Bianca application
# This script sets up the production environment using Docker Compose (same as staging)

set -e

# Variables
REGION="${region}"
AWS_ACCOUNT_ID="${aws_account_id}"
ENVIRONMENT="${environment}"

# Get instance metadata
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
PRIVATE_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# Create application directory
mkdir -p /opt/bianca-production
cd /opt/bianca-production

# Get secrets from AWS Secrets Manager
echo "Fetching secrets from AWS Secrets Manager..."
SECRET_JSON=$(aws secretsmanager get-secret-value --region $${REGION} --secret-id MySecretsManagerSecret --query SecretString --output text)
ARI_PASSWORD=$(echo $${SECRET_JSON} | jq -r '.ARI_PASSWORD')
BIANCA_PASSWORD=$(echo $${SECRET_JSON} | jq -r '.BIANCA_PASSWORD')
TWILIO_AUTHTOKEN=$(echo $${SECRET_JSON} | jq -r '.TWILIO_AUTHTOKEN')
GOOGLE_OAUTH_CLIENTID=$(echo $${SECRET_JSON} | jq -r '.GOOGLE_OAUTH_CLIENTID')
MICROSOFT_OAUTH_CLIENTID=$(echo $${SECRET_JSON} | jq -r '.MICROSOFT_OAUTH_CLIENTID')

# Create docker-compose.yml
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
    image: 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-asterisk:latest
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
      - ARI_PASSWORD=$${ARI_PASSWORD}
      - BIANCA_PASSWORD=$${BIANCA_PASSWORD}
      - RTP_START_PORT=10000
      - RTP_END_PORT=10100
    volumes:
      - asterisk_logs:/var/log/asterisk
    networks:
      - bianca-network

  app:
    image: 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:production
    container_name: production_app
    restart: unless-stopped
    ports:
      - "3000:3000"

    command: ["yarn", "start"]

    environment:
      - AWS_REGION=us-east-2
      - MONGODB_URL=mongodb://mongodb:27017/bianca-service
      - NODE_ENV=production
      - API_BASE_URL=https://api.myphonefriend.com
      - WEBSOCKET_URL=wss://api.myphonefriend.com
      - FRONTEND_URL=https://app.myphonefriend.com
      - ASTERISK_URL=http://asterisk:8088
      - ASTERISK_PRIVATE_IP=asterisk
      - ASTERISK_PUBLIC_IP=$${PUBLIC_IP}
      - AWS_SES_REGION=us-east-2
      - EMAIL_FROM=production@myphonefriend.com
      - TWILIO_PHONENUMBER=+19285758645
      - TWILIO_ACCOUNTSID=TWILIO_ACCOUNT_SID_PLACEHOLDER_REMOVED
      - TWILIO_AUTHTOKEN=$${TWILIO_AUTHTOKEN}
      - STRIPE_PUBLISHABLE_KEY=pk_live_51R7r9ACpu9kuPmCAet21mRsIPqgc8iXD6oz5BrwVTEm8fd4j5z4GehmtTbMRuZyiCjJDOpLUKpUUMptDqfqdkG5300uoGHj7Ef
      - RTP_LISTENER_HOST=0.0.0.0
      - RTP_BIANCA_HOST=production_app
      - RTP_ASTERISK_HOST=asterisk
      - USE_PRIVATE_NETWORK_FOR_RTP=true
      - NETWORK_MODE=DOCKER_COMPOSE
      - APP_RTP_PORT_RANGE=20002-30000
      - ARI_PASSWORD=$${ARI_PASSWORD}
      - BIANCA_PASSWORD=$${BIANCA_PASSWORD}
      - GOOGLE_OAUTH_CLIENTID=$${GOOGLE_OAUTH_CLIENTID}
      - MICROSOFT_OAUTH_CLIENTID=$${MICROSOFT_OAUTH_CLIENTID}
      - EMERGENCY_SNS_TOPIC_ARN=arn:aws:sns:us-east-2:730335291008:bianca-emergency-alerts
    depends_on:
      - mongodb
      - asterisk
    networks:
      - bianca-network

  frontend:
    image: 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:production
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
    server_name app.myphonefriend.com;
    
    location / {
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.myphonefriend.com;
    
    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Login to ECR (as root for systemd)
echo "Logging into ECR..."
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com

# Create MongoDB data directory
mkdir -p /opt/mongodb-data
chown 999:999 /opt/mongodb-data

# Pull and start containers
echo "Starting containers..."
docker-compose pull
docker-compose up -d

# Copy source code to host for editing (after containers are running)
echo "Copying source code to host for editing..."
docker run --rm --user root -v /opt/bianca-production/app:/target 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:production sh -c "cp -r /usr/src/bianca-app/* /target/"

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

# Simple health check script
HEALTH_URL="http://localhost:3000/health"
LOG_FILE="/var/log/bianca-production.log"

if curl -f -s "$HEALTH_URL" > /dev/null; then
    echo "$(date): Health check passed" >> "$LOG_FILE"
else
    echo "$(date): Health check failed" >> "$LOG_FILE"
    # Restart services
    cd /opt/bianca-production
    docker-compose restart
fi
EOF

chmod +x /opt/bianca-production/monitor.sh

# Add cron job for monitoring
echo "*/5 * * * * /opt/bianca-production/monitor.sh" | crontab -u ec2-user -

# Create backup script
cat > /opt/bianca-production/backup.sh <<'EOF'
#!/bin/bash

# Backup script for production
BACKUP_DIR="/opt/bianca-production/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup MongoDB
docker-compose exec -T mongodb mongodump --archive | gzip > "$BACKUP_DIR/mongodb_$DATE.gz"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "mongodb_*.gz" -mtime +7 -delete

echo "$(date): Backup completed" >> /var/log/bianca-production.log
EOF

chmod +x /opt/bianca-production/backup.sh

# Add daily backup cron job
echo "0 2 * * * /opt/bianca-production/backup.sh" | crontab -u ec2-user -

echo "Production environment setup completed!"