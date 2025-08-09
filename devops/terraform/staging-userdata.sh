#!/bin/bash
# staging-userdata.sh - Setup script for staging environment

set -e

# Update and install Docker
yum update -y
amazon-linux-extras install docker -y
service docker start
usermod -a -G docker ec2-user

# Install docker-compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install utilities
yum install -y aws-cli jq git

# Get instance metadata
INSTANCE_ID=$(ec2-metadata --instance-id | cut -d " " -f 2)
PRIVATE_IP=$(ec2-metadata --local-ipv4 | cut -d " " -f 2)
PUBLIC_IP=$(ec2-metadata --public-ipv4 | cut -d " " -f 2 || echo $PRIVATE_IP)

# Create app directory
mkdir -p /opt/bianca-staging
cd /opt/bianca-staging

# Create frontend directory and nginx config
mkdir -p /var/www/staging-frontend

# Create nginx config for Docker
cat > nginx.conf << 'NGINX'
# Frontend server (staging.myphonefriend.com)
server {
    listen 80;
    server_name staging.myphonefriend.com;
    
    # Trust X-Forwarded-* headers from ALB
    real_ip_header X-Forwarded-For;
    set_real_ip_from 10.0.0.0/8;
    set_real_ip_from 172.16.0.0/12;
    set_real_ip_from 192.168.0.0/16;
    
    # Frontend routes - proxy to frontend container
    location / {
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API server (staging-api.myphonefriend.com)
server {
    listen 80;
    server_name staging-api.myphonefriend.com;
    
    # Trust X-Forwarded-* headers from ALB
    real_ip_header X-Forwarded-For;
    set_real_ip_from 10.0.0.0/8;
    set_real_ip_from 172.16.0.0/12;
    set_real_ip_from 192.168.0.0/16;
    
    # API routes - proxy ALL traffic to backend (no /api/ prefix needed!)
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
NGINX

# Create docker-compose.yml
cat > docker-compose.yml << 'COMPOSE'
version: '3.8'

services:
  # Asterisk for call handling
  asterisk:
    image: 730335291008.dkr.ecr.${region}.amazonaws.com/bianca-app-asterisk:latest
    container_name: staging_asterisk
    restart: unless-stopped
    network_mode: host
    environment:
      - EXTERNAL_ADDRESS=PUBLIC_IP_PLACEHOLDER
      - PRIVATE_ADDRESS=PRIVATE_IP_PLACEHOLDER
      - ARI_PASSWORD=staging123
      - BIANCA_PASSWORD=staging123
      - RTP_START_PORT=10000
      - RTP_END_PORT=10500
    volumes:
      - asterisk_logs:/var/log/asterisk

  # MongoDB (lightweight config for staging)
  mongodb:
    image: mongo:4.4
    container_name: staging_mongodb
    restart: unless-stopped
    ports:
      - "127.0.0.1:27017:27017"
    command: mongod --wiredTigerCacheSizeGB 0.5
    volumes:
      - mongo_data:/data/db

  # Your application
  app:
    image: ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/bianca-app-backend:staging
    container_name: staging_app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - AWS_REGION=${region}
      - MONGODB_URL=mongodb://mongodb:27017/bianca-service
      - NODE_ENV=staging
      - API_BASE_URL=https://staging-api.myphonefriend.com
      - WEBSOCKET_URL=wss://staging-api.myphonefriend.com
      - FRONTEND_URL=https://staging.myphonefriend.com
      - ASTERISK_URL=http://asterisk:8088
      - ASTERISK_PRIVATE_IP=asterisk
      - ASTERISK_PUBLIC_IP=PUBLIC_IP_PLACEHOLDER
      - AWS_SES_REGION=${region}
      - EMAIL_FROM=staging@myphonefriend.com
      - TWILIO_PHONENUMBER=+19786256514
      - TWILIO_ACCOUNTSID=TWILIO_ACCOUNT_SID_PLACEHOLDER_REMOVED
      - STRIPE_PUBLISHABLE_KEY=pk_test_51R7r9ACpu9kuPmCAet21mRsIPqgc8iXD6oz5BrwVTEm8fd4j5z4GehmtTbMRuZyiCjJDOpLUKpUUMptDqfqdkG5300uoGHj7Ef
      - RTP_LISTENER_HOST=0.0.0.0
      - USE_PRIVATE_NETWORK_FOR_RTP=true
      - NETWORK_MODE=HYBRID
      # Secrets will be fetched by the app from AWS Secrets Manager at runtime
    depends_on:
      - mongodb
      - asterisk

  # Frontend container (using staging tag for consistency)
  frontend:
    image: ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/bianca-app-frontend:staging
    container_name: staging_frontend
    restart: unless-stopped
    ports:
      - "3001:80"
    depends_on:
      - app

  # Nginx for reverse proxy (no longer serves static files)
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

volumes:
  mongo_data:
  asterisk_logs:
COMPOSE

# Replace placeholders with actual values
sed -i "s/PRIVATE_IP_PLACEHOLDER/$PRIVATE_IP/g" docker-compose.yml
sed -i "s/PUBLIC_IP_PLACEHOLDER/$PUBLIC_IP/g" docker-compose.yml

# Create startup script
cat > /usr/local/bin/start-staging.sh << 'STARTUP'
#!/bin/bash
cd /opt/bianca-staging

# Login to ECR
aws ecr get-login-password --region ${region} | \
  docker login --username AWS --password-stdin 730335291008.dkr.ecr.${region}.amazonaws.com

# Note: Secrets are loaded at runtime by the application from AWS Secrets Manager
# No need to fetch them here as environment variables

# Pull latest app image
docker-compose pull app || true

# Start all services
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Check service health
docker-compose ps
STARTUP

chmod +x /usr/local/bin/start-staging.sh

# Create systemd service
cat > /etc/systemd/system/bianca-staging.service << SYSTEMD
[Unit]
Description=Bianca Staging Stack
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/start-staging.sh
ExecStop=/usr/local/bin/docker-compose -f /opt/bianca-staging/docker-compose.yml down
WorkingDirectory=/opt/bianca-staging

[Install]
WantedBy=multi-user.target
SYSTEMD

# Enable and start the service
systemctl enable bianca-staging
systemctl start bianca-staging

# Setup CloudWatch monitoring (minimal for staging)
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json << CLOUDWATCH
{
  "metrics": {
    "namespace": "Bianca/Staging",
    "metrics_collected": {
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 300
      },
      "disk": {
        "measurement": ["used_percent"],
        "metrics_collection_interval": 300,
        "resources": ["/"]
      }
    }
  }
}
CLOUDWATCH

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config -m ec2 -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json || true







echo "Bianca staging environment ready!"
echo "Access points:"
echo "  Frontend: https://staging.myphonefriend.com"
echo "  API: https://staging-api.myphonefriend.com"
echo "  Direct API: http://$PUBLIC_IP:3000"
echo "  Asterisk ARI: http://$PUBLIC_IP:8088 (user: asterisk, pass: staging123)"
echo "  SIP: sip:$PUBLIC_IP"    