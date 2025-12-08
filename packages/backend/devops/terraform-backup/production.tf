# production.tf
# Production environment configuration based on staging
# This creates a completely separate production environment

################################################################################
# PRODUCTION RESOURCES - Completely isolated from staging
################################################################################

# Production VPC (separate from staging)
resource "aws_vpc" "production" {
  cidr_block           = "10.2.0.0/16"  # Different from staging (10.1.0.0/16)
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "bianca-production-vpc"
    Environment = "production"
  }
}

resource "aws_internet_gateway" "production" {
  vpc_id = aws_vpc.production.id

  tags = {
    Name        = "bianca-production-igw"
    Environment = "production"
  }
}

# Production subnets
resource "aws_subnet" "production_public" {
  vpc_id                  = aws_vpc.production.id
  cidr_block              = "10.2.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name        = "bianca-production-public"
    Environment = "production"
  }
}

resource "aws_subnet" "production_public_b" {
  vpc_id                  = aws_vpc.production.id
  cidr_block              = "10.2.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name        = "bianca-production-public-b"
    Environment = "production"
  }
}

resource "aws_route_table" "production" {
  vpc_id = aws_vpc.production.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.production.id
  }

  tags = {
    Name        = "bianca-production-rt"
    Environment = "production"
  }
}

resource "aws_route_table_association" "production_a" {
  subnet_id      = aws_subnet.production_public.id
  route_table_id = aws_route_table.production.id
}

resource "aws_route_table_association" "production_b" {
  subnet_id      = aws_subnet.production_public_b.id
  route_table_id = aws_route_table.production.id
}

# Production Security Group
resource "aws_security_group" "production" {
  name_prefix = "bianca-production-"
  vpc_id      = aws_vpc.production.id

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Application port
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # RTP ports for Asterisk
  ingress {
    from_port   = 10000
    to_port     = 20000
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SIP
  ingress {
    from_port   = 5060
    to_port     = 5060
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "bianca-production-sg"
    Environment = "production"
  }
}

# Production IAM Role
resource "aws_iam_role" "production_role" {
  name = "bianca-production-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = "production"
  }
}

# Production IAM Policy
resource "aws_iam_role_policy" "production_policy" {
  name = "bianca-production-policy"
  role = aws_iam_role.production_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:*",
          "ecr:*",
          "logs:*",
          "ssm:*",
          "sns:*",
          "ses:*",
          "secretsmanager:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# Production IAM Instance Profile
resource "aws_iam_instance_profile" "production_profile" {
  name = "bianca-production-profile"
  role = aws_iam_role.production_role.name

  tags = {
    Environment = "production"
  }
}

# Production EBS Volume for MongoDB data persistence
resource "aws_ebs_volume" "production_mongodb" {
  availability_zone = aws_subnet.production_public.availability_zone
  size              = 20  # 20GB same as staging for cost optimization
  type              = "gp3"
  
  tags = {
    Name        = "bianca-production-mongodb-data"
    Environment = "production"
    Purpose     = "MongoDB data persistence"
  }
}

# Production Launch Template
resource "aws_launch_template" "production" {
  name_prefix   = "bianca-production-"
  image_id      = data.aws_ami.amazon_linux_2.id
  instance_type = "t3.small"  # Same as staging for cost optimization
  key_name      = var.asterisk_key_pair_name

  vpc_security_group_ids = [aws_security_group.production.id]
  
  iam_instance_profile {
    name = aws_iam_instance_profile.production_profile.name
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size = 20  # Same as staging for cost optimization
      volume_type = "gp3"
    }
  }

  user_data = base64encode(templatefile("${path.module}/production-userdata.sh", {
    region         = var.aws_region
    aws_account_id = var.aws_account_id
    environment    = "production"
  }))

  # Force recreation when userdata changes
  update_default_version = true

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "bianca-production"
      Environment = "production"
    }
  }
}

# Production EC2 Instance - ON-DEMAND FOR RELIABILITY
resource "aws_instance" "production" {
  launch_template {
    id      = aws_launch_template.production.id
    version = "$Latest"
  }

  subnet_id = aws_subnet.production_public.id

  # NO SPOT INSTANCE FOR PRODUCTION - Use on-demand for 24/7 availability
  # REMOVED spot configuration - production must stay up

  # Enable detailed monitoring for auto-recovery
  monitoring = true

  # Enable auto-recovery if instance fails health checks
  # This will automatically restart the instance if it becomes impaired
  maintenance_options {
    auto_recovery = "default"
  }

  tags = {
    Name        = "bianca-production"
    Environment = "production"
  }

  # Prevent unnecessary user_data changes from triggering instance updates
  lifecycle {
    ignore_changes = [user_data]
  }
}

# Attach EBS volume to production instance
resource "aws_volume_attachment" "production_mongodb" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.production_mongodb.id
  instance_id = aws_instance.production.id
}

# Production Load Balancer for HTTPS
resource "aws_lb" "production" {
  name               = "bianca-production-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.production_alb.id]
  subnets            = [aws_subnet.production_public.id, aws_subnet.production_public_b.id]

  enable_deletion_protection = false

  tags = {
    Environment = "production"
  }
}

# Security group for production load balancer
resource "aws_security_group" "production_alb" {
  name_prefix = "bianca-production-alb-"
  vpc_id      = aws_vpc.production.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "bianca-production-alb-sg"
    Environment = "production"
  }
}

# Target group for production app
resource "aws_lb_target_group" "production_app" {
  name     = "bianca-production-app-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.production.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Environment = "production"
  }
}

# Target group for production API
resource "aws_lb_target_group" "production_api" {
  name     = "bianca-production-api-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.production.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Environment = "production"
  }
}

# Attach instance to target groups
resource "aws_lb_target_group_attachment" "production_app" {
  target_group_arn = aws_lb_target_group.production_app.arn
  target_id        = aws_instance.production.id
  port             = 80
}

resource "aws_lb_target_group_attachment" "production_api" {
  target_group_arn = aws_lb_target_group.production_api.arn
  target_id        = aws_instance.production.id
  port             = 3000
}

# HTTP listener (redirect to HTTPS)
resource "aws_lb_listener" "production_http_redirect" {
  load_balancer_arn = aws_lb.production.arn
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

# HTTPS listener
resource "aws_lb_listener" "production_https" {
  load_balancer_arn = aws_lb.production.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = data.aws_acm_certificate.app_cert.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.production_app.arn
  }
}

# HTTPS listener rule for API
resource "aws_lb_listener_rule" "production_api_https_rule" {
  listener_arn = aws_lb_listener.production_https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.production_api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/v1/*", "/health"]
    }
  }
}

# Production Route53 Records
resource "aws_route53_record" "production_api" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "api.myphonefriend.com"
  type    = "CNAME"
  ttl     = 300
  records = [aws_lb.production.dns_name]
}

resource "aws_route53_record" "production_app" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "app.myphonefriend.com"
  type    = "CNAME"
  ttl     = 300
  records = [aws_lb.production.dns_name]
}

# Production CloudWatch Log Group
resource "aws_cloudwatch_log_group" "production_logs" {
  name              = "/bianca/production"
  retention_in_days = 30  # Longer retention for production

  tags = {
    Environment = "production"
  }
}

# Production SNS Topic for alerts
resource "aws_sns_topic" "production_alerts" {
  name = "bianca-production-alerts"

  tags = {
    Environment = "production"
  }
}

# Lambda function removed - not essential for basic production setup

# Data sources are defined in main.tf

