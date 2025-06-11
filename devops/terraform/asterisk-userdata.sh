#!/bin/bash
set -e

# Log all user-data output to a file for debugging
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "--- Starting Asterisk setup script ---"

# --- 1. Install Dependencies ---
echo "Updating system and installing Docker, AWS CLI, and jq..."
yum update -y
amazon-linux-extras install docker -y
yum install -y aws-cli jq

# Enable and start Docker service
systemctl enable docker
systemctl start docker

# --- 2. Create Log Directory on EC2 Host ---
echo "Creating log directory on the host at /var/log/asterisk-docker..."
mkdir -p /var/log/asterisk-docker
# Set open permissions so the 'asterisk' user inside the container can write to it
chmod 777 /var/log/asterisk-docker

# --- 3. Install and Configure CloudWatch Agent ---
echo "Installing CloudWatch Agent..."
yum install -y amazon-cloudwatch-agent

echo "Creating CloudWatch Agent configuration..."
# Create the config file that tells the agent which logs to watch
cat <<EOF > /opt/aws/amazon-cloudwatch-agent/bin/config.json
{
  "agent": {
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/asterisk-docker/full",
            "log_group_name": "/aws/ec2/asterisk",
            "log_stream_name": "{instance_id}-asterisk-full",
            "timestamp_format": "%Y-%m-%d %H:%M:%S"
          },
          {
            "file_path": "/var/log/asterisk-docker/messages",
            "log_group_name": "/aws/ec2/asterisk",
            "log_stream_name": "{instance_id}-asterisk-messages",
            "timestamp_format": "%Y-%m-%d %H:%M:%S"
          }
        ]
      }
    }
  }
}
EOF

echo "Starting CloudWatch Agent..."
# Start the agent using the new configuration
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json -s


# --- 4. Pull Secrets and Run Docker Container ---
echo "Fetching secrets from Secrets Manager..."
# The templated variables like ${region} are replaced by Terraform
ARI_PASSWORD=$(aws secretsmanager get-secret-value --region ${region} --secret-id "${ari_password_secret}" --query SecretString --output text | jq -r .ARI_PASSWORD)
BIANCA_PASSWORD=$(aws secretsmanager get-secret-value --region ${region} --secret-id "${bianca_password_secret}" --query SecretString --output text | jq -r .BIANCA_PASSWORD)

echo "Logging into ECR..."
aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin 730335291008.dkr.ecr.${region}.amazonaws.com

echo "Pulling latest Asterisk image..."
docker pull 730335291008.dkr.ecr.${region}.amazonaws.com/bianca-app-asterisk:latest

# Check if a container named 'asterisk' is already running and remove it
if [ $(docker ps -a -q -f name=^/asterisk$) ]; then
    echo "Removing existing container named 'asterisk'..."
    docker rm -f asterisk
fi

echo "Running new Asterisk container with log volume..."
docker run -d \
  --name asterisk \
  --restart=always \
  --network=host \
  -e EXTERNAL_ADDRESS=${external_ip} \
  -e ARI_PASSWORD=$ARI_PASSWORD \
  -e BIANCA_PASSWORD=$BIANCA_PASSWORD \
  -v /var/log/asterisk-docker:/var/log/asterisk \
  730335291008.dkr.ecr.${region}.amazonaws.com/bianca-app-asterisk:latest

echo "--- Asterisk setup complete! ---"