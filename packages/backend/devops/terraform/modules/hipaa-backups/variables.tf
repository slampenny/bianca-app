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

variable "backup_schedule_timezone" {
  type        = string
  description = "IANA timezone for backup schedules (handles PST/PDT automatically)"
  default     = "America/Los_Angeles"
}

variable "backup_schedule_hour" {
  type        = number
  description = "Local hour (0-23) to run scheduled backups"
  default     = 12
}

variable "backup_schedule_minute" {
  type        = number
  description = "Local minute (0-59) to run scheduled backups"
  default     = 0
}
