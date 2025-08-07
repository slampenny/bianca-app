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
yum install -y aws-cli jq git nginx

# Get instance metadata
INSTANCE_ID=$(ec2-metadata --instance-id | cut -d " " -f 2)
PRIVATE_IP=$(ec2-metadata --local-ipv4 | cut -d " " -f 2)
PUBLIC_IP=$(ec2-metadata --public-ipv4 | cut -d " " -f 2 || echo $PRIVATE_IP)

# Create app directory
mkdir -p /opt/bianca-staging
cd /opt/bianca-staging

# Create frontend directory
mkdir -p /var/www/staging-frontend

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
    image: ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/bianca-app-backend:latest
    container_name: staging_app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=staging
      - MONGODB_URL=mongodb://mongodb:27017/bianca-staging
      - ASTERISK_URL=http://asterisk:8088
      - ASTERISK_HOST=asterisk
      - ASTERISK_PRIVATE_IP=PRIVATE_IP_PLACEHOLDER
      - ASTERISK_PUBLIC_IP=PUBLIC_IP_PLACEHOLDER
      - DEPLOYMENT_TYPE=docker-compose
      - AWS_REGION=${region}
      # Staging-specific settings
      - LOG_LEVEL=debug
      - ENABLE_MONITORING=false
      - USE_MOCK_TWILIO=false
      - EMAIL_CRITICAL=false
      - FAIL_ON_EMAIL_ERROR=false
      # Required Twilio configuration (non-secret values)
      - TWILIO_ACCOUNTSID=TWILIO_ACCOUNT_SID_PLACEHOLDER_REMOVED
      - TWILIO_PHONENUMBER=+19786256514
      - STRIPE_PUBLISHABLE_KEY=pk_test_51R7r9ACpu9kuPmCAet21mRsIPqgc8iXD6oz5BrwVTEm8fd4j5z4GehmtTbMRuZyiCjJDOpLUKpUUMptDqfqdkG5300uoGHj7Ef
      # Email configuration
      - AWS_SES_REGION=${region}
      - EMAIL_FROM=staging@myphonefriend.com
      - RTP_LISTENER_HOST=0.0.0.0
      - USE_PRIVATE_NETWORK_FOR_RTP=true
      - NETWORK_MODE=HYBRID
      # Secrets (pulled from AWS Secrets Manager)
      - JWT_SECRET=$${JWT_SECRET}
      - TWILIO_AUTHTOKEN=$${TWILIO_AUTHTOKEN}
      - ARI_PASSWORD=$${ARI_PASSWORD}
      - OPENAI_API_KEY=$${OPENAI_API_KEY}
    depends_on:
      - mongodb
      - asterisk

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

# Get secrets from AWS Secrets Manager
echo "Fetching secrets from AWS Secrets Manager..."
JWT_SECRET=$(aws secretsmanager get-secret-value --region ${region} --secret-id "MySecretsManagerSecret" --query SecretString --output text | jq -r .JWT_SECRET)
TWILIO_AUTHTOKEN=$(aws secretsmanager get-secret-value --region ${region} --secret-id "MySecretsManagerSecret" --query SecretString --output text | jq -r .TWILIO_AUTHTOKEN)
ARI_PASSWORD=$(aws secretsmanager get-secret-value --region ${region} --secret-id "MySecretsManagerSecret" --query SecretString --output text | jq -r .ARI_PASSWORD)
OPENAI_API_KEY=$(aws secretsmanager get-secret-value --region ${region} --secret-id "MySecretsManagerSecret" --query SecretString --output text | jq -r .OPENAI_API_KEY)

# Export secrets as environment variables for docker-compose
export JWT_SECRET
export TWILIO_AUTHTOKEN  
export ARI_PASSWORD
export OPENAI_API_KEY

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

# Setup nginx for frontend
cat > /etc/nginx/conf.d/staging-frontend.conf << NGINX
server {
    listen 80;
    server_name staging.myphonefriend.com staging-api.myphonefriend.com;
    
    # Frontend routes
    location / {
        root /var/www/staging-frontend;
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # API routes - proxy to backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Admin routes
    location /admin/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

# Create a simple placeholder frontend
cat > /var/www/staging-frontend/index.html << FRONTEND
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bianca App - Staging</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            text-align: center;
            max-width: 600px;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .status {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            backdrop-filter: blur(10px);
        }
        .endpoint {
            background: rgba(255,255,255,0.2);
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            font-family: monospace;
        }
        .health-check {
            margin-top: 30px;
        }
        .health-status {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            margin: 10px;
        }
        .healthy { background: #4CAF50; }
        .unhealthy { background: #f44336; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Bianca App</h1>
        <div class="status">
            <h2>Staging Environment</h2>
            <p>Full-stack development environment with API, frontend, and telephony services.</p>
        </div>
        
        <div class="status">
            <h3>📡 Endpoints</h3>
            <div class="endpoint">
                <strong>Frontend:</strong> <a href="/" style="color: white;">staging.myphonefriend.com</a>
            </div>
            <div class="endpoint">
                <strong>API:</strong> <a href="/api/health" style="color: white;">staging-api.myphonefriend.com</a>
            </div>
            <div class="endpoint">
                <strong>SIP:</strong> staging-sip.myphonefriend.com
            </div>
        </div>
        
        <div class="health-check">
            <h3>🔍 Health Status</h3>
            <div id="health-status" class="health-status unhealthy">Checking...</div>
        </div>
    </div>

    <script>
        // Health check
        async function checkHealth() {
            try {
                const response = await fetch('/api/health');
                const status = document.getElementById('health-status');
                if (response.ok) {
                    status.textContent = '✅ Healthy';
                    status.className = 'health-status healthy';
                } else {
                    status.textContent = '❌ Unhealthy';
                    status.className = 'health-status unhealthy';
                }
            } catch (error) {
                const status = document.getElementById('health-status');
                status.textContent = '❌ Unhealthy';
                status.className = 'health-status unhealthy';
            }
        }
        
        // Check health on load and every 30 seconds
        checkHealth();
        setInterval(checkHealth, 30000);
    </script>
</body>
</html>
FRONTEND

# Start nginx
systemctl enable nginx
systemctl start nginx

echo "Bianca staging environment ready!"
echo "Access points:"
echo "  Frontend: http://staging.myphonefriend.com"
echo "  API: http://staging-api.myphonefriend.com"
echo "  Direct API: http://$PUBLIC_IP:3000"
echo "  Asterisk ARI: http://$PUBLIC_IP:8088 (user: asterisk, pass: staging123)"
echo "  SIP: sip:$PUBLIC_IP"    