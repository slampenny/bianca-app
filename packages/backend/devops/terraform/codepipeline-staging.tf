################################################################################
# CODEBUILD PROJECT FOR STAGING (EC2 Deployment)
################################################################################
# NOTE: This project does NOT set NODE_ENV - it builds Docker images for staging
# The actual NODE_ENV=staging is set during CodeDeploy deployment (see before_install.sh)
# This ensures the build stage doesn't accidentally use test configuration

resource "aws_codebuild_project" "staging_build" {
  name         = "bianca-staging-build"
  description  = "Builds Docker images for Bianca staging and pushes to ECR"
  service_role = aws_iam_role.codebuild_staging_role.arn

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
    # Staging secrets - backend will load from AWS Secrets Manager at runtime
    environment_variable {
      name  = "AWS_SECRET_ID"
      value = "MySecretsManagerSecret-Staging"
    }
    environment_variable {
      name  = "AWS_REGION"
      value = var.aws_region
    }
    # NOTE: NODE_ENV is NOT set here - it's set to "staging" during CodeDeploy deployment
    # This ensures the build stage doesn't use test configuration
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "packages/backend/devops/buildspec-staging.yml"
  }

  logs_config {
    cloudwatch_logs {
      status     = "ENABLED"
      group_name = "/aws/codebuild/bianca-staging-build"
    }
  }

  tags = {
    Name        = "bianca-staging-build"
    Environment = "staging"
  }
}

################################################################################
# IAM ROLE FOR CODEBUILD (STAGING)
################################################################################

resource "aws_iam_role" "codebuild_staging_role" {
  name = "bianca-codebuild-staging-role"

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
    Environment = "staging"
    Purpose     = "CodeBuild service role for staging"
  }
}

resource "aws_iam_role_policy" "codebuild_staging_policy" {
  name = "bianca-codebuild-staging-policy"
  role = aws_iam_role.codebuild_staging_role.id

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
          aws_s3_bucket.codedeploy_artifacts.arn,
          "${aws_s3_bucket.codedeploy_artifacts.arn}/*"
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
          "ec2:RunInstances",
          "ec2:TerminateInstances",
          "ec2:DescribeInstanceStatus",
          "ec2:DescribeInstanceAttribute",
          "ec2:CreateTags",
          "ec2:DeleteTags",
          "ec2:DescribeTags",
          "ec2:DescribeInstances",
          "ec2:DescribeLaunchTemplates",
          "ec2:DescribeLaunchTemplateVersions",
          "ec2:AllocateAddress",
          "ec2:AssociateAddress",
          "ec2:DisassociateAddress",
          "ec2:ReleaseAddress",
          "ec2:DescribeAddresses",
          "ec2:AttachVolume",
          "ec2:DetachVolume",
          "ec2:DescribeVolumes",
          "ec2:CreateVolume",
          "ec2:DeleteVolume"
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
      # Terraform state (SwapAndTerminate updates state after blue-green so next apply doesn't recreate instance)
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.terraform_state.arn,
          "${aws_s3_bucket.terraform_state.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:MySecretsManagerSecret-*",
          "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:MySecretsManagerSecret-Staging-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "codepipeline:GetPipeline"
        ]
        Resource = "arn:aws:codepipeline:${var.aws_region}:${var.aws_account_id}:bianca-staging-pipeline"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = aws_iam_role.staging_instance_role.arn
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
# IAM ROLE FOR CODEPIPELINE (STAGING)
################################################################################

resource "aws_iam_role" "codepipeline_staging_role" {
  name = "bianca-codepipeline-staging-role"

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
    Environment = "staging"
    Purpose     = "CodePipeline service role for staging"
  }
}

resource "aws_iam_role_policy" "codepipeline_staging_policy" {
  name = "bianca-codepipeline-staging-policy"
  role = aws_iam_role.codepipeline_staging_role.id

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
          aws_s3_bucket.codedeploy_artifacts.arn,
          "${aws_s3_bucket.codedeploy_artifacts.arn}/*"
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
          aws_codebuild_project.staging_build.arn,
          aws_codebuild_project.staging_tests.arn,
          aws_codebuild_project.staging_post_deploy_validation.arn,
          aws_codebuild_project.staging_create_green_instance.arn,
          aws_codebuild_project.staging_swap_and_terminate.arn
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
          aws_codedeploy_app.staging.arn,
          "arn:aws:codedeploy:${var.aws_region}:${var.aws_account_id}:deploymentgroup:bianca-staging/*",
          "arn:aws:codedeploy:${var.aws_region}:${var.aws_account_id}:deploymentconfig:*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = aws_iam_role.codebuild_staging_role.arn
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

################################################################################
# CODEBUILD PROJECT FOR POST-DEPLOYMENT VALIDATION (STAGING)
################################################################################
# Validates that the deployed site is actually accessible via public URLs
# This runs AFTER deployment to catch issues like 503 errors, ALB problems, etc.
# This is different from smoke tests which only test the build locally

resource "aws_codebuild_project" "staging_post_deploy_validation" {
  name         = "bianca-staging-post-deploy-validation"
  description  = "Validates that deployed staging site is accessible via public URLs"
  service_role = aws_iam_role.codebuild_staging_role.arn

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
      value = "https://staging.biancawellness.com"
    }
    environment_variable {
      name  = "API_URL"
      value = "https://staging-api.biancawellness.com"
    }
    environment_variable {
      name  = "MAX_RETRIES"
      value = "20"
    }
    environment_variable {
      name  = "RETRY_DELAY"
      value = "10"
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "packages/backend/devops/buildspec-post-deploy-validation.yml"
  }

  logs_config {
    cloudwatch_logs {
      status     = "ENABLED"
      group_name = "/aws/codebuild/bianca-staging-post-deploy-validation"
    }
  }

  tags = {
    Name        = "bianca-staging-post-deploy-validation"
    Environment = "staging"
  }
}

################################################################################
# CODEBUILD PROJECT FOR BLUE-GREEN: CREATE GREEN INSTANCE
################################################################################
# Creates a new "green" instance before deployment for blue-green deployment

resource "aws_codebuild_project" "staging_create_green_instance" {
  name         = "bianca-staging-create-green-instance"
  description  = "Creates a new green instance for blue-green deployment"
  service_role = aws_iam_role.codebuild_staging_role.arn

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
      name  = "LAUNCH_TEMPLATE_NAME"
      value = aws_launch_template.staging.name
    }
    environment_variable {
      name  = "SUBNET_ID"
      value = aws_subnet.staging_public.id
    }
    environment_variable {
      name  = "SECURITY_GROUP_ID"
      value = aws_security_group.staging.id
    }
    environment_variable {
      name  = "INSTANCE_PROFILE_NAME"
      value = aws_iam_instance_profile.staging_profile.name
    }
    environment_variable {
      name  = "KEY_NAME"
      value = var.asterisk_key_pair_name
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "packages/backend/devops/buildspec-create-green-instance.yml"
  }

  logs_config {
    cloudwatch_logs {
      status     = "ENABLED"
      group_name = "/aws/codebuild/bianca-staging-create-green-instance"
    }
  }

  tags = {
    Name        = "bianca-staging-create-green-instance"
    Environment = "staging"
  }
}

################################################################################
# CODEBUILD PROJECT FOR BLUE-GREEN: SWAP AND TERMINATE
################################################################################
# Swaps ALB target groups to point to green instance, then terminates old blue instance

resource "aws_codebuild_project" "staging_swap_and_terminate" {
  name         = "bianca-staging-swap-and-terminate"
  description  = "Swaps ALB target groups to green instance and terminates old blue instance"
  service_role = aws_iam_role.codebuild_staging_role.arn

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
      name  = "API_TARGET_GROUP_ARN"
      value = aws_lb_target_group.staging_api.arn
    }
    environment_variable {
      name  = "FRONTEND_TARGET_GROUP_ARN"
      value = aws_lb_target_group.staging_frontend.arn
    }
    # EIP allocation ID for staging SIP (staging-sip.*). After swap we associate this
    # with the new blue instance so Twilio/Asterisk SIP keeps working.
    environment_variable {
      name  = "STAGING_EIP_ALLOCATION_ID"
      value = aws_eip.staging.id
    }
    # Must match aws_ebs_volume.staging_mongodb tag Name (swap script finds the correct volume; prod uses a different tag)
    environment_variable {
      name  = "MONGODB_DATA_VOLUME_TAG"
      value = aws_ebs_volume.staging_mongodb.tags["Name"]
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "packages/backend/devops/buildspec-swap-and-terminate.yml"
  }

  logs_config {
    cloudwatch_logs {
      status     = "ENABLED"
      group_name = "/aws/codebuild/bianca-staging-swap-and-terminate"
    }
  }

  tags = {
    Name        = "bianca-staging-swap-and-terminate"
    Environment = "staging"
  }
}

################################################################################
# CODEBUILD PROJECT FOR TESTS (STAGING)
################################################################################
# NOTE: This project runs with NODE_ENV=test to ensure tests use test configuration
# (e.g., Ethereal Mail instead of SES, test database, etc.)
# This is DIFFERENT from the staging deploy which uses NODE_ENV=staging

resource "aws_codebuild_project" "staging_tests" {
  name         = "bianca-staging-tests"
  description  = "Runs unit tests (backend and frontend) and Cucumber E2E tests for staging pipeline"
  service_role = aws_iam_role.codebuild_staging_role.arn

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
    # CRITICAL: Set NODE_ENV=test for test stage (NOT staging!)
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
    # Staging secrets - inject directly from AWS Secrets Manager
    environment_variable {
      name  = "AWS_SECRET_ID"
      value = "MySecretsManagerSecret-Staging"
    }
    environment_variable {
      name  = "AWS_REGION"
      value = var.aws_region
    }
    environment_variable {
      name  = "ECR_REGISTRY"
      value = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    }
    # Staging Build pushes :staging tags (buildspec-playwright defaults match this)
    environment_variable {
      name  = "BIANCA_ECR_IMAGE_TAG"
      value = "staging"
    }
    environment_variable {
      name  = "CODEPIPELINE_NAME"
      value = "bianca-staging-pipeline"
    }
    # Inject secrets from Secrets Manager (CodeBuild handles permissions automatically)
    environment_variable {
      name  = "JWT_SECRET"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:JWT_SECRET::"
    }
    environment_variable {
      name  = "STRIPE_SECRET_KEY"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:STRIPE_SECRET_KEY::"
    }
    environment_variable {
      name  = "STRIPE_PUBLISHABLE_KEY"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:STRIPE_PUBLISHABLE_KEY::"
    }
    environment_variable {
      name  = "OPENAI_API_KEY"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:OPENAI_API_KEY::"
    }
    environment_variable {
      name  = "MFA_ENCRYPTION_KEY"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:MFA_ENCRYPTION_KEY::"
    }
    environment_variable {
      name  = "TWILIO_AUTHTOKEN"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:TWILIO_AUTHTOKEN::"
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "packages/mobile/devops/buildspec-playwright.yml"
  }

  logs_config {
    cloudwatch_logs {
      status     = "ENABLED"
      group_name = "/aws/codebuild/bianca-staging-tests"
    }
  }

  tags = {
    Name        = "bianca-staging-tests"
    Environment = "staging"
  }
}

################################################################################
# CODEPIPELINE FOR STAGING
################################################################################

resource "aws_codepipeline" "staging" {
  name     = "bianca-staging-pipeline"
  role_arn = aws_iam_role.codepipeline_staging_role.arn

  artifact_store {
    type     = "S3"
    location = aws_s3_bucket.codedeploy_artifacts.bucket
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
        BranchName           = "staging"
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
        ProjectName   = aws_codebuild_project.staging_build.name
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
        ProjectName   = aws_codebuild_project.staging_create_green_instance.name
        PrimarySource = "SourceOutput"
      }
      run_order = 1
    }
  }

  # Deploy stage: Deploy to green instance
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
        ApplicationName     = aws_codedeploy_app.staging.name
        DeploymentGroupName = aws_codedeploy_deployment_group.staging_green.deployment_group_name
      }
      run_order = 1
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
        ProjectName   = aws_codebuild_project.staging_post_deploy_validation.name
        PrimarySource = "SourceOutput"
      }
      run_order = 1
    }
  }

  # Swap proceeds as soon as Deploy and PostDeployValidation pass
  # This keeps staging deployments fast for rapid iteration
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
        ProjectName   = aws_codebuild_project.staging_swap_and_terminate.name
        PrimarySource = "SourceOutput"
      }
      run_order = 1
    }
  }

  # Staging: RunTests runs after swap for monitoring/feedback, but does NOT block deployment.
  # This allows fast iterations in staging while still getting test feedback.
  # Production pipeline runs tests BEFORE swap to ensure safety.
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
        ProjectName   = aws_codebuild_project.staging_tests.name
        PrimarySource = "SourceOutput"
      }
      run_order = 1
    }
  }

  tags = {
    Name        = "bianca-staging-pipeline"
    Environment = "staging"
  }
}

