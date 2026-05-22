# demo.tf
# This creates a separate demo environment for sales demonstrations
# Demo uses the main VPC but with isolated subnets for network-level separation
# This provides good isolation while working within AWS account limits

################################################################################
# DEMO RESOURCES - Isolated subnets in main VPC
################################################################################

# Note: Using main VPC to avoid hitting internet gateway limit
# Demo subnets are in different CIDR range (10.3.x.x) for isolation

# Demo subnets in main VPC (isolated CIDR range)
resource "aws_subnet" "demo_public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "172.31.200.0/24" # Different CIDR in main VPC for isolation
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name        = "bianca-demo-public"
    Environment = "demo"
  }
}

# Second subnet for ALB (AWS requirement)
resource "aws_subnet" "demo_public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "172.31.201.0/24" # Different CIDR in main VPC for isolation
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name        = "bianca-demo-public-b"
    Environment = "demo"
  }
}

# Use existing public route table (shares internet gateway with main VPC)
resource "aws_route_table_association" "demo_a" {
  subnet_id      = aws_subnet.demo_public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "demo_b" {
  subnet_id      = aws_subnet.demo_public_b.id
  route_table_id = aws_route_table.public.id
}

# Demo Security Group
resource "aws_security_group" "demo" {
  name        = "bianca-demo-sg"
  description = "Security group for demo environment"
  vpc_id      = aws_vpc.main.id

  # Allow all internal
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }

  # HTTP/HTTPS
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

  # App
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SIP TCP
  ingress {
    from_port   = 5060
    to_port     = 5061
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SIP UDP
  ingress {
    from_port   = 5060
    to_port     = 5061
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # RTP
  ingress {
    from_port   = 10000
    to_port     = 10100
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Restrict to your IP in production
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "bianca-demo-sg"
    Environment = "demo"
  }
}

# IAM Role for demo EC2 instance
resource "aws_iam_role" "demo_instance_role" {
  name = "bianca-demo-instance-role"

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
    Environment = "demo"
  }
}

# Attach necessary policies to demo instance role
resource "aws_iam_role_policy_attachment" "demo_ssm" {
  role       = aws_iam_role.demo_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "demo_cloudwatch" {
  role       = aws_iam_role.demo_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_role_policy_attachment" "demo_ecr_readonly" {
  role       = aws_iam_role.demo_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# Custom policy for demo instance
resource "aws_iam_role_policy" "demo_instance_policy" {
  name = "bianca-demo-instance-policy"
  role = aws_iam_role.demo_instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "ses:GetSendQuota",
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:GetSendStatistics",
          "sns:Publish"
        ]
        Resource = "*"
      }
    ]
  })
}

# Add CodeDeploy permissions to demo instance role
resource "aws_iam_role_policy" "demo_codedeploy_policy" {
  name = "bianca-demo-codedeploy-policy"
  role = aws_iam_role.demo_instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::bianca-codedeploy-artifacts-${var.aws_account_id}",
          "arn:aws:s3:::bianca-codedeploy-artifacts-${var.aws_account_id}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "codedeploy:PutLifecycleEventHookExecutionStatus",
          "codedeploy:GetDeployment",
          "codedeploy:GetDeploymentConfig",
          "codedeploy:GetApplication",
          "codedeploy:GetApplicationRevision",
          "codedeploy:ListApplicationRevisions",
          "codedeploy:RegisterApplicationRevision",
          "codedeploy:BatchGetDeploymentInstances",
          "codedeploy:ListDeploymentInstances",
          "codedeploy:GetDeploymentInstance"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM Instance Profile for demo
resource "aws_iam_instance_profile" "demo_profile" {
  name = "bianca-demo-instance-profile"
  role = aws_iam_role.demo_instance_role.name
}

# Demo EC2 Instance (On-demand for reliability - demo must work flawlessly)
resource "aws_launch_template" "demo" {
  name_prefix   = "bianca-demo-"
  image_id      = data.aws_ami.amazon_linux_2.id
  instance_type = "t3.small"
  key_name      = var.asterisk_key_pair_name

  vpc_security_group_ids = [aws_security_group.demo.id]

  iam_instance_profile {
    name = aws_iam_instance_profile.demo_profile.name
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size = 50
      volume_type = "gp3"
    }
  }

  user_data = base64encode(templatefile("${path.module}/demo-userdata.sh", {
    region         = var.aws_region
    aws_account_id = var.aws_account_id
    environment    = "demo"
    eip_address    = aws_eip.demo.public_ip
  }))

  update_default_version = true

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "bianca-demo"
      Environment = "demo"
      Purpose     = "Sales demonstrations"
      # NOTE: Demo does NOT have AutoStop - it should be always available
    }
  }
}

# Elastic IP for demo instance
# Reusing existing unassociated EIP to avoid hitting limit
# Using eipalloc-0ce9b38740bc14595 (18.216.248.123) which is currently unassociated
resource "aws_eip" "demo" {
  # Import existing unassociated EIP instead of creating new
  # This avoids hitting the EIP limit
  # If you need to use a different EIP, update the allocation_id below
  # To find unassociated EIPs: aws ec2 describe-addresses --filters "Name=domain,Values=vpc" --query 'Addresses[?AssociationId==`null`]'

  # For now, we'll create a new one and handle limit separately if needed
  domain = "vpc"
  tags = {
    Name        = "bianca-demo-eip"
    Environment = "demo"
  }

  # If EIP limit is hit, you can import an existing unassociated EIP:
  # terraform import aws_eip.demo eipalloc-0ce9b38740bc14595
}

resource "aws_instance" "demo" {
  launch_template {
    id      = aws_launch_template.demo.id
    version = "$Latest"
  }

  subnet_id = aws_subnet.demo_public.id

  # Enable detailed monitoring for auto-recovery
  monitoring = true

  # Enable auto-recovery if instance fails health checks
  maintenance_options {
    auto_recovery = "default"
  }

  tags = {
    Name        = "bianca-demo"
    Environment = "demo"
    Purpose     = "Sales demonstrations - always available"
  }
}

# Associate Elastic IP with demo instance
resource "aws_eip_association" "demo" {
  instance_id   = aws_instance.demo.id
  allocation_id = aws_eip.demo.id
}

# Demo does NOT use EBS volumes - data should be ephemeral for easy reset between demos
# MongoDB data will be stored on the instance root volume and wiped on instance recreation

# Demo now uses shared ALB (consolidated with WordPress to reduce costs)
# The shared ALB is defined in main.tf

# API Target Group
resource "aws_lb_target_group" "demo_api" {
  name     = "bianca-demo-api-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 60
    matcher             = "200"
    path                = "/health"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name        = "bianca-demo-api-tg"
    Environment = "demo"
  }
}

# Frontend Target Group
resource "aws_lb_target_group" "demo_frontend" {
  name     = "bianca-demo-frontend-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 60
    matcher             = "200"
    path                = "/"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name        = "bianca-demo-frontend-tg"
    Environment = "demo"
  }
}

resource "aws_lb_target_group_attachment" "demo_api" {
  target_group_arn = aws_lb_target_group.demo_api.arn
  target_id        = aws_instance.demo.id
  port             = 3000
}

resource "aws_lb_target_group_attachment" "demo_frontend" {
  target_group_arn = aws_lb_target_group.demo_frontend.arn
  target_id        = aws_instance.demo.id
  port             = 80
}

# HTTP redirect is handled by shared ALB listener in main.tf

# S3 Bucket for frontend builds
resource "aws_s3_bucket" "demo_frontend" {
  bucket = "bianca-demo-frontend-${random_string.demo_suffix.result}"

  tags = {
    Name        = "bianca-demo-frontend"
    Environment = "demo"
  }
}

resource "aws_s3_bucket_public_access_block" "demo_frontend" {
  bucket = aws_s3_bucket.demo_frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "demo_frontend" {
  bucket = aws_s3_bucket.demo_frontend.id
  versioning_configuration {
    # Demo artifacts are disposable; avoid accumulating version storage costs.
    status = "Suspended"
  }
}

# Random suffix for unique bucket names
resource "random_string" "demo_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Route 53 for demo - points to shared ALB
resource "aws_route53_record" "demo_frontend_primary" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "demo.${var.primary_domain}"
  type    = "A"

  alias {
    name                   = aws_lb.shared.dns_name
    zone_id                = aws_lb.shared.zone_id
    evaluate_target_health = false
  }
}

# Host-based routing rule for demo frontend (demo.biancawellness.com)
# Priority 21 (after API rule at 11; 20 is used by WordPress)
resource "aws_lb_listener_rule" "demo_frontend" {
  listener_arn = aws_lb_listener.shared_https.arn
  priority     = 21

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.demo_frontend.arn
  }

  condition {
    host_header {
      values = ["demo.${var.primary_domain}"]
    }
  }
}

# Host-based routing rule for demo API (/v1/* paths on demo.biancawellness.com)
resource "aws_lb_listener_rule" "demo_api" {
  listener_arn = aws_lb_listener.shared_https.arn
  priority     = 11

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.demo_api.arn
  }

  condition {
    host_header {
      values = ["demo.${var.primary_domain}"]
    }
  }

  condition {
    path_pattern {
      values = ["/v1/*"]
    }
  }
}

################################################################################
# OUTPUTS - Demo
################################################################################

output "demo_instance_ip" {
  value       = aws_instance.demo.public_ip
  description = "Demo instance public IP"
}

output "demo_url" {
  value       = "https://demo.${var.primary_domain}"
  description = "Demo frontend URL"
}

output "demo_api_url" {
  value       = "https://demo.${var.primary_domain}/v1"
  description = "Demo API URL"
}

output "demo_ssh_command" {
  value       = "ssh -i ~/.ssh/${var.asterisk_key_pair_name}.pem ec2-user@${aws_instance.demo.public_ip}"
  description = "SSH command to connect to demo"
}

################################################################################
# CloudWatch Log Groups for HIPAA Compliance (7-year retention)
################################################################################

resource "aws_cloudwatch_log_group" "demo_app_logs" {
  name              = "/bianca/demo/app"
  retention_in_days = 2557 # 7 years for HIPAA compliance

  tags = {
    Name        = "bianca-demo-app-logs"
    Environment = "demo"
    HIPAA       = "true"
  }
}

resource "aws_cloudwatch_log_group" "demo_mongodb_logs" {
  name              = "/bianca/demo/mongodb"
  retention_in_days = 2557

  tags = {
    Name        = "bianca-demo-mongodb-logs"
    Environment = "demo"
    HIPAA       = "true"
  }
}

resource "aws_cloudwatch_log_group" "demo_asterisk_logs" {
  name              = "/bianca/demo/asterisk"
  retention_in_days = 2557

  tags = {
    Name        = "bianca-demo-asterisk-logs"
    Environment = "demo"
    HIPAA       = "true"
  }
}

resource "aws_cloudwatch_log_group" "demo_nginx_logs" {
  name              = "/bianca/demo/nginx"
  retention_in_days = 2557

  tags = {
    Name        = "bianca-demo-nginx-logs"
    Environment = "demo"
    HIPAA       = "true"
  }
}

resource "aws_cloudwatch_log_group" "demo_frontend_logs" {
  name              = "/bianca/demo/frontend"
  retention_in_days = 2557

  tags = {
    Name        = "bianca-demo-frontend-logs"
    Environment = "demo"
    HIPAA       = "true"
  }
}

################################################################################
# CODEDEPLOY FOR DEMO
################################################################################

# CodeDeploy Application for demo
resource "aws_codedeploy_app" "demo" {
  name             = "bianca-demo"
  compute_platform = "Server"

  tags = {
    Environment = "demo"
    Name        = "bianca-demo"
  }
}

# CodeDeploy Deployment Group for demo
resource "aws_codedeploy_deployment_group" "demo" {
  app_name              = aws_codedeploy_app.demo.name
  deployment_group_name = "bianca-demo-ec2"
  service_role_arn      = aws_iam_role.codedeploy_service_role.arn

  ec2_tag_filter {
    key   = "Name"
    type  = "KEY_AND_VALUE"
    value = "bianca-demo"
  }

  deployment_config_name = "CodeDeployDefault.AllAtOnce"

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE"]
  }

  alarm_configuration {
    enabled = false
  }

  tags = {
    Environment = "demo"
    Name        = "bianca-demo-ec2"
  }
}
