#!/bin/bash
# Demo setup script - Only infrastructure setup
# Application deployment is handled by CodeDeploy
# Demo must be reliable for sales demonstrations

set -e
exec > >(tee /var/log/user-data.log) 2>&1

# Terraform variables
AWS_ACCOUNT_ID="${aws_account_id}"
AWS_REGION="${region}"
ENVIRONMENT="demo"

# Export ENVIRONMENT to /etc/environment so it's available to CodeDeploy scripts
echo "ENVIRONMENT=$${ENVIRONMENT}" >> /etc/environment
export ENVIRONMENT="$${ENVIRONMENT}"

echo "Starting demo infrastructure setup..."

# Update and install packages
yum update -y
yum install -y docker git jq ruby wget

# Start Docker
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

# Add ec2-user to docker group
usermod -a -G docker ec2-user

# Install docker compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

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
# Use EIP if provided (from Terraform), otherwise fall back to instance metadata
%{ if eip_address != "" ~}
PUBLIC_IP="${eip_address}"
%{ else ~}
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
%{ endif ~}

# Fix for NVMe EBS volumes (newer instance types use /dev/nvme* instead of /dev/sd*)
# Format and mount EBS volume for MongoDB data
echo "Setting up EBS volume for MongoDB..."
# Check for NVMe device first (newer instances)
if [ -b /dev/nvme1n1 ]; then
    EBS_DEVICE="/dev/nvme1n1"
elif [ -b /dev/sdf ]; then
    EBS_DEVICE="/dev/sdf"
else
    EBS_DEVICE=""
fi

if [ -n "$EBS_DEVICE" ]; then
    if ! blkid $EBS_DEVICE >/dev/null 2>&1; then
        echo "Formatting EBS volume $EBS_DEVICE..."
        mkfs.ext4 $EBS_DEVICE
    fi
    
    mkdir -p /opt/mongodb-data
    mount $EBS_DEVICE /opt/mongodb-data
    chown 999:999 /opt/mongodb-data
    chmod 755 /opt/mongodb-data
    echo "$EBS_DEVICE /opt/mongodb-data ext4 defaults,nofail 0 2" >> /etc/fstab
    echo "EBS volume mounted successfully"
else
    echo "Warning: EBS volume not found (checked /dev/nvme1n1 and /dev/sdf)"
fi

echo "Instance: $${INSTANCE_ID}"
echo "Private IP: $${PRIVATE_IP}"
echo "Public IP: $${PUBLIC_IP}"

# Create app directory structure
mkdir -p /opt/bianca-demo
mkdir -p /opt/bianca-demo/app
chown -R ec2-user:ec2-user /opt/bianca-demo/app/
chmod -R 755 /opt/bianca-demo/app/

# Setup cron for ECR refresh (CodeDeploy will handle actual login, but this helps)
echo "0 */6 * * * root aws ecr get-login-password --region $${AWS_REGION} | docker login --username AWS --password-stdin $${AWS_ACCOUNT_ID}.dkr.ecr.$${AWS_REGION}.amazonaws.com" > /etc/cron.d/ecr-refresh

# Install and start SSM agent
echo "Installing and starting SSM agent..."
yum install -y amazon-ssm-agent
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent
echo "SSM agent installed and started"

# Install CodeDeploy agent (CRITICAL - must not fail)
echo "==================================="
echo "Installing CodeDeploy agent (REQUIRED)..."
echo "==================================="
cd /tmp

# Remove any existing installation
sudo yum remove -y codedeploy-agent 2>/dev/null || true
sudo systemctl stop codedeploy-agent 2>/dev/null || true

# Download and install with retries
MAX_RETRIES=3
RETRY_COUNT=0
INSTALL_SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES: Downloading CodeDeploy agent installer..."
    if wget https://aws-codedeploy-$${AWS_REGION}.s3.$${AWS_REGION}.amazonaws.com/latest/install -O install 2>&1; then
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
    echo "   sudo yum install -y ruby && cd /tmp && wget https://aws-codedeploy-$${AWS_REGION}.s3.$${AWS_REGION}.amazonaws.com/latest/install && sudo ./install auto"
fi

echo "==================================="
echo "Demo infrastructure setup complete!"
echo "Waiting for CodeDeploy to handle application deployment..."
echo "==================================="
