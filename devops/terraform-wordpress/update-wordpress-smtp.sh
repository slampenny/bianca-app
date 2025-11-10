#!/bin/bash
# Script to update WordPress SMTP credentials in docker-compose.yml
# Usage: ./update-wordpress-smtp.sh <smtp-username> <smtp-password>

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <smtp-username> <smtp-password>"
    echo "Example: $0 AKIAIOSFODNN7EXAMPLE wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    exit 1
fi

SMTP_USERNAME="$1"
SMTP_PASSWORD="$2"

echo "Updating WordPress SMTP credentials..."
echo "Username: $SMTP_USERNAME"

# SSH into WordPress instance and update docker-compose.yml
ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@3.145.12.148 << EOF
cd /opt/bianca-wordpress

# Backup
cp docker-compose.yml docker-compose.yml.backup.\$(date +%Y%m%d_%H%M%S)

# Update credentials using sed
sed -i "s|SES_SMTP_USERNAME: \".*\"|SES_SMTP_USERNAME: \"$SMTP_USERNAME\"|" docker-compose.yml
sed -i "s|SES_SMTP_PASSWORD: \".*\"|SES_SMTP_PASSWORD: \"$SMTP_PASSWORD\"|" docker-compose.yml

echo "Credentials updated in docker-compose.yml"
echo "Restarting WordPress container..."

# Restart to apply changes
docker-compose restart wordpress

echo "WordPress container restarted. Waiting 10 seconds for it to start..."
sleep 10

# Test if container is running
docker ps | grep wordpress

echo ""
echo "✅ WordPress SMTP credentials updated!"
echo ""
echo "To test email:"
echo "1. Go to: https://myphonefriend.com/wp-admin"
echo "2. Navigate to: WP Mail SMTP → Tools → Email Test"
echo "3. Send a test email"
EOF

echo ""
echo "Done! Test email sending via WordPress admin."




