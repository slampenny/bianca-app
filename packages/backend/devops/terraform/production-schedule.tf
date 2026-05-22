# production-schedule.tf
# Cost control: start production EC2 at a fixed local time daily, stop at noon.
# Uses EventBridge Scheduler (timezone-aware cron) + Lambda (start/stop primary instance).

variable "production_ec2_cost_schedule_enabled" {
  description = "When true, EventBridge Scheduler runs daily start/stop for the production EC2 instance."
  type        = bool
  default     = true
}

variable "production_schedule_timezone" {
  description = "IANA timezone for production start/stop windows (e.g. America/Los_Angeles for Pacific, America/New_York for Eastern)."
  type        = string
  default     = "America/Los_Angeles"
}

variable "production_schedule_start_hour" {
  description = "Local hour (0-23) to start production EC2."
  type        = number
  default     = 7
}

variable "production_schedule_start_minute" {
  description = "Local minute (0-59) to start production EC2."
  type        = number
  default     = 0
}

variable "production_schedule_stop_hour" {
  description = "Local hour (0-23) to stop production EC2."
  type        = number
  default     = 13
}

variable "production_schedule_stop_minute" {
  description = "Local minute (0-59) to stop production EC2."
  type        = number
  default     = 0
}

locals {
  production_schedule_start_cron = format(
    "cron(%d %d * * ? *)",
    var.production_schedule_start_minute,
    var.production_schedule_start_hour
  )
  production_schedule_stop_cron = format(
    "cron(%d %d * * ? *)",
    var.production_schedule_stop_minute,
    var.production_schedule_stop_hour
  )
}

# --- Lambda: start/stop primary production instance (tag Name=bianca-production) ---

resource "aws_iam_role" "production_ec2_scheduler_lambda" {
  name = "bianca-production-ec2-scheduler-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = {
    Environment = "production"
    Purpose     = "ec2-cost-schedule"
  }
}

resource "aws_iam_role_policy" "production_ec2_scheduler_lambda" {
  name = "bianca-production-ec2-scheduler-lambda-policy"
  role = aws_iam_role.production_ec2_scheduler_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:StartInstances",
          "ec2:StopInstances"
        ]
        Resource = "*"
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

resource "aws_lambda_function" "production_ec2_scheduler" {
  filename         = data.archive_file.production_ec2_scheduler.output_path
  function_name    = "bianca-production-ec2-scheduler"
  role             = aws_iam_role.production_ec2_scheduler_lambda.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  timeout          = 120
  source_code_hash = data.archive_file.production_ec2_scheduler.output_base64sha256

  environment {
    variables = {
      INSTANCE_ID = aws_instance.production.id
    }
  }

  depends_on = [
    aws_iam_role_policy.production_ec2_scheduler_lambda,
    data.archive_file.production_ec2_scheduler
  ]

  tags = {
    Environment = "production"
    Purpose     = "ec2-cost-schedule"
  }
}

data "archive_file" "production_ec2_scheduler" {
  type        = "zip"
  output_path = "${path.module}/production-ec2-scheduler.zip"

  source {
    filename = "index.py"
    content  = <<-PY
import boto3
import json
import os

def handler(event, context):
    if isinstance(event, str):
        try:
            event = json.loads(event)
        except json.JSONDecodeError:
            event = {}
    action = (event or {}).get("action")
    instance_id = os.environ.get("INSTANCE_ID")
    if not instance_id:
        return {"statusCode": 500, "body": "INSTANCE_ID missing"}

    ec2 = boto3.client("ec2")
    resp = ec2.describe_instances(InstanceIds=[instance_id])
    inst = resp["Reservations"][0]["Instances"][0]
    state = inst["State"]["Name"]

    if action == "start":
        if state == "running":
            return {"statusCode": 200, "body": "already running"}
        if state == "stopped":
            ec2.start_instances(InstanceIds=[instance_id])
            return {"statusCode": 200, "body": "start initiated"}
        return {"statusCode": 200, "body": f"skip start from state={state}"}

    if action == "stop":
        if state == "stopped":
            return {"statusCode": 200, "body": "already stopped"}
        if state == "running":
            ec2.stop_instances(InstanceIds=[instance_id])
            return {"statusCode": 200, "body": "stop initiated"}
        return {"statusCode": 200, "body": f"skip stop from state={state}"}

    return {"statusCode": 400, "body": f"unknown action={action}"}
PY
  }
}

# --- EventBridge Scheduler invokes Lambda ---

resource "aws_iam_role" "production_ec2_scheduler_invoke" {
  name = "bianca-production-ec2-scheduler-invoke"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "scheduler.amazonaws.com"
      }
    }]
  })

  tags = {
    Environment = "production"
    Purpose     = "ec2-cost-schedule"
  }
}

resource "aws_iam_role_policy" "production_ec2_scheduler_invoke" {
  name = "bianca-production-ec2-scheduler-invoke-policy"
  role = aws_iam_role.production_ec2_scheduler_invoke.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction"]
      Resource = aws_lambda_function.production_ec2_scheduler.arn
    }]
  })
}

resource "aws_scheduler_schedule_group" "production_ec2" {
  name = "bianca-production-ec2-scheduler"
}

resource "aws_scheduler_schedule" "production_ec2_start" {
  count = var.production_ec2_cost_schedule_enabled ? 1 : 0

  name                         = "bianca-production-ec2-start"
  group_name                   = aws_scheduler_schedule_group.production_ec2.name
  state                        = "ENABLED"
  schedule_expression          = local.production_schedule_start_cron
  schedule_expression_timezone = var.production_schedule_timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.production_ec2_scheduler.arn
    role_arn = aws_iam_role.production_ec2_scheduler_invoke.arn
    input    = jsonencode({ action = "start" })
  }
}

resource "aws_scheduler_schedule" "production_ec2_stop" {
  count = var.production_ec2_cost_schedule_enabled ? 1 : 0

  name                         = "bianca-production-ec2-stop"
  group_name                   = aws_scheduler_schedule_group.production_ec2.name
  state                        = "ENABLED"
  schedule_expression          = local.production_schedule_stop_cron
  schedule_expression_timezone = var.production_schedule_timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.production_ec2_scheduler.arn
    role_arn = aws_iam_role.production_ec2_scheduler_invoke.arn
    input    = jsonencode({ action = "stop" })
  }
}

resource "aws_lambda_permission" "production_ec2_scheduler_start" {
  count = var.production_ec2_cost_schedule_enabled ? 1 : 0

  statement_id  = "AllowEventBridgeSchedulerStart"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.production_ec2_scheduler.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.production_ec2_start[0].arn
}

resource "aws_lambda_permission" "production_ec2_scheduler_stop" {
  count = var.production_ec2_cost_schedule_enabled ? 1 : 0

  statement_id  = "AllowEventBridgeSchedulerStop"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.production_ec2_scheduler.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.production_ec2_stop[0].arn
}

output "production_ec2_schedule_summary" {
  description = "Human-readable summary of production EC2 cost schedule (after apply)."
  value = var.production_ec2_cost_schedule_enabled ? format(
    "Production EC2 %s: start %s, stop %s (%s)",
    aws_instance.production.id,
    local.production_schedule_start_cron,
    local.production_schedule_stop_cron,
    var.production_schedule_timezone
  ) : "Production EC2 cost schedule disabled (production_ec2_cost_schedule_enabled=false)."
}
