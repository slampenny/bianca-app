# staging.tf
# ADD THIS FILE ALONGSIDE YOUR EXISTING main.tf
# This creates a completely separate staging environment

################################################################################
# STAGING RESOURCES - Completely isolated from production
################################################################################

# Staging VPC (separate from production)
resource "aws_vpc" "staging" {
  cidr_block           = "10.1.0.0/16"  # Different from production
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "bianca-staging-vpc"
    Environment = "staging"
  }
}

resource "aws_internet_gateway" "staging" {
  vpc_id = aws_vpc.staging.id

  tags = {
    Name        = "bianca-staging-igw"
    Environment = "staging"
  }
}

# Single subnet for staging (cost optimization)
resource "aws_subnet" "staging_public" {
  vpc_id                  = aws_vpc.staging.id
  cidr_block              = "10.1.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name        = "bianca-staging-public"
    Environment = "staging"
  }
}

# Second subnet for ALB (AWS requirement)
resource "aws_subnet" "staging_public_b" {
  vpc_id                  = aws_vpc.staging.id
  cidr_block              = "10.1.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name        = "bianca-staging-public-b"
    Environment = "staging"
  }
}

resource "aws_route_table" "staging" {
  vpc_id = aws_vpc.staging.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.staging.id
  }

  tags = {
    Name        = "bianca-staging-rt"
    Environment = "staging"
  }
}

resource "aws_route_table_association" "staging_a" {
  subnet_id      = aws_subnet.staging_public.id
  route_table_id = aws_route_table.staging.id
}

resource "aws_route_table_association" "staging_b" {
  subnet_id      = aws_subnet.staging_public_b.id
  route_table_id = aws_route_table.staging.id
}

# Staging Security Group
resource "aws_security_group" "staging" {
  name        = "bianca-staging-sg"
  description = "Security group for staging environment"
  vpc_id      = aws_vpc.staging.id

  # Allow all internal
  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
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

  # RTP (staging-optimized range)
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
    cidr_blocks = ["0.0.0.0/0"]  # Restrict to your IP in production
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "bianca-staging-sg"
    Environment = "staging"
  }
}

# IAM Role for staging EC2 instance
resource "aws_iam_role" "staging_instance_role" {
  name = "bianca-staging-instance-role"

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
    Environment = "staging"
  }
}

# Attach necessary policies to staging instance role
resource "aws_iam_role_policy_attachment" "staging_ssm" {
  role       = aws_iam_role.staging_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "staging_cloudwatch" {
  role       = aws_iam_role.staging_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# CRITICAL: Add ECR read-only policy for pulling images
resource "aws_iam_role_policy_attachment" "staging_ecr_readonly" {
  role       = aws_iam_role.staging_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# Custom policy for staging instance (updated with explicit ECR permissions)
resource "aws_iam_role_policy" "staging_instance_policy" {
  name = "bianca-staging-instance-policy"
  role = aws_iam_role.staging_instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          # ECR permissions (explicit)
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          
          # Secrets Manager
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          
          # CloudWatch Logs
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          
          # SES permissions
          "ses:GetSendQuota",
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:GetSendStatistics"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM Instance Profile for staging
resource "aws_iam_instance_profile" "staging_profile" {
  name = "bianca-staging-instance-profile"
  role = aws_iam_role.staging_instance_role.name
}

# Staging EC2 Instance (Spot for cost savings)
resource "aws_launch_template" "staging" {
  name_prefix   = "bianca-staging-"
  image_id      = data.aws_ami.amazon_linux_2.id
  instance_type = "t3.small"
  key_name      = var.asterisk_key_pair_name

  vpc_security_group_ids = [aws_security_group.staging.id]
  
  iam_instance_profile {
    name = aws_iam_instance_profile.staging_profile.name
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size = 20
      volume_type = "gp3"
    }
  }

  user_data = base64encode(templatefile("${path.module}/staging-userdata.sh", {
    region         = var.aws_region
    aws_account_id = var.aws_account_id
    environment    = "staging"
  }))

  # Force recreation when userdata changes
  update_default_version = true

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "bianca-staging"
      Environment = "staging"
      AutoStop    = "true"
    }
  }
}

resource "aws_instance" "staging" {
  launch_template {
    id      = aws_launch_template.staging.id
    version = "$Latest"
  }

  subnet_id = aws_subnet.staging_public.id

  # Spot instance configuration
  instance_market_options {
    market_type = "spot"
    spot_options {
      max_price                      = "0.01"
      spot_instance_type            = "one-time"
      instance_interruption_behavior = "terminate"
    }
  }

  tags = {
    Name        = "bianca-staging"
    Environment = "staging"
    AutoStop    = "true"
  }

  # Prevent unnecessary user_data changes from triggering instance updates
  lifecycle {
    ignore_changes = [user_data]
  }
}

# Staging ALB
resource "aws_lb" "staging" {
  name               = "bianca-staging-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.staging.id]
  subnets            = [aws_subnet.staging_public.id, aws_subnet.staging_public_b.id]

  tags = {
    Name        = "bianca-staging-alb"
    Environment = "staging"
  }
}

# API Target Group
resource "aws_lb_target_group" "staging_api" {
  name     = "bianca-staging-api-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.staging.id

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
    Name        = "bianca-staging-api-tg"
    Environment = "staging"
  }
}

# Frontend Target Group (nginx on port 80)
resource "aws_lb_target_group" "staging_frontend" {
  name     = "bianca-staging-frontend-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.staging.id

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
    Name        = "bianca-staging-frontend-tg"
    Environment = "staging"
  }
}

resource "aws_lb_target_group_attachment" "staging_api" {
  target_group_arn = aws_lb_target_group.staging_api.arn
  target_id        = aws_instance.staging.id
  port             = 3000
}

resource "aws_lb_target_group_attachment" "staging_frontend" {
  target_group_arn = aws_lb_target_group.staging_frontend.arn
  target_id        = aws_instance.staging.id
  port             = 80
}

# ALB Listener for HTTP to HTTPS redirect
resource "aws_lb_listener" "staging_http_redirect" {
  load_balancer_arn = aws_lb.staging.arn
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

# S3 Bucket for frontend builds
resource "aws_s3_bucket" "staging_frontend" {
  bucket = "bianca-staging-frontend-${random_string.staging_suffix.result}"

  tags = {
    Name        = "bianca-staging-frontend"
    Environment = "staging"
  }
}

resource "aws_s3_bucket_public_access_block" "staging_frontend" {
  bucket = aws_s3_bucket.staging_frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "staging_frontend" {
  bucket = aws_s3_bucket.staging_frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Random suffix for unique bucket names
resource "random_string" "staging_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Route 53 for staging
resource "aws_route53_record" "staging_api" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "staging-api.myphonefriend.com"
  type    = "A"

  alias {
    name                   = aws_lb.staging.dns_name
    zone_id                = aws_lb.staging.zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "staging_sip" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "staging-sip.myphonefriend.com"
  type    = "A"
  ttl     = 60
  records = [aws_instance.staging.public_ip]
}

# Route 53 for staging frontend
resource "aws_route53_record" "staging_frontend" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "staging.myphonefriend.com"
  type    = "A"

  alias {
    name                   = aws_lb.staging.dns_name
    zone_id                = aws_lb.staging.zone_id
    evaluate_target_health = false
  }
}

# ACM Certificate for staging (uses the same wildcard cert as production)
data "aws_acm_certificate" "staging_cert" {
  domain      = "*.myphonefriend.com"
  statuses    = ["ISSUED"]
  most_recent = true
}

# HTTPS Listener for staging
resource "aws_lb_listener" "staging_https" {
  load_balancer_arn = aws_lb.staging.arn
  port              = "443"
  protocol          = "HTTPS"
  certificate_arn   = data.aws_acm_certificate.staging_cert.arn
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-Ext-2018-06"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.staging_frontend.arn
  }
}

# HTTPS Listener Rule for API traffic
resource "aws_lb_listener_rule" "staging_api_https_rule" {
  listener_arn = aws_lb_listener.staging_https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.staging_api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/health", "/admin/*"]
    }
  }
}

# IAM Role for Lambda auto-stop function
resource "aws_iam_role" "staging_lambda_role" {
  name = "bianca-staging-lambda-auto-stop-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = {
    Environment = "staging"
  }
}

resource "aws_iam_role_policy" "staging_lambda_policy" {
  name = "bianca-staging-lambda-auto-stop-policy"
  role = aws_iam_role.staging_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:StopInstances",
          "ec2:StartInstances",
          "cloudwatch:GetMetricStatistics"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Lambda for auto-stop (saves money)
resource "aws_lambda_function" "staging_auto_stop" {
  filename      = "staging-auto-stop.zip"
  function_name = "bianca-staging-auto-stop"
  role          = aws_iam_role.staging_lambda_role.arn
  handler       = "index.handler"
  runtime       = "python3.9"
  timeout       = 60

  environment {
    variables = {
      INSTANCE_ID = aws_instance.staging.id
    }
  }

  depends_on = [
    aws_iam_role_policy.staging_lambda_policy,
    data.archive_file.staging_auto_stop
  ]
}

data "archive_file" "staging_auto_stop" {
  type        = "zip"
  output_path = "staging-auto-stop.zip"
  
  source {
    content  = <<EOF
import boto3
import os
from datetime import datetime, timedelta

def handler(event, context):
    ec2 = boto3.client('ec2')
    cloudwatch = boto3.client('cloudwatch')
    
    instance_id = os.environ['INSTANCE_ID']
    
    # Check if instance has been idle for 30 minutes
    metrics = cloudwatch.get_metric_statistics(
        Namespace='AWS/EC2',
        MetricName='NetworkIn',
        Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
        StartTime=datetime.utcnow() - timedelta(minutes=30),
        EndTime=datetime.utcnow(),
        Period=1800,
        Statistics=['Sum']
    )
    
    if not metrics['Datapoints'] or sum(dp['Sum'] for dp in metrics['Datapoints']) < 1048576:
        print(f"Stopping idle staging instance {instance_id}")
        ec2.stop_instances(InstanceIds=[instance_id])
        return {'statusCode': 200, 'body': 'Instance stopped'}
    
    return {'statusCode': 200, 'body': 'Instance still active'}
EOF
    filename = "index.py"
  }
}

# CloudWatch Event to check every 30 minutes
resource "aws_cloudwatch_event_rule" "staging_auto_stop" {
  name                = "staging-auto-stop-check"
  schedule_expression = "rate(30 minutes)"
}

resource "aws_cloudwatch_event_target" "staging_auto_stop" {
  rule      = aws_cloudwatch_event_rule.staging_auto_stop.name
  target_id = "StagingAutoStopLambda"
  arn       = aws_lambda_function.staging_auto_stop.arn
}

resource "aws_lambda_permission" "staging_auto_stop" {
  statement_id  = "AllowCloudWatchInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.staging_auto_stop.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.staging_auto_stop.arn
}

################################################################################
# OUTPUTS - Staging
################################################################################

output "staging_instance_ip" {
  value = aws_instance.staging.public_ip
  description = "Staging instance public IP"
}

output "staging_api_url" {
  value = "https://staging-api.myphonefriend.com"
  description = "Staging API URL"
}

output "staging_sip_url" {
  value = "staging-sip.myphonefriend.com"
  description = "Staging SIP URL for Twilio"
}

output "staging_ssh_command" {
  value = "ssh -i ~/.ssh/${var.asterisk_key_pair_name}.pem ec2-user@${aws_instance.staging.public_ip}"
  description = "SSH command to connect to staging"
}

output "staging_monthly_cost" {
  value = "Estimated: $20-30/month (with auto-stop enabled)"
  description = "Staging environment cost estimate"
}

output "staging_frontend_url" {
  value = "https://staging.myphonefriend.com"
  description = "Staging frontend URL"
}

output "staging_frontend_s3_bucket" {
  value = aws_s3_bucket.staging_frontend.bucket
  description = "Staging frontend S3 bucket name"
}