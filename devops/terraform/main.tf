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

variable "vpc_id" {
  description = "ID of the VPC where resources will be deployed."
  type        = string
  default     = "vpc-05c16725411127dc3"
}

variable "subnet_ids" {
  description = "List of subnet IDs for placing resources like Fargate tasks and Load Balancers."
  type        = list(string)
  default     = ["subnet-016b6aba534de1845", "subnet-0c7b38f9439f97b3e", "subnet-006892e47fe84433f"]
}

variable "cluster_name" {
  description = "Name for the ECS cluster."
  type        = string
  default     = "bianca-cluster"
}

# --- Application Service (bianca-app-backend) Variables ---
variable "service_name" {
  description = "Name for the main application ECS service (e.g., bianca-app)."
  type        = string
  default     = "bianca-service"
}

variable "container_name" {
  description = "Name of the main application container (e.g., bianca-app-backend)."
  type        = string
  default     = "bianca-app-backend"
}

variable "container_port" {
  description = "Port the main application container listens on for HTTP traffic."
  type        = number
  default     = 3000
}

variable "app_rtp_listener_port" {
  description = "UDP port for the application's RTP listener service."
  type        = number
  default     = 16384
}

variable "repository_name" {
  description = "Name of the ECR repository for the main application."
  type        = string
  default     = "bianca-app-backend"
}

# --- Asterisk Service Variables ---
variable "asterisk_service_name" {
  description = "Name for the Asterisk ECS service."
  type        = string
  default     = "asterisk-sip-service"
}

variable "asterisk_container_name" {
  description = "Name of the Asterisk container."
  type        = string
  default     = "asterisk"
}

variable "asterisk_ecr_repo_name" {
  description = "Name of the ECR repository for the Asterisk image."
  type        = string
  default     = "bianca-app-asterisk"
}

variable "asterisk_sip_udp_port" {
  description = "UDP port for Asterisk SIP."
  type        = number
  default     = 5060
}

variable "asterisk_sip_tcp_port" {
  description = "TCP port for Asterisk SIP."
  type        = number
  default     = 5061
}

variable "asterisk_ari_http_port" {
  description = "TCP port for Asterisk ARI HTTP interface."
  type        = number
  default     = 8088
}

variable "asterisk_rtp_start_port" {
  description = "Start of the UDP port range for Asterisk RTP."
  type        = number
  default     = 10000
}

variable "asterisk_rtp_end_port" {
  description = "End of the UDP port range for Asterisk RTP."
  type        = number
  default     = 10100
}

# --- MongoDB Variables ---
variable "mongodb_port" {
  description = "TCP port for MongoDB."
  type        = number
  default     = 27017
}

# --- EFS Variables ---
variable "efs_nfs_port" {
  description = "TCP port for EFS (NFS)."
  type        = number
  default     = 2049
}

# --- Load Balancer Variables ---
variable "load_balancer_name" {
  description = "Name for the Application Load Balancer."
  type        = string
  default     = "bianca-load-balancer"
}

variable "sip_nlb_name" {
  description = "Name for the Network Load Balancer for SIP/RTP."
  type        = string
  default     = "bianca-sip-nlb"
}

# --- CodePipeline & Build Variables ---
variable "bucket_name" {
  description = "Name of the S3 bucket for CodePipeline artifacts."
  type        = string
  default     = "bianca-codepipeline-artifact-bucket"
}

variable "codepipeline_role_name" {
  description = "Name for the CodePipeline IAM role."
  type        = string
  default     = "CodePipelineServiceRole"
}

variable "codebuild_role_name" {
  description = "Name for the CodeBuild IAM role."
  type        = string
  default     = "CodeBuildServiceRole"
}

variable "ecs_execution_role_name" {
  description = "Name for the ECS task execution IAM role."
  type        = string
  default     = "ecsTaskExecutionRole"
}

variable "ecs_task_role_name" {
  description = "Name for the ECS task IAM role (for application permissions)."
  type        = string
  default     = "ecsTaskRole"
}

variable "github_owner" {
  description = "GitHub repository owner."
  type        = string
  default     = "slampenny"
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
  default     = "bianca-app-backend"
}

variable "github_branch" {
  description = "GitHub branch for CodePipeline."
  type        = string
  default     = "asterisk-remote"
}

variable "github_app_connection_arn" {
  description = "ARN of the AWS CodeStar connection to GitHub."
  type        = string
  default     = "arn:aws:codeconnections:us-east-2:730335291008:connection/a126dbfd-f253-42e4-811b-cda3ebd5a629"
}

# --- Secrets Manager Variables ---
variable "secrets_manager_secret_name" {
  description = "Name of the secret in AWS Secrets Manager."
  type        = string
  default     = "MySecretsManagerSecret"
}

# --- Allowed IP Ranges ---
variable "twilio_ip_ranges" {
  description = "List of Twilio SIP signaling IP CIDR ranges."
  type        = list(string)
  default = [
    "54.172.60.0/23", "34.203.250.0/23", "34.216.110.128/25",
    "54.244.51.0/24", "54.171.127.192/26", "35.156.191.128/26",
    "54.65.63.192/26", "54.169.127.128/26", "54.252.254.64/26",
    "177.71.206.192/26"
  ]
}

variable "bianca_client_static_ips" {
  description = "List of static IP addresses or CIDR ranges for your Bianca client(s)."
  type        = list(string)
  default     = ["3.141.235.83/32"]
}

################################################################################
# DATA SOURCES
################################################################################

data "aws_secretsmanager_secret" "app_secret" {
  name = var.secrets_manager_secret_name
}

data "aws_subnet" "vpc_task_subnets" {
  for_each = toset(var.subnet_ids)
  id       = each.value
}

data "aws_route53_zone" "myphonefriend" {
  name         = "myphonefriend.com."
  private_zone = false
}

data "aws_acm_certificate" "app_cert" {
  domain      = "*.myphonefriend.com"
  statuses    = ["ISSUED"]
  most_recent = true
}

################################################################################
# SERVICE DISCOVERY (AWS Cloud Map)
################################################################################

# Renamed resource block back to 'internal' to match existing state if possible,
# or ensure this is the intended name if creating a new namespace.
resource "aws_service_discovery_private_dns_namespace" "internal" {
  name        = "myphonefriend.internal" # This is the actual DNS namespace name
  description = "Private DNS namespace for internal services"
  vpc         = var.vpc_id
  tags        = { Name = "myphonefriend-internal-namespace" }
}

resource "aws_service_discovery_service" "asterisk_sd_service" {
  name = "asterisk"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.internal.id # References the namespace above
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 10
      type = "A"
    }
  }
  tags = { Name = "asterisk-service-discovery" }
}

resource "aws_service_discovery_service" "bianca_app_sd_service" {
  name = "bianca-app"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.internal.id # References the namespace above
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 10
      type = "A"
    }
  }
  tags = { Name = "bianca-app-service-discovery" }
}

################################################################################
# SECURITY GROUPS
################################################################################

resource "aws_security_group" "alb_sg" {
  name        = "alb-sg"
  description = "Security group for the Application Load Balancer" # Keeping new description
  vpc_id      = var.vpc_id

  lifecycle {
    ignore_changes = [description, tags, tags_all] # Prevent replacement on metadata change
  }

  ingress {
    description = "Allow HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTPS from anywhere"
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
  tags = { Name = "alb-sg" }
}

resource "aws_security_group" "bianca_app_sg" {
  name        = "bianca-app-sg"
  description = "Security group for Bianca application ECS tasks" # Keeping new description
  vpc_id      = var.vpc_id

  lifecycle {
    ignore_changes = [description, tags, tags_all] # Prevent replacement on metadata change
  }

  ingress {
    description     = "Allow ALB traffic on App HTTP Port"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  ingress {
    description = "Allow UDP for RTP listener from Asterisk service (tasks in VPC subnets)"
    from_port   = var.app_rtp_listener_port
    to_port     = var.app_rtp_listener_port
    protocol    = "udp"
    cidr_blocks = [for s in data.aws_subnet.vpc_task_subnets : s.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "bianca-app-sg" }
}

resource "aws_security_group" "asterisk_sg" {
  name        = "asterisk-sg"
  description = "Security group for Asterisk ECS tasks" # Keeping new description
  vpc_id      = var.vpc_id

  lifecycle {
    ignore_changes = [description, tags, tags_all] # Prevent replacement on metadata change
  }

  ingress {
    from_port   = var.asterisk_sip_udp_port
    to_port     = var.asterisk_sip_udp_port
    protocol    = "udp"
    cidr_blocks = concat(var.twilio_ip_ranges, var.bianca_client_static_ips)
    description = "SIP UDP from Twilio & Bianca Client (via NLB)"
  }

  ingress {
    from_port   = var.asterisk_sip_udp_port
    to_port     = var.asterisk_sip_udp_port
    protocol    = "udp"
    cidr_blocks = [for s in data.aws_subnet.vpc_task_subnets : s.cidr_block]
    description = "Allow NLB UDP Health Check for Asterisk SIP UDP"
  }

  ingress {
    from_port   = var.asterisk_sip_tcp_port
    to_port     = var.asterisk_sip_tcp_port
    protocol    = "tcp"
    cidr_blocks = concat(var.twilio_ip_ranges, var.bianca_client_static_ips)
    description = "SIP TCP from Twilio & Bianca Client (via NLB)"
  }

  ingress {
    from_port   = var.asterisk_sip_tcp_port
    to_port     = var.asterisk_sip_tcp_port
    protocol    = "tcp"
    cidr_blocks = [for s in data.aws_subnet.vpc_task_subnets : s.cidr_block]
    description = "Allow NLB TCP Health Check for Asterisk SIP TCP"
  }

  ingress {
    from_port   = var.asterisk_rtp_start_port
    to_port     = var.asterisk_rtp_end_port
    protocol    = "udp"
    cidr_blocks = concat(var.twilio_ip_ranges, var.bianca_client_static_ips)
    description = "RTP UDP from Twilio & Bianca Client (via NLB)"
  }

  ingress {
    from_port   = var.asterisk_rtp_start_port
    to_port     = var.asterisk_rtp_start_port
    protocol    = "udp"
    cidr_blocks = [for s in data.aws_subnet.vpc_task_subnets : s.cidr_block]
    description = "Allow NLB UDP Health Check for Asterisk RTP"
  }

  ingress {
    from_port       = var.asterisk_ari_http_port
    to_port         = var.asterisk_ari_http_port
    protocol        = "tcp"
    security_groups = [aws_security_group.bianca_app_sg.id]
    description     = "ARI access from Bianca App Backend"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "asterisk-sg" }
}

resource "aws_security_group" "efs_sg" {
  name        = "mongodb-efs-sg"
  description = "Allow NFS traffic from ECS tasks to EFS"
  vpc_id      = var.vpc_id

  ingress {
    description     = "NFS from Bianca App ECS tasks"
    from_port       = var.efs_nfs_port
    to_port         = var.efs_nfs_port
    protocol        = "tcp"
    security_groups = [aws_security_group.bianca_app_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "mongodb-efs-sg" }
}

resource "aws_security_group" "sip_nlb_sg" {
  name        = "sip-nlb-sg"
  description = "Security group for SIP Network Load Balancer"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = var.asterisk_sip_udp_port
    to_port     = var.asterisk_sip_udp_port
    protocol    = "udp"
    cidr_blocks = concat(var.twilio_ip_ranges, var.bianca_client_static_ips)
    description = "SIP UDP from Twilio & Bianca Client to NLB"
  }

  ingress {
    from_port   = var.asterisk_sip_tcp_port
    to_port     = var.asterisk_sip_tcp_port
    protocol    = "tcp"
    cidr_blocks = concat(var.twilio_ip_ranges, var.bianca_client_static_ips)
    description = "SIP TCP from Twilio & Bianca Client to NLB"
  }

  ingress {
    from_port   = var.asterisk_rtp_start_port
    to_port     = var.asterisk_rtp_end_port
    protocol    = "udp"
    cidr_blocks = concat(var.twilio_ip_ranges, var.bianca_client_static_ips)
    description = "RTP UDP from Twilio & Bianca Client to NLB"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "sip-nlb-sg" }
}

################################################################################
# EFS (for MongoDB Persistence)
################################################################################

resource "aws_efs_file_system" "mongodb_data" {
  creation_token = "mongodb-data-${var.cluster_name}"
  tags           = { Name = "MongoDB Data for ${var.cluster_name}" }
}

resource "aws_efs_access_point" "mongo_ap" {
  file_system_id = aws_efs_file_system.mongodb_data.id
  posix_user {
    uid = 999
    gid = 999
  }
  root_directory {
    path = "/mongodb"
    creation_info {
      owner_uid   = 999
      owner_gid   = 999
      permissions = "700"
    }
  }
  tags = { Name = "MongoDB Access Point for ${var.cluster_name}" }
}

resource "aws_efs_mount_target" "mongodb_mount" {
  count           = length(var.subnet_ids)
  file_system_id  = aws_efs_file_system.mongodb_data.id
  subnet_id       = var.subnet_ids[count.index]
  security_groups = [aws_security_group.efs_sg.id]
}

resource "aws_efs_file_system_policy" "mongodb_policy" {
  file_system_id = aws_efs_file_system.mongodb_data.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowECSAccess"
        Effect = "Allow"
        Principal = {
          AWS = "*" # Consider restricting to your ECS Task Role ARN
        }
        Action = [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite"
        ]
        Resource  = aws_efs_file_system.mongodb_data.arn
        Condition = { Bool = { "aws:SecureTransport" = "true" } }
      }
    ]
  })
}

################################################################################
# APPLICATION LOAD BALANCER (ALB) - For Bianca App HTTP/S Traffic
################################################################################

resource "aws_lb" "app_lb" {
  name               = var.load_balancer_name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = var.subnet_ids
  tags               = { Name = var.load_balancer_name }
}

resource "aws_lb_target_group" "app_tg" {
  name        = "bianca-target-group" # Reverted to old name from plan to avoid replacement
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 2
  }
  tags = { Name = "bianca-target-group" } # Match the name
}

resource "aws_lb_listener" "http_listener" {
  load_balancer_arn = aws_lb.app_lb.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn
  }
}

resource "aws_lb_listener" "https_listener" {
  load_balancer_arn = aws_lb.app_lb.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = data.aws_acm_certificate.app_cert.arn
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-Ext-2018-06"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn
  }
}

################################################################################
# NETWORK LOAD BALANCER (NLB) - For SIP/RTP Traffic
################################################################################

resource "aws_eip" "sip_eip" {
  domain = "vpc"
  tags   = { Name = "bianca-sip-eip" }
}

resource "aws_lb" "sip_lb" {
  name                             = var.sip_nlb_name
  internal                         = false
  load_balancer_type               = "network"
  enable_cross_zone_load_balancing = true
  security_groups                  = [aws_security_group.sip_nlb_sg.id]

  subnet_mapping {
    subnet_id     = var.subnet_ids[0]
    allocation_id = aws_eip.sip_eip.id
  }
  dynamic "subnet_mapping" {
    for_each = length(var.subnet_ids) > 1 ? slice(var.subnet_ids, 1, length(var.subnet_ids)) : []
    content {
      subnet_id = subnet_mapping.value
    }
  }
  tags = { Name = var.sip_nlb_name }
}

resource "aws_lb_target_group" "sip_udp_tg" {
  name               = "sip-udp-tg"
  port               = var.asterisk_sip_udp_port
  protocol           = "UDP"
  vpc_id             = var.vpc_id
  target_type        = "ip"
  preserve_client_ip = true

  health_check {
    protocol            = "TCP"
    port                = var.asterisk_sip_tcp_port
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 30
  }
  tags = { Name = "sip-udp-tg" }
}

resource "aws_lb_target_group" "sip_tcp_tg" {
  name               = "sip-tcp-tg"
  port               = var.asterisk_sip_tcp_port
  protocol           = "TCP"
  vpc_id             = var.vpc_id
  target_type        = "ip"
  preserve_client_ip = true

  health_check {
    protocol            = "TCP"
    port                = var.asterisk_sip_tcp_port
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 30
  }
  tags = { Name = "sip-tcp-tg" }
}

resource "aws_lb_target_group" "rtp_udp_tg" {
  name               = "rtp-udp-tg"
  port               = var.asterisk_rtp_start_port
  protocol           = "UDP"
  vpc_id             = var.vpc_id
  target_type        = "ip"
  preserve_client_ip = true

  health_check {
    protocol            = "TCP"
    port                = var.asterisk_sip_tcp_port
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 30
  }
  tags = { Name = "rtp-udp-tg" }
}

resource "aws_lb_listener" "sip_udp_listener" {
  load_balancer_arn = aws_lb.sip_lb.arn
  port              = var.asterisk_sip_udp_port
  protocol          = "UDP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.sip_udp_tg.arn
  }
}

resource "aws_lb_listener" "sip_tcp_listener" {
  load_balancer_arn = aws_lb.sip_lb.arn
  port              = var.asterisk_sip_tcp_port
  protocol          = "TCP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.sip_tcp_tg.arn
  }
}

resource "aws_lb_listener" "rtp_udp_listener" {
  load_balancer_arn = aws_lb.sip_lb.arn
  port              = var.asterisk_rtp_start_port
  protocol          = "UDP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.rtp_udp_tg.arn
  }
}

################################################################################
# ECS (Cluster, Task Definitions, Services)
################################################################################

resource "aws_ecs_cluster" "cluster" {
  name = var.cluster_name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = { Name = var.cluster_name }
}

resource "aws_ecs_task_definition" "asterisk_task" {
  family                   = var.asterisk_service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = var.asterisk_container_name
      image     = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.asterisk_ecr_repo_name}:latest"
      essential = true
      portMappings = concat(
        [
          { containerPort = var.asterisk_sip_udp_port, hostPort = var.asterisk_sip_udp_port, protocol = "udp" },
          { containerPort = var.asterisk_sip_tcp_port, hostPort = var.asterisk_sip_tcp_port, protocol = "tcp" },
          { containerPort = var.asterisk_ari_http_port, hostPort = var.asterisk_ari_http_port, protocol = "tcp" }
        ],
        [
          for port in range(var.asterisk_rtp_start_port, var.asterisk_rtp_end_port + 1) : {
            containerPort = port
            hostPort      = port
            protocol      = "udp"
          }
        ]
      )
      environment = [
        { name = "EXTERNAL_ADDRESS", value = aws_eip.sip_eip.public_ip }
      ]
      secrets = [
        { name = "ARI_PASSWORD", valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:ARI_PASSWORD::" },
        { name = "BIANCA_PASSWORD", valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:BIANCA_PASSWORD::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.asterisk_log_group.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "asterisk"
        }
      }
    }
  ])
  tags = { Name = var.asterisk_service_name }
}

resource "aws_ecs_service" "asterisk_service" {
  name                               = var.asterisk_service_name
  cluster                            = aws_ecs_cluster.cluster.id
  task_definition                    = aws_ecs_task_definition.asterisk_task.arn # Corrected: Task definition name
  launch_type                        = "FARGATE"
  desired_count                      = 1
  enable_execute_command             = true
  deployment_controller              { type = "ECS" }
  health_check_grace_period_seconds  = 120

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.asterisk_sg.id]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.asterisk_sd_service.arn
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.sip_udp_tg.arn
    container_name   = var.asterisk_container_name
    container_port   = var.asterisk_sip_udp_port
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.sip_tcp_tg.arn
    container_name   = var.asterisk_container_name
    container_port   = var.asterisk_sip_tcp_port
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.rtp_udp_tg.arn
    container_name   = var.asterisk_container_name
    container_port   = var.asterisk_rtp_start_port
  }

  depends_on = [
    aws_lb_listener.sip_udp_listener,
    aws_lb_listener.sip_tcp_listener,
    aws_lb_listener.rtp_udp_listener,
    aws_service_discovery_service.asterisk_sd_service,
    aws_security_group.asterisk_sg
  ]
  tags = { Name = var.asterisk_service_name }
}

resource "aws_ecs_task_definition" "app_task" {
  family                   = var.service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  volume {
    name = "mongodb-data"
    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.mongodb_data.id
      transit_encryption = "ENABLED"
      authorization_config {
        access_point_id = aws_efs_access_point.mongo_ap.id
      }
    }
  }

  container_definitions = jsonencode([
    { # Bianca App Backend (Node.js)
      name      = var.container_name
      image     = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.repository_name}:latest"
      essential = true
      portMappings = [
        { containerPort = var.container_port, hostPort = var.container_port, protocol = "tcp" },
        { containerPort = var.app_rtp_listener_port, hostPort = var.app_rtp_listener_port, protocol = "udp" }
      ]
      environment = [
        { name = "AWS_REGION", value = var.aws_region },
        { name = "MONGODB_URL", value = "mongodb://localhost:${var.mongodb_port}/${var.service_name}" }, # Corrected DB name
        { name = "NODE_ENV", value = "production" },
        { name = "WBSOCKET_URL", value = "wss://app.myphonefriend.com" },
        { name = "RTP_LISTENER_PORT", value = tostring(var.app_rtp_listener_port) },
        { name = "ASTERISK_URL", value = "http://asterisk.${aws_service_discovery_private_dns_namespace.internal.name}:${var.asterisk_ari_http_port}" }, # Corrected namespace ref
        { name = "RTP_LISTENER_HOST", value = "bianca-app.${aws_service_discovery_private_dns_namespace.internal.name}" },
        { name = "AWS_SES_REGION", value = var.aws_region }
      ]
      secrets = [
        { name = "JWT_SECRET", valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:JWT_SECRET::" },
        { name = "OPENAI_API_KEY", valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:OPENAI_API_KEY::" },
        { name = "TWILIO_PHONENUMBER", valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:TWILIO_PHONENUMBER::" },
        { name = "TWILIO_ACCOUNTSID", valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:TWILIO_ACCOUNTSID::" },
        { name = "TWILIO_AUTHTOKEN", valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:TWILIO_AUTHTOKEN::" },
        { name = "STRIPE_SECRET_KEY", valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:STRIPE_SECRET_KEY::" },
        { name = "STRIPE_PUBLISHABLE_KEY", valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:STRIPE_PUBLISHABLE_KEY::" },
        { name = "ASTERISK_PASSWORD", valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:ARI_PASSWORD::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app_log_group.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "app"
        }
      }
      dependsOn = [{ "containerName" : "mongodb", "condition" : "HEALTHY" }]
    },
    { # MongoDB Container
      name      = "mongodb"
      image     = "mongo:4.4"
      essential = true
      portMappings = [
        { containerPort = var.mongodb_port, protocol = "tcp" }
      ]
      # mountPoints = [
      #   { sourceVolume = "mongodb-data", containerPath = "/data/db", readOnly = false }
      # ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.mongodb_log_group.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "mongo"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "mongo --eval 'db.adminCommand(\"ping\")' || exit 1"]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 60
      }
    }
  ])
  tags = { Name = var.service_name }
}

resource "aws_ecs_service" "app_service" {
  name                               = var.service_name
  cluster                            = aws_ecs_cluster.cluster.id
  task_definition                    = aws_ecs_task_definition.app_task.arn
  launch_type                        = "FARGATE"
  desired_count                      = 1
  deployment_controller              { type = "ECS" }
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 50
  enable_execute_command             = true
  health_check_grace_period_seconds  = 120

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.bianca_app_sg.id]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.bianca_app_sd_service.arn
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app_tg.arn
    container_name   = var.container_name
    container_port   = var.container_port
  }

  lifecycle { ignore_changes = [desired_count] }

  depends_on = [
    aws_lb_listener.http_listener,
    aws_lb_listener.https_listener,
    aws_service_discovery_service.bianca_app_sd_service,
    aws_security_group.bianca_app_sg
  ]
  tags = { Name = var.service_name }
}

################################################################################
# ECR & S3 (Artifacts)
################################################################################

resource "aws_s3_bucket" "artifact_bucket" {
  bucket = var.bucket_name
  tags   = { Name = var.bucket_name }
}

resource "aws_ecr_repository" "app_repo" {
  name                 = var.repository_name
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  tags                 = { Name = var.repository_name }
}

resource "aws_ecr_repository" "asterisk_repo" {
  name                 = var.asterisk_ecr_repo_name
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  tags                 = { Name = var.asterisk_ecr_repo_name }
}

################################################################################
# CloudWatch Log Groups
################################################################################

resource "aws_cloudwatch_log_group" "app_log_group" {
  name              = "/ecs/${var.container_name}"
  retention_in_days = 14
  tags              = { Name = "${var.container_name}-logs" }
}

resource "aws_cloudwatch_log_group" "mongodb_log_group" {
  name              = "/ecs/mongodb"
  retention_in_days = 14
  tags              = { Name = "mongodb-logs" }
}

resource "aws_cloudwatch_log_group" "asterisk_log_group" {
  name              = "/ecs/${var.asterisk_container_name}"
  retention_in_days = 14
  tags              = { Name = "${var.asterisk_container_name}-logs" }
}

################################################################################
# IAM ROLES & POLICIES
################################################################################

resource "aws_iam_role" "ecs_execution_role" {
  name               = var.ecs_execution_role_name
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
  tags = { Name = var.ecs_execution_role_name }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy_attachment" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_policy" "ecs_execution_secrets_policy" {
  name        = "ECSTaskExecutionSecretsManagerPolicy"
  description = "Allows ECS tasks to get secrets from Secrets Manager for env vars"
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:${var.secrets_manager_secret_name}-*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_secrets_policy_attach" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.ecs_execution_secrets_policy.arn
}

resource "aws_iam_role" "ecs_task_role" {
  name               = var.ecs_task_role_name
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
  tags = { Name = var.ecs_task_role_name }
}

resource "aws_iam_policy" "ecs_task_exec_policy" {
  name        = "ECSTaskExecPolicy"
  description = "Allows ECS Exec functionality"
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel"
      ]
      Resource = "*"
    }]
  })
}
resource "aws_iam_role_policy_attachment" "ecs_task_exec_policy_attach" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_exec_policy.arn
}

resource "aws_iam_policy" "ecs_task_secrets_policy" {
  name        = "ECSTaskSecretsManagerPolicyForApp"
  description = "Allows ECS tasks to get secrets from Secrets Manager (for application use)"
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:${var.secrets_manager_secret_name}-*"
    }]
  })
}
resource "aws_iam_role_policy_attachment" "ecs_task_secrets_policy_attach" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_secrets_policy.arn
}

resource "aws_iam_policy" "ecs_task_ses_policy" {
  name        = "ECSTaskSESPolicy"
  description = "Allows ECS tasks to send email via SES"
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action = [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ]
      Resource = "*"
    }]
  })
}
resource "aws_iam_role_policy_attachment" "ecs_task_ses_policy_attach" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_ses_policy.arn
}

data "aws_iam_policy_document" "codebuild_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}
resource "aws_iam_role" "codebuild_role" {
  name               = var.codebuild_role_name
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume_role_policy.json
  tags               = { Name = var.codebuild_role_name }
}

resource "aws_iam_policy" "codebuild_ecr_policy" {
  name        = "CodeBuildECRPolicy"
  description = "Allow CodeBuild to push Docker images to ECR"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      { Sid = "AllowECRAuth", Effect = "Allow", Action = "ecr:GetAuthorizationToken", Resource = "*" },
      {
        Sid    = "AllowECRImagePush",
        Effect = "Allow",
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:PutImage",
          "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload",
          "ecr:BatchGetImage", "ecr:GetRepositoryPolicy", "ecr:DescribeRepositories"
        ],
        Resource = [aws_ecr_repository.app_repo.arn, aws_ecr_repository.asterisk_repo.arn]
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "codebuild_ecr_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_ecr_policy.arn
}

resource "aws_iam_policy" "codebuild_ecs_task_def_policy" {
  name        = "CodeBuildECSTaskDefPolicy"
  description = "Allow CodeBuild to register and describe ECS task definitions"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      { Effect = "Allow", Action = "ecs:RegisterTaskDefinition", Resource = "*" },
      { Effect = "Allow", Action = "ecs:DescribeTaskDefinition", Resource = "*" }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "codebuild_ecs_task_def_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_ecs_task_def_policy.arn
}

resource "aws_iam_policy" "codebuild_pass_role_policy" {
  name        = "CodeBuildPassRolePolicy"
  description = "Allow CodeBuild to pass ECS task execution and task roles"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      { Effect = "Allow", Action = "iam:PassRole", Resource = aws_iam_role.ecs_execution_role.arn },
      { Effect = "Allow", Action = "iam:PassRole", Resource = aws_iam_role.ecs_task_role.arn }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "codebuild_pass_role_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_pass_role_policy.arn
}

resource "aws_iam_policy" "codebuild_logs_policy" {
  name        = "CodeBuildLogsPolicy"
  description = "Allow CodeBuild to write logs to CloudWatch"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/codebuild/${aws_codebuild_project.bianca_project.name}:*"
    }]
  })
}
resource "aws_iam_role_policy_attachment" "codebuild_logs_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_logs_policy.arn
}

resource "aws_iam_policy" "codebuild_s3_artifact_policy" {
  name        = "CodeBuildS3ArtifactPolicy"
  description = "Allow CodeBuild to access S3 artifact bucket"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject", "s3:GetBucketAcl", "s3:GetBucketLocation"],
      Resource = [aws_s3_bucket.artifact_bucket.arn, "${aws_s3_bucket.artifact_bucket.arn}/*"]
    }]
  })
}
resource "aws_iam_role_policy_attachment" "codebuild_s3_artifact_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_s3_artifact_policy.arn
}

resource "aws_iam_role" "codepipeline_role" {
  name               = var.codepipeline_role_name
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "codepipeline.amazonaws.com" }
    }]
  })
  tags = { Name = var.codepipeline_role_name }

  inline_policy {
    name = "CodePipelineBasePermissions"
    policy = jsonencode({
      Version = "2012-10-17",
      Statement = [
        {
          Effect   = "Allow",
          Action   = ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject", "s3:ListBucket"],
          Resource = [aws_s3_bucket.artifact_bucket.arn, "${aws_s3_bucket.artifact_bucket.arn}/*"]
        },
        {
          Effect   = "Allow",
          Action   = ["codebuild:StartBuild", "codebuild:StopBuild", "codebuild:BatchGetBuilds"],
          Resource = aws_codebuild_project.bianca_project.arn
        },
        {
          Effect   = "Allow",
          Action   = ["ecs:DescribeServices", "ecs:UpdateService", "ecs:DescribeTaskDefinition"],
          Resource = [
            aws_ecs_service.app_service.id,
            aws_ecs_service.asterisk_service.id,
            "arn:aws:ecs:${var.aws_region}:${var.aws_account_id}:task-definition/*"
          ]
        },
        {
          Effect    = "Allow",
          Action    = "iam:PassRole",
          Resource  = [aws_iam_role.ecs_execution_role.arn, aws_iam_role.ecs_task_role.arn],
          Condition = { StringEqualsIfExists = { "iam:PassedToService" = "ecs-tasks.amazonaws.com" } }
        },
        {
          Effect   = "Allow",
          Action   = "codestar-connections:UseConnection",
          Resource = var.github_app_connection_arn
        },
        {
          Effect   = "Allow",
          Action   = "secretsmanager:GetSecretValue",
          Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:${var.secrets_manager_secret_name}-*"
        }
      ]
    })
  }
}

resource "aws_iam_role_policy_attachment" "codepipeline_temp_ecs_full_attach" {
  role       = aws_iam_role.codepipeline_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonECS_FullAccess" # TODO: Remove this after fine-tuning permissions
}

################################################################################
# CODEBUILD PROJECT
################################################################################

resource "aws_codebuild_project" "bianca_project" {
  name         = "bianca-app-build"
  description  = "Builds Docker images for Bianca application and Asterisk, prepares ECS deployment artifacts"
  service_role = aws_iam_role.codebuild_role.arn

  artifacts { type = "CODEPIPELINE" }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true
    image_pull_credentials_type = "CODEBUILD"
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "devops/buildspec.yml"
  }

  logs_config {
    cloudwatch_logs { status = "ENABLED" }
  }
  tags = { Name = "bianca-app-build" }
}

################################################################################
# CODEPIPELINE
################################################################################

resource "aws_codepipeline" "bianca_pipeline" {
  name     = "BiancaApp-ECS-Pipeline"
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    type     = "S3"
    location = aws_s3_bucket.artifact_bucket.bucket
  }

  stage {
    name = "Source"
    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["SourceOutput"]
      configuration = {
        ConnectionArn        = var.github_app_connection_arn
        FullRepositoryId     = "${var.github_owner}/${var.github_repo}"
        BranchName           = var.github_branch
        OutputArtifactFormat = "CODE_ZIP"
      }
      run_order = 1
    }
  }

  stage {
    name = "Build"
    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceOutput"]
      output_artifacts = ["BuildOutputApp", "BuildOutputAsterisk"]
      configuration = {
        ProjectName = aws_codebuild_project.bianca_project.name
      }
      run_order = 1
    }
  }

  stage {
    name = "Deploy"
    action {
      name            = "DeployAppECS"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      version         = "1"
      input_artifacts = ["BuildOutputApp"]
      configuration = {
        ClusterName = aws_ecs_cluster.cluster.name
        ServiceName = aws_ecs_service.app_service.name
        FileName    = "imagedefinitions_app.json"
      }
      run_order = 1
    }
    action {
      name            = "DeployAsteriskECS"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      version         = "1"
      input_artifacts = ["BuildOutputAsterisk"]
      configuration = {
        ClusterName = aws_ecs_cluster.cluster.name
        ServiceName = aws_ecs_service.asterisk_service.name
        FileName    = "imagedefinitions_asterisk.json"
      }
      run_order = 2
    }
  }
  tags = { Name = "BiancaApp-ECS-Pipeline" }
}

################################################################################
# ROUTE 53 RECORDS
################################################################################

resource "aws_route53_record" "app_subdomain" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "app.myphonefriend.com"
  type    = "A"
  alias {
    name                   = aws_lb.app_lb.dns_name
    zone_id                = aws_lb.app_lb.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "sip_subdomain" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "sip.myphonefriend.com"
  type    = "A"
  alias {
    name                   = aws_lb.sip_lb.dns_name
    zone_id                = aws_lb.sip_lb.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "wordpress_apex" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "myphonefriend.com"
  type    = "A"
  ttl     = "300"
  records = ["192.254.225.221"]
}

################################################################################
# SES DOMAIN VERIFICATION & DKIM
################################################################################

resource "aws_ses_domain_identity" "ses_domain" {
  domain = "myphonefriend.com"
}

resource "aws_route53_record" "ses_verification_record" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "_amazonses.${aws_ses_domain_identity.ses_domain.domain}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.ses_domain.verification_token]
}

resource "aws_ses_domain_dkim" "ses_dkim" {
  domain = aws_ses_domain_identity.ses_domain.domain
}

resource "aws_route53_record" "ses_dkim_records" {
  count   = 3
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "${element(aws_ses_domain_dkim.ses_dkim.dkim_tokens, count.index)}._domainkey.${aws_ses_domain_identity.ses_domain.domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${element(aws_ses_domain_dkim.ses_dkim.dkim_tokens, count.index)}.dkim.amazonses.com"]
}

################################################################################
# OUTPUTS
################################################################################

output "sip_nlb_static_ip" {
  description = "Static IP address for the SIP Network Load Balancer"
  value       = aws_eip.sip_eip.public_ip
}

output "sip_nlb_dns_name" {
  description = "DNS name for the SIP Network Load Balancer (sip.myphonefriend.com)"
  value       = aws_route53_record.sip_subdomain.name
}

output "app_alb_dns_name" {
  description = "DNS name for the Application Load Balancer (app.myphonefriend.com)"
  value       = aws_route53_record.app_subdomain.name
}
