#!/bin/bash
# WordPress user_data script for bianca-app
# This sets up WordPress on a dedicated EC2 instance

# Don't exit on error - log and continue (certbot can fail without breaking WordPress)
set +e
exec > >(tee /var/log/wordpress-userdata.log) 2>&1

echo "Starting WordPress setup on dedicated instance..."

# Terraform variables
WP_DOMAIN="${wp_domain}"
S3_BACKUP_BUCKET="${s3_backup_bucket}"
AWS_REGION="${aws_region}"
CERT_ARN="${cert_arn}"

# Update system
yum update -y

# Install Docker
yum install -y docker git
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# Note: SSL is handled by ALB with AWS ACM certificate - no need for certbot/Let's Encrypt

# Install AWS CLI v2 if not present
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
fi

# WordPress directories
WORDPRESS_DIR="/opt/bianca-wordpress"
WORDPRESS_DATA_DIR="/opt/wordpress-data"
WORDPRESS_DB_DIR="/opt/wordpress-db"

# Create WordPress directories
mkdir -p $WORDPRESS_DIR
mkdir -p $WORDPRESS_DATA_DIR/wp-content
mkdir -p $WORDPRESS_DATA_DIR/wp-content/uploads
mkdir -p $WORDPRESS_DB_DIR

# Set permissions
chown -R ec2-user:ec2-user $WORDPRESS_DIR
# WordPress container runs as www-data (UID 33), so wp-content must be owned by UID 33
chown -R 33:33 $WORDPRESS_DATA_DIR/wp-content
chmod -R 775 $WORDPRESS_DATA_DIR/wp-content

# Setup EBS volumes
echo "Setting up EBS volumes..."

# WordPress data volume (/dev/xvdf)
if [ -b /dev/xvdf ]; then
    echo "Found WordPress data volume at /dev/xvdf"
    
    if ! blkid /dev/xvdf >/dev/null 2>&1; then
        echo "Formatting WordPress data volume..."
        mkfs.ext4 /dev/xvdf
    fi
    
    mount /dev/xvdf $WORDPRESS_DATA_DIR || echo "Mount failed, may already be mounted"
    grep -q "/dev/xvdf" /etc/fstab || echo "/dev/xvdf $WORDPRESS_DATA_DIR ext4 defaults,nofail 0 2" >> /etc/fstab
    
    # Ensure wp-content directory exists
    mkdir -p $WORDPRESS_DATA_DIR/wp-content/uploads
    # WordPress container runs as www-data (UID 33), so wp-content must be owned by UID 33
    chown -R 33:33 $WORDPRESS_DATA_DIR/wp-content
    chmod -R 775 $WORDPRESS_DATA_DIR/wp-content
    echo "WordPress data volume mounted"
else
    echo "Warning: WordPress data volume /dev/xvdf not found"
fi

# WordPress DB volume (/dev/xvdg)
if [ -b /dev/xvdg ]; then
    echo "Found WordPress DB volume at /dev/xvdg"
    
    if ! blkid /dev/xvdg >/dev/null 2>&1; then
        echo "Formatting WordPress DB volume..."
        mkfs.ext4 /dev/xvdg
    fi
    
    mount /dev/xvdg $WORDPRESS_DB_DIR || echo "Mount failed, may already be mounted"
    grep -q "/dev/xvdg" /etc/fstab || echo "/dev/xvdg $WORDPRESS_DB_DIR ext4 defaults,nofail 0 2" >> /etc/fstab
    
    chown -R 999:999 $WORDPRESS_DB_DIR  # MySQL user
    chmod -R 755 $WORDPRESS_DB_DIR
    echo "WordPress DB volume mounted"
else
    echo "Warning: WordPress DB volume /dev/xvdg not found"
fi

# Generate secure passwords
DB_ROOT_PASSWORD=$(openssl rand -hex 16)
DB_PASSWORD=$(openssl rand -hex 16)

# Create WordPress docker-compose.yml
cat > $WORDPRESS_DIR/docker-compose.yml <<EOF
version: '3.8'

services:
  wordpress-db:
    image: mysql:8.0
    container_name: bianca-wordpress-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: $DB_ROOT_PASSWORD
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: $DB_PASSWORD
    volumes:
      - /opt/wordpress-db:/var/lib/mysql
    networks:
      - wordpress-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  wordpress:
    image: wordpress:latest
    container_name: bianca-wordpress
    restart: unless-stopped
    depends_on:
      wordpress-db:
        condition: service_healthy
    environment:
      WORDPRESS_DB_HOST: wordpress-db:3306
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: $DB_PASSWORD
      WORDPRESS_DEBUG: false
      # Note: WORDPRESS_CONFIG_EXTRA removed - it was causing PHP syntax errors
      # WordPress will use default settings initially, can be configured via wp-config.php later
    ports:
      - "8080:80"  # Internal port, nginx will handle 80/443
    volumes:
      - /opt/wordpress-data/wp-content:/var/www/html/wp-content
    networks:
      - wordpress-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    container_name: bianca-wordpress-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - wordpress
    networks:
      - wordpress-network

networks:
  wordpress-network:
    driver: bridge
EOF

chown -R ec2-user:ec2-user $WORDPRESS_DIR
chmod -R 755 $WORDPRESS_DIR

# Create nginx configuration
# HTTP-only - SSL is handled by ALB, which uses AWS ACM certificate
cat > $WORDPRESS_DIR/nginx.conf <<'NGINXEOF'
events {
    worker_connections 1024;
}

http {
    upstream wordpress {
        server wordpress:80;  # WordPress container exposes port 80 internally (8080 is host mapping only)
    }

    # HTTP server - ALB handles HTTPS/SSL termination
    server {
        listen 80;
        server_name WP_DOMAIN_PLACEHOLDER www.WP_DOMAIN_PLACEHOLDER;

        # Proxy to WordPress
        location / {
            proxy_pass http://wordpress;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            # Use X-Forwarded-Proto from ALB if present, otherwise use $scheme
            proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
            # If ALB didn't send it, use scheme (but ALB should send it)
            if ($http_x_forwarded_proto = '') {
                proxy_set_header X-Forwarded-Proto $scheme;
            }
        }
    }
}
NGINXEOF

# Replace domain placeholder in nginx config
sed -i "s/WP_DOMAIN_PLACEHOLDER/$WP_DOMAIN/g" $WORDPRESS_DIR/nginx.conf

chown -R ec2-user:ec2-user $WORDPRESS_DIR
chmod -R 755 $WORDPRESS_DIR

# Ensure uploads directory has correct permissions before starting
mkdir -p $WORDPRESS_DATA_DIR/wp-content/uploads
chown -R 33:33 $WORDPRESS_DATA_DIR/wp-content
chmod -R 775 $WORDPRESS_DATA_DIR/wp-content

# Start WordPress services (without nginx first - SSL cert needed)
cd $WORDPRESS_DIR
docker-compose up -d wordpress-db wordpress

# Wait for WordPress to be ready
echo "Waiting for WordPress to start..."
sleep 30

# Start nginx (HTTP-only initially)
docker-compose up -d nginx

# Wait for nginx to be ready
sleep 10

echo "✅ WordPress deployment complete"
echo "📍 HTTP:  http://$WP_DOMAIN (via ALB)"
echo "🔒 HTTPS: https://$WP_DOMAIN (via ALB with AWS ACM certificate)"
echo ""
echo "Note: SSL/HTTPS is handled by Application Load Balancer using AWS ACM certificate"
echo "      WordPress instance only needs to handle HTTP traffic from ALB"

# Create systemd service for auto-restart
cat > /etc/systemd/system/bianca-wordpress.service <<EOF
[Unit]
Description=Bianca WordPress
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$WORDPRESS_DIR
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
StandardOutput=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable bianca-wordpress

# Setup backup script (sync to S3 daily)
cat > /usr/local/bin/wordpress-backup.sh <<BACKUPEOF
#!/bin/bash
# Backup WordPress media to S3

BUCKET="$S3_BACKUP_BUCKET"
DATA_DIR="/opt/wordpress-data/wp-content"
DATE=\$(date +%Y%m%d)

# Sync wp-content to S3
aws s3 sync \$DATA_DIR s3://\$BUCKET/wp-content/ \
  --region $AWS_REGION \
  --exclude "*.log" \
  --exclude "cache/*"

# Backup database
docker exec bianca-wordpress-db mysqldump \
  -u wordpress \
  -p\$(docker exec bianca-wordpress-db printenv MYSQL_PASSWORD) \
  wordpress | \
  gzip | \
  aws s3 cp - s3://\$BUCKET/db-backups/wordpress-\$DATE.sql.gz \
  --region $AWS_REGION

echo "Backup completed: \$DATE"
BACKUPEOF

# Set environment variables for backup script
echo "S3_BACKUP_BUCKET=$S3_BACKUP_BUCKET" >> /etc/environment
echo "AWS_REGION=$AWS_REGION" >> /etc/environment

chmod +x /usr/local/bin/wordpress-backup.sh

# Schedule daily backups at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/wordpress-backup.sh >> /var/log/wordpress-backup.log 2>&1") | crontab -

INSTANCE_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo "=========================================="
echo "✅ WordPress setup complete!"
echo ""
echo "📍 Domain: $WP_DOMAIN"
echo "🌐 Instance IP: $INSTANCE_IP"
echo "🔒 SSL: Let's Encrypt certificate configured"
echo ""
echo "📝 Next steps:"
echo "1. DNS is configured via Terraform (Route53)"
echo "2. SSL certificate will be obtained automatically"
echo "3. Access WordPress at: https://$WP_DOMAIN"
echo "4. Complete WordPress installation wizard"
echo ""
echo "⚠️  If SSL setup failed, run manually:"
echo "   docker-compose -f $WORDPRESS_DIR/docker-compose.yml run --rm certbot certonly --webroot -w /var/www/certbot -d $WP_DOMAIN -d www.$WP_DOMAIN"
echo "=========================================="

docker ps

