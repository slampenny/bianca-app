# CodeDeploy for Staging EC2 Instance
# This replaces the SSM/SSH deployment method with a more reliable CodeDeploy approach

################################################################################
# IAM ROLE FOR CODEDEPLOY
################################################################################

resource "aws_iam_role" "codedeploy_service_role" {
  name = "bianca-codedeploy-service-role"

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
    Environment = "staging"
    Purpose     = "CodeDeploy service role"
  }
}

resource "aws_iam_role_policy_attachment" "codedeploy_service_role" {
  role       = aws_iam_role.codedeploy_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
}

################################################################################
# IAM ROLE FOR EC2 INSTANCE (CodeDeploy Agent)
################################################################################

resource "aws_iam_role" "codedeploy_ec2_role" {
  name = "bianca-codedeploy-ec2-role"

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
    Environment = "staging"
    Purpose     = "CodeDeploy EC2 instance role"
  }
}

resource "aws_iam_role_policy" "codedeploy_ec2_policy" {
  name = "bianca-codedeploy-ec2-policy"
  role = aws_iam_role.codedeploy_ec2_role.id

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
          aws_s3_bucket.codedeploy_artifacts.arn,
          "${aws_s3_bucket.codedeploy_artifacts.arn}/*"
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

# Add CodeDeploy permissions to existing staging instance role
# The staging_instance_role is defined in staging.tf
resource "aws_iam_role_policy" "staging_codedeploy_policy" {
  name = "bianca-staging-codedeploy-policy"
  role = aws_iam_role.staging_instance_role.id

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
          aws_s3_bucket.codedeploy_artifacts.arn,
          "${aws_s3_bucket.codedeploy_artifacts.arn}/*"
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

################################################################################
# S3 BUCKET FOR CODEDEPLOY ARTIFACTS
################################################################################

resource "aws_s3_bucket" "codedeploy_artifacts" {
  bucket = "bianca-codedeploy-artifacts-${var.aws_account_id}"

  tags = {
    Environment = "staging"
    Purpose     = "CodeDeploy deployment artifacts"
  }
}

resource "aws_s3_bucket_versioning" "codedeploy_artifacts" {
  bucket = aws_s3_bucket.codedeploy_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "codedeploy_artifacts" {
  bucket = aws_s3_bucket.codedeploy_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "codedeploy_artifacts" {
  bucket = aws_s3_bucket.codedeploy_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

################################################################################
# CODEDEPLOY APPLICATION
################################################################################

resource "aws_codedeploy_app" "staging" {
  name             = "bianca-staging"
  compute_platform = "Server"

  tags = {
    Environment = "staging"
    Name        = "bianca-staging"
  }
}

################################################################################
# CODEDEPLOY DEPLOYMENT GROUP
################################################################################

resource "aws_codedeploy_deployment_group" "staging" {
  app_name              = aws_codedeploy_app.staging.name
  deployment_group_name = "bianca-staging-ec2"
  service_role_arn      = aws_iam_role.codedeploy_service_role.arn

  ec2_tag_filter {
    key   = "Name"
    type  = "KEY_AND_VALUE"
    value = "bianca-staging"
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
    Environment = "staging"
    Name        = "bianca-staging-ec2"
  }
}

################################################################################
# UPDATE STAGING INSTANCE TO USE CODEDEPLOY IAM PROFILE
################################################################################

# Note: This requires updating the staging instance's IAM instance profile
# We'll need to add the codedeploy_ec2_profile to the existing instance profile
# or update the launch template to include it

