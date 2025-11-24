# CodeDeploy for Production EC2 Instance
# This replaces the SSM/SSH deployment method with a more reliable CodeDeploy approach

################################################################################
# IAM ROLE FOR CODEDEPLOY (PRODUCTION)
################################################################################

resource "aws_iam_role" "codedeploy_production_service_role" {
  name = "bianca-codedeploy-production-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = "production"
    Purpose     = "CodeDeploy service role"
  }
}

resource "aws_iam_role_policy_attachment" "codedeploy_production_service_role" {
  role       = aws_iam_role.codedeploy_production_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
}

################################################################################
# IAM ROLE FOR EC2 INSTANCE (CodeDeploy Agent) - PRODUCTION
################################################################################

resource "aws_iam_role" "codedeploy_production_ec2_role" {
  name = "bianca-codedeploy-production-ec2-role"

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
    Purpose     = "CodeDeploy EC2 instance role"
  }
}

resource "aws_iam_role_policy" "codedeploy_production_ec2_policy" {
  name = "bianca-codedeploy-production-ec2-policy"
  role = aws_iam_role.codedeploy_production_ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.codedeploy_production_artifacts.arn,
          "${aws_s3_bucket.codedeploy_production_artifacts.arn}/*"
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
      }
    ]
  })
}

# Add CodeDeploy permissions to existing production instance role
# The production_role is defined in production.tf
resource "aws_iam_role_policy" "production_codedeploy_policy" {
  name = "bianca-production-codedeploy-policy"
  role = aws_iam_role.production_role.id

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
          aws_s3_bucket.codedeploy_production_artifacts.arn,
          "${aws_s3_bucket.codedeploy_production_artifacts.arn}/*"
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

################################################################################
# S3 BUCKET FOR CODEDEPLOY ARTIFACTS (PRODUCTION)
################################################################################

resource "aws_s3_bucket" "codedeploy_production_artifacts" {
  bucket = "bianca-codedeploy-production-artifacts-${var.aws_account_id}"

  tags = {
    Environment = "production"
    Purpose     = "CodeDeploy deployment artifacts"
  }
}

resource "aws_s3_bucket_versioning" "codedeploy_production_artifacts" {
  bucket = aws_s3_bucket.codedeploy_production_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "codedeploy_production_artifacts" {
  bucket = aws_s3_bucket.codedeploy_production_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "codedeploy_production_artifacts" {
  bucket = aws_s3_bucket.codedeploy_production_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

################################################################################
# CODEDEPLOY APPLICATION (PRODUCTION)
################################################################################

resource "aws_codedeploy_app" "production" {
  name             = "bianca-production"
  compute_platform = "Server"

  tags = {
    Environment = "production"
    Name        = "bianca-production"
  }
}

################################################################################
# CODEDEPLOY DEPLOYMENT GROUP (PRODUCTION)
################################################################################

resource "aws_codedeploy_deployment_group" "production" {
  app_name              = aws_codedeploy_app.production.name
  deployment_group_name = "bianca-production-ec2"
  service_role_arn      = aws_iam_role.codedeploy_production_service_role.arn

  ec2_tag_filter {
    key   = "Name"
    type  = "KEY_AND_VALUE"
    value = "bianca-production"
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
    Environment = "production"
    Name        = "bianca-production-ec2"
  }
}

################################################################################
# UPDATE PRODUCTION INSTANCE TO USE CODEDEPLOY IAM PROFILE
################################################################################

# Note: This requires updating the production instance's IAM instance profile
# We'll need to add the codedeploy_production_ec2_profile to the existing instance profile
# or update the launch template to include it

