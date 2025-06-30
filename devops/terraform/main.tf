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

# This variable is no longer used for the primary services but can be kept for reference
variable "subnet_ids" {
  description = "List of original private subnet IDs."
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

variable "app_rtp_sender_port" {
  description = "UDP port for the application's RTP sender service."
  type        = number
  default     = 16385
}

variable "repository_name" {
  description = "Name of the ECR repository for the main application."
  type        = string
  default     = "bianca-app-backend"
}

variable "asterisk_ecr_repo_name" {
  description = "Name of the ECR repository for the Asterisk Docker image."
  type        = string
  default     = "bianca-app-asterisk"
}

# --- Asterisk EC2 Variables ---
variable "asterisk_instance_type" {
  description = "EC2 instance type for Asterisk server"
  type        = string
  default     = "t3.medium"
}

variable "asterisk_ami_id" {
  description = "AMI ID for Asterisk (defaults to Amazon Linux 2)"
  type        = string
  default     = "" # Will use data source if not specified
}

variable "asterisk_key_pair_name" {
  description = "EC2 key pair name for SSH access to Asterisk"
  type        = string
  default     = "bianca-key-pair" # Create this key pair in AWS first
}

# --- Asterisk Service Variables ---
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
  default     = 20000 # Increased for more concurrent calls
}

variable "app_rtp_port_start" {
  description = "Start of RTP port range for the application"
  type        = number
  default     = 16384
}

variable "app_rtp_port_end" {
  description = "End of RTP port range for the application"
  type        = number
  default     = 16484
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
  default     = "audio/fix-networking"
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

data "aws_route53_zone" "myphonefriend" {
  name         = "myphonefriend.com."
  private_zone = false
}

data "aws_acm_certificate" "app_cert" {
  domain      = "*.myphonefriend.com"
  statuses    = ["ISSUED"]
  most_recent = true
}

# Get latest Amazon Linux 2 AMI if not specified
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

################################################################################
# NETWORKING - PUBLIC AND PRIVATE SUBNETS
################################################################################

# Get the list of Availability Zones in your region to ensure high availability
data "aws_availability_zones" "available" {
  state = "available"
}

# Use a resource block to create/manage the Internet Gateway.
# On a fresh account, this will be created.
# On your existing account, you have already imported it.
resource "aws_internet_gateway" "gw" {
  vpc_id = var.vpc_id

  tags = {
    Name = "bianca-app-igw"
  }
}

# Create a new Route Table for your public subnets
resource "aws_route_table" "public" {
  vpc_id = var.vpc_id

  # This route sends all internet-bound traffic (0.0.0.0/0) to the Internet Gateway
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name = "bianca-public-rt"
  }
}

# Create the first public subnet in the first available Availability Zone
resource "aws_subnet" "public_a" {
  vpc_id                  = var.vpc_id
  # IMPORTANT: Adjust this CIDR block if it conflicts with existing subnets in your VPC
  cidr_block              = "172.31.100.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true # Automatically assign public IPs to instances launched here

  tags = {
    Name = "bianca-public-a"
  }
}

# Create the second public subnet in the second available Availability Zone
resource "aws_subnet" "public_b" {
  vpc_id                  = var.vpc_id
  # IMPORTANT: Adjust this CIDR block if it conflicts with existing subnets in your VPC
  cidr_block              = "172.31.101.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true # Automatically assign public IPs to instances launched here

  tags = {
    Name = "bianca-public-b"
  }
}

# Associate the new public route table with our new public subnets
resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

################################################################################
# NEW: PRIVATE SUBNETS FOR APPLICATION
################################################################################

# Private subnet for Fargate applications
resource "aws_subnet" "private_a" {
  vpc_id            = var.vpc_id
  cidr_block        = "172.31.110.0/24"  # Adjust to avoid conflicts
  availability_zone = data.aws_availability_zones.available.names[0]
  
  tags = {
    Name = "bianca-private-a"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = var.vpc_id
  cidr_block        = "172.31.111.0/24"  # Adjust to avoid conflicts
  availability_zone = data.aws_availability_zones.available.names[1]
  
  tags = {
    Name = "bianca-private-b"
  }
}

# NAT Gateway for private subnet internet access
resource "aws_eip" "nat_gateway" {
  domain = "vpc"
  tags   = { Name = "bianca-nat-gateway-eip" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat_gateway.id
  subnet_id     = aws_subnet.public_a.id  # NAT goes in public subnet
  
  tags = { Name = "bianca-nat-gateway" }
  depends_on = [aws_internet_gateway.gw]
}

# Private route table
resource "aws_route_table" "private" {
  vpc_id = var.vpc_id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = { Name = "bianca-private-rt" }
}

# Associate private subnets with private route table
resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.private.id
}

################################################################################
# SERVICE DISCOVERY (AWS Cloud Map)
################################################################################

resource "aws_service_discovery_private_dns_namespace" "internal" {
  name        = "myphonefriend.internal"
  description = "Private DNS namespace for internal services"
  vpc         = var.vpc_id
  tags        = { Name = "myphonefriend-internal-namespace" }
}

resource "aws_service_discovery_service" "asterisk_sd_service" {
  name = "asterisk"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.internal.id
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
    namespace_id   = aws_service_discovery_private_dns_namespace.internal.id
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 10
      type = "A"
    }
  }
  tags = { Name = "bianca-app-service-discovery" }
}

################################################################################
# SECURITY GROUPS - UPDATED FOR HYBRID NETWORKING
################################################################################

# Add explicit ALB to Fargate egress rule
resource "aws_security_group_rule" "alb_to_fargate_egress" {
  type                     = "egress"
  from_port                = var.container_port
  to_port                  = var.container_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.alb_sg.id
  source_security_group_id = aws_security_group.bianca_app_sg.id
  description              = "Allow ALB to reach Fargate tasks"
}

resource "aws_security_group" "alb_sg" {
  name        = "alb-sg"
  description = "Security group for the Application Load Balancer"
  vpc_id      = var.vpc_id

  lifecycle {
    ignore_changes = [description, tags, tags_all]
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

  # Keep the general egress rule but add specific one below
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "alb-sg" }
}

# UPDATED: App security group for private communication
resource "aws_security_group" "bianca_app_sg" {
  name        = "bianca-app-sg"
  description = "Security group for Bianca application ECS tasks"
  vpc_id      = var.vpc_id

  lifecycle {
    ignore_changes = [description, tags, tags_all]
  }

  # ALB traffic (external)
  ingress {
    description     = "Allow ALB traffic on App HTTP Port"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  # Egress rules
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "bianca-app-sg" }
}

# UPDATED: Asterisk security group to handle both Twilio and internal traffic
resource "aws_security_group" "asterisk_ec2_sg" {
  name        = "asterisk-ec2-sg"
  description = "Security group for Asterisk EC2 instance"
  vpc_id      = var.vpc_id

  # SIP UDP from Twilio (external)
  ingress {
    from_port   = var.asterisk_sip_udp_port
    to_port     = var.asterisk_sip_udp_port
    protocol    = "udp"
    cidr_blocks = concat(var.twilio_ip_ranges, var.bianca_client_static_ips)
    description = "SIP UDP from Twilio & Bianca Client"
  }

  # SIP TCP from Twilio (external)
  ingress {
    from_port   = var.asterisk_sip_tcp_port
    to_port     = var.asterisk_sip_tcp_port
    protocol    = "tcp"
    cidr_blocks = concat(var.twilio_ip_ranges, var.bianca_client_static_ips)
    description = "SIP TCP from Twilio & Bianca Client"
  }

  # RTP Range from Twilio (external) - for Twilio calls
  ingress {
    from_port   = var.asterisk_rtp_start_port
    to_port     = var.asterisk_rtp_end_port
    protocol    = "udp"
    cidr_blocks = var.twilio_ip_ranges
    description = "RTP UDP from Twilio"
  }

  # SSH Access (optional)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Restrict this to your IP
    description = "SSH access"
  }

  # Egress rules
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "asterisk-ec2-sg" }
}

# SEPARATE RULES: Add these as separate security group rules for cross-referencing
# RTP from Bianca App to Asterisk (internal)
resource "aws_security_group_rule" "asterisk_rtp_from_bianca_app" {
  type                     = "ingress"
  from_port                = var.asterisk_rtp_start_port
  to_port                  = var.asterisk_rtp_end_port
  protocol                 = "udp"
  security_group_id        = aws_security_group.asterisk_ec2_sg.id
  source_security_group_id = aws_security_group.bianca_app_sg.id
  description              = "RTP UDP from Bianca App (internal)"
}

# ARI HTTP from Bianca App to Asterisk (internal)
resource "aws_security_group_rule" "asterisk_ari_from_bianca_app" {
  type                     = "ingress"
  from_port                = var.asterisk_ari_http_port
  to_port                  = var.asterisk_ari_http_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.asterisk_ec2_sg.id
  source_security_group_id = aws_security_group.bianca_app_sg.id
  description              = "ARI access from Bianca App Backend"
}

# Debug: Add more specific RTP debugging rules
resource "aws_security_group_rule" "bianca_app_rtp_from_asterisk_debug" {
  type                     = "ingress"
  from_port                = var.app_rtp_port_start
  to_port                  = var.app_rtp_port_end
  protocol                 = "udp"
  security_group_id        = aws_security_group.bianca_app_sg.id
  source_security_group_id = aws_security_group.asterisk_ec2_sg.id
  description              = "RTP from Asterisk (internal network) - Debug"
}

# Also allow all UDP traffic temporarily for debugging
resource "aws_security_group_rule" "bianca_app_debug_udp" {
  type              = "ingress"
  from_port         = 10000
  to_port           = 65535
  protocol          = "udp"
  security_group_id = aws_security_group.bianca_app_sg.id
  cidr_blocks       = ["172.31.0.0/16"]  # Allow from entire VPC
  description       = "DEBUG: Allow all UDP from VPC"
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

################################################################################
# ASTERISK EC2 INSTANCE - KEPT IN PUBLIC SUBNET
################################################################################

# Elastic IP for Asterisk
resource "aws_eip" "asterisk_eip" {
  domain = "vpc"
  tags   = { Name = "asterisk-permanent-eip" }
}

# EIP Association
resource "aws_eip_association" "asterisk_eip_assoc" {
  instance_id   = aws_instance.asterisk.id
  allocation_id = aws_eip.asterisk_eip.id
}

# IAM Role for EC2 Instance
resource "aws_iam_role" "asterisk_ec2_role" {
  name = "asterisk-ec2-role"

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
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "asterisk_profile" {
  name = "asterisk-ec2-profile"
  role = aws_iam_role.asterisk_ec2_role.name
}

# Attach policies to the role
resource "aws_iam_role_policy_attachment" "asterisk_ssm" {
  role       = aws_iam_role.asterisk_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "asterisk_cloudwatch" {
  role       = aws_iam_role.asterisk_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Policy for Secrets Manager access
resource "aws_iam_role_policy" "asterisk_secrets" {
  name = "asterisk-secrets-policy"
  role = aws_iam_role.asterisk_ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = data.aws_secretsmanager_secret.app_secret.arn
    }]
  })
}

# EC2 Instance - KEPT IN PUBLIC SUBNET FOR TWILIO ACCESS
resource "aws_instance" "asterisk" {
  ami           = var.asterisk_ami_id != "" ? var.asterisk_ami_id : data.aws_ami.amazon_linux_2.id
  instance_type = var.asterisk_instance_type
  # KEPT: Asterisk in public subnet for Twilio direct access
  subnet_id = aws_subnet.public_a.id

  vpc_security_group_ids = [aws_security_group.asterisk_ec2_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.asterisk_profile.name
  key_name               = var.asterisk_key_pair_name

  # Enable detailed monitoring
  monitoring = true

  # User data script to install Docker and run Asterisk
  user_data = base64encode(templatefile("${path.module}/asterisk-userdata.sh", {
    external_ip            = aws_eip.asterisk_eip.public_ip
    ari_password_secret    = data.aws_secretsmanager_secret.app_secret.arn
    bianca_password_secret = data.aws_secretsmanager_secret.app_secret.arn
    region                 = var.aws_region
    # Pass private subnet CIDR for RTP routing
    private_subnet_cidrs   = "172.31.110.0/24,172.31.111.0/24"
  }))

  root_block_device {
    volume_type = "gp3"
    volume_size = 30
    encrypted   = true
  }

  tags = {
    Name = "asterisk-server",
    Environment = "production",
  }
}

# Service Discovery Instance for Asterisk EC2
resource "aws_service_discovery_instance" "asterisk" {
  instance_id = "asterisk-ec2"
  service_id  = aws_service_discovery_service.asterisk_sd_service.id

  attributes = {
    AWS_INSTANCE_IPV4 = aws_instance.asterisk.private_ip
  }
}

################################################################################
# EFS (for MongoDB Persistence) - UPDATED FOR PRIVATE SUBNETS
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
    path = "/mongodb_new"
    creation_info {
      owner_uid   = 999
      owner_gid   = 999
      permissions = "700"
    }
  }
  tags = { Name = "MongoDB Access Point for ${var.cluster_name}" }
}

# UPDATED: Mount EFS in private subnets where Fargate runs
resource "aws_efs_mount_target" "mongodb_mount" {
  count           = 2
  file_system_id  = aws_efs_file_system.mongodb_data.id
  subnet_id       = [aws_subnet.private_a.id, aws_subnet.private_b.id][count.index]
  security_groups = [aws_security_group.efs_sg.id]
}

resource "aws_efs_file_system_policy" "mongodb_policy" {
  file_system_id = aws_efs_file_system.mongodb_data.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowECSAccess"
      Effect = "Allow"
      Principal = {
        AWS = "*"
      }
      Action = [
        "elasticfilesystem:ClientMount",
        "elasticfilesystem:ClientWrite"
      ]
      Resource  = aws_efs_file_system.mongodb_data.arn
      Condition = { Bool = { "aws:SecureTransport" = "true" } }
    }]
  })
}

################################################################################
# APPLICATION LOAD BALANCER (ALB) - For Bianca App HTTP/S Traffic
################################################################################

resource "aws_lb" "app_lb" {
  name               = var.load_balancer_name
  internal           = false
  load_balancer_type = "application"
  idle_timeout       = 120
  security_groups    = [aws_security_group.alb_sg.id]
  # ALB stays in public subnets to receive external traffic
  subnets = [aws_subnet.public_a.id, aws_subnet.public_b.id]
  tags    = { Name = var.load_balancer_name }
}

resource "aws_lb_target_group" "app_tg" {
  name        = "bianca-target-group"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    interval            = 60        # Increased to give more time
    timeout             = 15        # Increased timeout
    healthy_threshold   = 2         # Reduced threshold
    unhealthy_threshold = 10        # Increased to be more forgiving
    matcher             = "200"
    port                = "traffic-port"
    protocol            = "HTTP"
  }
  tags = { Name = "bianca-target-group" }
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
# ECS (Cluster, Task Definitions, Services) - UPDATED FOR PRIVATE NETWORKING
################################################################################

resource "aws_ecs_cluster" "cluster" {
  name = var.cluster_name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = { Name = var.cluster_name }
}

# UPDATED: Task definition with hybrid networking environment variables
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
    {
      name      = var.container_name
      image     = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.repository_name}:latest"
      essential = true
      portMappings = [
        { containerPort = var.container_port, hostPort = var.container_port, protocol = "tcp" },
        # Add UDP port mappings for RTP
        { containerPort = var.app_rtp_port_start, hostPort = var.app_rtp_port_start, protocol = "udp" },
        { containerPort = var.app_rtp_port_end, hostPort = var.app_rtp_port_end, protocol = "udp" }
      ]
      environment = [
        { name = "AWS_REGION", value = var.aws_region },
        { name = "MONGODB_URL", value = "mongodb://localhost:${var.mongodb_port}/${var.service_name}" },
        { name = "NODE_ENV", value = "production" },
        { name = "WEBSOCKET_URL", value = "wss://app.myphonefriend.com" },
        { name = "RTP_PORT_RANGE", value = "${var.asterisk_rtp_start_port}-${var.asterisk_rtp_end_port}" },
        
        # Internal communication uses private IP
        { name = "ASTERISK_URL", value = "http://${aws_instance.asterisk.private_ip}:${var.asterisk_ari_http_port}" },
        { name = "ASTERISK_PRIVATE_IP", value = aws_instance.asterisk.private_ip },
        
        # External SIP signaling uses public IP (for Twilio)
        { name = "ASTERISK_PUBLIC_IP", value = aws_eip.asterisk_eip.public_ip },
        
        { name = "AWS_SES_REGION", value = var.aws_region },
        { name = "APP_RTP_PORT_RANGE", value = "${var.app_rtp_port_start}-${var.app_rtp_port_end}"},
        { name = "RTP_LISTENER_HOST", value = "0.0.0.0" },
        
        # App will auto-detect its private IP for RTP
        { name = "USE_PRIVATE_NETWORK_FOR_RTP", value = "true" },
        { name = "NETWORK_MODE", value = "HYBRID" },
        { name = "ALB_DNS_NAME", value = aws_lb.app_lb.dns_name }
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
      },
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
      dependsOn = [{ "containerName" : "mongodb", "condition" : "HEALTHY" }]
    },
    {
      name      = "mongodb"
      image     = "mongo:4.4"
      essential = true
      portMappings = [
        { containerPort = var.mongodb_port, protocol = "tcp" }
      ]
      mountPoints = [
        { sourceVolume = "mongodb-data", containerPath = "/data/db", readOnly = false }
      ]
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

# UPDATED: ECS service moved to private subnets
resource "aws_ecs_service" "app_service" {
  name = var.service_name
  cluster = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.app_task.arn
  launch_type = "FARGATE"
  platform_version                   = "LATEST"
  desired_count = 1
  deployment_maximum_percent         = 100
  deployment_minimum_healthy_percent = 0
  enable_execute_command             = true
  health_check_grace_period_seconds  = 120

  network_configuration {
    # CHANGED: Use private subnets for Fargate
    subnets          = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_groups  = [aws_security_group.bianca_app_sg.id]
    # CHANGED: No public IP needed since we're in private subnets
    assign_public_ip = false
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
  name              = "/aws/ec2/asterisk"
  retention_in_days = 14
  tags              = { Name = "asterisk-ec2-logs" }
}

resource "aws_iam_role_policy" "asterisk_ecr_pull" {
  name = "asterisk-ecr-pull-policy"
  role = aws_iam_role.asterisk_ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
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
      Effect = "Allow"
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
      Effect = "Allow"
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

# S3 Debug Audio Bucket and Policy
resource "aws_s3_bucket" "debug_audio_bucket" {
  bucket = "bianca-audio-debug"
  tags = {
    Name        = "Bianca Debug Audio Bucket"
    Environment = "Debug"
  }
}

resource "aws_s3_bucket_ownership_controls" "debug_audio_bucket_ownership" {
  bucket = aws_s3_bucket.debug_audio_bucket.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_iam_policy" "ecs_task_s3_debug_audio_policy" {
  name        = "ECSTaskS3DebugAudioPolicy"
  description = "Allows ECS tasks to write debug audio to a specific S3 bucket"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["s3:PutObject"],
      Resource = "arn:aws:s3:::bianca-audio-debug/*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_s3_debug_audio_attach" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_s3_debug_audio_policy.arn
}

# CodeBuild and CodePipeline IAM roles
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
        Resource = [
          aws_ecr_repository.app_repo.arn,
          aws_ecr_repository.asterisk_repo.arn
        ]
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
}

# Separate IAM policy for CodePipeline (replacing inline_policy)
resource "aws_iam_policy" "codepipeline_base_policy" {
  name        = "CodePipelineBasePermissions"
  description = "Base permissions for CodePipeline"
  
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
        Effect = "Allow",
        Action = ["ecs:DescribeServices", "ecs:UpdateService", "ecs:DescribeTaskDefinition"],
        Resource = [
          aws_ecs_service.app_service.id,
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

# Attach the policy to the role
resource "aws_iam_role_policy_attachment" "codepipeline_base_policy_attach" {
  role       = aws_iam_role.codepipeline_role.name
  policy_arn = aws_iam_policy.codepipeline_base_policy.arn
}

resource "aws_iam_role_policy_attachment" "codepipeline_temp_ecs_full_attach" {
  role       = aws_iam_role.codepipeline_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonECS_FullAccess"
}

################################################################################
# CODEBUILD PROJECT (App Only - Asterisk is on EC2)
################################################################################

resource "aws_codebuild_project" "bianca_project" {
  name         = "bianca-app-build"
  description  = "Builds Docker images for Bianca application"
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
# CODEPIPELINE (App Only - Asterisk is on EC2)
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
      output_artifacts = ["BuildOutput"]
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
      input_artifacts = ["BuildOutput"]
      configuration = {
        ClusterName = aws_ecs_cluster.cluster.name
        ServiceName = aws_ecs_service.app_service.name
        FileName    = "imagedefinitions_app.json"
      }
      run_order = 1
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

# KEPT: Direct EIP mapping for SIP (Twilio needs direct access)
resource "aws_route53_record" "sip_subdomain" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "sip.myphonefriend.com"
  type    = "A"
  ttl     = 300
  records = [aws_eip.asterisk_eip.public_ip]
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
# OUTPUTS - UPDATED FOR VERIFICATION
################################################################################

output "asterisk_public_ip" {
  description = "Public IP for Twilio/external SIP traffic"
  value       = aws_eip.asterisk_eip.public_ip
}

output "asterisk_private_ip" {
  description = "Private IP for internal App-Asterisk RTP"
  value       = aws_instance.asterisk.private_ip
}

output "sip_dns_name" {
  description = "DNS name for SIP (sip.myphonefriend.com)"
  value       = aws_route53_record.sip_subdomain.name
}

output "app_alb_dns_name" {
  description = "DNS name for the Application Load Balancer (app.myphonefriend.com)"
  value       = aws_route53_record.app_subdomain.name
}

output "asterisk_instance_id" {
  description = "EC2 instance ID for Asterisk"
  value       = aws_instance.asterisk.id
}

output "private_subnet_cidrs" {
  description = "Private subnet CIDRs where Fargate runs"
  value       = ["172.31.110.0/24", "172.31.111.0/24"]
}

output "network_architecture" {
  description = "Network architecture summary"
  value = "Hybrid: Twilio->Asterisk(public), App<->Asterisk(private)"
}

output "nat_gateway_ip" {
  description = "NAT Gateway IP for private subnet internet access"
  value       = aws_eip.nat_gateway.public_ip
}