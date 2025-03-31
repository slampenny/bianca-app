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

variable "codedeploy_role_name" {
  default = "CodeDeployServiceRole"
}

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

variable "application_name" {
  default = "BiancaApp"
}

variable "deployment_group_name" {
  default = "BiancaDeploymentGroup"
}

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
    description      = "Allow ALB (alb_sg) traffic on port 3000"
    from_port        = 3000
    to_port          = 3000
    protocol         = "tcp"
    security_groups  = [aws_security_group.alb_sg.id]
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

##############################
# ALB Target Groups
##############################

resource "aws_lb_target_group" "app_tg_blue" {
  name        = "bianca-target-group-blue"
  port        = var.container_port    # e.g. 3000
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

resource "aws_lb_target_group" "app_tg_green" {
  name        = "bianca-target-group-green"
  port        = var.container_port    # e.g. 3000
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

##############################
# S3 Bucket and ECR Repository
##############################

resource "aws_s3_bucket" "artifact_bucket" {
  bucket = var.bucket_name
}

resource "aws_ecr_repository" "app_repo" {
  name = var.repository_name
}

##############################
# IAM Roles and Policies
##############################

# CodeBuild Role
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

resource "aws_iam_policy" "codebuild_ecr_policy" {
  name        = "CodeBuildECRPolicy"
  description = "Allow CodeBuild to push Docker images to ECR"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Sid      = "AllowECRPush",
        Effect   = "Allow",
        Action   = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codebuild_ecr_policy_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_ecr_policy.arn
}

resource "aws_iam_policy" "codebuild_ecs_policy" {
  name        = "CodeBuildECSPolicy"
  description = "Allow CodeBuild to register ECS task definitions"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "ecs:RegisterTaskDefinition",
        Resource = "arn:aws:ecs:${var.aws_region}:${var.aws_account_id}:task-definition/${var.service_name}:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codebuild_ecs_policy_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_ecs_policy.arn
}

resource "aws_iam_policy" "codebuild_ecs_describe_policy" {
  name        = "CodeBuildECSDescribePolicy"
  description = "Allow CodeBuild to describe ECS task definitions"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "ecs:DescribeTaskDefinition",
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codebuild_ecs_describe_policy_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_ecs_describe_policy.arn
}

resource "aws_iam_policy" "codebuild_pass_role_policy" {
  name        = "CodeBuildPassRolePolicy"
  description = "Allow CodeBuild to pass the ECS task execution role"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "iam:PassRole",
        Resource = "arn:aws:iam::${var.aws_account_id}:role/${var.ecs_execution_role_name}"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codebuild_pass_role_policy_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_pass_role_policy.arn
}

resource "aws_iam_role_policy_attachment" "codebuild_policy" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess"
}

# CodeDeploy Role
data "aws_iam_policy_document" "codedeploy_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codedeploy.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codedeploy_role" {
  name               = var.codedeploy_role_name
  assume_role_policy = data.aws_iam_policy_document.codedeploy_assume.json
}

resource "aws_iam_role_policy_attachment" "codedeploy_policy" {
  role       = aws_iam_role.codedeploy_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
}

resource "aws_iam_policy" "codedeploy_update_service_policy" {
  name        = "CodeDeployUpdateServicePolicy"
  description = "Allow CodeDeploy to update the primary task set on ECS services"
  policy      = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid      = "AllowUpdateServicePrimaryTaskSet",
        Effect   = "Allow",
        Action   = "ecs:UpdateServicePrimaryTaskSet",
        Resource = "arn:aws:ecs:${var.aws_region}:${var.aws_account_id}:service/${var.cluster_name}/${var.service_name}"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy_update_service_policy_attach" {
  role       = aws_iam_role.codedeploy_role.name
  policy_arn = aws_iam_policy.codedeploy_update_service_policy.arn
}


resource "aws_iam_policy" "codedeploy_ecs_policy" {
  name        = "CodeDeployECSPolicy"
  description = "Allow CodeDeploy to describe ECS services"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Sid      = "AllowDescribeServices",
        Effect   = "Allow",
        Action   = "ecs:DescribeServices",
        Resource = "arn:aws:ecs:${var.aws_region}:${var.aws_account_id}:service/${var.cluster_name}/${var.service_name}"
      }
    ]
  })
}

resource "aws_iam_policy" "codedeploy_pass_task_role_policy" {
  name        = "CodeDeployPassTaskRolePolicy"
  description = "Allow CodeDeploy to pass the ECS task role"
  policy      = jsonencode({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: "iam:PassRole",
        Resource: "arn:aws:iam::${var.aws_account_id}:role/ecsTaskRole"
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "codedeploy_pass_task_role_policy_attach" {
  role       = aws_iam_role.codedeploy_role.name
  policy_arn = aws_iam_policy.codedeploy_pass_task_role_policy.arn
}


resource "aws_iam_role_policy_attachment" "codedeploy_ecs_policy_attach" {
  role       = aws_iam_role.codedeploy_role.name
  policy_arn = aws_iam_policy.codedeploy_ecs_policy.arn
}

resource "aws_iam_policy" "codedeploy_s3_policy" {
  name        = "CodeDeployS3Policy"
  description = "Allow CodeDeploy to read deployment artifacts from S3"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Sid      = "AllowS3Access",
        Effect   = "Allow",
        Action   = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket"
        ],
        Resource = [
          "arn:aws:s3:::${var.bucket_name}",
          "arn:aws:s3:::${var.bucket_name}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy_s3_policy_attach" {
  role       = aws_iam_role.codedeploy_role.name
  policy_arn = aws_iam_policy.codedeploy_s3_policy.arn
}

resource "aws_iam_policy" "codedeploy_elbv2_policy" {
  name        = "CodeDeployELBV2Policy"
  description = "Allow CodeDeploy to perform operations on ELBv2"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Sid      = "AllowDescribeELBv2",
        Effect   = "Allow",
        Action   = [
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeTargetHealth"
        ],
        Resource = "*"
      },
      {
        Sid      = "AllowModifyELBv2",
        Effect   = "Allow",
        Action   = [
          "elasticloadbalancing:ModifyListener",
          "elasticloadbalancing:ModifyRule",
          "elasticloadbalancing:ModifyTargetGroup"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy_elbv2_policy_attach" {
  role       = aws_iam_role.codedeploy_role.name
  policy_arn = aws_iam_policy.codedeploy_elbv2_policy.arn
}

resource "aws_iam_policy" "codedeploy_ecs_createtaskset_policy" {
  name        = "CodeDeployECSCreatetasksetPolicy"
  description = "Allow CodeDeploy to create ECS task sets for blue/green deployments"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Sid      = "AllowCreateTaskSet",
        Effect   = "Allow",
        Action   = "ecs:CreateTaskSet",
        Resource = "arn:aws:ecs:${var.aws_region}:${var.aws_account_id}:task-set/${var.cluster_name}/${var.service_name}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy_ecs_createtaskset_policy_attach" {
  role       = aws_iam_role.codedeploy_role.name
  policy_arn = aws_iam_policy.codedeploy_ecs_createtaskset_policy.arn
}

resource "aws_iam_policy" "codedeploy_ecs_deletetaskset_policy" {
  name        = "CodeDeployECSDeleteTaskSetPolicy"
  description = "Allow CodeDeploy to delete ECS task sets during blue/green deployments"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Sid      = "AllowDeleteTaskSet",
        Effect   = "Allow",
        Action   = "ecs:DeleteTaskSet",
        Resource = "arn:aws:ecs:${var.aws_region}:${var.aws_account_id}:task-set/${var.cluster_name}/${var.service_name}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy_ecs_deletetaskset_policy_attach" {
  role       = aws_iam_role.codedeploy_role.name
  policy_arn = aws_iam_policy.codedeploy_ecs_deletetaskset_policy.arn
}

resource "aws_iam_policy" "codedeploy_pass_role_policy" {
  name        = "CodeDeployPassRolePolicy"
  description = "Allow CodeDeploy to pass the ECS task execution role"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Sid      = "AllowPassECSExecutionRole",
        Effect   = "Allow",
        Action   = "iam:PassRole",
        Resource = "arn:aws:iam::${var.aws_account_id}:role/${var.ecs_execution_role_name}"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy_pass_role_policy_attach" {
  role       = aws_iam_role.codedeploy_role.name
  policy_arn = aws_iam_policy.codedeploy_pass_role_policy.arn
}

# ECS Execution Role
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

# ECS Task Role (required for ECS Exec)
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
        Action   = [
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
        Resource = "arn:aws:secretsmanager:us-east-2:730335291008:secret:MySecretsManagerSecret-LyB1aP"
      }
    ]
  })
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
        Resource = "arn:aws:secretsmanager:us-east-2:730335291008:secret:MySecretsManagerSecret-LyB1aP"
      }
    ]
  })
}

# CodePipeline Role
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
    name   = "CodePipelineSecretsManagerAccess"
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
    name   = "CodePipelineS3AccessPolicy"
    policy = jsonencode({
      Version   = "2012-10-17",
      Statement = [{
        Sid      = "AllowS3Actions",
        Effect   = "Allow",
        Action   = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket"
        ],
        Resource = [
          "arn:aws:s3:::${var.bucket_name}",
          "arn:aws:s3:::${var.bucket_name}/*"
        ]
      }]
    })
  }

  inline_policy {
    name   = "CodePipelineCodeBuildAccess"
    policy = jsonencode({
      Version   = "2012-10-17",
      Statement = [{
        Sid      = "AllowCodeBuildActions",
        Effect   = "Allow",
        Action   = [
          "codebuild:StartBuild",
          "codebuild:BatchGetBuilds"
        ],
        Resource = aws_codebuild_project.bianca_project.arn
      }]
    })
  }

  inline_policy {
    name   = "CodePipelineCodeDeployAccess"
    policy = jsonencode({
      Version   = "2012-10-17",
      Statement = [
        {
          Sid    = "AllowCodeDeployActions",
          Effect = "Allow",
          Action = [
            "codedeploy:CreateDeployment",
            "codedeploy:GetDeploymentConfig",
            "codedeploy:RegisterApplicationRevision",
            "codedeploy:GetDeployment",
            "codedeploy:GetApplicationRevision",
            "codedeploy:ListDeploymentConfigs",
            "codedeploy:ListDeploymentGroups"
          ],
          Resource = [
            "arn:aws:codedeploy:${var.aws_region}:${var.aws_account_id}:deploymentgroup:${var.application_name}/${var.deployment_group_name}",
            "arn:aws:codedeploy:${var.aws_region}:${var.aws_account_id}:deploymentconfig:CodeDeployDefault.ECSAllAtOnce",
            "arn:aws:codedeploy:${var.aws_region}:${var.aws_account_id}:application:${var.application_name}"
          ]
        }
      ]
    })
  }
}

resource "aws_iam_role_policy_attachment" "codepipeline_policy" {
  role       = aws_iam_role.codepipeline_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodePipeline_FullAccess"
}

resource "aws_iam_policy" "codepipeline_connection_policy" {
  name        = "CodePipelineConnectionPolicy"
  description = "Allow CodePipeline to use the GitHub App-based connection"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "codestar-connections:UseConnection",
        Resource = "arn:aws:codeconnections:us-east-2:${var.aws_account_id}:connection/a126dbfd-f253-42e4-811b-cda3ebd5a629"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codepipeline_connection_policy_attach" {
  role       = aws_iam_role.codepipeline_role.name
  policy_arn = aws_iam_policy.codepipeline_connection_policy.arn
}

resource "aws_iam_policy" "codebuild_logs_policy" {
  name        = "CodeBuildLogsPolicy"
  description = "Allow CodeBuild to create log groups, log streams, and put log events in CloudWatch Logs"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codebuild_logs_policy_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_logs_policy.arn
}

resource "aws_iam_policy" "codebuild_artifact_access" {
  name        = "CodeBuildArtifactAccessPolicy"
  description = "Allow CodeBuild to read from and write artifacts to the CodePipeline artifact bucket"
  policy      = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = [
          "s3:GetObject",
          "s3:PutObject"
        ],
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codebuild_artifact_access_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_artifact_access.arn
}

##############################
# ECS Cluster, Task Definition, and Service
##############################

resource "aws_ecs_cluster" "cluster" {
  name = var.cluster_name
}

resource "aws_ecs_task_definition" "app_task" {
  family                   = var.service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  # Add volume configuration for MongoDB
  volume {
    name = "mongodb-data"
    
    efs_volume_configuration {
      file_system_id = aws_efs_file_system.mongodb_data.id
      root_directory = "/"
    }
  }

  container_definitions = jsonencode([
    {
      name         = var.container_name
      image        = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.repository_name}:latest"
      essential    = true
      portMappings = [{
        containerPort = var.container_port
        hostPort      = var.container_port
        protocol      = "tcp"
      }]
      environment = [
        {
          name  = "MONGODB_URL"
          value = "mongodb://mongodb:27017/bianca-app"
        },
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "JWT_SECRET"
          value = "temp-secret-bianca"
        }
      ]
    },
    {
      name         = "mongodb"
      image        = "mongo:4.2.1-bionic"
      essential    = true
      portMappings = [{
        containerPort = 27017
        hostPort      = 27017
        protocol      = "tcp"
      }]
      mountPoints = [{
        sourceVolume  = "mongodb-data"
        containerPath = "/data/db"
      }]
    }
  ])
}

resource "aws_ecs_service" "app_service" {
  name            = var.service_name
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.app_task.arn
  launch_type     = "FARGATE"
  desired_count   = 1

  deployment_controller {
    type = "CODE_DEPLOY"
  }

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.bianca_app_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app_tg_green.arn
    container_name   = var.container_name
    container_port   = var.container_port
  }

  enable_execute_command = true

  lifecycle {
    ignore_changes = [ task_definition, desired_count, load_balancer ]
  }

  depends_on = [
    aws_lb_listener.http_listener,
    aws_lb_listener.https_listener
  ]
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
}

resource "aws_lb_listener" "http_listener" {
  load_balancer_arn = aws_lb.app_lb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301" # Or "HTTP_302" for temporary redirect
    }
  }

  lifecycle {
    ignore_changes = [default_action]
  }
}

resource "aws_lb_listener" "https_listener" {
  load_balancer_arn = aws_lb.app_lb.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = data.aws_acm_certificate.test_cert.arn
  ssl_policy        = "ELBSecurityPolicy-2016-08"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg_green.arn # Or blue, depending on initial state
  }

  lifecycle {
    ignore_changes = [default_action]
  }
}

data "aws_acm_certificate" "test_cert" {
  domain      = "*.myphonefriend.com"
  statuses    = ["ISSUED"]
  most_recent = true
}

##############################
# CodeBuild Project
##############################

resource "aws_codebuild_project" "bianca_project" {
  name         = "bianca"
  service_role = aws_iam_role.codebuild_role.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:4.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "devops/buildspec.yml"
  }
}

resource "aws_iam_role_policy" "codebuild_pass_task_role_policy" {
  name = "CodeBuildPassTaskRolePolicy"
  role = aws_iam_role.codebuild_role.id
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "iam:PassRole",
        Resource = "arn:aws:iam::${var.aws_account_id}:role/ecsTaskRole"
      }
    ]
  })
}

##############################
# CodeDeploy Application and Deployment Group
##############################

resource "aws_codedeploy_app" "bianca_app" {
  name             = var.application_name
  compute_platform = "ECS"
}

resource "aws_codedeploy_deployment_group" "bianca_deployment_group" {
  app_name               = aws_codedeploy_app.bianca_app.name
  deployment_group_name  = var.deployment_group_name
  service_role_arn       = aws_iam_role.codedeploy_role.arn
  deployment_config_name = "CodeDeployDefault.ECSAllAtOnce"

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }

  blue_green_deployment_config {
    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }
    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }
  }

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [aws_lb_listener.https_listener.arn]
      }
      target_group {
        name = aws_lb_target_group.app_tg_green.name
      }
      target_group {
        name = aws_lb_target_group.app_tg_blue.name
      }
    }
  }

  ecs_service {
    cluster_name = aws_ecs_cluster.cluster.name
    service_name = aws_ecs_service.app_service.name
  }
}

##############################
# Route 53
##############################

# 1. Lookup the hosted zone for myphonefriend.com
data "aws_route53_zone" "myphonefriend" {
  name         = "myphonefriend.com."
  private_zone = false
}

# 2. Create (or update) the Alias record for app.myphonefriend.com
resource "aws_route53_record" "app_subdomain" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "app.myphonefriend.com"
  type    = "A"

  alias {
    name                   = aws_lb.app_lb.dns_name   # Your ALB's DNS name
    zone_id                = aws_lb.app_lb.zone_id    # The hosted zone ID of your ALB
    evaluate_target_health = true
  }
}

##############################
# CodePipeline
##############################

resource "aws_codepipeline" "bianca_pipeline" {
  name     = "BiancaPipeline"
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    type     = "S3"
    location = aws_s3_bucket.artifact_bucket.bucket
  }

  stage {
    name = "Source"

    action {
      name             = "SourceAction"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"  # Using GitHub App-based connection
      version          = "1"
      output_artifacts = ["SourceOutput"]
      configuration = {
        ConnectionArn    = var.github_app_connection_arn
        FullRepositoryId = "${var.github_owner}/${var.github_repo}"
        BranchName       = var.github_branch
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
      name            = "DeployAction"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "CodeDeploy"
      version         = "1"
      input_artifacts = ["BuildOutput"]
      configuration = {
        ApplicationName     = aws_codedeploy_app.bianca_app.name
        DeploymentGroupName = aws_codedeploy_deployment_group.bianca_deployment_group.deployment_group_name
      }
      run_order = 1
    }
  }
}

# Create a domain identity for SES
resource "aws_ses_domain_identity" "ses_identity" {
  domain = "myphonefriend.com"
}

# Create a TXT record for domain verification in Route 53
resource "aws_route53_record" "ses_verification" {
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "_amazonses.${aws_ses_domain_identity.ses_identity.domain}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.ses_identity.verification_token]
}

# Enable DKIM for the domain
resource "aws_ses_domain_dkim" "ses_dkim" {
  domain = aws_ses_domain_identity.ses_identity.domain
}

# Create CNAME records for DKIM verification (SES generates 3 DKIM tokens)
resource "aws_route53_record" "ses_dkim_record" {
  count   = 3
  zone_id = data.aws_route53_zone.myphonefriend.zone_id
  name    = "${element(aws_ses_domain_dkim.ses_dkim.dkim_tokens, count.index)}._domainkey.${aws_ses_domain_identity.ses_identity.domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${element(aws_ses_domain_dkim.ses_dkim.dkim_tokens, count.index)}.dkim.amazonses.com"]
}