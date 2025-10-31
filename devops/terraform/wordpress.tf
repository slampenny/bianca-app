# WordPress Resources for myphonefriend.com
# This deploys WordPress on a separate EC2 instance (t3.micro) - isolated from app instances
# IMPORTANT: WordPress deployment is isolated - it will NOT affect app deployments

################################################################################
# VARIABLES
################################################################################

variable "wp_domain" {
  description = "Domain name for WordPress site"
  type        = string
  default     = "myphonefriend.com"
}

variable "create_wordpress" {
  description = "Whether to create WordPress resources. Default false to avoid accidental deployment."
  type        = bool
  default     = false  # Set to true explicitly when deploying WordPress
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
# SECURITY GROUPS (need to be defined before ALB and instance)
################################################################################

# Security Group for WordPress ALB (defined first to avoid circular dependency)
resource "aws_security_group" "wordpress_alb" {
  count       = var.create_wordpress ? 1 : 0
  name        = "bianca-wordpress-alb-sg"
  description = "Security group for WordPress ALB"
  vpc_id      = aws_subnet.public_a.vpc_id  # Use same VPC as subnets

  # HTTP from internet
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  # HTTPS from internet
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
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
    Name        = "bianca-wordpress-alb-sg"
    Environment = var.environment
    Project     = "bianca"
  }
}

# Security Group for WordPress EC2 instance
resource "aws_security_group" "wordpress" {
  count       = var.create_wordpress ? 1 : 0
  name        = "bianca-wordpress-sg"
  description = "Security group for WordPress instance"
  vpc_id      = aws_subnet.public_a.vpc_id  # Use same VPC as subnets

  # Allow traffic only from ALB
  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.wordpress_alb[0].id]
    description     = "HTTP from ALB"
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

  availability_zone = aws_subnet.public_a.availability_zone
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

  availability_zone = aws_subnet.public_a.availability_zone
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
# APPLICATION LOAD BALANCER FOR WORDPRESS
################################################################################

# Application Load Balancer for WordPress
resource "aws_lb" "wordpress" {
  count              = var.create_wordpress ? 1 : 0
  name               = "bianca-wordpress-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.wordpress_alb[0].id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]  # Need at least 2 subnets in different AZs

  enable_deletion_protection = false
  enable_http2              = true
  idle_timeout               = 60

  depends_on = [
    aws_security_group.wordpress_alb,
  ]

  tags = {
    Name        = "bianca-wordpress-alb"
    Environment = var.environment
    Project     = "bianca"
  }
}

# Target Group for WordPress instance
resource "aws_lb_target_group" "wordpress" {
  count    = var.create_wordpress ? 1 : 0
  name     = "bianca-wordpress-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_subnet.public_a.vpc_id  # Use same VPC as subnets

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200-399"
  }

  deregistration_delay = 30

  tags = {
    Name        = "bianca-wordpress-tg"
    Environment = var.environment
    Project     = "bianca"
  }
}

# Attach WordPress instance to target group
resource "aws_lb_target_group_attachment" "wordpress" {
  count            = var.create_wordpress ? 1 : 0
  target_group_arn = aws_lb_target_group.wordpress[0].arn
  target_id        = aws_instance.wordpress[0].id
  port             = 80
}

# ALB Listener - HTTP (redirect to HTTPS)
resource "aws_lb_listener" "wordpress_http" {
  count             = var.create_wordpress ? 1 : 0
  load_balancer_arn = aws_lb.wordpress[0].arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ALB Listener - HTTPS (uses ACM certificate)
resource "aws_lb_listener" "wordpress_https" {
  count             = var.create_wordpress ? 1 : 0
  load_balancer_arn = aws_lb.wordpress[0].arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.wordpress_cert[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.wordpress[0].arn
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
  subnet_id              = aws_subnet.public_a.id  # Use public_a subnet
  iam_instance_profile   = aws_iam_instance_profile.wordpress_profile[0].name

  user_data = base64encode(templatefile("${path.module}/wordpress-userdata.sh", {
    wp_domain         = var.wp_domain
    s3_backup_bucket  = aws_s3_bucket.wordpress_media[0].id
    aws_region        = var.aws_region
    cert_arn          = var.create_wordpress ? aws_acm_certificate_validation.wordpress_cert[0].certificate_arn : ""
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
# ELASTIC IP FOR WORDPRESS (Optional - using auto-assigned IP if limit reached)
################################################################################

# Note: EIP limit reached in account - WordPress will use auto-assigned public IP
# This works fine - the IP remains static as long as instance isn't terminated
# If you need a true Elastic IP, release an unused one first

# Elastic IP for WordPress instance (static IP) - DISABLED due to limit
# resource "aws_eip" "wordpress_eip" {
#   count  = var.create_wordpress ? 1 : 0
#   domain = "vpc"
#   tags = {
#     Name = "bianca-wordpress-eip"
#   }
# }

# WordPress will use auto-assigned public IP (available via aws_instance.wordpress[0].public_ip)

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

# Use existing Route53 hosted zone for myphonefriend.com
data "aws_route53_zone" "wordpress_domain" {
  count        = var.create_wordpress ? 1 : 0
  name         = "myphonefriend.com."
  private_zone = false
}

# Request ACM certificate for myphonefriend.com and www.myphonefriend.com
# Note: ACM certs can't be used directly by nginx on EC2, but we'll use Route53 validation
# and still use Let's Encrypt for the actual nginx configuration
resource "aws_acm_certificate" "wordpress_cert" {
  count            = var.create_wordpress ? 1 : 0
  domain_name      = var.wp_domain
  validation_method = "DNS"

  subject_alternative_names = ["www.${var.wp_domain}"]

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "bianca-wordpress-ssl"
    Environment = var.environment
    Project     = "bianca"
  }
}

# Route53 validation records for ACM certificate
resource "aws_route53_record" "wordpress_cert_validation" {
  for_each = var.create_wordpress ? {
    for dvo in aws_acm_certificate.wordpress_cert[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id = data.aws_route53_zone.wordpress_domain[0].zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60

  allow_overwrite = true
}

# Wait for certificate validation
resource "aws_acm_certificate_validation" "wordpress_cert" {
  count           = var.create_wordpress ? 1 : 0
  certificate_arn = aws_acm_certificate.wordpress_cert[0].arn
  validation_record_fqdns = [
    for record in aws_route53_record.wordpress_cert_validation : record.fqdn
  ]

  timeouts {
    create = "5m"
  }
}

# Also keep data source for backward compatibility (use existing wildcard cert for reference)
data "aws_acm_certificate" "wordpress_cert_existing" {
  count       = var.create_wordpress ? 1 : 0
  domain      = "*.myphonefriend.com"
  statuses    = ["ISSUED"]
  most_recent = true
}

# IMPORTANT: Only updates root domain (myphonefriend.com) and www.myphonefriend.com
# Does NOT touch any subdomains (api, app, staging, etc.) - those remain unchanged

# Update existing root domain A record to point to WordPress
# This will update the existing aws_route53_record.wordpress_apex record in main.tf
# Route53 A Record for root domain (myphonefriend.com - WordPress)
# Uses instance public IP (auto-assigned since EIP limit reached)
resource "aws_route53_record" "wordpress_root" {
  count   = var.create_wordpress ? 1 : 0
  zone_id = data.aws_route53_zone.wordpress_domain[count.index].zone_id
  name    = var.wp_domain  # Just "myphonefriend.com" - NO subdomains touched
  type    = "A"

  alias {
    name                   = aws_lb.wordpress[0].dns_name
    zone_id                = aws_lb.wordpress[0].zone_id
    evaluate_target_health = true
  }

  lifecycle {
    create_before_destroy = true
    # Prevent accidental modification of subdomain records
  }
}

# Create www subdomain record (only if it doesn't exist)
resource "aws_route53_record" "wordpress_www" {
  count   = var.create_wordpress ? 1 : 0
  zone_id = data.aws_route53_zone.wordpress_domain[count.index].zone_id
  name    = "www.${var.wp_domain}"  # Only www subdomain - other subdomains untouched
  type    = "A"

  alias {
    name                   = aws_lb.wordpress[0].dns_name
    zone_id                = aws_lb.wordpress[0].zone_id
    evaluate_target_health = true
  }

  lifecycle {
    create_before_destroy = true
  }
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
  value       = var.create_wordpress ? aws_instance.wordpress[0].public_ip : null
  description = "WordPress public IP address (auto-assigned, static while instance runs)"
}

output "wordpress_url" {
  value       = var.create_wordpress ? "https://${var.wp_domain}" : null
  description = "WordPress site URL (after DNS is configured)"
}

output "wordpress_ssh_command" {
  value = var.create_wordpress ? "ssh -i ~/.ssh/${var.wordpress_key_pair_name != "" ? var.wordpress_key_pair_name : var.asterisk_key_pair_name}.pem ec2-user@${aws_instance.wordpress[0].public_ip}" : null
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
  value       = var.create_wordpress && length(data.aws_route53_zone.wordpress_domain) > 0 ? "DNS records created for myphonefriend.com" : "DNS zone not found - create Route53 hosted zone first"
  description = "Status of WordPress DNS configuration"
}

output "wordpress_certificate_arn" {
  value       = var.create_wordpress ? aws_acm_certificate_validation.wordpress_cert[0].certificate_arn : null
  description = "ACM certificate ARN for WordPress SSL (validated via Route53)"
}

output "wordpress_alb_dns" {
  value       = var.create_wordpress ? aws_lb.wordpress[0].dns_name : null
  description = "DNS name of the WordPress Application Load Balancer"
}

output "wordpress_alb_arn" {
  value       = var.create_wordpress ? aws_lb.wordpress[0].arn : null
  description = "ARN of the WordPress Application Load Balancer"
}
