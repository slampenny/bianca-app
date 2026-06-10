################################################################################
# Post-pipeline build notifications (staging + production)
# Email jlapp@biancatechnologies.com with subject "build successful" or "build failed".
################################################################################

variable "pipeline_notification_email" {
  description = "Email address for CodePipeline success/failure notifications"
  type        = string
  default     = "jlapp@biancatechnologies.com"
}

resource "aws_sns_topic" "pipeline_build_notifications" {
  name         = "bianca-pipeline-build-notifications"
  display_name = "Bianca pipeline builds"

  tags = {
    Name    = "bianca-pipeline-build-notifications"
    Purpose = "CodePipeline post-build email alerts"
  }
}

resource "aws_sns_topic_subscription" "pipeline_build_notifications_email" {
  topic_arn = aws_sns_topic.pipeline_build_notifications.arn
  protocol  = "email"
  endpoint  = var.pipeline_notification_email
  # AWS sends a confirmation email to the endpoint on first apply.
}

resource "aws_iam_role" "pipeline_notify_lambda" {
  name = "bianca-pipeline-notify-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Purpose = "CodePipeline build notification Lambda"
  }
}

resource "aws_iam_role_policy" "pipeline_notify_lambda" {
  name = "bianca-pipeline-notify-lambda-policy"
  role = aws_iam_role.pipeline_notify_lambda.id

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
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = aws_sns_topic.pipeline_build_notifications.arn
      },
      {
        Effect = "Allow"
        Action = [
          "codepipeline:ListActionExecutions"
        ]
        Resource = [
          aws_codepipeline.production.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "codebuild:BatchGetBuilds"
        ]
        Resource = "arn:aws:codebuild:${var.aws_region}:${var.aws_account_id}:project/bianca-*"
      }
    ]
  })
}

data "archive_file" "pipeline_notify_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda-pipeline-notify"
  output_path = "${path.module}/lambda-pipeline-notify.zip"
}

resource "aws_lambda_function" "pipeline_notify" {
  filename         = data.archive_file.pipeline_notify_lambda.output_path
  function_name    = "bianca-pipeline-notify"
  role             = aws_iam_role.pipeline_notify_lambda.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  timeout          = 60
  source_code_hash = data.archive_file.pipeline_notify_lambda.output_base64sha256

  environment {
    variables = {
      SNS_TOPIC_ARN  = aws_sns_topic.pipeline_build_notifications.arn
      AWS_ACCOUNT_ID = var.aws_account_id
    }
  }

  depends_on = [
    aws_iam_role_policy.pipeline_notify_lambda,
    data.archive_file.pipeline_notify_lambda
  ]

  tags = {
    Purpose = "CodePipeline build notification"
  }
}

resource "aws_cloudwatch_event_rule" "pipeline_execution_state" {
  name        = "bianca-pipeline-execution-notify"
  description = "Notify on production CodePipeline success or failure"

  event_pattern = jsonencode({
    source      = ["aws.codepipeline"]
    detail-type = ["CodePipeline Pipeline Execution State Change"]
    detail = {
      state = ["SUCCEEDED", "FAILED"]
      pipeline = [
        aws_codepipeline.production.name
      ]
    }
  })
}

resource "aws_cloudwatch_event_target" "pipeline_notify" {
  rule      = aws_cloudwatch_event_rule.pipeline_execution_state.name
  target_id = "PipelineNotifyLambda"
  arn       = aws_lambda_function.pipeline_notify.arn
}

resource "aws_lambda_permission" "pipeline_notify_eventbridge" {
  statement_id  = "AllowEventBridgeInvokePipelineNotify"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pipeline_notify.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.pipeline_execution_state.arn
}

output "pipeline_build_notification_topic_arn" {
  description = "SNS topic for pipeline build success/failure emails"
  value       = aws_sns_topic.pipeline_build_notifications.arn
}
