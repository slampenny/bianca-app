#!/bin/bash
# Add SES SMTP credentials to docker-compose.yml

cd /opt/bianca-wordpress

# Backup
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)

# Check if credentials already exist
if grep -q "SES_SMTP_USERNAME" docker-compose.yml; then
    echo "SES SMTP credentials already exist in docker-compose.yml"
    exit 0
fi

# Add credentials after WORDPRESS_DEBUG line
sed -i '/WORDPRESS_DEBUG: false/a\      SES_SMTP_USERNAME: "AKIA_PLACEHOLDER_REMOVED"\n      SES_SMTP_PASSWORD: "AWS_SECRET_PLACEHOLDER_REMOVED"' docker-compose.yml

echo "SES SMTP credentials added to docker-compose.yml"



