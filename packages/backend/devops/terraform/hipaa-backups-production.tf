################################################################################
# HIPAA backup infrastructure — production
################################################################################

module "production_hipaa_backups" {
  source = "./modules/hipaa-backups"

  environment               = "production"
  aws_region                = var.aws_region
  aws_account_id            = var.aws_account_id
  backup_notification_email = var.backup_notification_email
  ec2_target_tag_name       = "bianca-production"
}
