################################################################################
# HIPAA-Compliant Automated Backup Infrastructure
# 
# Requirements Met:
# - Daily automated backups (HIPAA §164.308(a)(7)(ii)(A))
# - Encryption at rest and in transit
# - 7-year retention policy
# - Automated testing and verification
# - Audit logging
# - Monitoring and alerting
################################################################################

################################################################################
# KMS Key for Backup Encryption
################################################################################

resource "aws_kms_key" "backup_encryption" {
  description             = "KMS key for HIPAA-compliant database backups"
  deletion_window_in_days = 30
  enable_key_rotation     = true # Annual automatic rotation

  tags = {
    Name        = "${var.environment}-backup-encryption-key"
    Environment = var.environment
    Purpose     = "HIPAA-backup-encryption"
    Compliance  = "HIPAA"
  }
}

resource "aws_kms_alias" "backup_encryption_alias" {
  name          = "alias/${var.environment}-backup-encryption"
  target_key_id = aws_kms_key.backup_encryption.key_id
}

# Key policy for backup operations
resource "aws_kms_key_policy" "backup_encryption_policy" {
  key_id = aws_kms_key.backup_encryption.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.aws_account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Lambda to encrypt/decrypt backups"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.backup_lambda_role.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:DescribeKey",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow S3 to use key for server-side encryption"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })
}

################################################################################
# S3 Bucket for Encrypted Backups
################################################################################

resource "aws_s3_bucket" "hipaa_backups" {
  bucket = "${var.environment}-bianca-hipaa-backups"

  tags = {
    Name        = "${var.environment}-hipaa-backups"
    Environment = var.environment
    Purpose     = "HIPAA-encrypted-database-backups"
    Compliance  = "HIPAA"
  }
}

# Block all public access (HIPAA requirement)
resource "aws_s3_bucket_public_access_block" "hipaa_backups" {
  bucket = aws_s3_bucket.hipaa_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for backup protection
resource "aws_s3_bucket_versioning" "hipaa_backups" {
  bucket = aws_s3_bucket.hipaa_backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption with KMS (HIPAA requirement)
resource "aws_s3_bucket_server_side_encryption_configuration" "hipaa_backups" {
  bucket = aws_s3_bucket.hipaa_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.backup_encryption.id
    }
    bucket_key_enabled = true
  }
}

# 7-year retention lifecycle policy (HIPAA requirement)
resource "aws_s3_bucket_lifecycle_configuration" "hipaa_backups" {
  bucket = aws_s3_bucket.hipaa_backups.id

  # Daily backups: 90 days, then transition to cheaper storage
  rule {
    id     = "daily-backups-lifecycle"
    status = "Enabled"

    filter {
      prefix = "daily/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA" # Infrequent Access (cheaper)
    }

    transition {
      days          = 60
      storage_class = "GLACIER_IR" # Instant Retrieval Glacier
    }

    expiration {
      days = 90 # Daily backups kept for 90 days
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  # Weekly backups: 1 year retention
  rule {
    id     = "weekly-backups-lifecycle"
    status = "Enabled"

    filter {
      prefix = "weekly/"
    }

    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }

    expiration {
      days = 365 # Weekly backups kept for 1 year
    }
  }

  # Monthly backups: 3 years retention
  rule {
    id     = "monthly-backups-lifecycle"
    status = "Enabled"

    filter {
      prefix = "monthly/"
    }

    transition {
      days          = 180
      storage_class = "GLACIER" # Glacier Flexible Retrieval (old name in Terraform)
    }

    expiration {
      days = 1095 # 3 years
    }
  }

  # Annual backups: 7 years retention (HIPAA requirement)
  rule {
    id     = "annual-backups-lifecycle"
    status = "Enabled"

    filter {
      prefix = "annual/"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE" # Lowest cost for long-term (not GLACIER_DEEP_ARCHIVE)
    }

    expiration {
      days = 2555 # 7 years (HIPAA requirement)
    }
  }
}

# Enable access logging (audit trail)
resource "aws_s3_bucket" "backup_access_logs" {
  bucket = "${var.environment}-bianca-backup-access-logs"

  tags = {
    Name        = "${var.environment}-backup-access-logs"
    Environment = var.environment
    Purpose     = "Audit trail for backup bucket access"
  }
}

resource "aws_s3_bucket_public_access_block" "backup_access_logs" {
  bucket = aws_s3_bucket.backup_access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_logging" "hipaa_backups_logging" {
  bucket = aws_s3_bucket.hipaa_backups.id

  target_bucket = aws_s3_bucket.backup_access_logs.id
  target_prefix = "backup-access-logs/"
}

################################################################################
# SNS Topic for Backup Notifications
################################################################################

resource "aws_sns_topic" "backup_notifications" {
  name              = "${var.environment}-backup-notifications"
  display_name      = "HIPAA Backup Alerts"
  kms_master_key_id = aws_kms_key.backup_encryption.id # Encrypt SNS messages

  tags = {
    Name        = "${var.environment}-backup-notifications"
    Environment = var.environment
    Purpose     = "Backup success/failure notifications"
  }
}

resource "aws_sns_topic_subscription" "backup_email" {
  topic_arn = aws_sns_topic.backup_notifications.arn
  protocol  = "email"
  endpoint  = var.backup_notification_email # Define this variable

  # Note: This will send confirmation email that must be clicked
}

# Optional: Add more subscribers
# resource "aws_sns_topic_subscription" "backup_sms" {
#   topic_arn = aws_sns_topic.backup_notifications.arn
#   protocol  = "sms"
#   endpoint  = "+1234567890" # On-call phone number
# }

################################################################################
# Lambda Function for Backup Execution
################################################################################

# IAM Role for Lambda
resource "aws_iam_role" "backup_lambda_role" {
  name = "${var.environment}-backup-lambda-role"

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
    Name        = "${var.environment}-backup-lambda-role"
    Environment = var.environment
  }
}

# IAM Policy for Lambda backup operations
resource "aws_iam_role_policy" "backup_lambda_policy" {
  name = "${var.environment}-backup-lambda-policy"
  role = aws_iam_role.backup_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # CloudWatch Logs
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        # S3 Backup Bucket Access
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.hipaa_backups.arn,
          "${aws_s3_bucket.hipaa_backups.arn}/*"
        ]
      },
      {
        # KMS for Encryption
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.backup_encryption.arn
      },
      {
        # SNS for Notifications
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.backup_notifications.arn
      },
      {
        # Secrets Manager for MongoDB credentials
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:${var.environment}/*"
      },
      {
        # EC2 for VPC access (if MongoDB in VPC)
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda function code will be uploaded separately
resource "aws_lambda_function" "mongodb_backup" {
  filename         = "${path.module}/lambda-backup.zip" # We'll create this
  function_name    = "${var.environment}-mongodb-backup"
  role            = aws_iam_role.backup_lambda_role.arn
  handler         = "index.handler"
  source_code_hash = fileexists("${path.module}/lambda-backup.zip") ? filebase64sha256("${path.module}/lambda-backup.zip") : null
  runtime         = "nodejs18.x"
  timeout         = 900 # 15 minutes (enough for large database dumps)
  memory_size     = 1024 # 1GB RAM

  environment {
    variables = {
      MONGODB_URL_SECRET_NAME = "${var.environment}/mongodb-url" # Secrets Manager secret name
      S3_BUCKET              = aws_s3_bucket.hipaa_backups.id
      KMS_KEY_ID             = aws_kms_key.backup_encryption.id
      SNS_TOPIC_ARN          = aws_sns_topic.backup_notifications.arn
      ENVIRONMENT            = var.environment
      RETENTION_DAYS_DAILY   = "90"
      RETENTION_DAYS_WEEKLY  = "365"
      RETENTION_DAYS_MONTHLY = "1095"
      RETENTION_DAYS_ANNUAL  = "2555" # 7 years
    }
  }

  # If MongoDB is in VPC (recommended), add VPC configuration
  # vpc_config {
  #   subnet_ids         = var.subnet_ids
  #   security_group_ids = [aws_security_group.backup_lambda_sg.id]
  # }

  tags = {
    Name        = "${var.environment}-mongodb-backup"
    Environment = var.environment
    Purpose     = "HIPAA-automated-backups"
    Compliance  = "HIPAA"
  }
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "backup_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.mongodb_backup.function_name}"
  retention_in_days = 365 # 1 year retention for backup logs

  tags = {
    Name        = "${var.environment}-backup-lambda-logs"
    Environment = var.environment
  }
}

################################################################################
# EventBridge Rule for Daily Backups (2 AM EST)
################################################################################

resource "aws_cloudwatch_event_rule" "daily_backup" {
  name                = "${var.environment}-daily-mongodb-backup"
  description         = "Trigger MongoDB backup daily at 2 AM EST"
  schedule_expression = "cron(0 7 * * ? *)" # 7 AM UTC = 2 AM EST

  tags = {
    Name        = "${var.environment}-daily-backup-schedule"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "backup_lambda" {
  rule      = aws_cloudwatch_event_rule.daily_backup.name
  target_id = "BackupLambda"
  arn       = aws_lambda_function.mongodb_backup.arn

  input = jsonencode({
    backupType = "daily"
    timestamp  = "$${aws.events.event.time}"
  })
}

# Allow EventBridge to invoke Lambda
resource "aws_lambda_permission" "allow_eventbridge_daily" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mongodb_backup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_backup.arn
}

################################################################################
# EventBridge Rule for Weekly Backups (Sunday 3 AM EST)
################################################################################

resource "aws_cloudwatch_event_rule" "weekly_backup" {
  name                = "${var.environment}-weekly-mongodb-backup"
  description         = "Trigger MongoDB backup weekly on Sunday at 3 AM EST"
  schedule_expression = "cron(0 8 ? * SUN *)" # 8 AM UTC Sunday = 3 AM EST Sunday

  tags = {
    Name        = "${var.environment}-weekly-backup-schedule"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "weekly_backup_lambda" {
  rule      = aws_cloudwatch_event_rule.weekly_backup.name
  target_id = "WeeklyBackupLambda"
  arn       = aws_lambda_function.mongodb_backup.arn

  input = jsonencode({
    backupType = "weekly"
    timestamp  = "$${aws.events.event.time}"
  })
}

resource "aws_lambda_permission" "allow_eventbridge_weekly" {
  statement_id  = "AllowExecutionFromEventBridgeWeekly"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mongodb_backup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_backup.arn
}

################################################################################
# EventBridge Rule for Monthly Backups (1st of month, 4 AM EST)
################################################################################

resource "aws_cloudwatch_event_rule" "monthly_backup" {
  name                = "${var.environment}-monthly-mongodb-backup"
  description         = "Trigger MongoDB backup monthly on 1st at 4 AM EST"
  schedule_expression = "cron(0 9 1 * ? *)" # 9 AM UTC on 1st = 4 AM EST on 1st

  tags = {
    Name        = "${var.environment}-monthly-backup-schedule"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "monthly_backup_lambda" {
  rule      = aws_cloudwatch_event_rule.monthly_backup.name
  target_id = "MonthlyBackupLambda"
  arn       = aws_lambda_function.mongodb_backup.arn

  input = jsonencode({
    backupType = "monthly"
    timestamp  = "$${aws.events.event.time}"
  })
}

resource "aws_lambda_permission" "allow_eventbridge_monthly" {
  statement_id  = "AllowExecutionFromEventBridgeMonthly"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mongodb_backup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monthly_backup.arn
}

################################################################################
# Backup Verification Lambda (Tests Restore)
################################################################################

resource "aws_lambda_function" "backup_verification" {
  filename         = "${path.module}/lambda-verify-backup.zip"
  function_name    = "${var.environment}-backup-verification"
  role            = aws_iam_role.backup_lambda_role.arn
  handler         = "verify.handler"
  source_code_hash = fileexists("${path.module}/lambda-verify-backup.zip") ? filebase64sha256("${path.module}/lambda-verify-backup.zip") : null
  runtime         = "nodejs18.x"
  timeout         = 900
  memory_size     = 2048 # More memory for restore testing

  environment {
    variables = {
      S3_BUCKET              = aws_s3_bucket.hipaa_backups.id
      KMS_KEY_ID             = aws_kms_key.backup_encryption.id
      SNS_TOPIC_ARN          = aws_sns_topic.backup_notifications.arn
      STAGING_MONGODB_SECRET = "${var.environment}/mongodb-url-staging" # Test restore here
      ENVIRONMENT            = var.environment
    }
  }

  tags = {
    Name        = "${var.environment}-backup-verification"
    Environment = var.environment
    Purpose     = "Backup restore testing"
  }
}

# Weekly backup verification (Sunday after weekly backup)
resource "aws_cloudwatch_event_rule" "weekly_verification" {
  name                = "${var.environment}-weekly-backup-verification"
  description         = "Test backup restore weekly"
  schedule_expression = "cron(0 10 ? * SUN *)" # 10 AM UTC Sunday = 5 AM EST (2 hours after backup)

  tags = {
    Name        = "${var.environment}-weekly-verification"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "verification_lambda" {
  rule      = aws_cloudwatch_event_rule.weekly_verification.name
  target_id = "VerificationLambda"
  arn       = aws_lambda_function.backup_verification.arn
}

resource "aws_lambda_permission" "allow_eventbridge_verification" {
  statement_id  = "AllowExecutionFromEventBridgeVerification"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backup_verification.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_verification.arn
}

################################################################################
# CloudWatch Alarms for Monitoring
################################################################################

# Alarm for backup failures
resource "aws_cloudwatch_metric_alarm" "backup_failed" {
  alarm_name          = "${var.environment}-backup-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 86400 # 24 hours
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alert when daily backup fails"
  alarm_actions       = [aws_sns_topic.backup_notifications.arn]
  treat_missing_data  = "breaching" # Alert if no data (backup didn't run)

  dimensions = {
    FunctionName = aws_lambda_function.mongodb_backup.function_name
  }

  tags = {
    Name        = "${var.environment}-backup-failed-alarm"
    Environment = var.environment
  }
}

# Alarm for backup Lambda timeout
resource "aws_cloudwatch_metric_alarm" "backup_timeout" {
  alarm_name          = "${var.environment}-backup-timeout"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 840000 # 14 minutes (timeout is 15)
  alarm_description   = "Alert when backup takes too long (near timeout)"
  alarm_actions       = [aws_sns_topic.backup_notifications.arn]

  dimensions = {
    FunctionName = aws_lambda_function.mongodb_backup.function_name
  }

  tags = {
    Name        = "${var.environment}-backup-timeout-alarm"
    Environment = var.environment
  }
}

# Alarm for no recent backups
resource "aws_cloudwatch_metric_alarm" "backup_missing" {
  alarm_name          = "${var.environment}-backup-missing"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Invocations"
  namespace           = "AWS/Lambda"
  period              = 86400 # 24 hours
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Alert when backup hasn't run in 24 hours"
  alarm_actions       = [aws_sns_topic.backup_notifications.arn]
  treat_missing_data  = "breaching"

  dimensions = {
    FunctionName = aws_lambda_function.mongodb_backup.function_name
  }

  tags = {
    Name        = "${var.environment}-backup-missing-alarm"
    Environment = var.environment
  }
}

################################################################################
# Backup Restore Lambda (For Disaster Recovery)
################################################################################

resource "aws_lambda_function" "mongodb_restore" {
  filename         = "${path.module}/lambda-restore.zip"
  function_name    = "${var.environment}-mongodb-restore"
  role            = aws_iam_role.backup_lambda_role.arn
  handler         = "restore.handler"
  source_code_hash = fileexists("${path.module}/lambda-restore.zip") ? filebase64sha256("${path.module}/lambda-restore.zip") : null
  runtime         = "nodejs18.x"
  timeout         = 900
  memory_size     = 2048

  environment {
    variables = {
      S3_BUCKET              = aws_s3_bucket.hipaa_backups.id
      KMS_KEY_ID             = aws_kms_key.backup_encryption.id
      MONGODB_URL_SECRET_NAME = "${var.environment}/mongodb-url"
      SNS_TOPIC_ARN          = aws_sns_topic.backup_notifications.arn
      ENVIRONMENT            = var.environment
    }
  }

  tags = {
    Name        = "${var.environment}-mongodb-restore"
    Environment = var.environment
    Purpose     = "Disaster recovery - manual restore only"
  }
}

# Note: Restore is manual only (no scheduled triggers for safety)
# Invoke manually via AWS Console or CLI when disaster recovery needed

################################################################################
# CloudWatch Dashboard for Backup Monitoring
################################################################################

resource "aws_cloudwatch_dashboard" "backup_monitoring" {
  dashboard_name = "${var.environment}-hipaa-backup-monitoring"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", { stat = "Sum", label = "Backup Executions" }],
            [".", "Errors", { stat = "Sum", label = "Backup Errors" }],
            [".", "Duration", { stat = "Average", label = "Avg Duration (ms)" }]
          ]
          period = 86400
          stat   = "Sum"
          region = var.aws_region
          title  = "Daily Backup Metrics"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
      },
      {
        type = "log"
        properties = {
          query   = "SOURCE '/aws/lambda/${aws_lambda_function.mongodb_backup.function_name}' | fields @timestamp, @message | filter @message like /SUCCESS/ or @message like /ERROR/ | sort @timestamp desc | limit 20"
          region  = var.aws_region
          title   = "Recent Backup Logs"
        }
      }
    ]
  })
}

################################################################################
# Variables for Backup Configuration
################################################################################

variable "backup_notification_email" {
  description = "Email address for backup notifications"
  type        = string
  default     = "devops@myphonefriend.com" # Change this to your email
}

variable "mongodb_atlas_api_public_key" {
  description = "MongoDB Atlas API public key (if using Atlas backups)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "mongodb_atlas_api_private_key" {
  description = "MongoDB Atlas API private key (if using Atlas backups)"
  type        = string
  default     = ""
  sensitive   = true
}

################################################################################
# Outputs
################################################################################

output "backup_bucket_name" {
  description = "Name of the S3 bucket for backups"
  value       = aws_s3_bucket.hipaa_backups.id
}

output "backup_bucket_arn" {
  description = "ARN of the S3 bucket for backups"
  value       = aws_s3_bucket.hipaa_backups.arn
}

output "backup_kms_key_id" {
  description = "KMS key ID for backup encryption"
  value       = aws_kms_key.backup_encryption.id
}

output "backup_kms_key_arn" {
  description = "KMS key ARN for backup encryption"
  value       = aws_kms_key.backup_encryption.arn
}

output "backup_lambda_function_name" {
  description = "Name of the backup Lambda function"
  value       = aws_lambda_function.mongodb_backup.function_name
}

output "backup_sns_topic_arn" {
  description = "SNS topic ARN for backup notifications"
  value       = aws_sns_topic.backup_notifications.arn
}

output "restore_lambda_function_name" {
  description = "Name of the restore Lambda function (manual use only)"
  value       = aws_lambda_function.mongodb_restore.function_name
}

output "backup_dashboard_url" {
  description = "URL to CloudWatch dashboard for backup monitoring"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.backup_monitoring.dashboard_name}"
}

