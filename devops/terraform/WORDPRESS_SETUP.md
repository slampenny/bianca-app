# WordPress Setup for biancatechnologies.com

This document describes the WordPress infrastructure setup for biancatechnologies.com, configured similar to the tagger app.

## Overview

WordPress runs on a **dedicated EC2 instance (t3.micro)**, completely isolated from the bianca-app instances (staging and production). This provides better separation, security, and scalability.

## Infrastructure Components

### 1. WordPress EC2 Instance

- **Instance Type**: `t3.micro` (Free tier eligible)
- **AMI**: Amazon Linux 2
- **Subnet**: Staging public subnet (can be moved to dedicated VPC/subnet)
- **Elastic IP**: Static IP address for DNS
- **Security Group**: Dedicated SG with HTTP/HTTPS/SSH access

### 2. EBS Volumes (for data persistence)

- **WordPress Data Volume** (`/dev/xvdf`): 20GB
  - Stores WordPress files, themes, plugins, uploads
  - Mounted at `/opt/wordpress-data`
  - Survives instance replacement

- **WordPress Database Volume** (`/dev/xvdg`): 10GB
  - Stores MySQL database files
  - Mounted at `/opt/wordpress-db`
  - Survives instance replacement

### 2. S3 Bucket

- **Bucket Name**: `bianca-wordpress-media-{environment}-{account_id}`
- **Purpose**: Backup WordPress media and uploads
- **Features**:
  - Versioning enabled
  - Encryption enabled (AES-256)
  - Lifecycle policies (delete old versions after 30 days)

### 3. IAM Permissions

- WordPress has S3 access for media backups
- Policy allows: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket`

### 4. DNS Records

- **Root Domain**: `biancatechnologies.com` → Points to staging EC2 instance IP
- **WWW**: `www.biancatechnologies.com` → Points to staging EC2 instance IP
- Created automatically if Route53 hosted zone exists

### 5. Docker Services

WordPress runs in Docker Compose with two services:

- **wordpress-db** (MySQL 8.0):
  - Container name: `bianca-wordpress-db`
  - Database: `wordpress`
  - Data volume: `/opt/wordpress-db`
  - Health checks enabled

- **wordpress** (WordPress latest):
  - Container name: `bianca-wordpress`
  - Port: `8080:80` (internal)
  - Data volume: `/opt/wordpress-data/wp-content`
  - Health checks enabled
  - Connected to `bianca-network` (shared with app)

### 6. Nginx Configuration

Nginx proxies `biancatechnologies.com` and `www.biancatechnologies.com` to the WordPress container.

## File Locations

- **WordPress Docker Compose**: `/opt/bianca-wordpress/docker-compose.yml`
- **WordPress Data**: `/opt/wordpress-data/wp-content`
- **WordPress Database**: `/opt/wordpress-db`
- **Setup Script**: `/opt/bianca-wordpress/wordpress-setup.sh` (optional manual script)

## Deployment

### Automatic Setup

WordPress is automatically configured during EC2 instance initialization via `staging-userdata.sh`:

1. EBS volumes are attached and mounted
2. WordPress directories are created
3. Docker Compose file is created
4. WordPress services are started

### Manual Setup (if needed)

If WordPress wasn't set up automatically, you can run:

```bash
sudo /opt/bianca-wordpress/wordpress-setup.sh
```

Or SSH to the instance and run:

```bash
cd /opt/bianca-wordpress
docker-compose up -d
```

## Access

### Initial WordPress Setup

1. **Via IP**: `http://{staging-instance-ip}:8080`
2. **Via Domain** (after DNS propagates): `http://biancatechnologies.com`

### WordPress Admin

- Default admin is created during first-time setup
- Access at: `http://biancatechnologies.com/wp-admin`
- Username and password set during installation

## Configuration

### Environment Variables

WordPress uses environment variables in `/opt/bianca-wordpress/docker-compose.yml`:

- `WP_DB_ROOT_PASSWORD`: MySQL root password (auto-generated)
- `WP_DB_NAME`: Database name (default: `wordpress`)
- `WP_DB_USER`: Database user (default: `wordpress`)
- `WP_DB_PASSWORD`: Database password (auto-generated)

### PHP Configuration

WordPress uses custom PHP settings:
- `upload_max_filesize`: 500M
- `post_max_size`: 500M
- `max_execution_time`: 300s

## Backup Strategy

### Automatic Backups

1. **EBS Snapshots**: Manual or via AWS Backup service
2. **S3 Sync**: Use WordPress plugins or cron jobs to sync media to S3

### Manual Backup

```bash
# Backup WordPress files
tar -czf wordpress-backup-$(date +%Y%m%d).tar.gz /opt/wordpress-data/wp-content

# Backup database
docker exec bianca-wordpress-db mysqldump -u wordpress -p wordpress > wordpress-db-$(date +%Y%m%d).sql

# Upload to S3
aws s3 cp wordpress-backup-$(date +%Y%m%d).tar.gz s3://bianca-wordpress-media-staging-730335291008/backups/
aws s3 cp wordpress-db-$(date +%Y%m%d).sql s3://bianca-wordpress-media-staging-730335291008/backups/
```

## Troubleshooting

### WordPress Not Accessible

1. Check if containers are running:
   ```bash
   docker ps | grep wordpress
   ```

2. Check WordPress logs:
   ```bash
   docker logs bianca-wordpress
   docker logs bianca-wordpress-db
   ```

3. Check nginx configuration:
   ```bash
   docker exec staging_nginx cat /etc/nginx/conf.d/default.conf | grep biancatechnologies
   ```

### Volume Issues

1. Check if volumes are mounted:
   ```bash
   mount | grep wordpress
   ls -la /opt/wordpress-data
   ls -la /opt/wordpress-db
   ```

2. Remount if needed:
   ```bash
   sudo mount /dev/xvdf /opt/wordpress-data
   sudo mount /dev/xvdg /opt/wordpress-db
   ```

### Database Connection Issues

1. Test MySQL connection:
   ```bash
   docker exec bianca-wordpress-db mysql -u wordpress -p wordpress
   ```

2. Check WordPress environment variables:
   ```bash
   docker exec bianca-wordpress env | grep WORDPRESS
   ```

## Updating WordPress

```bash
cd /opt/bianca-wordpress
docker-compose pull wordpress
docker-compose up -d wordpress
```

## Security Considerations

1. **Change default passwords** immediately after setup
2. **Enable SSL/TLS** via Let's Encrypt (requires nginx SSL configuration)
3. **Keep WordPress updated** regularly
4. **Use security plugins** (e.g., Wordfence)
5. **Regular backups** to S3
6. **Limit admin access** via security groups

## Cost Estimate

- **EBS Volumes**: ~$3.50/month (20GB + 10GB × $0.10/GB)
- **S3 Storage**: ~$0.023/GB/month (minimal for backups)
- **EC2 Instance**: Shared with staging app (no additional cost)

**Total Additional Cost**: ~$4-5/month

## Next Steps

1. **Run Terraform** to create WordPress resources:
   ```bash
   cd devops/terraform-new
   terraform init
   terraform plan
   terraform apply
   ```

2. **Access WordPress** after instance initialization

3. **Configure SSL** via Let's Encrypt for HTTPS

4. **Set up backups** (EBS snapshots + S3 sync)

---

**Created**: January 15, 2025
**Status**: Ready for deployment

