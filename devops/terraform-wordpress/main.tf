# WordPress Infrastructure for myphonefriend.com
# This is a standalone Terraform workspace - completely independent from the main app
# WordPress will always exist - no variables needed to keep it running

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

################################################################################
# VARIABLES
################################################################################

variable "aws_region" {
  description = "AWS region for the deployment."
  type        = string
  default     = "us-east-2"
}

variable "aws_profile" {
  description = "AWS CLI profile to use for authentication."
  type        = string
  default     = "jordan"
}

variable "aws_account_id" {
  description = "Your AWS Account ID."
  type        = string
  default     = "730335291008"
}

variable "environment" {
  description = "Environment name."
  type        = string
  default     = "staging"  # Using staging bucket that already exists
}

variable "wp_domain" {
  description = "Domain name for WordPress site"
  type        = string
  default     = "myphonefriend.com"
}

variable "wordpress_instance_type" {
  description = "EC2 instance type for WordPress"
  type        = string
  default     = "t3.micro"
}

variable "wordpress_key_pair_name" {
  description = "SSH key pair name for WordPress instance"
  type        = string
  default     = "bianca-key-pair"
}

# VPC and subnet IDs (from main terraform workspace)
variable "vpc_id" {
  description = "VPC ID where WordPress will be deployed"
  type        = string
  default     = "vpc-05c16725411127dc3"
}

variable "subnet_public_a_id" {
  description = "Public subnet A ID"
  type        = string
  default     = "subnet-00ec81340523b7240"
}

variable "subnet_public_b_id" {
  description = "Public subnet B ID"
  type        = string
  default     = "subnet-06d5200485f11541b"
}

################################################################################
# DATA SOURCES
################################################################################

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_route53_zone" "wordpress_domain" {
  name         = "${var.wp_domain}."
  private_zone = false
}

data "aws_subnet" "public_a" {
  id = var.subnet_public_a_id
}

data "aws_subnet" "public_b" {
  id = var.subnet_public_b_id
}

################################################################################
# SECURITY GROUPS
################################################################################

# Security Group for WordPress ALB
resource "aws_security_group" "wordpress_alb" {
  name        = "bianca-wordpress-alb-sg"
  description = "Security group for WordPress ALB"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

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
    ManagedBy   = "terraform-wordpress"
  }
}

# Security Group for WordPress EC2 instance
resource "aws_security_group" "wordpress" {
  name        = "bianca-wordpress-sg"
  description = "Security group for WordPress instance"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.wordpress_alb.id]
    description     = "HTTP from ALB"
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH"
  }

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
    ManagedBy   = "terraform-wordpress"
  }
}

################################################################################
# IAM ROLE FOR WORDPRESS INSTANCE
################################################################################

resource "aws_iam_role" "wordpress_instance_role" {
  name = "bianca-wordpress-instance-role"

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
    ManagedBy   = "terraform-wordpress"
  }
}

resource "aws_iam_role_policy_attachment" "wordpress_ssm" {
  role       = aws_iam_role.wordpress_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "wordpress_cloudwatch" {
  role       = aws_iam_role.wordpress_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_role_policy" "wordpress_s3_access" {
  name = "bianca-wordpress-s3-access"
  role = aws_iam_role.wordpress_instance_role.id

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
          aws_s3_bucket.wordpress_media.arn,
          "${aws_s3_bucket.wordpress_media.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "wordpress_ses_access" {
  name = "bianca-wordpress-ses-access"
  role = aws_iam_role.wordpress_instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "wordpress_profile" {
  name = "bianca-wordpress-instance-profile"
  role = aws_iam_role.wordpress_instance_role.name
}

################################################################################
# EBS VOLUMES FOR WORDPRESS PERSISTENCE
################################################################################

resource "aws_ebs_volume" "wordpress_data" {
  availability_zone = data.aws_subnet.public_a.availability_zone
  size              = 20
  type              = "gp3"
  encrypted         = true

  tags = {
    Name        = "bianca-wordpress-data"
    Environment = var.environment
    Project     = "bianca"
    Backup      = "daily"
    Purpose     = "WordPress files and wp-content"
    ManagedBy   = "terraform-wordpress"
  }
}

resource "aws_ebs_volume" "wordpress_db" {
  availability_zone = data.aws_subnet.public_a.availability_zone
  size              = 10
  type              = "gp3"
  encrypted         = true

  tags = {
    Name        = "bianca-wordpress-db"
    Environment = var.environment
    Project     = "bianca"
    Backup      = "daily"
    Purpose     = "WordPress MySQL database"
    ManagedBy   = "terraform-wordpress"
  }
}

################################################################################
# APPLICATION LOAD BALANCER FOR WORDPRESS
################################################################################

resource "aws_lb" "wordpress" {
  name               = "bianca-wordpress-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.wordpress_alb.id]
  subnets            = [var.subnet_public_a_id, var.subnet_public_b_id]

  enable_deletion_protection = false
  enable_http2              = true
  idle_timeout               = 60

  tags = {
    Name        = "bianca-wordpress-alb"
    Environment = var.environment
    Project     = "bianca"
    ManagedBy   = "terraform-wordpress"
  }
}

resource "aws_lb_target_group" "wordpress" {
  name     = "bianca-wordpress-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = var.vpc_id

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
    ManagedBy   = "terraform-wordpress"
  }
}

resource "aws_lb_target_group_attachment" "wordpress" {
  target_group_arn = aws_lb_target_group.wordpress.arn
  target_id        = aws_instance.wordpress.id
  port             = 80
}

resource "aws_lb_listener" "wordpress_http" {
  load_balancer_arn = aws_lb.wordpress.arn
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

resource "aws_lb_listener" "wordpress_https" {
  load_balancer_arn = aws_lb.wordpress.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.wordpress_cert.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.wordpress.arn
  }
}

################################################################################
# WORDPRESS EC2 INSTANCE
################################################################################

resource "aws_instance" "wordpress" {
  ami                    = data.aws_ami.amazon_linux_2.id
  instance_type          = var.wordpress_instance_type
  key_name               = var.wordpress_key_pair_name
  vpc_security_group_ids = [aws_security_group.wordpress.id]
  subnet_id              = var.subnet_public_a_id
  iam_instance_profile   = aws_iam_instance_profile.wordpress_profile.name

  user_data = base64encode(templatefile("${path.module}/wordpress-userdata.sh", {
    wp_domain         = var.wp_domain
    s3_backup_bucket  = aws_s3_bucket.wordpress_media.id
    aws_region        = var.aws_region
    cert_arn          = aws_acm_certificate_validation.wordpress_cert.certificate_arn
  }))

  root_block_device {
    volume_type = "gp3"
    volume_size = 8
    encrypted   = true
  }

  tags = {
    Name        = "bianca-wordpress"
    Environment = var.environment
    Project     = "bianca"
    Purpose     = "WordPress site for ${var.wp_domain}"
    ManagedBy   = "terraform-wordpress"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_volume_attachment" "wordpress_data_attachment" {
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.wordpress_data.id
  instance_id = aws_instance.wordpress.id
  force_detach = false
}

resource "aws_volume_attachment" "wordpress_db_attachment" {
  device_name = "/dev/xvdg"
  volume_id   = aws_ebs_volume.wordpress_db.id
  instance_id = aws_instance.wordpress.id
  force_detach = false
}

################################################################################
# S3 BUCKET FOR WORDPRESS MEDIA BACKUPS
################################################################################

resource "aws_s3_bucket" "wordpress_media" {
  bucket = "bianca-wordpress-media-${var.environment}-${var.aws_account_id}"

  tags = {
    Name        = "WordPress Media Backup"
    Environment = var.environment
    Project     = "bianca"
    Purpose     = "WordPress media and uploads backup"
    ManagedBy   = "terraform-wordpress"
  }
}

resource "aws_s3_bucket_versioning" "wordpress_media_versioning" {
  bucket = aws_s3_bucket.wordpress_media.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "wordpress_media_encryption" {
  bucket = aws_s3_bucket.wordpress_media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "wordpress_media_lifecycle" {
  bucket = aws_s3_bucket.wordpress_media.id

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

resource "aws_acm_certificate" "wordpress_cert" {
  domain_name       = var.wp_domain
  validation_method = "DNS"

  subject_alternative_names = ["www.${var.wp_domain}"]

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "bianca-wordpress-ssl"
    Environment = var.environment
    Project     = "bianca"
    ManagedBy   = "terraform-wordpress"
  }
}

resource "aws_route53_record" "wordpress_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.wordpress_cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.wordpress_domain.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60

  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "wordpress_cert" {
  certificate_arn = aws_acm_certificate.wordpress_cert.arn
  validation_record_fqdns = [
    for record in aws_route53_record.wordpress_cert_validation : record.fqdn
  ]

  timeouts {
    create = "5m"
  }
}

resource "aws_route53_record" "wordpress_root" {
  zone_id        = data.aws_route53_zone.wordpress_domain.zone_id
  name           = var.wp_domain
  type           = "A"
  allow_overwrite = true

  alias {
    name                   = aws_lb.wordpress.dns_name
    zone_id                = aws_lb.wordpress.zone_id
    evaluate_target_health = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "wordpress_www" {
  zone_id        = data.aws_route53_zone.wordpress_domain.zone_id
  name           = "www.${var.wp_domain}"
  type           = "A"
  allow_overwrite = true

  alias {
    name                   = aws_lb.wordpress.dns_name
    zone_id                = aws_lb.wordpress.zone_id
    evaluate_target_health = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

################################################################################
# SES DOMAIN VERIFICATION FOR EMAIL SENDING
################################################################################

# Note: SES domain verification for myphonefriend.com is managed in the main
# terraform workspace (devops/terraform/main.tf). The domain should already be
# verified. This section documents the requirement.
#
# To verify SES is set up correctly, run:
#   aws ses get-identity-verification-attributes --identities myphonefriend.com --region us-east-2
#
# The WordPress instance has IAM permissions to send emails via SES (configured above).
# WordPress itself needs to be configured to use SES via an SMTP plugin.
# See WORDPRESS_EMAIL_SETUP.md for instructions.

################################################################################
# OUTPUTS
################################################################################

output "wordpress_instance_id" {
  value       = aws_instance.wordpress.id
  description = "WordPress EC2 instance ID"
}

output "wordpress_instance_ip" {
  value       = aws_instance.wordpress.public_ip
  description = "WordPress EC2 instance public IP"
}

output "wordpress_url" {
  value       = "https://${var.wp_domain}"
  description = "WordPress site URL"
}

output "wordpress_ssh_command" {
  value = "ssh -i ~/.ssh/${var.wordpress_key_pair_name}.pem ec2-user@${aws_instance.wordpress.public_ip}"
  description = "SSH command to connect to WordPress instance"
}

output "wordpress_data_volume_id" {
  value       = aws_ebs_volume.wordpress_data.id
  description = "EBS volume ID for WordPress files"
}

output "wordpress_db_volume_id" {
  value       = aws_ebs_volume.wordpress_db.id
  description = "EBS volume ID for WordPress database"
}

output "wordpress_media_bucket" {
  value       = aws_s3_bucket.wordpress_media.id
  description = "S3 bucket for WordPress media backups"
}

output "wordpress_certificate_arn" {
  value       = aws_acm_certificate_validation.wordpress_cert.certificate_arn
  description = "ACM certificate ARN for WordPress SSL"
}

output "wordpress_alb_dns" {
  value       = aws_lb.wordpress.dns_name
  description = "DNS name of the WordPress Application Load Balancer"
}

output "wordpress_alb_arn" {
  value       = aws_lb.wordpress.arn
  description = "ARN of the WordPress Application Load Balancer"
}
