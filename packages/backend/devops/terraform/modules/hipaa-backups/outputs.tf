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

output "backup_lambda_function_name" {
  description = "Name of the backup Lambda function"
  value       = aws_lambda_function.mongodb_backup.function_name
}

output "restore_lambda_function_name" {
  description = "Name of the restore Lambda function (manual use only)"
  value       = aws_lambda_function.mongodb_restore.function_name
}
