#!/bin/bash
# Simple, working staging setup script

set -e
exec > >(tee /var/log/user-data.log) 2>&1

# Terraform variables
AWS_ACCOUNT_ID="${aws_account_id}"
AWS_REGION="${region}"

echo "Starting staging setup..."

# Update and install packages
yum update -y
yum install -y docker git jq

# Start Docker
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
usermod -a -G docker ec2-user

# Install docker-compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# Install AWS CLI v2 if not present
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
fi

# Get instance metadata
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
PRIVATE_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo "Instance: $${INSTANCE_ID}"
echo "Private IP: $${PRIVATE_IP}"
echo "Public IP: $${PUBLIC_IP}"

# Create app directory
mkdir -p /opt/bianca-staging
cd /opt/bianca-staging

# Create app directory for volume mounting
mkdir -p /opt/bianca-staging/app

# Set proper permissions for the app directory
chown -R ec2-user:ec2-user /opt/bianca-staging/app/
chmod -R 755 /opt/bianca-staging/app/



# Get secrets
echo "Fetching secrets..."
SECRET_JSON=$(aws secretsmanager get-secret-value --region $${AWS_REGION} --secret-id MySecretsManagerSecret --query SecretString --output text)
ARI_PASSWORD=$(echo $${SECRET_JSON} | jq -r '.ARI_PASSWORD')
BIANCA_PASSWORD=$(echo $${SECRET_JSON} | jq -r '.BIANCA_PASSWORD')
TWILIO_AUTHTOKEN=$(echo $${SECRET_JSON} | jq -r '.TWILIO_AUTHTOKEN')

# Create docker-compose.yml
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
      - mongo_data:/data/db
    networks:
      - bianca-network

  asterisk:
    image: $${AWS_ACCOUNT_ID}.dkr.ecr.$${AWS_REGION}.amazonaws.com/bianca-app-asterisk:latest
    container_name: staging_asterisk
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
    image: $${AWS_ACCOUNT_ID}.dkr.ecr.$${AWS_REGION}.amazonaws.com/bianca-app-backend:staging
    container_name: staging_app
    restart: unless-stopped
    ports:
      - "3000:3000"

    command: ["yarn", "dev:staging"]
    volumes:
      - /opt/bianca-staging/app:/usr/src/bianca-app:rw

    environment:
      - AWS_REGION=$${AWS_REGION}
      - MONGODB_URL=mongodb://mongodb:27017/bianca-service
      - NODE_ENV=staging
      - API_BASE_URL=https://staging-api.myphonefriend.com
      - WEBSOCKET_URL=wss://staging-api.myphonefriend.com
      - FRONTEND_URL=https://staging.myphonefriend.com
      - ASTERISK_URL=http://asterisk:8088
      - ASTERISK_PRIVATE_IP=asterisk
      - ASTERISK_PUBLIC_IP=$${PUBLIC_IP}
      - AWS_SES_REGION=$${AWS_REGION}
      - EMAIL_FROM=staging@myphonefriend.com
      - TWILIO_PHONENUMBER=+19285758645
      - TWILIO_ACCOUNTSID=TWILIO_ACCOUNT_SID_PLACEHOLDER_REMOVED
      - TWILIO_AUTHTOKEN=$${TWILIO_AUTHTOKEN}
      - STRIPE_PUBLISHABLE_KEY=pk_test_51R7r9ACpu9kuPmCAet21mRsIPqgc8iXD6oz5BrwVTEm8fd4j5z4GehmtTbMRuZyiCjJDOpLUKpUUMptDqfqdkG5300uoGHj7Ef
      - RTP_LISTENER_HOST=0.0.0.0
      - USE_PRIVATE_NETWORK_FOR_RTP=true
      - NETWORK_MODE=DOCKER_COMPOSE
      - ARI_PASSWORD=$${ARI_PASSWORD}
      - BIANCA_PASSWORD=$${BIANCA_PASSWORD}
    depends_on:
      - mongodb
      - asterisk
    networks:
      - bianca-network

  frontend:
    image: $${AWS_ACCOUNT_ID}.dkr.ecr.$${AWS_REGION}.amazonaws.com/bianca-app-frontend:staging
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

volumes:
  mongo_data:
  asterisk_logs:

networks:
  bianca-network:
    driver: bridge
EOF

# Create nginx config
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
        proxy_set_header X-Forwarded-Proto $scheme;
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
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Login to ECR (as root for systemd)
echo "Logging into ECR..."
aws ecr get-login-password --region $${AWS_REGION} | docker login --username AWS --password-stdin $${AWS_ACCOUNT_ID}.dkr.ecr.$${AWS_REGION}.amazonaws.com







# Pull and start containers
echo "Starting containers..."
docker-compose pull







docker-compose up -d

# Copy source code to host for editing (after containers are running)
echo "Copying source code to host for editing..."
docker run --rm --user root -v /opt/bianca-staging/app:/target $${AWS_ACCOUNT_ID}.dkr.ecr.$${AWS_REGION}.amazonaws.com/bianca-app-backend:staging sh -c "cp -r /usr/src/bianca-app/* /target/"

# Debug: Check what we copied
echo "Checking copied files on host:"
ls -la /opt/bianca-staging/
ls -la /opt/bianca-staging/src/

# Create systemd service
cat > /etc/systemd/system/bianca-staging.service <<EOF
[Unit]
Description=Bianca Staging
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/bianca-staging
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
StandardOutput=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable bianca-staging

# Setup cron for ECR refresh
echo "0 */6 * * * root aws ecr get-login-password --region $${AWS_REGION} | docker login --username AWS --password-stdin $${AWS_ACCOUNT_ID}.dkr.ecr.$${AWS_REGION}.amazonaws.com" > /etc/cron.d/ecr-refresh

# Wait and check
sleep 20

echo "==================================="
echo "Staging setup complete!"
echo "Frontend: https://staging.myphonefriend.com"
echo "API: https://staging-api.myphonefriend.com"
echo "==================================="

docker ps