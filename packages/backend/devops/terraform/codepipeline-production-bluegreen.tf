# Production Blue-Green Deployment (same setup as staging, production env vars)
# Adds CreateGreenInstance, Deploy to green, PostDeployValidation (green), SwapAndTerminate

################################################################################
# CODEBUILD: CREATE GREEN INSTANCE (PRODUCTION)
################################################################################
resource "aws_codebuild_project" "production_create_green_instance" {
  name         = "bianca-production-create-green-instance"
  description  = "Creates a new green instance for production blue-green deployment"
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
      name  = "LAUNCH_TEMPLATE_NAME"
      value = aws_launch_template.production_green.name
    }
    environment_variable {
      name  = "SUBNET_ID"
      value = aws_subnet.production_public.id
    }
    environment_variable {
      name  = "SECURITY_GROUP_ID"
      value = aws_security_group.production.id
    }
    environment_variable {
      name  = "INSTANCE_PROFILE_NAME"
      value = aws_iam_instance_profile.production_profile.name
    }
    environment_variable {
      name  = "KEY_NAME"
      value = var.asterisk_key_pair_name
    }
    environment_variable {
      name  = "GREEN_TAG"
      value = "bianca-production-green"
    }
    environment_variable {
      name  = "BLUE_TAG"
      value = "bianca-production"
    }
    environment_variable {
      name  = "ENVIRONMENT_TAG"
      value = "production"
    }
    environment_variable {
      name  = "CODEPIPELINE_NAME"
      value = "bianca-production-pipeline"
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "packages/backend/devops/buildspec-create-green-instance.yml"
  }

  logs_config {
    cloudwatch_logs {
      status     = "ENABLED"
      group_name = "/aws/codebuild/bianca-production-create-green-instance"
    }
  }

  tags = {
    Name        = "bianca-production-create-green-instance"
    Environment = "production"
  }
}

################################################################################
# CODEBUILD: SWAP AND TERMINATE (PRODUCTION)
################################################################################
resource "aws_codebuild_project" "production_swap_and_terminate" {
  name         = "bianca-production-swap-and-terminate"
  description  = "Swaps ALB target groups to green instance and terminates old blue instance"
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
      name  = "API_TARGET_GROUP_ARN"
      value = aws_lb_target_group.production_api.arn
    }
    environment_variable {
      name  = "FRONTEND_TARGET_GROUP_ARN"
      value = aws_lb_target_group.production_app.arn
    }
    environment_variable {
      name  = "GREEN_TAG"
      value = "bianca-production-green"
    }
    environment_variable {
      name  = "BLUE_TAG"
      value = "bianca-production"
    }
    # EIP allocation ID for production SIP (sip.myphonefriend.com). After swap we associate this
    # with the new blue instance so Twilio/Asterisk SIP keeps working.
    environment_variable {
      name  = "PRODUCTION_EIP_ALLOCATION_ID"
      value = aws_eip.production.id
    }
    # Must match aws_ebs_volume.production_mongodb tag Name (staging uses bianca-staging-mongodb-data)
    environment_variable {
      name  = "MONGODB_DATA_VOLUME_TAG"
      value = aws_ebs_volume.production_mongodb.tags["Name"]
    }
    environment_variable {
      name  = "ADMIN_URL"
      value = "https://admin.biancawellness.com"
    }
    environment_variable {
      name  = "CODEPIPELINE_NAME"
      value = "bianca-production-pipeline"
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "packages/backend/devops/buildspec-swap-and-terminate.yml"
  }

  logs_config {
    cloudwatch_logs {
      status     = "ENABLED"
      group_name = "/aws/codebuild/bianca-production-swap-and-terminate"
    }
  }

  tags = {
    Name        = "bianca-production-swap-and-terminate"
    Environment = "production"
  }
}
