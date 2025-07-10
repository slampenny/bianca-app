# --- Data sources for shared resources ---
data "aws_route53_zone" "myphonefriend" {
  name = "myphonefriend.com."
}

data "aws_ecs_cluster" "main" {
  cluster_name = "bianca-cluster"
}

data "aws_lb" "app_lb" {
  name = "bianca-load-balancer"
}

data "aws_lb_listener" "http" {
  load_balancer_arn = data.aws_lb.app_lb.arn
  port              = 80
}

data "aws_lb_listener" "https" {
  load_balancer_arn = data.aws_lb.app_lb.arn
  port              = 443
}

data "aws_subnet" "private_a" {
  filter {
    name   = "tag:Name"
    values = ["bianca-private-a"]
  }
}

data "aws_subnet" "private_b" {
  filter {
    name   = "tag:Name"
    values = ["bianca-private-b"]
  }
}

data "aws_security_group" "alb_sg" {
  filter {
    name   = "group-name"
    values = ["alb-sg"]
  }
}

data "aws_security_group" "vpc_endpoints_sg" {
  filter {
    name   = "group-name"
    values = ["vpc-endpoints-sg"]
  }
}

data "aws_iam_role" "ecs_execution_role" {
  name = "ecsTaskExecutionRole"
}

data "aws_iam_role" "ecs_task_role" {
  name = "ecsTaskRole"
}

data "aws_ecr_repository" "frontend_repo" {
  name = "bianca-app-frontend"
}

# --- CloudWatch Log Group for Frontend ---
resource "aws_cloudwatch_log_group" "frontend_log_group" {
  name              = "/ecs/bianca-frontend"
  retention_in_days = 14
  tags              = { Name = "bianca-frontend-logs" }
}

# --- ALB Target Group for Frontend ---
resource "aws_lb_target_group" "frontend_tg" {
  name        = "bianca-frontend-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = data.aws_lb.app_lb.vpc_id
  target_type = "ip"
  health_check {
    path                = "/"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
    port                = "traffic-port"
    protocol            = "HTTP"
  }
  tags = { Name = "bianca-frontend-tg" }
}

# --- ALB Listener Rule for Frontend (HTTP) ---
resource "aws_lb_listener_rule" "frontend_http" {
  listener_arn = data.aws_lb_listener.http.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend_tg.arn
  }
  condition {
    host_header {
      values = ["app.myphonefriend.com"]
    }
  }
}

# --- ALB Listener Rule for Frontend (HTTPS) ---
resource "aws_lb_listener_rule" "frontend_https" {
  listener_arn = data.aws_lb_listener.https.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend_tg.arn
  }
  condition {
    host_header {
      values = ["app.myphonefriend.com"]
    }
  }
}

# --- ECS Task Definition for Frontend ---
resource "aws_ecs_task_definition" "frontend_task" {
  family                   = "bianca-frontend-service"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = data.aws_iam_role.ecs_execution_role.arn
  task_role_arn            = data.aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "bianca-frontend"
      image     = "${data.aws_ecr_repository.frontend_repo.repository_url}:latest"
      essential = true
      portMappings = [
        { containerPort = 80, hostPort = 80, protocol = "tcp" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend_log_group.name
          "awslogs-region"        = "us-east-2"
          "awslogs-stream-prefix" = "frontend"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost/ || exit 1"]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 30
      }
    }
  ])
  tags = { Name = "bianca-frontend-service" }
}

# --- ECS Service for Frontend ---
resource "aws_ecs_service" "frontend_service" {
  name            = "bianca-frontend-service"
  cluster         = data.aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend_task.arn
  launch_type     = "FARGATE"
  platform_version = "LATEST"
  desired_count   = 1
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 0
  enable_execute_command             = true
  health_check_grace_period_seconds  = 60

  network_configuration {
    subnets          = [data.aws_subnet.private_a.id, data.aws_subnet.private_b.id]
    security_groups  = [data.aws_security_group.alb_sg.id, data.aws_security_group.vpc_endpoints_sg.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend_tg.arn
    container_name   = "bianca-frontend"
    container_port   = 80
  }

  lifecycle { ignore_changes = [desired_count] }

  depends_on = [
    aws_lb_listener_rule.frontend_http,
    aws_lb_listener_rule.frontend_https
  ]
  tags = { Name = "bianca-frontend-service" }
}

# --- CodeBuild project for Frontend ---
resource "aws_codebuild_project" "frontend_project" {
  name          = "bianca-frontend-build"
  description   = "Builds Docker image for Bianca frontend"
  service_role  = data.terraform_remote_state.backend.outputs.codebuild_role_arn

  artifacts {
    type = "CODEPIPELINE"
  }

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
  tags = { Name = "bianca-frontend-build" }
}

# --- CodePipeline for Frontend ---
variable "frontend_github_owner" {
  description = "GitHub owner for the frontend repo"
  type        = string
  default     = "slampenny"
}

variable "frontend_github_repo" {
  description = "GitHub repo name for the frontend"
  type        = string
  default     = "bianca-app-frontend"
}

variable "frontend_github_branch" {
  description = "Branch to watch for frontend pipeline"
  type        = string
  default     = "main"
}

variable "github_app_connection_arn" {
  description = "GitHub App connection ARN for CodePipeline (shared with backend)"
  type        = string
  default     = "arn:aws:codeconnections:us-east-2:730335291008:connection/a126dbfd-f253-42e4-811b-cda3ebd5a629"
}

data "terraform_remote_state" "backend" {
  backend = "s3"
  config = {
    bucket = "bianca-terraform-state"
    key    = "backend/terraform.tfstate"
    region = "us-east-2"
  }
}

resource "aws_codepipeline" "frontend_pipeline" {
  name     = "BiancaFrontend-ECS-Pipeline"
  role_arn = data.terraform_remote_state.backend.outputs.codepipeline_role_arn

  artifact_store {
    type     = "S3"
    location = data.terraform_remote_state.backend.outputs.artifact_bucket_name
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
        FullRepositoryId     = "${var.frontend_github_owner}/${var.frontend_github_repo}"
        BranchName           = var.frontend_github_branch
        OutputArtifactFormat = "CODE_ZIP"
      }
      run_order = 1
    }
  }

  stage {
    name = "Build"
    action {
      name             = "BuildFrontend"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceOutput"]
      output_artifacts = ["BuildOutputFrontend"]
      configuration = {
        ProjectName = aws_codebuild_project.frontend_project.name
      }
      run_order = 1
    }
  }

  stage {
    name = "Deploy"
    action {
      name            = "DeployFrontendECS"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      version         = "1"
      input_artifacts = ["BuildOutputFrontend"]
      configuration = {
        ClusterName = data.aws_ecs_cluster.main.cluster_name
        ServiceName = aws_ecs_service.frontend_service.name
        FileName    = "imagedefinitions_frontend.json"
      }
      run_order = 1
    }
  }
  tags = { Name = "BiancaFrontend-ECS-Pipeline" }
} 