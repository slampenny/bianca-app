# How to Deploy WordPress

## Overview

WordPress is **part of your existing Terraform setup** in `terraform-new/`. It's not a separate project - it's integrated into the same infrastructure.

## Quick Start

```bash
cd /home/jordanlapp/code/bianca-app/bianca-app-backend/devops/terraform-new

# 1. Initialize (if needed)
terraform init

# 2. Plan to see what will be created
terraform plan

# 3. Apply to create WordPress resources
terraform apply
```

## Configuration

WordPress is controlled by a variable that defaults to `true`:

```hcl
variable "create_wordpress" {
  default = true  # WordPress will be created by default
}
```

### To Disable WordPress

If you don't want WordPress, set the variable:

```bash
terraform apply -var="create_wordpress=false"
```

### To Enable WordPress Explicitly

```bash
terraform apply -var="create_wordpress=true"
```

## What Gets Created

When you run `terraform apply`, it will create:

1. ✅ **EC2 Instance** (`t3.micro`) - Dedicated WordPress server
2. ✅ **Elastic IP** - Static IP for DNS
3. ✅ **Security Group** - HTTP/HTTPS/SSH access
4. ✅ **EBS Volumes** - 2 volumes (data + database)
5. ✅ **IAM Role** - For S3 access and monitoring
6. ✅ **S3 Bucket** - For media backups
7. ✅ **DNS Records** - Route53 A records (if zone exists)
8. ✅ **User Data Script** - Auto-installs WordPress via Docker

## Step-by-Step Deployment

### 1. Review What Will Be Created

```bash
cd devops/terraform-new
terraform plan | grep wordpress
```

This shows you all WordPress resources that will be created.

### 2. Apply the Changes

```bash
terraform apply
```

Type `yes` when prompted, or use:

```bash
terraform apply -auto-approve
```

### 3. Wait for Instance to Initialize

The WordPress instance will:
- Launch with t3.micro instance type
- Install Docker and Docker Compose
- Mount EBS volumes
- Start WordPress and MySQL containers
- Set up automatic backups

**Initialization takes ~5-10 minutes.**

### 4. Check Outputs

After `terraform apply` completes, check the outputs:

```bash
terraform output wordpress_url
terraform output wordpress_elastic_ip
terraform output wordpress_ssh_command
```

### 5. Access WordPress

1. **Via Elastic IP** (immediate):
   ```bash
   # Get the IP
   terraform output wordpress_elastic_ip
   
   # Open in browser
   http://<elastic-ip>
   ```

2. **Via Domain** (after DNS propagates, ~5 minutes):
   ```
   http://biancatechnologies.com
   ```

### 6. Complete WordPress Setup

1. Visit the WordPress installation URL
2. Select language
3. Fill in site information
4. Create admin account
5. Complete installation

## Troubleshooting

### Check Instance Status

```bash
# SSH to instance
terraform output wordpress_ssh_command

# Check Docker containers
docker ps
docker logs bianca-wordpress
docker logs bianca-wordpress-db

# Check user_data logs
sudo tail -f /var/log/wordpress-userdata.log
```

### WordPress Not Accessible

1. **Check security group**: HTTP port 80 must be open
2. **Check instance status**: Instance must be running
3. **Check Docker**: Containers must be running
   ```bash
   sudo docker ps
   sudo docker logs bianca-wordpress
   ```

### DNS Not Working

DNS records are only created if:
- Route53 hosted zone exists for `biancatechnologies.com`
- You can check: `terraform output wordpress_dns_status`

If DNS zone doesn't exist, manually point DNS to the Elastic IP from terraform output.

## Cost Estimate

- **t3.micro Instance**: Free tier eligible (750 hrs/month) or ~$7.50/month
- **EBS Volumes**: ~$3.00/month (20GB + 10GB)
- **Elastic IP**: Free (if attached to running instance)
- **S3 Storage**: Minimal (~$0.023/GB/month)

**Total**: ~$10-12/month (or free if within free tier)

## Managing WordPress

### Update WordPress

SSH to instance and run:

```bash
cd /opt/bianca-wordpress
docker-compose pull
docker-compose up -d
```

### Backup Manually

```bash
/usr/local/bin/wordpress-backup.sh
```

Backups run automatically daily at 2 AM.

### Restart WordPress Services

```bash
sudo systemctl restart bianca-wordpress
```

## Destroying WordPress

To remove WordPress resources:

```bash
terraform destroy -target=aws_instance.wordpress
terraform destroy -target=aws_eip.wordpress_eip
terraform destroy -target=aws_ebs_volume.wordpress_data
terraform destroy -target=aws_ebs_volume.wordpress_db
# etc...
```

Or disable WordPress and apply:

```bash
terraform apply -var="create_wordpress=false"
```

⚠️ **Warning**: This will delete the WordPress instance but preserve EBS volumes if detached first.

---

**Next Steps**: Run `terraform apply` to deploy WordPress!





