variable "environment" {
  type        = string
  description = "Environment name (staging or production)"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account ID"
}

variable "backup_notification_email" {
  type        = string
  description = "Email for backup SNS notifications"
}

variable "ec2_target_tag_name" {
  type        = string
  description = "EC2 Name tag for SSM backup/restore target (e.g. bianca-staging)"
}
