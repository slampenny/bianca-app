#!/bin/bash
# WordPress setup script for bianca-app
# This script configures WordPress on the EC2 instance
# Run this after instance initialization, or include in user_data

set -e
exec > >(tee /var/log/wordpress-setup.log) 2>&1

echo "Starting WordPress setup..."

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

# Check if WordPress data volume is attached (/dev/xvdf)
if [ -b /dev/xvdf ]; then
    echo "Found WordPress data volume at /dev/xvdf"
    
    # Check if it's already formatted
    if ! blkid /dev/xvdf >/dev/null 2>&1; then
        echo "Formatting WordPress data volume..."
        mkfs.ext4 /dev/xvdf
    fi
    
    # Mount the volume
    mount /dev/xvdf $WORDPRESS_DATA_DIR || echo "Mount failed, may already be mounted"
    
    # Add to fstab for persistence
    grep -q "/dev/xvdf" /etc/fstab || echo "/dev/xvdf $WORDPRESS_DATA_DIR ext4 defaults,nofail 0 2" >> /etc/fstab
    
    # Ensure wp-content directory exists
    mkdir -p $WORDPRESS_DATA_DIR/wp-content/uploads
    # WordPress container runs as www-data (UID 33), so wp-content must be owned by UID 33
    chown -R 33:33 $WORDPRESS_DATA_DIR/wp-content
    chmod -R 775 $WORDPRESS_DATA_DIR/wp-content
    echo "WordPress data volume mounted"
else
    echo "Warning: WordPress data volume /dev/xvdf not found. Using local storage."
fi

# Check if WordPress DB volume is attached (/dev/xvdg)
if [ -b /dev/xvdg ]; then
    echo "Found WordPress DB volume at /dev/xvdg"
    
    # Check if it's already formatted
    if ! blkid /dev/xvdg >/dev/null 2>&1; then
        echo "Formatting WordPress DB volume..."
        mkfs.ext4 /dev/xvdg
    fi
    
    # Mount the volume
    mount /dev/xvdg $WORDPRESS_DB_DIR || echo "Mount failed, may already be mounted"
    
    # Add to fstab for persistence
    grep -q "/dev/xvdg" /etc/fstab || echo "/dev/xvdg $WORDPRESS_DB_DIR ext4 defaults,nofail 0 2" >> /etc/fstab
    
    # Set permissions for MySQL (user 999)
    chown -R 999:999 $WORDPRESS_DB_DIR
    chmod -R 755 $WORDPRESS_DB_DIR
    echo "WordPress DB volume mounted"
else
    echo "Warning: WordPress DB volume /dev/xvdg not found. Using local storage."
fi

# Create WordPress docker-compose.yml
cat > $WORDPRESS_DIR/docker-compose.yml <<'EOF'
version: '3.8'

services:
  wordpress-db:
    image: mysql:8.0
    container_name: bianca-wordpress-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${WP_DB_ROOT_PASSWORD:-wordpress_root_pass}
      MYSQL_DATABASE: ${WP_DB_NAME:-wordpress}
      MYSQL_USER: ${WP_DB_USER:-wordpress}
      MYSQL_PASSWORD: ${WP_DB_PASSWORD:-wordpress_pass}
    volumes:
      - /opt/wordpress-db:/var/lib/mysql
    networks:
      - bianca-network
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
      WORDPRESS_DB_NAME: ${WP_DB_NAME:-wordpress}
      WORDPRESS_DB_USER: ${WP_DB_USER:-wordpress}
      WORDPRESS_DB_PASSWORD: ${WP_DB_PASSWORD:-wordpress_pass}
      WORDPRESS_DEBUG: ${WORDPRESS_DEBUG:-false}
      # Increase upload limits
      UPLOAD_MAX_FILESIZE: 500M
      POST_MAX_SIZE: 500M
      MAX_EXECUTION_TIME: 300
    ports:
      - "8080:80"
    volumes:
      - /opt/wordpress-data/wp-content:/var/www/html/wp-content
      - ./php-uploads.ini:/usr/local/etc/php/conf.d/uploads.ini
    networks:
      - bianca-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  bianca-network:
    external: true
EOF

# Create PHP upload configuration
cat > $WORDPRESS_DIR/php-uploads.ini <<'EOF'
upload_max_filesize = 500M
post_max_size = 500M
max_execution_time = 300
max_input_time = 300
memory_limit = 512M
EOF

# Create WordPress .env file template
cat > $WORDPRESS_DIR/.env <<'EOF'
WP_DB_ROOT_PASSWORD=wordpress_root_pass_$(openssl rand -hex 16)
WP_DB_NAME=wordpress
WP_DB_USER=wordpress
WP_DB_PASSWORD=wordpress_pass_$(openssl rand -hex 16)
WORDPRESS_DEBUG=false
EOF

# Generate secure passwords
cd $WORDPRESS_DIR
sed -i "s/wordpress_root_pass_\$(openssl rand -hex 16)/$(openssl rand -hex 16)/g" .env
sed -i "s/wordpress_pass_\$(openssl rand -hex 16)/$(openssl rand -hex 16)/g" .env

chmod 600 .env
chown ec2-user:ec2-user .env

# Set directory permissions
chown -R ec2-user:ec2-user $WORDPRESS_DIR

# Connect to existing bianca-network if it exists, or create it
docker network create bianca-network || echo "Network already exists"

# Ensure uploads directory has correct permissions before starting
mkdir -p $WORDPRESS_DATA_DIR/wp-content/uploads
chown -R 33:33 $WORDPRESS_DATA_DIR/wp-content
chmod -R 775 $WORDPRESS_DATA_DIR/wp-content

# Start WordPress services
cd $WORDPRESS_DIR
docker-compose up -d

echo "WordPress setup complete!"
echo "WordPress will be available at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080"
echo "Configure nginx to proxy biancatechnologies.com to wordpress:80"





