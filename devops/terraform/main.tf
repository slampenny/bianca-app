provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

##############################
# Variables
##############################

variable "aws_profile" {
  default = "jordan"
}

variable "aws_region" {
  default = "us-east-2"
}

variable "aws_account_id" {
  default = "730335291008"
}

variable "repository_name" {
  default = "bianca-app-backend"
}

variable "bucket_name" {
  default = "bianca-codepipeline-artifact-bucket"
}

variable "codepipeline_role_name" {
  default = "CodePipelineServiceRole"
}

variable "codebuild_role_name" {
  default = "CodeBuildServiceRole"
}

# variable "codedeploy_role_name" { # Removed - No longer needed
#  default = "CodeDeployServiceRole"
# }

variable "ecs_execution_role_name" {
  default = "ecsTaskExecutionRole"
}

variable "github_owner" {
  default = "slampenny"
}

variable "github_repo" {
  default = "bianca-app-backend"
}

variable "github_branch" {
  default = "main"
}

variable "github_app_connection_arn" {
  description = "The ARN of the GitHub App connection to use for CodePipeline."
  default     = "arn:aws:codeconnections:us-east-2:730335291008:connection/a126dbfd-f253-42e4-811b-cda3ebd5a629"
  type        = string
}

variable "secrets_manager_secret" {
  default = "MySecretsManagerSecret"
}

data "aws_secretsmanager_secret" "app_secret" {
  name = var.secrets_manager_secret
}

# variable "application_name" { # Removed - No longer needed for CodeDeploy
#  default = "BiancaApp"
# }

# variable "deployment_group_name" { # Removed - No longer needed for CodeDeploy
#  default = "BiancaDeploymentGroup"
# }

variable "cluster_name" {
  default = "bianca-cluster"
}

variable "service_name" {
  default = "bianca-service"
}

variable "load_balancer_name" {
  default = "bianca-load-balancer"
}

variable "container_name" {
  default = "bianca-app-backend"
}

variable "container_port" {
  default = 3000
}

variable "vpc_id" {
  default = "vpc-05c16725411127dc3"
}

variable "subnet_ids" {
  type    = list(string)
  default = ["subnet-016b6aba534de1845", "subnet-0c7b38f9439f97b3e", "subnet-006892e47fe84433f"]
}

##############################
# Security Group
##############################

resource "aws_security_group" "bianca_app_sg" {
  name   = "bianca-app-sg"
  vpc_id = var.vpc_id

  ingress {
    description     = "Allow ALB (alb_sg) traffic on port 3000"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}


resource "aws_security_group" "alb_sg" {
  name   = "alb-sg"
  vpc_id = var.vpc_id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from anywhere"
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
}

##############################
# EFS for MongoDB Persistence
##############################

# Create an EFS file system for MongoDB data
resource "aws_efs_file_system" "mongodb_data" {
  creation_token = "mongodb-data"

  tags = {
    Name = "MongoDB Data"
  }
}

resource "aws_efs_access_point" "mongo_ap" {
  file_system_id = aws_efs_file_system.mongodb_data.id

  # Define the user/group ID for files created via this access point
  posix_user {
    uid = 999 # Standard mongodb user ID
    gid = 999 # Standard mongodb group ID
  }

  # Define the root directory on EFS for this access point
  # And automatically create it with the correct ownership/permissions
  root_directory {
    path = "/mongodb" # Create a subdirectory on EFS for this app's data
    creation_info {
      owner_uid   = 999
      owner_gid   = 999
      permissions = "700" # Owner has read/write/execute, nobody else
    }
  }

  tags = {
    Name = "MongoDB Access Point"
  }
}

# Create mount targets in each subnet
resource "aws_efs_mount_target" "mongodb_mount" {
  count           = length(var.subnet_ids)
  file_system_id  = aws_efs_file_system.mongodb_data.id
  subnet_id       = var.subnet_ids[count.index]
  security_groups = [aws_security_group.efs_sg.id]
}

# Security group for EFS
resource "aws_security_group" "efs_sg" {
  name        = "mongodb-efs-sg"
  description = "Allow NFS traffic from ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "NFS from ECS tasks"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.bianca_app_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
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
          AWS = "*"
        }
        Action = [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite"
        ]
        Resource = aws_efs_file_system.mongodb_data.arn
        Condition = {
          Bool = {
            "aws:SecureTransport" = "true"
          }
        }
      }
    ]
  })
}

##############################
# ALB Target Group (Single)
##############################

# resource "aws_lb_target_group" "app_tg_blue" { # Removed - No longer needed for rolling update
#  ...
# }

resource "aws_lb_target_group" "app_tg" { # Renamed from app_tg_green
  name        = "bianca-target-group"     # Renamed for clarity
  port        = var.container_port        # e.g. 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 2
  }
}

resource "aws_cloudwatch_log_group" "app_log_group" {
  name              = "/ecs/${var.container_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "mongodb_log_group" {
  name              = "/ecs/mongodb"
  retention_in_days = 14
}

##############################
# S3 Bucket and ECR Repository
##############################

resource "aws_s3_bucket" "artifact_bucket" {
  bucket = var.bucket_name
  # Consider adding versioning and lifecycle policies
  # versioning {
  #   enabled = true
  # }
  # lifecycle_rule {
  #   ...
  # }
}

resource "aws_ecr_repository" "app_repo" {
  name = var.repository_name
  # Consider image scanning and lifecycle policies
  # image_scanning_configuration {
  #  scan_on_push = true
  # }
  # image_tag_mutability = "MUTABLE" # Or IMMUTABLE
}

resource "aws_ecr_repository" "asterisk_repo" {
  name = "bianca-app-asterisk"

  image_scanning_configuration {
    scan_on_push = true
  }

  image_tag_mutability = "MUTABLE" # or IMMUTABLE if you prefer strict tagging
}


variable "asterisk_service_name" {
  default = "asterisk-service"
}

variable "asterisk_container_name" {
  default = "asterisk"
}

variable "asterisk_image" {
  default = "andrius/asterisk:latest"
}

variable "asterisk_container_port" {
  default = 5060
}

resource "aws_security_group" "asterisk_sg" {
  name   = "asterisk-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 5060
    to_port     = 5060
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 5060
    to_port     = 5060
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 10000
    to_port     = 10100
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
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
      image     = var.asterisk_image
      essential = true
      portMappings = [
        { containerPort = 5060, protocol = "udp" },
        { containerPort = 5060, protocol = "tcp" },
        { containerPort = 10000, protocol = "udp" }
      ]
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          "awslogs-group"         = "/ecs/asterisk",
          "awslogs-region"        = var.aws_region,
          "awslogs-stream-prefix" = "asterisk"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "asterisk_service" {
  name            = var.asterisk_service_name
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.asterisk_task.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.asterisk_sg.id]
    assign_public_ip = true
  }
}

resource "aws_route53_record" "sip_subdomain" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "sip.myphonefriend.com"
  type    = "A"

  alias {
    name                   = aws_lb.app_lb.dns_name # or your NLB if you use one for SIP
    zone_id                = aws_lb.app_lb.zone_id
    evaluate_target_health = true
  }
}


##############################
# IAM Roles and Policies
##############################

# --- CodeBuild Role and Policies ---
data "aws_iam_policy_document" "codebuild_assume" {
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
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

# (Keep CodeBuild ECR, ECS Task Definition, PassRole, Logs, Artifact Access policies as they are)
# ECR Push Policy
resource "aws_iam_policy" "codebuild_ecr_policy" {
  name        = "CodeBuildECRPolicy"
  description = "Allow CodeBuild to push Docker images to ECR"
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Sid      = "AllowECRPushLogin", # Updated Sid for clarity
        Effect   = "Allow",
        Action   = [
          "ecr:GetAuthorizationToken"
        ],
        Resource = "*" # Necessary for GetAuthorizationToken
      },
      {
        Sid      = "AllowECRImagePush", # Updated Sid for clarity
        Effect   = "Allow",
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer", # Although pushing, sometimes needed
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:BatchGetImage", # Sometimes needed by Docker client
          "ecr:GetRepositoryPolicy", # Good practice
          "ecr:DescribeRepositories" # Good practice
        ],
        Resource = [
          aws_ecr_repository.app_repo.arn, # More specific resource
          aws_ecr_repository.asterisk_repo.arn
        ]
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "codebuild_ecr_policy_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_ecr_policy.arn
}

# ECS Task Definition Policy
resource "aws_iam_policy" "codebuild_ecs_policy" {
  name        = "CodeBuildECSPolicy"
  description = "Allow CodeBuild to register ECS task definitions"
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "ecs:RegisterTaskDefinition",
        Resource = "*" # RegisterTaskDefinition doesn't easily support specific ARNs for new definitions
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "codebuild_ecs_policy_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_ecs_policy.arn
}

# ECS Describe Task Definition Policy (Still useful for build process)
resource "aws_iam_policy" "codebuild_ecs_describe_policy" {
  name        = "CodeBuildECSDescribePolicy"
  description = "Allow CodeBuild to describe ECS task definitions"
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "ecs:DescribeTaskDefinition",
        Resource = "*" # Describe often needs broader access or complex resource matching
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "codebuild_ecs_describe_policy_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_ecs_describe_policy.arn
}

# Pass Execution Role Policy
resource "aws_iam_policy" "codebuild_pass_exec_role_policy" { # Renamed for clarity
  name        = "CodeBuildPassExecRolePolicy"
  description = "Allow CodeBuild to pass the ECS task execution role"
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "iam:PassRole",
        Resource = aws_iam_role.ecs_execution_role.arn # Use the ARN of the actual execution role
        # Condition = { # Optional: Restrict which service can use this PassRole
        #   "StringEquals" : {"iam:PassedToService": "ecs-tasks.amazonaws.com"}
        # }
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "codebuild_pass_exec_role_policy_attach" { # Renamed for clarity
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_pass_exec_role_policy.arn
}

# Pass Task Role Policy (May still be needed if task def includes task role)
resource "aws_iam_policy" "codebuild_pass_task_role_policy" {
  name   = "CodeBuildPassTaskRolePolicy"
  # role   = aws_iam_role.codebuild_role.id # Attaching directly to role
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "iam:PassRole",
        Resource = aws_iam_role.ecs_task_role.arn # Use the ARN of the actual task role
        # Condition = { # Optional: Restrict which service can use this PassRole
        #   "StringEquals" : {"iam:PassedToService": "ecs-tasks.amazonaws.com"}
        # }
      }
    ]
  })
}

# Attach the CodeBuildPassTaskRolePolicy to the CodeBuild Role
resource "aws_iam_role_policy_attachment" "codebuild_pass_task_role_policy_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_pass_task_role_policy.arn
}

# Logs Policy
resource "aws_iam_policy" "codebuild_logs_policy" {
  name        = "CodeBuildLogsPolicy"
  description = "Allow CodeBuild to create log groups, log streams, and put log events in CloudWatch Logs"
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/codebuild/${aws_codebuild_project.bianca_project.name}:*" # More specific resource
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "codebuild_logs_policy_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_logs_policy.arn
}

# Artifact Access Policy
resource "aws_iam_policy" "codebuild_artifact_access" {
  name        = "CodeBuildArtifactAccessPolicy"
  description = "Allow CodeBuild to read from and write artifacts to the CodePipeline artifact bucket"
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion", # Added for completeness
          "s3:PutObject",
          "s3:GetBucketAcl",     # Often needed by CodeBuild S3 actions
          "s3:GetBucketLocation" # Often needed by CodeBuild S3 actions
        ],
        Resource = [
           aws_s3_bucket.artifact_bucket.arn,
           "${aws_s3_bucket.artifact_bucket.arn}/*"
        ]
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "codebuild_artifact_access_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_artifact_access.arn
}

# Basic CodeBuild Managed Policy (Consider replacing with more specific policies if desired)
# resource "aws_iam_role_policy_attachment" "codebuild_policy" {
#  role       = aws_iam_role.codebuild_role.name
#  policy_arn = "arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess" # This is very permissive
# }


# --- CodeDeploy Role and Policies --- (REMOVED)

# data "aws_iam_policy_document" "codedeploy_assume" { ... }
# resource "aws_iam_role" "codedeploy_role" { ... }
# resource "aws_iam_role_policy_attachment" "codedeploy_policy" { ... }
# resource "aws_iam_policy" "codedeploy_update_service_policy" { ... }
# resource "aws_iam_role_policy_attachment" "codedeploy_update_service_policy_attach" { ... }
# resource "aws_iam_policy" "codedeploy_ecs_policy" { ... }
# resource "aws_iam_policy" "codedeploy_pass_task_role_policy" { ... }
# resource "aws_iam_role_policy_attachment" "codedeploy_pass_task_role_policy_attach" { ... }
# resource "aws_iam_role_policy_attachment" "codedeploy_ecs_policy_attach" { ... }
# resource "aws_iam_policy" "codedeploy_s3_policy" { ... }
# resource "aws_iam_role_policy_attachment" "codedeploy_s3_policy_attach" { ... }
# resource "aws_iam_policy" "codedeploy_elbv2_policy" { ... }
# resource "aws_iam_role_policy_attachment" "codedeploy_elbv2_policy_attach" { ... }
# resource "aws_iam_policy" "codedeploy_ecs_createtaskset_policy" { ... }
# resource "aws_iam_role_policy_attachment" "codedeploy_ecs_createtaskset_policy_attach" { ... }
# resource "aws_iam_policy" "codedeploy_ecs_deletetaskset_policy" { ... }
# resource "aws_iam_role_policy_attachment" "codedeploy_ecs_deletetaskset_policy_attach" { ... }
# resource "aws_iam_policy" "codedeploy_pass_role_policy" { ... } # Note: Pass role policy might be named similarly to codebuild one, ensure correct deletion
# resource "aws_iam_role_policy_attachment" "codedeploy_pass_role_policy_attach" { ... }


# --- ECS Execution Role and Policies --- (Keep as is)
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
}

resource "aws_iam_role_policy_attachment" "ecs_exec_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets_policy" {
  name = "ecs-execution-secrets-policy"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowSecretsManagerGetSecretValue"
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:${var.secrets_manager_secret}-*" # Use wildcard if suffix is dynamic
        # Resource = "arn:aws:secretsmanager:us-east-2:730335291008:secret:MySecretsManagerSecret-LyB1aP" # Original specific ARN
      }
    ]
  })
}

# --- ECS Task Role and Policies --- (Keep as is)
resource "aws_iam_role" "ecs_task_role" {
  name               = "ecsTaskRole"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_role_policy" {
  name = "ecsTaskRolePolicy"
  role = aws_iam_role.ecs_task_role.id
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "ecs_task_secrets_policy" {
  name = "ecs-task-secrets-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowSecretsManagerGetSecretValue"
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:${var.secrets_manager_secret}-*" # Use wildcard if suffix is dynamic
         # Resource = "arn:aws:secretsmanager:us-east-2:730335291008:secret:MySecretsManagerSecret-LyB1aP" # Original specific ARN
      }
    ]
  })
}


# --- CodePipeline Role and Policies ---
resource "aws_iam_role" "codepipeline_role" {
  name = var.codepipeline_role_name
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "codepipeline.amazonaws.com" }
    }]
  })

  inline_policy {
    name = "CodePipelineSecretsManagerAccess"
    policy = jsonencode({
      Version   = "2012-10-17",
      Statement = [{
        Sid      = "AllowGetSecretValue",
        Effect   = "Allow",
        Action   = "secretsmanager:GetSecretValue",
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:${var.secrets_manager_secret}*"
      }]
    })
  }

  inline_policy {
    name = "CodePipelineS3AccessPolicy"
    policy = jsonencode({
      Version   = "2012-10-17",
      Statement = [{
        Sid      = "AllowS3Actions",
        Effect   = "Allow",
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket"
        ],
        Resource = [
          aws_s3_bucket.artifact_bucket.arn,
          "${aws_s3_bucket.artifact_bucket.arn}/*"
        ]
      }]
    })
  }

  inline_policy {
    name = "CodePipelineCodeBuildAccess"
    policy = jsonencode({
      Version   = "2012-10-17",
      Statement = [{
        Sid      = "AllowCodeBuildActions",
        Effect   = "Allow",
        Action = [
          "codebuild:StartBuild",
          "codebuild:StopBuild", # Added for completeness
          "codebuild:BatchGetBuilds"
        ],
        Resource = aws_codebuild_project.bianca_project.arn
      }]
    })
  }

   # Removed CodeDeploy inline policy
  # inline_policy {
  #   name = "CodePipelineCodeDeployAccess"
  #   ...
  # }

  # ADDED: Inline policy for ECS Deploy actions
  inline_policy {
    name = "CodePipelineECSDeployAccess"
    policy = jsonencode({
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "ecs:DescribeServices",
                    "ecs:UpdateService",
                    "ecs:DescribeTaskDefinition"
                ],
                "Resource": "*" # s/b aws_ecs_service.app_service.id # Grant access only to the specific service ARN
            },
            { # Needed to pass roles if task definition changes require it
                "Effect": "Allow",
                "Action": "iam:PassRole",
                "Resource": [
                    aws_iam_role.ecs_execution_role.arn,
                    aws_iam_role.ecs_task_role.arn
                ],
                "Condition": {
                    "StringEqualsIfExists": {
                        "iam:PassedToService": "ecs-tasks.amazonaws.com"
                    }
                }
            }
        ]
    })
  }
}

# ------------------------------------------------------------
# TEMPORARY ATTACHMENT FOR DEBUGGING ECS PERMISSIONS
# REMOVE THIS AFTER TESTING! GRANTS EXCESSIVE PERMISSIONS.
# ------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "codepipeline_temp_ecs_full_attach" {
  role       = aws_iam_role.codepipeline_role.name # Ensure this targets your CodePipeline role
  policy_arn = "arn:aws:iam::aws:policy/AmazonECS_FullAccess"
}
# ------------------------------------------------------------

# Removed FullAccess policy - using more granular inline policies now.
# resource "aws_iam_role_policy_attachment" "codepipeline_policy" {
#  role       = aws_iam_role.codepipeline_role.name
#  policy_arn = "arn:aws:iam::aws:policy/AWSCodePipeline_FullAccess" # This is very permissive
# }

# Keep CodeStar connection policy
resource "aws_iam_policy" "codepipeline_connection_policy" {
  name        = "CodePipelineConnectionPolicy"
  description = "Allow CodePipeline to use the GitHub App-based connection"
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "codestar-connections:UseConnection",
        Resource = var.github_app_connection_arn # Use variable directly
        # Resource = "arn:aws:codeconnections:us-east-2:${var.aws_account_id}:connection/a126dbfd-f253-42e4-811b-cda3ebd5a629" # Original specific ARN
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "codepipeline_connection_policy_attach" {
  role       = aws_iam_role.codepipeline_role.name
  policy_arn = aws_iam_policy.codepipeline_connection_policy.arn
}


##############################
# ECS Cluster, Task Definition, and Service
##############################

resource "aws_ecs_cluster" "cluster" {
  name = var.cluster_name

  # Optional: Enable Container Insights
  # setting {
  #   name  = "containerInsights"
  #   value = "enabled"
  # }
}

resource "aws_ecs_task_definition" "app_task" {
  family                   = var.service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512" # Consider adjusting based on load
  memory                   = "1024" # Consider adjusting based on load
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  volume {
    name = "mongodb-data" # Keep the volume name the same
    efs_volume_configuration {
      file_system_id = aws_efs_file_system.mongodb_data.id
      # Remove root_directory - we use the access point now
      # root_directory = "/"
      transit_encryption = "ENABLED" # Keep this
      # Specify the Access Point ID:
      authorization_config {
        access_point_id = aws_efs_access_point.mongo_ap.id
        }
    }
  }

  container_definitions = jsonencode([
    {
      name      = var.container_name,
      # Image will be updated by CodePipeline using imagedefinitions.json,
      # so this initial value is just a placeholder or the initial version.
      image     = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.repository_name}:latest",
      essential = true,
      portMappings = [{
        containerPort = var.container_port,
        hostPort      = var.container_port, # Not strictly needed in awsvpc, but doesn't hurt
        protocol      = "tcp",
        # appProtocol = "http" # Optional: For App Mesh / Service Connect
      }],
      environment = [
        {
          name  = "MONGODB_URL",
          value = "mongodb://localhost:27017/bianca-app" # Assumes Mongo runs in the same task
        },
        {
          name  = "NODE_ENV",
          value = "production"
        },
        
        {
            name  = "WBSOCKET_URL",
            value = "wss://app.myphonefriend.com"
        },
        # { # Example using Secrets Manager
        #  name = "JWT_SECRET"
        #  valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:${var.secrets_manager_secret}-xxxxxx:JWT_SECRET::" # Adjust ARN and key name
        # }
      ],
        secrets = [
        # --- Secrets injected from AWS Secrets Manager ---
        {
            # Env Var name created inside the container:
            name      = "AWS_ACCESS_KEY",
            # Value comes from the 'JWT_SECRET' key within the JSON stored in Secrets Manager:
            valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:AWS_ACCESS_KEY::"
        },
        {
            # Env Var name created inside the container:
            name      = "AWS_SECRET_KEY",
            # Value comes from the 'JWT_SECRET' key within the JSON stored in Secrets Manager:
            valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:AWS_SECRET_KEY::"
        },
        {
            # Env Var name created inside the container:
            name      = "JWT_SECRET",
            # Value comes from the 'JWT_SECRET' key within the JSON stored in Secrets Manager:
            valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:JWT_SECRET::"
        },
        {
            name      = "OPENAI_API_KEY",
            valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:OPENAI_API_KEY::"
        },
        {
            name      = "TWILIO_PHONENUMBER",
            valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:TWILIO_ACCOUNTSID::"
        },
        {
            name      = "TWILIO_ACCOUNTSID",
            valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:TWILIO_ACCOUNTSID::"
        },
        {
            name      = "TWILIO_AUTHTOKEN",
            valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:TWILIO_AUTHTOKEN::"
        },
        {
            name      = "STRIPE_SECRET_KEY",
            valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:STRIPE_SECRET_KEY::"
        },
        {
            name      = "STRIPE_PUBLISHABLE_KEY",
            valueFrom = "${data.aws_secretsmanager_secret.app_secret.arn}:STRIPE_PUBLISHABLE_KEY::"
        },
        
        ],

      logConfiguration = {
        logDriver = "awslogs",
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app_log_group.name,
          "awslogs-region"        = var.aws_region,
          "awslogs-stream-prefix" = "app" # Changed prefix for clarity
        }
      }
      # dependsOn = [ { "containerName": "mongodb", "condition": "START" } ] # Ensure mongo starts first
    },
    {
      name      = "mongodb",
      image     = "mongo:4.4" # Use a specific minor version if possible, e.g., 4.4.18
      essential = true # Usually true, unless app can function without DB temporarily
      portMappings = [{
        containerPort = 27017,
        protocol      = "tcp"
      }],
      mountPoints = [{
        sourceVolume  = "mongodb-data",
        containerPath = "/data/db",
        readOnly      = false
      }],
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.mongodb_log_group.name,
          "awslogs-region"        = var.aws_region,
          "awslogs-stream-prefix" = "mongo" # Changed prefix for clarity
        }
      }
       # healthCheck = { # Optional: Add container health check for Mongo
       #   command = ["mongo", "--eval", "db.adminCommand('ping')"]
       #   interval = 30
       #   timeout = 5
       #   retries = 3
       # }
    }
  ])

  # Optional: Enable runtime monitoring
  # runtime_platform {
  #   operating_system_family = "LINUX"
  #   cpu_architecture        = "X86_64" # Or ARM64
  # }

  # Optional: Configure Ephemeral Storage
  # ephemeral_storage {
  #   size_in_gib = 21 # Minimum 21 for Fargate
  # }
}


resource "aws_ecs_service" "app_service" {
  name            = var.service_name
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.app_task.arn # Will be updated by pipeline
  launch_type     = "FARGATE"
  desired_count   = 1 # Adjust as needed for baseline capacity

  # --- Deployment Configuration ---
  deployment_controller {
    type = "ECS" # Use ECS native rolling updates
  }
  # Optional: Fine-tune rolling update behavior
  deployment_maximum_percent         = 100 # Allow 100% extra tasks during deployment
  deployment_minimum_healthy_percent = 0 # Require 100% of desired_count to be healthy (adjust lower if some downtime is ok)

  # Optional: Enable circuit breaker for rollbacks
  # deployment_circuit_breaker {
  #   enable   = true
  #   rollback = true
  # }

  network_configuration {
    subnets         = var.subnet_ids
    security_groups = [aws_security_group.bianca_app_sg.id]
    assign_public_ip = true # Set to false if using private subnets and NAT Gateway/VPC Endpoint
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app_tg.arn # Point to the single target group
    container_name   = var.container_name
    container_port   = var.container_port
  }

  enable_execute_command = true # Keep if you need ECS Exec

  # --- Lifecycle ---
  # Removed ignore_changes for task_definition and load_balancer
  # Keep desired_count if you manage scaling outside of this deployment process (e.g., manual or Application Auto Scaling)
  lifecycle {
     ignore_changes = [desired_count]
  }

  depends_on = [
    aws_lb_listener.http_listener,
    aws_lb_listener.https_listener,
    aws_iam_role.ecs_task_role,      # Ensure roles exist before service creation
    aws_iam_role.ecs_execution_role
  ]

  # Optional: Propagate tags from task definition or service to tasks
  # propagate_tags = "SERVICE" # Or "TASK_DEFINITION"

  # Optional: Configure service discovery
  # service_registries {
  #   registry_arn = aws_service_discovery_service.example.arn
  # }

  # Optional: Wait for service stability on create/update (can increase apply time)
  # wait_for_steady_state = true
}

##############################
# Load Balancer and Listeners
##############################

resource "aws_lb" "app_lb" {
  name               = var.load_balancer_name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = var.subnet_ids
  # enable_deletion_protection = false # Consider setting to true in production
  # access_logs { # Recommended for production
  #   bucket  = aws_s3_bucket.lb_logs.id
  #   prefix  = "app-lb"
  #   enabled = true
  # }
}

resource "aws_lb_listener" "http_listener" {
  load_balancer_arn = aws_lb.app_lb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn # Point to single TG
  }
  # Optional: Redirect HTTP to HTTPS
  # default_action {
  #   type = "redirect"
  #   redirect {
  #     port        = "443"
  #     protocol    = "HTTPS"
  #     status_code = "HTTP_301"
  #   }
  # }
}

resource "aws_lb_listener" "https_listener" {
  load_balancer_arn = aws_lb.app_lb.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = data.aws_acm_certificate.test_cert.arn
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-Ext-2018-06" # Use a modern TLS policy

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn # Point to single TG
  }

  # Removed lifecycle ignore_changes for default_action
  # lifecycle {
  #  ignore_changes = [default_action]
  # }
}

data "aws_acm_certificate" "test_cert" {
  domain    = "*.myphonefriend.com"
  statuses  = ["ISSUED"]
  most_recent = true
}

##############################
# CodeBuild Project
##############################

resource "aws_codebuild_project" "bianca_project" {
  name         = "bianca"
  description  = "Builds the Bianca application Docker image and prepares ECS deployment artifacts"
  service_role = aws_iam_role.codebuild_role.arn

  artifacts {
    type = "CODEPIPELINE"
    # Optional: Define secondary artifacts if needed
    # secondary_artifacts { ... }
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0" # Use a recent image
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true # Required for Docker builds
    image_pull_credentials_type = "CODEBUILD" # Assumes ECR is in the same account

    # Optional: Environment variables for buildspec
    # environment_variable {
    #   name  = "EXAMPLE_VAR"
    #   value = "example_value"
    # }
  }

  source {
    type            = "CODEPIPELINE"
    buildspec       = "devops/buildspec.yml" # Ensure this file exists and is updated
    # git_clone_depth = 1 # Optional: Faster clones for shallow history
  }

  # Optional: Configure logs
  logs_config {
    cloudwatch_logs {
      #group_name  = "/aws/codebuild/${aws_codebuild_project.bianca_project.name}"
      #stream_name = "build" # Or keep default
      status      = "ENABLED"
    }
    # s3_logs { ... } # Optional S3 logging
  }

  # Optional: VPC configuration if build needs access to VPC resources
  # vpc_config {
  #   vpc_id             = var.vpc_id
  #   subnets            = var.subnet_ids
  #   security_group_ids = [aws_security_group.codebuild_sg.id] # Need a dedicated SG for CodeBuild
  # }

  # Optional: Caching for faster builds
  # cache {
  #   type  = "LOCAL"
  #   modes = ["LOCAL_DOCKER_LAYER_CACHE", "LOCAL_SOURCE_CACHE"]
  # }
}

# --- CodeDeploy Application and Deployment Group --- (REMOVED)

# resource "aws_codedeploy_app" "bianca_app" { ... }
# resource "aws_codedeploy_deployment_group" "bianca_deployment_group" { ... }


##############################
# Route 53
##############################

# 1. Lookup the hosted zone for myphonefriend.com
data "aws_route53_zone" "myphonefriend" {
  name         = "myphonefriend.com." # Ensure trailing dot
  private_zone = false
}

# 2. Create (or update) the Alias record for app.myphonefriend.com
resource "aws_route53_record" "app_subdomain" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "app.myphonefriend.com"
  type    = "A"

  alias {
    name                   = aws_lb.app_lb.dns_name     # Your ALB's DNS name
    zone_id                = aws_lb.app_lb.zone_id      # The hosted zone ID of your ALB
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "wordpress_apex" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "myphonefriend.com" # or "www.myphonefriend.com" if you prefer
  type    = "A"
  ttl     = "300"
  records = ["192.254.225.221"] # Replace with your HostGator server's IP address
}


##############################
# CodePipeline
##############################

resource "aws_codepipeline" "bianca_pipeline" {
  name     = "BiancaPipeline-ECS-Rolling" # Renamed for clarity
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    type     = "S3"
    location = aws_s3_bucket.artifact_bucket.bucket
    # encryption_key { # Optional: KMS encryption for artifacts
    #   id   = "arn:aws:kms:..."
    #   type = "KMS"
    # }
  }

  stage {
    name = "Source"

    action {
      name             = "SourceAction"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection" # Using GitHub App-based connection
      version          = "1"
      output_artifacts = ["SourceOutput"]
      configuration = {
        ConnectionArn    = var.github_app_connection_arn
        FullRepositoryId = "${var.github_owner}/${var.github_repo}"
        BranchName       = var.github_branch
        # DetectChanges = true # Default is true
        OutputArtifactFormat = "CODE_ZIP" # Default for CodeStarSourceConnection
      }
      run_order = 1
    }
  }

  stage {
    name = "Build"

    action {
      name             = "BuildAction"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceOutput"]
      output_artifacts = ["BuildOutput"] # This will contain imagedefinitions.json
      configuration = {
        ProjectName = aws_codebuild_project.bianca_project.name
        # Optional: Override buildspec environment variables
        # EnvironmentVariables = jsonencode([ ... ])
      }
      run_order = 1
    }
  }

  stage {
    name = "Deploy"

    action {
      name            = "DeployActionECS" # Renamed action
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS" # Changed provider
      version         = "1"
      input_artifacts = ["BuildOutput"] # Expects BuildOutput to contain imagedefinitions.json
      configuration = {
        ClusterName = aws_ecs_cluster.cluster.name
        ServiceName = aws_ecs_service.app_service.name
        # FileName specifies the artifact file containing container image mappings.
        # Ensure your buildspec produces this file in the root of BuildOutput.
        FileName    = "imagedefinitions.json"
      }
      run_order = 1
      # namespace = "DeployVariables" # Optional: Set namespace for variables
    }
  }
  # Optional: Add triggers (e.g., CloudWatch Events)
  # trigger { ... }
}

##############################
# SES and Domain Verification (Keep as is)
##############################

resource "aws_ses_domain_identity" "ses_identity" {
  domain = "myphonefriend.com"
}

resource "aws_route53_record" "ses_verification" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "_amazonses.${aws_ses_domain_identity.ses_identity.domain}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.ses_identity.verification_token]
}

resource "aws_ses_domain_dkim" "ses_dkim" {
  domain = aws_ses_domain_identity.ses_identity.domain
}

resource "aws_route53_record" "ses_dkim_record" {
  count   = 3
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "${element(aws_ses_domain_dkim.ses_dkim.dkim_tokens, count.index)}._domainkey.${aws_ses_domain_identity.ses_identity.domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${element(aws_ses_domain_dkim.ses_dkim.dkim_tokens, count.index)}.dkim.amazonses.com"]
}

##############################################################
# FRP Server (frps) Resources for Local Debug Tunneling
##############################################################

variable "frps_instance_type" {
  description = "EC2 instance type for frps server"
  type        = string
  default     = "t3.micro" # Or t4g.micro for ARM (potentially cheaper)
}

data "aws_ssm_parameter" "amazon_linux_2" {
  name = "/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2"
}

variable "frps_bind_port" {
  description = "TCP port for frpc clients to connect to frps"
  type        = number
  default     = 7000
}

variable "frps_sip_tcp_port" {
  description = "Public TCP port frps will expose for SIP signaling"
  type        = number
  default     = 5060
}

variable "frps_rtp_udp_start_port" {
  description = "Start of public UDP port range frps will expose for RTP"
  type        = number
  default     = 10000
}

variable "frps_rtp_udp_end_port" {
  description = "End of public UDP port range frps will expose for RTP"
  type        = number
  default     = 10100 # Keep range small for security if possible
}

variable "frps_token" {
  description = "Optional secret token for authenticating frpc to frps"
  type        = string
  default     = "RtSHnnUOfSis49XVqgidTGL3P1eggjPd6uKmfm2oiCY="
  sensitive   = true
}

variable "my_dev_ip_cidr" {
  description = "Your local development machine's public IP address in CIDR notation (e.g., 1.2.3.4/32) for SSH and frps access."
  type        = string
  default     = "23.16.17.211/32" # WARNING: Replace with your specific IP/32 for security!
}

variable "twilio_signaling_cidrs" {
  description = "List of CIDR blocks for Twilio SIP signaling (TCP). Get from Twilio Docs."
  type        = list(string)
  default     = ["54.172.60.0/30", "54.244.51.0/30"] # EXAMPLE ONLY - GET CURRENT LIST! Add all relevant NA ranges.
}

variable "twilio_media_cidrs" {
  description = "List of CIDR blocks for Twilio RTP media (UDP). Get from Twilio Docs."
  type        = list(string)
  default     = ["168.86.128.0/18"] # EXAMPLE ONLY - GET CURRENT LIST! This is often a global range.
}

variable "frp_version" {
  description = "Version of FRP to download from GitHub releases for frps"
  type        = string
  default     = "0.62.1" # Match your client version if possible
}

# 1. Static Public IP for the FRP Server
resource "aws_eip" "frps_eip" {
  domain = "vpc" # Use 'vpc' for EC2-VPC, remove if using EC2-Classic (unlikely)

  tags = {
    Name = "frps-eip"
  }
}

# 2. Security Group for the FRP Server
resource "aws_security_group" "frps_sg" {
  name        = "frps-server-sg"
  description = "Allow FRPS client, SIP(TCP), RTP(UDP), and SSH"
  vpc_id      = var.vpc_id # Use the same VPC as your app if possible

  # Allow frpc connection from your dev IP
  ingress {
    description = "FRPS Bind Port from Dev IP"
    from_port   = var.frps_bind_port
    to_port     = var.frps_bind_port
    protocol    = "tcp"
    cidr_blocks = [var.my_dev_ip_cidr] # Restrict to your IP!
  }

  # Allow Twilio SIP Signaling (TCP)
  ingress {
    description = "SIP Signaling (TCP) from Twilio"
    from_port   = var.frps_sip_tcp_port
    to_port     = var.frps_sip_tcp_port
    protocol    = "tcp"
    cidr_blocks = var.twilio_signaling_cidrs # Use list of Twilio IPs
  }

  # Allow Twilio RTP Media (UDP Range)
  ingress {
    description = "RTP Media (UDP) from Twilio"
    from_port   = var.frps_rtp_udp_start_port
    to_port     = var.frps_rtp_udp_end_port
    protocol    = "udp"
    cidr_blocks = var.twilio_media_cidrs # Use list of Twilio IPs
  }

  # Allow SSH from your dev IP (for debugging the instance)
  ingress {
    description = "SSH from Dev IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_dev_ip_cidr] # Restrict to your IP!
  }

  # Allow all outbound traffic (simplest for debugging)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "frps-sg"
  }
}

# 3. EC2 Instance to run frps
# 3. EC2 Instance to run frps
resource "aws_instance" "frps_server" {
  ami           = data.aws_ssm_parameter.amazon_linux_2.value
  instance_type = var.frps_instance_type
  key_name      = "bianca-key-pair"
  vpc_security_group_ids = [aws_security_group.frps_sg.id]
  subnet_id                   = var.subnet_ids[0]
  associate_public_ip_address = true # Required to associate EIP later

  # User data script to install and run frps
  user_data = templatefile("${path.module}/frps_userdata.tftpl", {
    frps_bind_port = var.frps_bind_port,
    frps_token = var.frps_token
    # Add the variable used for download path:
    frp_version    = var.frp_version,
    # Add variables needed for allowPorts in the template:
    frps_sip_tcp_port       = var.frps_sip_tcp_port,
    frps_rtp_udp_start_port = var.frps_rtp_udp_start_port,
    frps_rtp_udp_end_port   = var.frps_rtp_udp_end_port
  })

  tags = {
    Name = "frps-server"
  }
}

# 4. Associate the Elastic IP with the instance
resource "aws_eip_association" "frps_eip_assoc" {
  instance_id   = aws_instance.frps_server.id
  allocation_id = aws_eip.frps_eip.id
}

# 5. Output the public IP address
output "frps_server_public_ip" {
  description = "Public IP address of the FRPS server instance"
  value       = aws_eip.frps_eip.public_ip
}