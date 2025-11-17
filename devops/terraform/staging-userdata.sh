#!/bin/bash
# Minimal staging setup script - Only infrastructure setup
# Application deployment is handled by CodeDeploy

set -e
exec > >(tee /var/log/user-data.log) 2>&1

# Terraform variables
AWS_ACCOUNT_ID="${aws_account_id}"
AWS_REGION="${region}"

echo "Starting minimal staging infrastructure setup..."

# Update and install packages
yum update -y
yum install -y docker git jq ruby wget

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

# Create app directory structure
mkdir -p /opt/bianca-staging
mkdir -p /opt/bianca-staging/app
chown -R ec2-user:ec2-user /opt/bianca-staging/app/
chmod -R 755 /opt/bianca-staging/app/

# Format and mount EBS volume for MongoDB data
echo "Setting up EBS volume for MongoDB..."
if [ -b /dev/sdf ]; then
    if ! blkid /dev/sdf >/dev/null 2>&1; then
        echo "Formatting EBS volume /dev/sdf..."
        mkfs.ext4 /dev/sdf
    fi
    
    mkdir -p /opt/mongodb-data
    mount /dev/sdf /opt/mongodb-data
    chown 999:999 /opt/mongodb-data
    chmod 755 /opt/mongodb-data
    echo "/dev/sdf /opt/mongodb-data ext4 defaults,nofail 0 2" >> /etc/fstab
    echo "EBS volume mounted successfully"
else
    echo "Warning: EBS volume /dev/sdf not found"
fi

# Setup cron for ECR refresh (CodeDeploy will handle actual login, but this helps)
echo "0 */6 * * * root aws ecr get-login-password --region $${AWS_REGION} | docker login --username AWS --password-stdin $${AWS_ACCOUNT_ID}.dkr.ecr.$${AWS_REGION}.amazonaws.com" > /etc/cron.d/ecr-refresh

# Install and start SSM agent
echo "Installing and starting SSM agent..."
yum install -y amazon-ssm-agent
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent
echo "SSM agent installed and started"

# Install CodeDeploy agent
echo "Installing CodeDeploy agent..."
cd /tmp
# Remove any existing installation
sudo yum remove -y codedeploy-agent 2>/dev/null || true
sudo systemctl stop codedeploy-agent 2>/dev/null || true

# Download and install
if ! wget https://aws-codedeploy-$${AWS_REGION}.s3.$${AWS_REGION}.amazonaws.com/latest/install -O install; then
    echo "ERROR: Failed to download CodeDeploy agent installer"
    exit 1
fi
chmod +x ./install
if ! sudo ./install auto; then
    echo "ERROR: Failed to install CodeDeploy agent"
    exit 1
fi

# Enable and start
sudo systemctl enable codedeploy-agent
if ! sudo systemctl start codedeploy-agent; then
    echo "ERROR: Failed to start CodeDeploy agent"
    sudo systemctl status codedeploy-agent --no-pager || true
    exit 1
fi

# Wait and verify
sleep 10
for i in {1..6}; do
    if sudo systemctl is-active --quiet codedeploy-agent; then
        echo "✅ CodeDeploy agent is running"
        sudo systemctl status codedeploy-agent --no-pager | head -10
        break
    fi
    echo "Waiting for agent to start (attempt $i/6)..."
    sleep 5
done

if ! sudo systemctl is-active --quiet codedeploy-agent; then
    echo "❌ WARNING: CodeDeploy agent failed to start"
    sudo systemctl status codedeploy-agent --no-pager || true
    sudo tail -50 /var/log/aws/codedeploy-agent/codedeploy-agent.log 2>&1 || echo "Log file not found"
    # Don't exit - let the instance continue, but log the issue
fi

echo "==================================="
echo "Infrastructure setup complete!"
echo "Waiting for CodeDeploy to handle application deployment..."
echo "==================================="

