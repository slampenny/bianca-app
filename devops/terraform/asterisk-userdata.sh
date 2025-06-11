#!/bin/bash
set -e

# Log all output
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "Starting Asterisk setup..."

# Update system
yum update -y

# Install Docker
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker

# Install AWS CLI and jq
yum install -y aws-cli jq

# Get secrets from Secrets Manager
ARI_PASSWORD=$(aws secretsmanager get-secret-value --region ${region} --secret-id "${ari_password_secret}" --query SecretString --output text | jq -r .ARI_PASSWORD)
BIANCA_PASSWORD=$(aws secretsmanager get-secret-value --region ${region} --secret-id "${bianca_password_secret}" --query SecretString --output text | jq -r .BIANCA_PASSWORD)

# Create Asterisk configuration directory
mkdir -p /etc/asterisk

# Login to ECR
aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin 730335291008.dkr.ecr.${region}.amazonaws.com

# Pull and run Asterisk container
docker pull 730335291008.dkr.ecr.${region}.amazonaws.com/bianca-app-asterisk:latest

docker run -d \
  --name asterisk \
  --restart=always \
  --network=host \
  -e EXTERNAL_ADDRESS=${external_ip} \
  -e ARI_PASSWORD=$ARI_PASSWORD \
  -e BIANCA_PASSWORD=$BIANCA_PASSWORD \
  -v /etc/asterisk:/etc/asterisk \
  730335291008.dkr.ecr.${region}.amazonaws.com/bianca-app-asterisk:latest

echo "Asterisk setup complete!"