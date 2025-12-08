################################################################################
# CODEBUILD PROJECT FOR STAGING (EC2 Deployment)
################################################################################

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
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "devops/buildspec-staging.yml"
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
        Resource = aws_codebuild_project.staging_build.arn
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
      }
    ]
  })
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
    action {
      name             = "FrontendSource"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["FrontendSourceOutput"]
      configuration = {
        ConnectionArn        = var.github_app_connection_arn
        FullRepositoryId     = "slampenny/bianca-app-frontend"
        BranchName           = "staging"
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
      input_artifacts  = ["SourceOutput", "FrontendSourceOutput"]
      output_artifacts = ["BuildOutput"]
      configuration = {
        ProjectName   = aws_codebuild_project.staging_build.name
        PrimarySource = "SourceOutput"
      }
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
        ApplicationName     = aws_codedeploy_app.staging.name
        DeploymentGroupName = aws_codedeploy_deployment_group.staging.deployment_group_name
      }
    }
  }

  tags = {
    Name        = "bianca-staging-pipeline"
    Environment = "staging"
  }
}

