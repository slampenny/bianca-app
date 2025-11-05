# WordPress Resources for biancatechnologies.com
# This deploys WordPress on a separate EC2 instance (t3.micro) - isolated from app instances

################################################################################
# VARIABLES
################################################################################

variable "wp_domain" {
  description = "Domain name for WordPress site"
  type        = string
  default     = "biancatechnologies.com"
}

variable "create_wordpress" {
  description = "Whether to create WordPress resources"
  type        = bool
  default     = true
}

variable "wordpress_instance_type" {
  description = "EC2 instance type for WordPress"
  type        = string
  default     = "t3.micro"  # Free tier eligible, sufficient for WordPress
}

variable "wordpress_key_pair_name" {
  description = "SSH key pair name for WordPress instance"
  type        = string
  default     = ""  # Will use same as staging/production if not set
}

################################################################################
# SECURITY GROUP FOR WORDPRESS INSTANCE
################################################################################

# Security Group for WordPress EC2 instance
resource "aws_security_group" "wordpress" {
  count       = var.create_wordpress ? 1 : 0
  name        = "bianca-wordpress-sg"
  description = "Security group for WordPress instance"
  vpc_id      = aws_vpc.staging.id  # Use existing staging VPC

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  # SSH (restrict to your IP in production)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # TODO: Restrict to your IP
    description = "SSH"
  }

  # Allow all outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "bianca-wordpress-sg"
    Environment = var.environment
    Project     = "bianca"
  }
}

################################################################################
# IAM ROLE FOR WORDPRESS INSTANCE
################################################################################

# IAM Role for WordPress EC2 instance
resource "aws_iam_role" "wordpress_instance_role" {
  count = var.create_wordpress ? 1 : 0
  name  = "bianca-wordpress-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = {
    Environment = var.environment
    Project     = "bianca"
  }
}

# Attach necessary policies to WordPress instance role
resource "aws_iam_role_policy_attachment" "wordpress_ssm" {
  count      = var.create_wordpress ? 1 : 0
  role       = aws_iam_role.wordpress_instance_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "wordpress_cloudwatch" {
  count      = var.create_wordpress ? 1 : 0
  role       = aws_iam_role.wordpress_instance_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# IAM policy for WordPress to access S3 (for backups)
resource "aws_iam_role_policy" "wordpress_s3_access" {
  count = var.create_wordpress ? 1 : 0
  name  = "bianca-wordpress-s3-access"
  role  = aws_iam_role.wordpress_instance_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.wordpress_media[0].arn,
          "${aws_s3_bucket.wordpress_media[0].arn}/*"
        ]
      }
    ]
  })
}

# IAM Instance Profile for WordPress
resource "aws_iam_instance_profile" "wordpress_profile" {
  count = var.create_wordpress ? 1 : 0
  name  = "bianca-wordpress-instance-profile"
  role  = aws_iam_role.wordpress_instance_role[0].name
}

################################################################################
# EBS VOLUMES FOR WORDPRESS PERSISTENCE
################################################################################

# EBS Volume for WordPress files (themes, plugins, uploads)
resource "aws_ebs_volume" "wordpress_data" {
  count = var.create_wordpress ? 1 : 0

  availability_zone = aws_subnet.staging_public.availability_zone
  size              = 20 # GB - adjust as needed
  type              = "gp3"
  encrypted         = true

  tags = {
    Name        = "bianca-wordpress-data"
    Environment = var.environment
    Project     = "bianca"
    Backup      = "daily"
    Purpose     = "WordPress files and wp-content"
  }
}

# EBS Volume for WordPress MySQL database
resource "aws_ebs_volume" "wordpress_db" {
  count = var.create_wordpress ? 1 : 0

  availability_zone = aws_subnet.staging_public.availability_zone
  size              = 10 # GB - adjust as needed
  type              = "gp3"
  encrypted         = true

  tags = {
    Name        = "bianca-wordpress-db"
    Environment = var.environment
    Project     = "bianca"
    Backup      = "daily"
    Purpose     = "WordPress MySQL database"
  }
}

################################################################################
# WORDPRESS EC2 INSTANCE
################################################################################

# WordPress EC2 Instance - Separate from app instances
resource "aws_instance" "wordpress" {
  count = var.create_wordpress ? 1 : 0

  ami                    = data.aws_ami.amazon_linux_2.id
  instance_type          = var.wordpress_instance_type
  key_name               = var.wordpress_key_pair_name != "" ? var.wordpress_key_pair_name : var.asterisk_key_pair_name
  vpc_security_group_ids = [aws_security_group.wordpress[0].id]
  subnet_id              = aws_subnet.staging_public.id  # Use staging subnet or create dedicated
  iam_instance_profile   = aws_iam_instance_profile.wordpress_profile[0].name

  user_data = base64encode(templatefile("${path.module}/wordpress-userdata.sh", {
    wp_domain         = var.wp_domain
    s3_backup_bucket  = aws_s3_bucket.wordpress_media[0].id
    aws_region        = var.aws_region
  }))

  root_block_device {
    volume_type = "gp3"
    volume_size = 8  # Small root volume for t3.micro
    encrypted   = true
  }

  tags = {
    Name        = "bianca-wordpress"
    Environment = var.environment
    Project     = "bianca"
    Purpose     = "WordPress site for biancatechnologies.com"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Attach WordPress data volume to WordPress instance
resource "aws_volume_attachment" "wordpress_data_attachment" {
  count = var.create_wordpress ? 1 : 0

  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.wordpress_data[0].id
  instance_id = aws_instance.wordpress[0].id

  # Don't force detach on destroy to prevent data corruption
  force_detach = false
}

# Attach WordPress DB volume to WordPress instance
resource "aws_volume_attachment" "wordpress_db_attachment" {
  count = var.create_wordpress ? 1 : 0

  device_name = "/dev/xvdg"
  volume_id   = aws_ebs_volume.wordpress_db[0].id
  instance_id = aws_instance.wordpress[0].id

  force_detach = false
}

################################################################################
# ELASTIC IP FOR WORDPRESS (Optional but recommended for static IP)
################################################################################

# Elastic IP for WordPress instance (static IP)
# Elastic IP for WordPress (optional - may fail if account limit reached)
# If creation fails, DNS will use instance public IP instead
resource "aws_eip" "wordpress_eip" {
  count  = var.create_wordpress ? 1 : 0
  domain = "vpc"

  tags = {
    Name        = "bianca-wordpress-eip"
    Environment = var.environment
    Project     = "bianca"
  }
  
  # Don't fail if limit reached - DNS will use instance IP
  lifecycle {
    ignore_changes = [allocation_id]
  }
}

# Associate Elastic IP with WordPress instance (only if EIP exists)
# Note: If EIP creation fails due to limit, this resource will be skipped
resource "aws_eip_association" "wordpress_eip_assoc" {
  count         = var.create_wordpress ? 1 : 0
  instance_id   = aws_instance.wordpress[0].id
  allocation_id = try(aws_eip.wordpress_eip[0].id, null)
  
  lifecycle {
    ignore_changes = [allocation_id]
    create_before_destroy = true
  }
}

################################################################################
# S3 BUCKET FOR WORDPRESS MEDIA BACKUPS
################################################################################

# S3 Bucket for WordPress media backups (optional but recommended)
resource "aws_s3_bucket" "wordpress_media" {
  count  = var.create_wordpress ? 1 : 0
  bucket = "bianca-wordpress-media-${var.environment}-${var.aws_account_id}"

  tags = {
    Name        = "WordPress Media Backup"
    Environment = var.environment
    Project     = "bianca"
    Purpose     = "WordPress media and uploads backup"
  }
}

resource "aws_s3_bucket_versioning" "wordpress_media_versioning" {
  count  = var.create_wordpress ? 1 : 0
  bucket = aws_s3_bucket.wordpress_media[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "wordpress_media_encryption" {
  count  = var.create_wordpress ? 1 : 0
  bucket = aws_s3_bucket.wordpress_media[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "wordpress_media_lifecycle" {
  count  = var.create_wordpress ? 1 : 0
  bucket = aws_s3_bucket.wordpress_media[0].id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

################################################################################
# ROUTE53 DNS RECORDS FOR WORDPRESS
################################################################################

# Find existing Route53 hosted zone for biancatechnologies.com
data "aws_route53_zone" "bianca_domain" {
  count        = var.create_wordpress ? 1 : 0
  name         = var.wp_domain
  private_zone = false
}

# Route53 A Record for root domain (biancatechnologies.com - WordPress)
# Uses Elastic IP if available, otherwise falls back to instance public IP
resource "aws_route53_record" "wordpress_root" {
  count   = var.create_wordpress && length(data.aws_route53_zone.bianca_domain) > 0 ? 1 : 0
  zone_id = data.aws_route53_zone.bianca_domain[0].zone_id
  name    = var.wp_domain
  type    = "A"
  ttl     = 300
  # Use Elastic IP if it exists and has a public IP, otherwise use instance public IP
  records = [try(aws_eip.wordpress_eip[0].public_ip, aws_instance.wordpress[0].public_ip)]
}

# Route53 A Record for www subdomain (www.biancatechnologies.com)
# Uses Elastic IP if available, otherwise falls back to instance public IP
resource "aws_route53_record" "wordpress_www" {
  count   = var.create_wordpress && length(data.aws_route53_zone.bianca_domain) > 0 ? 1 : 0
  zone_id = data.aws_route53_zone.bianca_domain[0].zone_id
  name    = "www.${var.wp_domain}"
  type    = "A"
  ttl     = 300
  # Use Elastic IP if it exists and has a public IP, otherwise use instance public IP
  records = [try(aws_eip.wordpress_eip[0].public_ip, aws_instance.wordpress[0].public_ip)]
}

################################################################################
# OUTPUTS
################################################################################

output "wordpress_instance_id" {
  value       = var.create_wordpress ? aws_instance.wordpress[0].id : null
  description = "WordPress EC2 instance ID"
}

output "wordpress_instance_ip" {
  value       = var.create_wordpress ? aws_instance.wordpress[0].public_ip : null
  description = "WordPress EC2 instance public IP"
}

output "wordpress_elastic_ip" {
  value       = var.create_wordpress ? aws_eip.wordpress_eip[0].public_ip : null
  description = "WordPress Elastic IP address"
}

output "wordpress_url" {
  value       = var.create_wordpress ? "https://${var.wp_domain}" : null
  description = "WordPress site URL (after DNS is configured)"
}

output "wordpress_ssh_command" {
  value = var.create_wordpress ? "ssh -i ~/.ssh/${var.wordpress_key_pair_name != "" ? var.wordpress_key_pair_name : var.asterisk_key_pair_name}.pem ec2-user@${aws_eip.wordpress_eip[0].public_ip}" : null
  description = "SSH command to connect to WordPress instance"
}

output "wordpress_data_volume_id" {
  value       = var.create_wordpress ? aws_ebs_volume.wordpress_data[0].id : null
  description = "EBS volume ID for WordPress files (persistent across deployments)"
}

output "wordpress_db_volume_id" {
  value       = var.create_wordpress ? aws_ebs_volume.wordpress_db[0].id : null
  description = "EBS volume ID for WordPress database (persistent across deployments)"
}

output "wordpress_media_bucket" {
  value       = var.create_wordpress ? aws_s3_bucket.wordpress_media[0].id : null
  description = "S3 bucket for WordPress media backups"
}

output "wordpress_dns_status" {
  value       = var.create_wordpress && length(data.aws_route53_zone.bianca_domain) > 0 ? "DNS records created" : "DNS zone not found - create Route53 hosted zone first"
  description = "Status of WordPress DNS configuration"
}
