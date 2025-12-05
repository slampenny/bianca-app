################################################################################
# CODEBUILD PROJECT FOR PLAYWRIGHT E2E TESTS
################################################################################

resource "aws_codebuild_project" "playwright_tests" {
  name         = "bianca-playwright-e2e-tests"
  description  = "Runs Playwright E2E tests for Bianca frontend"
  service_role = data.terraform_remote_state.backend.outputs.codebuild_role_arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_LARGE"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "NODE_ENV"
      value = "test"
    }
    environment_variable {
      name  = "API_BASE_URL"
      value = "http://localhost:3000/v1"
    }
    environment_variable {
      name  = "MONGODB_URL"
      value = "mongodb://localhost:27017/bianca-app-test"
    }
    # AWS configuration for Secrets Manager access
    environment_variable {
      name  = "AWS_REGION"
      value = "us-east-2"
    }
    # Use staging secret with test keys (not production live keys!)
    environment_variable {
      name  = "AWS_SECRET_ID"
      value = "MySecretsManagerSecret-Staging"
    }
    # Load secrets from AWS Secrets Manager - using STAGING secret with TEST keys
    # Format: secret-name:json-key:version-stage (optional)
    # IMPORTANT: Staging uses test keys, production uses live keys
    environment_variable {
      name  = "JWT_SECRET"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:JWT_SECRET::"
    }
    environment_variable {
      name  = "OPENAI_API_KEY"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:OPENAI_API_KEY::"
    }
    environment_variable {
      name  = "STRIPE_SECRET_KEY"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:STRIPE_SECRET_KEY::"
    }
    environment_variable {
      name  = "TWILIO_AUTHTOKEN"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:TWILIO_AUTHTOKEN::"
    }
    # Additional secrets that may be needed
    environment_variable {
      name  = "STRIPE_PUBLISHABLE_KEY"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:STRIPE_PUBLISHABLE_KEY::"
    }
    environment_variable {
      name  = "MFA_ENCRYPTION_KEY"
      type  = "SECRETS_MANAGER"
      value = "MySecretsManagerSecret-Staging:MFA_ENCRYPTION_KEY::"
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "devops/buildspec-playwright.yml"
  }

  logs_config {
    cloudwatch_logs {
      status     = "ENABLED"
      group_name = "/aws/codebuild/bianca-playwright-e2e-tests"
    }
  }

  tags = {
    Name        = "bianca-playwright-e2e-tests"
    Environment = "test"
  }
}

################################################################################
# CODEPIPELINE FOR PLAYWRIGHT E2E TESTS
################################################################################

resource "aws_codepipeline" "playwright_test_pipeline" {
  name     = "BiancaPlaywright-Test-Pipeline"
  role_arn = data.terraform_remote_state.backend.outputs.codepipeline_role_arn

  artifact_store {
    type     = "S3"
    location = data.terraform_remote_state.backend.outputs.artifact_bucket_name
  }

  stage {
    name = "Source"
    action {
      name             = "FrontendSource"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["FrontendSourceOutput"]
      configuration = {
        ConnectionArn        = var.github_app_connection_arn
        FullRepositoryId     = "${var.frontend_github_owner}/${var.frontend_github_repo}"
        BranchName           = var.frontend_github_branch
        OutputArtifactFormat = "CODE_ZIP"
      }
      run_order = 1
    }
    action {
      name             = "BackendSource"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["BackendSourceOutput"]
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
    name = "Test"
    action {
      name             = "PlaywrightTests"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["FrontendSourceOutput", "BackendSourceOutput"]
      output_artifacts = ["TestResults"]
      configuration = {
        ProjectName   = aws_codebuild_project.playwright_tests.name
        PrimarySource = "FrontendSourceOutput"
      }
      run_order = 1
    }
  }

  tags = {
    Name        = "BiancaPlaywright-Test-Pipeline"
    Environment = "test"
  }
}

################################################################################
# VARIABLES FOR BACKEND SOURCE
################################################################################

variable "github_owner" {
  description = "GitHub owner for the backend repo"
  type        = string
  default     = "slampenny"
}

variable "github_repo" {
  description = "GitHub repo name for the backend"
  type        = string
  default     = "bianca-app-backend"
}

variable "github_branch" {
  description = "Branch to watch for backend source in test pipeline"
  type        = string
  default     = "staging"
}

