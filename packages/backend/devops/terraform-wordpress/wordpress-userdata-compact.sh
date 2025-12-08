#!/bin/bash
set +e
exec > >(tee /var/log/wordpress-userdata.log) 2>&1
echo "Starting WordPress setup on dedicated instance..."
WP_DOMAIN="${wp_domain}"
S3_BACKUP_BUCKET="${s3_backup_bucket}"
AWS_REGION="${aws_region}"
CERT_ARN="${cert_arn}"
yum update -y
yum install -y docker git
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
fi
yum install -y jq
WORDPRESS_DIR="/opt/bianca-wordpress"
WORDPRESS_DATA_DIR="/opt/wordpress-data"
WORDPRESS_DB_DIR="/opt/wordpress-db"
mkdir -p $WORDPRESS_DIR
mkdir -p $WORDPRESS_DATA_DIR/wp-content
mkdir -p $WORDPRESS_DATA_DIR/wp-content/uploads
mkdir -p $WORDPRESS_DB_DIR
chown -R ec2-user:ec2-user $WORDPRESS_DIR
chown -R 33:33 $WORDPRESS_DATA_DIR/wp-content
chmod -R 775 $WORDPRESS_DATA_DIR/wp-content
echo "Setting up EBS volumes..."
if [ -b /dev/xvdf ]; then
    echo "Found WordPress data volume at /dev/xvdf"
    if ! blkid /dev/xvdf >/dev/null 2>&1; then
        echo "Formatting WordPress data volume..."
        mkfs.ext4 /dev/xvdf
    fi
    mount /dev/xvdf $WORDPRESS_DATA_DIR || echo "Mount failed, may already be mounted"
    grep -q "/dev/xvdf" /etc/fstab || echo "/dev/xvdf $WORDPRESS_DATA_DIR ext4 defaults,nofail 0 2" >> /etc/fstab
    mkdir -p $WORDPRESS_DATA_DIR/wp-content/uploads
    chown -R 33:33 $WORDPRESS_DATA_DIR/wp-content
    chmod -R 775 $WORDPRESS_DATA_DIR/wp-content
    echo "WordPress data volume mounted"
else
    echo "Warning: WordPress data volume /dev/xvdf not found"
fi
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
echo "Retrieving database credentials from AWS Secrets Manager..."
SECRET_NAME="${secret_name}"
if ! aws secretsmanager describe-secret --region $${AWS_REGION} --secret-id $${SECRET_NAME} &>/dev/null; then
    echo "Secret does not exist, creating with default credentials..."
    DB_ROOT_PASSWORD=$(openssl rand -hex 16)
    DB_PASSWORD=$(openssl rand -hex 16)
    aws secretsmanager create-secret \
        --region $${AWS_REGION} \
        --name $${SECRET_NAME} \
        --secret-string "{\"MYSQL_ROOT_PASSWORD\":\"$${DB_ROOT_PASSWORD}\",\"MYSQL_PASSWORD\":\"$${DB_PASSWORD}\",\"MYSQL_DATABASE\":\"wordpress\",\"MYSQL_USER\":\"wordpress\"}" \
        --description "WordPress database credentials" || echo "Failed to create secret, using generated passwords"
else
    echo "Retrieving existing credentials from Secrets Manager..."
    SECRET_VALUE=$(aws secretsmanager get-secret-value --region $${AWS_REGION} --secret-id $${SECRET_NAME} --query SecretString --output text)
    DB_ROOT_PASSWORD=$(echo $${SECRET_VALUE} | jq -r .MYSQL_ROOT_PASSWORD)
    DB_PASSWORD=$(echo $${SECRET_VALUE} | jq -r .MYSQL_PASSWORD)
    if [ -z "$${DB_ROOT_PASSWORD}" ] || [ "$${DB_ROOT_PASSWORD}" = "null" ]; then
        echo "Warning: Could not retrieve credentials from Secrets Manager, generating new ones..."
        DB_ROOT_PASSWORD=$(openssl rand -hex 16)
        DB_PASSWORD=$(openssl rand -hex 16)
    fi
fi
echo "Database credentials retrieved successfully"
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
cat > $WORDPRESS_DIR/nginx.conf <<'NGINXEOF'
events {
    worker_connections 1024;
}
http {
    upstream wordpress {
        server wordpress:80;  # WordPress container exposes port 80 internally (8080 is host mapping only)
    }
    server {
        listen 80;
        server_name WP_DOMAIN_PLACEHOLDER www.WP_DOMAIN_PLACEHOLDER;
        location / {
            proxy_pass http://wordpress;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
NGINXEOF
sed -i "s/WP_DOMAIN_PLACEHOLDER/$WP_DOMAIN/g" $WORDPRESS_DIR/nginx.conf
chown -R ec2-user:ec2-user $WORDPRESS_DIR
chmod -R 755 $WORDPRESS_DIR
cd $WORDPRESS_DIR
mkdir -p $WORDPRESS_DATA_DIR/wp-content/uploads
chown -R 33:33 $WORDPRESS_DATA_DIR/wp-content
chmod -R 775 $WORDPRESS_DATA_DIR/wp-content
docker-compose up -d wordpress-db wordpress
echo "Waiting for WordPress to start..."
sleep 30
docker-compose up -d nginx
sleep 10
echo "✅ WordPress deployment complete"
echo "📍 HTTP:  http://$WP_DOMAIN (via ALB)"
echo "🔒 HTTPS: https://$WP_DOMAIN (via ALB with AWS ACM certificate)"
echo ""
echo "Note: SSL/HTTPS is handled by Application Load Balancer using AWS ACM certificate"
echo "      WordPress instance only needs to handle HTTP traffic from ALB"
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
cat > /usr/local/bin/wordpress-backup.sh <<BACKUPEOF
BUCKET="$S3_BACKUP_BUCKET"
DATA_DIR="/opt/wordpress-data/wp-content"
DATE=\$(date +%Y%m%d)
aws s3 sync \$DATA_DIR s3://\$BUCKET/wp-content/ \
  --region $AWS_REGION \
  --exclude "*.log" \
  --exclude "cache/*"
docker exec bianca-wordpress-db mysqldump \
  -u wordpress \
  -p\$(docker exec bianca-wordpress-db printenv MYSQL_PASSWORD) \
  wordpress | \
  gzip | \
  aws s3 cp - s3://\$BUCKET/db-backups/wordpress-\$DATE.sql.gz \
  --region $AWS_REGION
echo "Backup completed: \$DATE"
BACKUPEOF
echo "S3_BACKUP_BUCKET=$S3_BACKUP_BUCKET" >> /etc/environment
echo "AWS_REGION=$AWS_REGION" >> /etc/environment
chmod +x /usr/local/bin/wordpress-backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/wordpress-backup.sh >> /var/log/wordpress-backup.log 2>&1") | crontab -
cat > /usr/local/bin/wordpress-health-check.sh <<HEALTHCHECKEOF
WORDPRESS_DIR="/opt/bianca-wordpress"
LOG_FILE="/var/log/wordpress-health-check.log"
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}
check_nginx() {
    if ! curl -f -s -m 5 http://localhost:80 >/dev/null 2>&1; then
        log "❌ Nginx not responding on port 80"
        return 1
    fi
    return 0
}
check_wordpress_response() {
    RESPONSE_TIME=$(curl -o /dev/null -s -w "%%{time_total}" -m 10 http://localhost:80 2>&1)
    EXIT_CODE=$?
    if [ $EXIT_CODE -ne 0 ]; then
        log "❌ WordPress not responding or timed out"
        return 1
    fi
    if (( $(echo "$RESPONSE_TIME > 8" | bc -l 2>/dev/null || echo "0") )); then
        log "⚠️  WordPress responding but very slow ($${RESPONSE_TIME}s) - may cause gateway timeouts"
        return 1
    fi
    return 0
}
check_wordpress_container() {
    if ! docker ps | grep -q "bianca-wordpress\$"; then
        log "❌ WordPress container not running"
        return 1
    fi
    return 0
}
check_nginx_container() {
    if ! docker ps | grep -q "bianca-wordpress-nginx\$"; then
        log "❌ Nginx container not running"
        return 1
    fi
    return 0
}
check_db_container() {
    if ! docker ps | grep -q "bianca-wordpress-db\$"; then
        log "❌ Database container not running"
        return 1
    fi
    return 0
}
check_db_connectivity() {
    if ! docker exec bianca-wordpress ping -c 2 wordpress-db >/dev/null 2>&1; then
        log "❌ WordPress cannot reach database (DNS resolution failed)"
        return 1
    fi
    return 0
}
restart_services() {
    log "🔄 Restarting WordPress services..."
    cd "$WORDPRESS_DIR" || return 1
    docker-compose restart || docker-compose up -d
    sleep 15
    log "✅ Services restarted"
}
log "🔍 Starting WordPress health check..."
NGINX_OK=true
WORDPRESS_RESPONSE_OK=true
CONTAINERS_OK=true
if ! check_db_container; then
    log "⚠️  Database container issue detected"
    CONTAINERS_OK=false
fi
if ! check_wordpress_container; then
    log "⚠️  WordPress container issue detected"
    CONTAINERS_OK=false
fi
if ! check_nginx_container; then
    log "⚠️  Nginx container issue detected"
    CONTAINERS_OK=false
fi
if ! check_db_connectivity; then
    log "⚠️  Database connectivity issue detected"
    CONTAINERS_OK=false
fi
if ! check_nginx; then
    log "⚠️  Nginx not responding to HTTP requests"
    NGINX_OK=false
fi
if ! check_wordpress_response; then
    log "⚠️  WordPress response timeout or too slow (gateway timeout risk)"
    WORDPRESS_RESPONSE_OK=false
fi
if [ "$CONTAINERS_OK" = false ] || [ "$NGINX_OK" = false ] || [ "$WORDPRESS_RESPONSE_OK" = false ]; then
    log "⚠️  Health check failed - restarting services"
    restart_services
    sleep 15
    if check_nginx && check_wordpress_response && check_nginx_container && check_wordpress_container && check_db_container; then
        log "✅ Health check passed after restart"
    else
        log "❌ Health check still failing after restart - manual intervention may be needed"
        aws cloudwatch put-metric-data \
            --namespace WordPress/Health \
            --metric-name HealthCheckFailed \
            --value 1 \
            --unit Count \
            --region $${AWS_REGION:-us-east-2} 2>/dev/null || true
    fi
else
    log "✅ All health checks passed"
fi
HEALTHCHECKEOF
chmod +x /usr/local/bin/wordpress-health-check.sh
(crontab -l 2>/dev/null; echo "*/2 * * * * /usr/local/bin/wordpress-health-check.sh") | crontab -
echo "✅ Health check script installed and scheduled (runs every 2 minutes)"
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
