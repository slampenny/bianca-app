#!/bin/bash

# Update the instance
sudo apt-get update
sudo apt-get -y upgrade

# Install AWS CLI if it's not installed
if [ ! -x "$(command -v aws)" ]; then
    echo "Installing AWS CLI..."
    sudo apt-get -y install awscli
else
    echo "AWS CLI already installed."
fi

# Install Docker if it's not installed
if [ ! -x "$(command -v docker)" ]; then
    echo "Installing Docker..."
    sudo apt-get -y install apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
    sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
    sudo apt-get update
    sudo apt-get -y install docker-ce

    # Add the current user to the Docker group to avoid needing sudo
    sudo usermod -aG docker $USER
    newgrp docker
else
    echo "Docker already installed."
fi

# Install Docker Compose if it's not installed
if [ ! -x "$(command -v docker-compose)" ]; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "Docker Compose already installed."
fi

# Login to Amazon ECR
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend

# Pull the Docker container
docker pull 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:latest

# Run the Docker container
# Adjust the following command according to your container's needs (ports, environment variables, etc.)
docker run -d --name bianca-app-backend -p 80:80 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:latest
