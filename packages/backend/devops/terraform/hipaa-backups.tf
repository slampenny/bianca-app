################################################################################
# HIPAA backup infrastructure — staging (existing state migrated via moved blocks)
################################################################################

variable "backup_notification_email" {
  description = "Email address for HIPAA backup SNS notifications"
  type        = string
  default     = "jlapp@biancatechnologies.com"
}

module "staging_hipaa_backups" {
  source = "./modules/hipaa-backups"

  environment               = "staging"
  aws_region                = var.aws_region
  aws_account_id            = var.aws_account_id
  backup_notification_email = var.backup_notification_email
  ec2_target_tag_name       = "bianca-staging"
}

moved {
  from = aws_kms_key.backup_encryption
  to   = module.staging_hipaa_backups.aws_kms_key.backup_encryption
}

moved {
  from = aws_kms_alias.backup_encryption_alias
  to   = module.staging_hipaa_backups.aws_kms_alias.backup_encryption_alias
}

moved {
  from = aws_kms_key_policy.backup_encryption_policy
  to   = module.staging_hipaa_backups.aws_kms_key_policy.backup_encryption_policy
}

moved {
  from = aws_s3_bucket.hipaa_backups
  to   = module.staging_hipaa_backups.aws_s3_bucket.hipaa_backups
}

moved {
  from = aws_s3_bucket_public_access_block.hipaa_backups
  to   = module.staging_hipaa_backups.aws_s3_bucket_public_access_block.hipaa_backups
}

moved {
  from = aws_s3_bucket_versioning.hipaa_backups
  to   = module.staging_hipaa_backups.aws_s3_bucket_versioning.hipaa_backups
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.hipaa_backups
  to   = module.staging_hipaa_backups.aws_s3_bucket_server_side_encryption_configuration.hipaa_backups
}

moved {
  from = aws_s3_bucket_lifecycle_configuration.hipaa_backups
  to   = module.staging_hipaa_backups.aws_s3_bucket_lifecycle_configuration.hipaa_backups
}

moved {
  from = aws_s3_bucket.backup_access_logs
  to   = module.staging_hipaa_backups.aws_s3_bucket.backup_access_logs
}

moved {
  from = aws_s3_bucket_public_access_block.backup_access_logs
  to   = module.staging_hipaa_backups.aws_s3_bucket_public_access_block.backup_access_logs
}

moved {
  from = aws_s3_bucket_logging.hipaa_backups_logging
  to   = module.staging_hipaa_backups.aws_s3_bucket_logging.hipaa_backups_logging
}

moved {
  from = aws_sns_topic.backup_notifications
  to   = module.staging_hipaa_backups.aws_sns_topic.backup_notifications
}

moved {
  from = aws_sns_topic_subscription.backup_email
  to   = module.staging_hipaa_backups.aws_sns_topic_subscription.backup_email
}

moved {
  from = aws_iam_role.backup_lambda_role
  to   = module.staging_hipaa_backups.aws_iam_role.backup_lambda_role
}

moved {
  from = aws_iam_role_policy.backup_lambda_policy
  to   = module.staging_hipaa_backups.aws_iam_role_policy.backup_lambda_policy
}

moved {
  from = aws_lambda_function.mongodb_backup
  to   = module.staging_hipaa_backups.aws_lambda_function.mongodb_backup
}

moved {
  from = aws_cloudwatch_log_group.backup_lambda_logs
  to   = module.staging_hipaa_backups.aws_cloudwatch_log_group.backup_lambda_logs
}

moved {
  from = aws_lambda_function.backup_verification
  to   = module.staging_hipaa_backups.aws_lambda_function.backup_verification
}

moved {
  from = aws_cloudwatch_metric_alarm.backup_failed
  to   = module.staging_hipaa_backups.aws_cloudwatch_metric_alarm.backup_failed
}

moved {
  from = aws_cloudwatch_metric_alarm.backup_timeout
  to   = module.staging_hipaa_backups.aws_cloudwatch_metric_alarm.backup_timeout
}

moved {
  from = aws_cloudwatch_metric_alarm.backup_missing
  to   = module.staging_hipaa_backups.aws_cloudwatch_metric_alarm.backup_missing
}

moved {
  from = aws_lambda_function.mongodb_restore
  to   = module.staging_hipaa_backups.aws_lambda_function.mongodb_restore
}

moved {
  from = aws_cloudwatch_dashboard.backup_monitoring
  to   = module.staging_hipaa_backups.aws_cloudwatch_dashboard.backup_monitoring
}

output "staging_backup_bucket_name" {
  value = module.staging_hipaa_backups.backup_bucket_name
}

output "production_backup_bucket_name" {
  value = module.production_hipaa_backups.backup_bucket_name
}
