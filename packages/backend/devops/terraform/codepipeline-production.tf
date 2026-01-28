################################################################################
# CODEBUILD PROJECT FOR PRODUCTION (EC2 Deployment)
################################################################################

resource "aws_codebuild_project" "production_build" {
  name         = "bianca-production-build"
  description  = "Builds Docker images for Bianca production and pushes to ECR"
  service_role = aws_iam_role.codebuild_production_role.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "AWS_DEFAULT_REGION"
      value = var.aws_region
    }
    environment_variable {
      name  = "AWS_ACCOUNT_ID"
      value = var.aws_account_id
    }
    environment_variable {
      name  = "ECR_REGISTRY"
      value = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    }
    # Production secrets - backend will load from AWS Secrets Manager at runtime
    environment_variable {
      name  = "AWS_SECRET_ID"
      value = "MySecretsManagerSecret"
    }
    environment_variable {
      name  = "AWS_REGION"
      value = var.aws_region
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "packages/backend/devops/buildspec-production.yml"
  }

  logs_config {
    cloudwatch_logs {
      status     = "ENABLED"
      group_name = "/aws/codebuild/bianca-production-build"
    }
  }

  tags = {
    Name        = "bianca-production-build"
    Environment = "production"
  }
}

################################################################################
# CODEBUILD PROJECT FOR TESTS (PRODUCTION)
################################################################################
# NOTE: This project runs with NODE_ENV=test to ensure tests use test configuration
# (e.g., Ethereal Mail instead of SES, test database, etc.)
# This is DIFFERENT from the production deploy which uses NODE_ENV=production

resource "aws_codebuild_project" "production_tests" {
  name         = "bianca-production-tests"
  description  = "Runs unit tests (backend and frontend) and Cucumber E2E tests for production pipeline"
  service_role = aws_iam_role.codebuild_production_role.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_MEDIUM"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "AWS_DEFAULT_REGION"
      value = var.aws_region
    }
    # CRITICAL: Set NODE_ENV=test for test stage (NOT production!)
    # This ensures tests use test configuration (Ethereal Mail, test DB, etc.)
    environment_variable {
      name  = "NODE_ENV"
      value = "test"
    }
    environment_variable {
      name  = "MONGODB_URL"
      value = "mongodb://localhost:27017/bianca-app-test"
    }
    environment_variable {
      name  = "API_BASE_URL"
      value = "http://localhost:3000/v1"
    }
    # Production secrets - inject directly from AWS Secrets Manager
    environment_variable {
      name  = "AWS_SECRET_ID"
      value = "MySecretsManagerSecret"
    }
    environment_variable {
      name  = "AWS_REGION"
      value = var.aws_region
    }
    environment_variable {
      name  = "ECR_REGISTRY"
      value = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    }
    # Inject secrets from Secrets Manager (CodeBuild handles permissions automatically)
    environment_variable {
      name  = "JWT_SECRET"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret:JWT_SECRET::"
    }
    environment_variable {
      name  = "STRIPE_SECRET_KEY"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret:STRIPE_SECRET_KEY::"
    }
    environment_variable {
      name  = "STRIPE_PUBLISHABLE_KEY"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret:STRIPE_PUBLISHABLE_KEY::"
    }
    # Use test key for tests - prevents hitting real OpenAI API during test runs
    # Tests mock OpenAI services, but setting a test key provides extra safety
    environment_variable {
      name  = "OPENAI_API_KEY"
      value = "test-openai-api-key-for-testing-only"
    }
    environment_variable {
      name  = "MFA_ENCRYPTION_KEY"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret:MFA_ENCRYPTION_KEY::"
    }
    environment_variable {
      name  = "TWILIO_AUTHTOKEN"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret:TWILIO_AUTHTOKEN::"
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "packages/frontend/devops/buildspec-playwright.yml"
  }

  logs_config {
    cloudwatch_logs {
      status     = "ENABLED"
      group_name = "/aws/codebuild/bianca-production-tests"
    }
  }

  tags = {
    Name        = "bianca-production-tests"
    Environment = "production"
  }
}

################################################################################
# CODEBUILD PROJECT FOR POST-DEPLOYMENT VALIDATION (PRODUCTION)
################################################################################
# Validates that the deployed site is actually accessible via public URLs
# This runs AFTER deployment to catch issues like 503 errors, ALB problems, etc.

resource "aws_codebuild_project" "production_post_deploy_validation" {
  name         = "bianca-production-post-deploy-validation"
  description  = "Validates that deployed production site is accessible via public URLs"
  service_role = aws_iam_role.codebuild_production_role.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = false
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "AWS_DEFAULT_REGION"
      value = var.aws_region
    }
    environment_variable {
      name  = "FRONTEND_URL"
      value = "https://app.biancawellness.com"
    }
    environment_variable {
      name  = "API_URL"
      value = "https://api.biancawellness.com"
    }
    environment_variable {
      name  = "MAX_RETRIES"
      value = "20"
    }
    environment_variable {
      name  = "RETRY_DELAY"
      value = "10"
    }
    environment_variable {
      name  = "GREEN_TAG"
      value = "bianca-production-green"
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "packages/backend/devops/buildspec-post-deploy-validation.yml"
  }

  logs_config {
    cloudwatch_logs {
      status     = "ENABLED"
      group_name = "/aws/codebuild/bianca-production-post-deploy-validation"
    }
  }

  tags = {
    Name        = "bianca-production-post-deploy-validation"
    Environment = "production"
  }
}

################################################################################
# IAM ROLE FOR CODEBUILD (PRODUCTION)
################################################################################

resource "aws_iam_role" "codebuild_production_role" {
  name = "bianca-codebuild-production-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codebuild.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = "production"
    Purpose     = "CodeBuild service role for production"
  }
}

resource "aws_iam_role_policy" "codebuild_production_policy" {
  name = "bianca-codebuild-production-policy"
  role = aws_iam_role.codebuild_production_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
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
          "ssm:SendCommand",
          "ssm:GetCommandInvocation",
          "ssm:ListCommands",
          "ssm:ListCommandInvocations",
          "ec2:DescribeInstances",
          "ec2:DescribeInstanceInformation"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:MySecretsManagerSecret-*",
          "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:MySecretsManagerSecret"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:RunInstances",
          "ec2:TerminateInstances",
          "ec2:DescribeInstanceStatus",
          "ec2:DescribeInstanceAttribute",
          "ec2:CreateTags",
          "ec2:DeleteTags",
          "ec2:DescribeTags",
          "ec2:DescribeInstances",
          "ec2:DescribeLaunchTemplates",
          "ec2:DescribeLaunchTemplateVersions"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:RegisterTargets",
          "elasticloadbalancing:DeregisterTargets",
          "elasticloadbalancing:DescribeTargetHealth",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeLoadBalancers"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = aws_iam_role.production_role.arn
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ec2.amazonaws.com"
          }
        }
      }
    ]
  })
}

################################################################################
# IAM ROLE FOR CODEPIPELINE (PRODUCTION)
################################################################################

resource "aws_iam_role" "codepipeline_production_role" {
  name = "bianca-codepipeline-production-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codepipeline.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = "production"
    Purpose     = "CodePipeline service role for production"
  }
}

resource "aws_iam_role_policy" "codepipeline_production_policy" {
  name = "bianca-codepipeline-production-policy"
  role = aws_iam_role.codepipeline_production_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
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
          "codebuild:StartBuild",
          "codebuild:StopBuild",
          "codebuild:BatchGetBuilds"
        ]
        Resource = [
          aws_codebuild_project.production_build.arn,
          aws_codebuild_project.production_tests.arn,
          aws_codebuild_project.production_post_deploy_validation.arn,
          aws_codebuild_project.production_create_green_instance.arn,
          aws_codebuild_project.production_swap_and_terminate.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "codedeploy:CreateDeployment",
          "codedeploy:GetApplication",
          "codedeploy:GetApplicationRevision",
          "codedeploy:GetDeployment",
          "codedeploy:GetDeploymentConfig",
          "codedeploy:RegisterApplicationRevision",
          "codedeploy:ListDeploymentConfigs"
        ]
        Resource = [
          aws_codedeploy_app.production.arn,
          "arn:aws:codedeploy:${var.aws_region}:${var.aws_account_id}:deploymentgroup:bianca-production/*",
          "arn:aws:codedeploy:${var.aws_region}:${var.aws_account_id}:deploymentconfig:*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = [
          aws_iam_role.codebuild_production_role.arn
        ]
        Condition = {
          StringEqualsIfExists = {
            "iam:PassedToService" = "codebuild.amazonaws.com"
          }
        }
      },
      {
        Effect   = "Allow"
        Action   = "codestar-connections:UseConnection"
        Resource = var.github_app_connection_arn
      },
      {
        Effect   = "Allow"
        Action   = "codestar-connections:PassConnection"
        Resource = var.github_app_connection_arn
        Condition = {
          StringEquals = {
            "codestar-connections:PassedToService" = "codepipeline.amazonaws.com"
          }
        }
      }
    ]
  })
}

# NOTE: Production pipeline runs tests BEFORE deployment. Blue-green stages added in codepipeline-production-bluegreen.tf
# Tests must pass before deployment proceeds to prevent deploying broken code

################################################################################
# CODEPIPELINE FOR PRODUCTION
################################################################################

resource "aws_codepipeline" "production" {
  name     = "bianca-production-pipeline"
  role_arn = aws_iam_role.codepipeline_production_role.arn

  artifact_store {
    type     = "S3"
    location = aws_s3_bucket.codedeploy_production_artifacts.bucket
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
        BranchName           = "main"
        OutputArtifactFormat = "CODE_ZIP"
      }
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
        ProjectName   = aws_codebuild_project.production_build.name
        PrimarySource = "SourceOutput"
      }
    }
  }

  stage {
    name = "RunTests"
    action {
      name             = "RunTests"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceOutput", "BuildOutput"]
      output_artifacts = ["TestOutput"]
      configuration = {
        ProjectName   = aws_codebuild_project.production_tests.name
        PrimarySource = "SourceOutput"
      }
      run_order = 1
    }
  }

  stage {
    name = "CreateGreenInstance"
    action {
      name             = "CreateGreenInstance"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceOutput"]
      output_artifacts = ["GreenInstanceOutput"]
      configuration = {
        ProjectName   = aws_codebuild_project.production_create_green_instance.name
        PrimarySource = "SourceOutput"
      }
      run_order = 1
    }
  }

  stage {
    name = "Deploy"
    action {
      name            = "Deploy"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "CodeDeploy"
      version         = "1"
      input_artifacts = ["BuildOutput"]
      configuration = {
        ApplicationName     = aws_codedeploy_app.production.name
        DeploymentGroupName = aws_codedeploy_deployment_group.production_green.deployment_group_name
      }
    }
  }

  stage {
    name = "PostDeployValidation"
    action {
      name             = "ValidateDeployment"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceOutput", "GreenInstanceOutput"]
      output_artifacts = ["ValidationOutput"]
      configuration = {
        ProjectName   = aws_codebuild_project.production_post_deploy_validation.name
        PrimarySource = "SourceOutput"
      }
      run_order = 1
    }
  }

  stage {
    name = "SwapAndTerminate"
    action {
      name             = "SwapAndTerminate"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceOutput", "GreenInstanceOutput"]
      output_artifacts = ["SwapOutput"]
      configuration = {
        ProjectName   = aws_codebuild_project.production_swap_and_terminate.name
        PrimarySource = "SourceOutput"
      }
      run_order = 1
    }
  }

  tags = {
    Name        = "bianca-production-pipeline"
    Environment = "production"
  }
}

