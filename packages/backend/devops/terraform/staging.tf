# staging.tf
# ADD THIS FILE ALONGSIDE YOUR EXISTING main.tf
# This creates a completely separate staging environment

################################################################################
# STAGING RESOURCES - Completely isolated from production
################################################################################

# Staging VPC (separate from production)
resource "aws_vpc" "staging" {
  cidr_block           = "10.1.0.0/16" # Different from production
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
    cidr_blocks = ["0.0.0.0/0"] # Restrict to your IP in production
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

          # CloudWatch Logs (HIPAA-compliant 7-year retention)
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",

          # SES permissions
          "ses:GetSendQuota",
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:GetSendStatistics",

          # SNS permissions for emergency notifications
          "sns:Publish",

          # EC2 permissions for reading instance tags (needed by validate_service.sh to detect green instances)
          "ec2:DescribeInstances",
          "ec2:DescribeTags",

          # HIPAA backup uploads + admin portal Lambda invoke
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject",
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey",
          "lambda:InvokeFunction"
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

# Staging EC2 Instance (On-demand for reliability, same as production)
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
      volume_size = 50 # Increased from 20GB to 50GB to prevent disk space issues
      volume_type = "gp3"
    }
  }

  user_data = base64encode(templatefile("${path.module}/staging-userdata.sh", {
    region         = var.aws_region
    aws_account_id = var.aws_account_id
    environment    = "staging"
    eip_address    = aws_eip.staging.public_ip
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

# Elastic IP for staging instance (prevents IP changes on restart, same as production)
resource "aws_eip" "staging" {
  domain = "vpc"
  tags = {
    Name        = "bianca-staging-eip"
    Environment = "staging"
  }
}

resource "aws_instance" "staging" {
  launch_template {
    id      = aws_launch_template.staging.id
    version = "$Latest"
  }

  subnet_id = aws_subnet.staging_public.id

  # NO SPOT INSTANCE FOR STAGING - Use on-demand for reliability (same as production)
  # REMOVED spot configuration - staging should be reliable for testing

  # Enable detailed monitoring for auto-recovery
  monitoring = true

  # Enable auto-recovery if instance fails health checks
  # This will automatically restart the instance if it becomes impaired
  maintenance_options {
    auto_recovery = "default"
  }

  tags = {
    Name        = "bianca-staging"
    Environment = "staging"
    AutoStop    = "true"
  }

  # Blue/green swap replaces the live instance via CodePipeline; do not recreate on apply.
  lifecycle {
    ignore_changes = [
      launch_template,
      ami,
      monitoring,
      subnet_id,
      instance_type,
      key_name,
      vpc_security_group_ids,
      root_block_device,
      ebs_block_device,
      iam_instance_profile,
    ]
  }
}

# Associate Elastic IP with staging instance
resource "aws_eip_association" "staging" {
  instance_id   = aws_instance.staging.id
  allocation_id = aws_eip.staging.id

  lifecycle {
    ignore_changes = [instance_id]
  }
}

# EBS Volume for MongoDB data persistence.
# Attachment is NOT managed here: blue/green swap detaches/reattaches this volume between
# instances (see buildspec-swap-and-terminate.yml). Managing aws_volume_attachment causes
# VolumeInUse on apply. Volume is identified by tag Name=bianca-staging-mongodb-data.
resource "aws_ebs_volume" "staging_mongodb" {
  availability_zone = aws_subnet.staging_public.availability_zone
  size              = 20 # 20GB should be plenty for staging
  type              = "gp3"

  tags = {
    Name        = "bianca-staging-mongodb-data"
    Environment = "staging"
    Purpose     = "MongoDB data persistence"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# MongoDB data volume attachment is NOT managed here: blue/green swap (buildspec-swap-and-terminate)
# detaches/reattaches this volume between instances. Managing aws_volume_attachment caused
# VolumeInUse on apply. Volume is identified by tag Name=bianca-staging-mongodb-data (see swap env).

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

  lifecycle {
    ignore_changes = [target_id]
  }
}

resource "aws_lb_target_group_attachment" "staging_frontend" {
  target_group_arn = aws_lb_target_group.staging_frontend.arn
  target_id        = aws_instance.staging.id
  port             = 80

  lifecycle {
    ignore_changes = [target_id]
  }
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
# Legacy domain records (myphonefriend.com)
resource "aws_route53_record" "staging_api" {
  zone_id = data.aws_route53_zone.legacy.zone_id
  name    = "staging-api.myphonefriend.com"
  type    = "A"

  alias {
    name                   = aws_lb.staging.dns_name
    zone_id                = aws_lb.staging.zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "staging_sip" {
  zone_id = data.aws_route53_zone.legacy.zone_id
  name    = "staging-sip.myphonefriend.com"
  type    = "A"
  ttl     = 60
  records = [aws_eip.staging.public_ip]
}

# Route 53 for staging frontend
resource "aws_route53_record" "staging_frontend" {
  zone_id = data.aws_route53_zone.legacy.zone_id
  name    = "staging.myphonefriend.com"
  type    = "A"

  alias {
    name                   = aws_lb.staging.dns_name
    zone_id                = aws_lb.staging.zone_id
    evaluate_target_health = false
  }
}

# Primary domain records (biancawellness.com) - Parallel setup
resource "aws_route53_record" "staging_api_primary" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "staging-api.${var.primary_domain}"
  type    = "A"

  alias {
    name                   = aws_lb.staging.dns_name
    zone_id                = aws_lb.staging.zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "staging_sip_primary" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "staging-sip.${var.primary_domain}"
  type    = "A"
  ttl     = 60
  records = [aws_eip.staging.public_ip]
}

resource "aws_route53_record" "staging_frontend_primary" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "staging.${var.primary_domain}"
  type    = "A"

  alias {
    name                   = aws_lb.staging.dns_name
    zone_id                = aws_lb.staging.zone_id
    evaluate_target_health = false
  }
}

# Super-admin console (same ALB + nginx vhost as staging web)
resource "aws_route53_record" "staging_admin_primary" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "staging-admin.${var.primary_domain}"
  type    = "A"

  alias {
    name                   = aws_lb.staging.dns_name
    zone_id                = aws_lb.staging.zone_id
    evaluate_target_health = false
  }
}

# NOTE: Demo subdomain now points to its own infrastructure (see demo.tf)
# This record has been moved to demo.tf for isolation

# ACM Certificate for staging (legacy domain)
data "aws_acm_certificate" "staging_cert" {
  domain      = "*.myphonefriend.com"
  statuses    = ["ISSUED"]
  most_recent = true
}

# HTTPS Listener for staging - supports both domains via SNI
resource "aws_lb_listener" "staging_https" {
  load_balancer_arn = aws_lb.staging.arn
  port              = "443"
  protocol          = "HTTPS"
  certificate_arn   = data.aws_acm_certificate.staging_cert.arn # Legacy cert as default
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-Ext-2018-06"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.staging_frontend.arn
  }
}

# Add primary domain certificate to staging listener (SNI - supports multiple certs)
resource "aws_lb_listener_certificate" "staging_https_primary" {
  listener_arn    = aws_lb_listener.staging_https.arn
  certificate_arn = aws_acm_certificate_validation.primary_domain_cert.certificate_arn
}

# Redirect rules - higher priority (lower number) so redirects happen first
# Redirect staging-api.myphonefriend.com → staging-api.biancawellness.com
resource "aws_lb_listener_rule" "staging_api_redirect" {
  listener_arn = aws_lb_listener.staging_https.arn
  priority     = 50

  action {
    type = "redirect"

    redirect {
      host        = "staging-api.${var.primary_domain}"
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  condition {
    host_header {
      values = ["staging-api.${var.legacy_domain}"]
    }
  }
}

# Redirect staging.myphonefriend.com → staging.biancawellness.com
resource "aws_lb_listener_rule" "staging_frontend_redirect" {
  listener_arn = aws_lb_listener.staging_https.arn
  priority     = 51

  action {
    type = "redirect"

    redirect {
      host        = "staging.${var.primary_domain}"
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  condition {
    host_header {
      values = ["staging.${var.legacy_domain}"]
    }
  }
}

# HTTPS Listener Rule for API traffic - updated to use host header instead of path
resource "aws_lb_listener_rule" "staging_api_https_rule" {
  listener_arn = aws_lb_listener.staging_https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.staging_api.arn
  }

  condition {
    host_header {
      values = ["staging-api.${var.primary_domain}"]
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
          "cloudwatch:GetMetricStatistics",
          "ssm:GetParameter"
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

# Lambda for auto-stop (saves money) — staging + demo EC2 when idle
resource "aws_lambda_function" "staging_auto_stop" {
  filename         = data.archive_file.staging_auto_stop.output_path
  function_name    = "bianca-staging-auto-stop"
  role             = aws_iam_role.staging_lambda_role.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  timeout          = 60
  source_code_hash = data.archive_file.staging_auto_stop.output_base64sha256

  environment {
    variables = {
      # Comma-separated EC2 Name tags; resolves newest running instance per tag (blue/green safe for staging).
      INSTANCE_NAME_TAGS = "bianca-staging,bianca-demo"
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
from botocore.exceptions import ClientError

IDLE_NETWORK_IN_BYTES = 1048576  # 1 MiB over 30 minutes
IDLE_WINDOW_MINUTES = 30


def parse_name_tags():
    raw = os.environ.get('INSTANCE_NAME_TAGS', '').strip()
    if raw:
        return [tag.strip() for tag in raw.split(',') if tag.strip()]
    legacy = os.environ.get('INSTANCE_NAME_TAG', 'bianca-staging').strip()
    return [legacy] if legacy else []


def always_on_param_for_name_tag(name_tag):
    suffix = name_tag.replace('bianca-', '', 1) if name_tag.startswith('bianca-') else name_tag
    return f'/bianca/{suffix}/always-on'


def find_running_instance_id(ec2, name_tag):
    """Return the newest running instance with the given Name tag."""
    resp = ec2.describe_instances(
        Filters=[
            {'Name': 'tag:Name', 'Values': [name_tag]},
            {'Name': 'instance-state-name', 'Values': ['running']},
        ]
    )
    instances = [
        inst
        for reservation in resp.get('Reservations', [])
        for inst in reservation.get('Instances', [])
    ]
    if not instances:
        return None
    instances.sort(key=lambda inst: inst['LaunchTime'], reverse=True)
    return instances[0]['InstanceId']


def is_always_on(ssm, param_name):
    try:
        value = ssm.get_parameter(Name=param_name)['Parameter']['Value']
        return str(value).lower() == 'true'
    except ClientError as err:
        if err.response['Error']['Code'] == 'ParameterNotFound':
            return False
        raise


def maybe_stop_idle_instance(ec2, cloudwatch, ssm, name_tag):
    always_on_param = always_on_param_for_name_tag(name_tag)
    if is_always_on(ssm, always_on_param):
        print(f'Always-on mode enabled for {name_tag} ({always_on_param}); skipping auto-stop')
        return {'name_tag': name_tag, 'action': 'skipped', 'reason': 'always-on'}

    instance_id = find_running_instance_id(ec2, name_tag)
    if not instance_id:
        print(f'No running instance with Name={name_tag}; nothing to stop')
        return {'name_tag': name_tag, 'action': 'none', 'reason': 'not-running'}

    metrics = cloudwatch.get_metric_statistics(
        Namespace='AWS/EC2',
        MetricName='NetworkIn',
        Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
        StartTime=datetime.utcnow() - timedelta(minutes=IDLE_WINDOW_MINUTES),
        EndTime=datetime.utcnow(),
        Period=IDLE_WINDOW_MINUTES * 60,
        Statistics=['Sum']
    )

    network_in = sum(dp['Sum'] for dp in metrics.get('Datapoints', []))
    if network_in < IDLE_NETWORK_IN_BYTES:
        print(f'Stopping idle instance {instance_id} (Name={name_tag}, NetworkIn={network_in})')
        ec2.stop_instances(InstanceIds=[instance_id])
        return {'name_tag': name_tag, 'action': 'stopped', 'instance_id': instance_id, 'network_in': network_in}

    print(f'Instance {instance_id} still active (Name={name_tag}, NetworkIn={network_in})')
    return {'name_tag': name_tag, 'action': 'active', 'instance_id': instance_id, 'network_in': network_in}


def handler(event, context):
    ec2 = boto3.client('ec2')
    cloudwatch = boto3.client('cloudwatch')
    ssm = boto3.client('ssm')

    results = []
    for name_tag in parse_name_tags():
        results.append(maybe_stop_idle_instance(ec2, cloudwatch, ssm, name_tag))

    return {'statusCode': 200, 'body': results}
EOF
    filename = "index.py"
  }
}

# CloudWatch Event to check every 30 minutes
resource "aws_cloudwatch_event_rule" "staging_auto_stop" {
  name                = "staging-auto-stop-check"
  schedule_expression = "rate(30 minutes)"
  state               = "ENABLED"
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
  value       = aws_instance.staging.public_ip
  description = "Staging instance public IP"
}

output "staging_api_url" {
  value       = "https://staging-api.myphonefriend.com"
  description = "Staging API URL"
}

output "staging_sip_url" {
  value       = "staging-sip.myphonefriend.com"
  description = "Staging SIP URL for Twilio"
}

output "staging_ssh_command" {
  value       = "ssh -i ~/.ssh/${var.asterisk_key_pair_name}.pem ec2-user@${aws_instance.staging.public_ip}"
  description = "SSH command to connect to staging"
}

output "staging_monthly_cost" {
  value       = "Estimated: $20-30/month (with auto-stop enabled)"
  description = "Staging environment cost estimate"
}

output "staging_frontend_url" {
  value       = "https://staging.myphonefriend.com"
  description = "Staging frontend URL"
}

output "staging_frontend_s3_bucket" {
  value       = aws_s3_bucket.staging_frontend.bucket
  description = "Staging frontend S3 bucket name"
}

output "staging_mongodb_volume_id" {
  value       = aws_ebs_volume.staging_mongodb.id
  description = "EBS volume ID for staging MongoDB data (persistent across instance replacements)"
}

output "staging_mongodb_volume_tag" {
  value       = aws_ebs_volume.staging_mongodb.tags["Name"]
  description = "Name tag used by blue/green swap to find the staging MongoDB volume"
}

################################################################################
# CloudWatch Log Groups for HIPAA Compliance (7-year retention)
################################################################################

# Staging application logs (Docker containers)
resource "aws_cloudwatch_log_group" "staging_app_logs" {
  name              = "/bianca/staging/app"
  retention_in_days = 2557 # 7 years for HIPAA compliance (§164.316(b)(2)(i)) - closest valid value

  tags = {
    Name        = "bianca-staging-app-logs"
    Environment = "staging"
    HIPAA       = "true"
  }
}

resource "aws_cloudwatch_log_group" "staging_mongodb_logs" {
  name              = "/bianca/staging/mongodb"
  retention_in_days = 2557 # 7 years for HIPAA compliance

  tags = {
    Name        = "bianca-staging-mongodb-logs"
    Environment = "staging"
    HIPAA       = "true"
  }
}

resource "aws_cloudwatch_log_group" "staging_asterisk_logs" {
  name              = "/bianca/staging/asterisk"
  retention_in_days = 2557 # 7 years for HIPAA compliance

  tags = {
    Name        = "bianca-staging-asterisk-logs"
    Environment = "staging"
    HIPAA       = "true"
  }
}

resource "aws_cloudwatch_log_group" "staging_nginx_logs" {
  name              = "/bianca/staging/nginx"
  retention_in_days = 2557 # 7 years for HIPAA compliance

  tags = {
    Name        = "bianca-staging-nginx-logs"
    Environment = "staging"
    HIPAA       = "true"
  }
}

resource "aws_cloudwatch_log_group" "staging_frontend_logs" {
  name              = "/bianca/staging/frontend"
  retention_in_days = 2557 # 7 years for HIPAA compliance

  tags = {
    Name        = "bianca-staging-frontend-logs"
    Environment = "staging"
    HIPAA       = "true"
  }
}

################################################################################
# SES Bounce/Complaint Notifications (SNS)
################################################################################

# SNS Topic for SES bounce and complaint notifications
resource "aws_sns_topic" "ses_bounce_complaint_notifications" {
  name = "bianca-staging-ses-bounce-complaint"

  tags = {
    Name        = "bianca-staging-ses-bounce-complaint"
    Environment = "staging"
    Purpose     = "SES bounce and complaint notifications"
  }
}

# Subscribe email address to receive bounce/complaint notifications
resource "aws_sns_topic_subscription" "ses_bounce_complaint_email" {
  topic_arn = aws_sns_topic.ses_bounce_complaint_notifications.arn
  protocol  = "email"
  endpoint  = "jlapp@biancatechnologies.com" # Change this to your monitoring email

  # Note: AWS will send a confirmation email that must be clicked
}

# Configure SES to send bounce notifications to SNS
resource "aws_ses_identity_notification_topic" "bounce_notification" {
  topic_arn                = aws_sns_topic.ses_bounce_complaint_notifications.arn
  notification_type        = "Bounce"
  identity                 = "myphonefriend.com"
  include_original_headers = true
}

# Configure SES to send complaint notifications to SNS
resource "aws_ses_identity_notification_topic" "complaint_notification" {
  topic_arn                = aws_sns_topic.ses_bounce_complaint_notifications.arn
  notification_type        = "Complaint"
  identity                 = "myphonefriend.com"
  include_original_headers = true
}