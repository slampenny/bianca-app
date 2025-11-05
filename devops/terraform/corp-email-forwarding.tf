############################################################
# Corporate Email Forwarding for biancatechnologies.com
# 
# ⚠️ DISABLED - MIGRATED TO ZOHO MAIL
# All resources below are commented out because biancatechnologies.com now uses Zoho Mail.
# Email is handled directly by Zoho - no SES/Lambda forwarding needed.
#
# IMPORTANT: If you run terraform apply, these resources will NOT be recreated.
# This prevents conflicts with Zoho Mail MX records and infrastructure.
#
# This configuration previously:
# - Created SES domain identity + DKIM
# - Created Route53 records: MX, SPF, DKIM, DMARC (if zone exists)
# - Added SES receipt rules to existing active rule set
#   'myphonefriend-email-forwarding' to forward to Lambda
# - Stored raw emails in S3 prior to forwarding
############################################################

# locals {
#   corp_domain             = "biancatechnologies.com"
#   corp_bucket_name        = "bianca-corp-email-storage-${data.aws_caller_identity.current.account_id}"
#   ses_region              = var.aws_region
#   active_rule_set_name    = "myphonefriend-email-forwarding"
#   mx_hostname             = "inbound-smtp.${var.aws_region}.amazonaws.com"
# }

# data "aws_caller_identity" "current" {}

# # Optional: discover the hosted zone for biancatechnologies.com if it exists in Route53
# data "aws_route53_zone" "corp" {
#   name         = local.corp_domain
#   private_zone = false
# }

# # ---------------- SES DOMAIN IDENTIFICATION ----------------
# resource "aws_ses_domain_identity" "corp" {
#   domain = local.corp_domain
# }

# resource "aws_ses_domain_dkim" "corp" {
#   domain = aws_ses_domain_identity.corp.domain
# }

# # MAIL FROM domain configuration
# # This is used for bounce and complaint handling
# resource "aws_ses_domain_mail_from" "corp" {
#   domain           = aws_ses_domain_identity.corp.domain
#   mail_from_domain = "mail.${aws_ses_domain_identity.corp.domain}"
# }

# ⚠️ CRITICAL - DISABLED!
# These MX records would override Zoho Mail MX records!
# # Route53 MX record for MAIL FROM domain (points to SES bounce handling)
# # Note: This record may already exist - import it if needed:
# # terraform import aws_route53_record.corp_mail_from_mx ZONEID_mail.biancatechnologies.com_MX
# resource "aws_route53_record" "corp_mail_from_mx" {
#   zone_id = data.aws_route53_zone.corp.zone_id
#   name    = aws_ses_domain_mail_from.corp.mail_from_domain
#   type    = "MX"
#   ttl     = 300
#   records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]  # Must point to feedback-smtp, not inbound-smtp!
#
#   lifecycle {
#     create_before_destroy = true
#   }
# }

# # Route53 SPF record for MAIL FROM domain
# resource "aws_route53_record" "corp_mail_from_spf" {
#   zone_id = data.aws_route53_zone.corp.zone_id
#   name    = aws_ses_domain_mail_from.corp.mail_from_domain
#   type    = "TXT"
#   ttl     = 300
#   records = ["v=spf1 include:amazonses.com ~all"]
#
#   lifecycle {
#     create_before_destroy = true
#   }
# }

# # ---------------- S3 BUCKET FOR RAW EMAILS -----------------
# resource "aws_s3_bucket" "corp_email_storage" {
#   bucket = local.corp_bucket_name
# }

# resource "aws_s3_bucket_versioning" "corp_email_storage" {
#   bucket = aws_s3_bucket.corp_email_storage.id
#   versioning_configuration { status = "Enabled" }
# }

# resource "aws_s3_bucket_server_side_encryption_configuration" "corp_email_storage" {
#   bucket = aws_s3_bucket.corp_email_storage.id
#   rule {
#     apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
#   }
# }

# # ---------------- ROUTE53 RECORDS (conditional) -------------
# # Create records only if the hosted zone exists in Route53
# resource "aws_route53_record" "corp_verification" {
#   zone_id = data.aws_route53_zone.corp.zone_id
#   name    = "_amazonses.${local.corp_domain}"
#   type    = "TXT"
#   ttl     = 300
#   records = [aws_ses_domain_identity.corp.verification_token]
# }

# ⚠️ CRITICAL - DISABLED!
# This MX record would override Zoho Mail MX records!
# MX records now point to Zoho (mx.zoho.com, mx2.zoho.com) - DO NOT recreate this
# resource "aws_route53_record" "corp_mx" {
#   zone_id = data.aws_route53_zone.corp.zone_id
#   name    = local.corp_domain
#   type    = "MX"
#   ttl     = 300
#   records = ["10 ${local.mx_hostname}"]
#
#   lifecycle {
#     create_before_destroy = true
#   }
# }

# ⚠️ DISABLED - Using Zoho Mail, SPF now includes Zoho (managed manually or via Zoho)
# Note: Current SPF is "v=spf1 include:zoho.com include:amazonses.com ~all"
# resource "aws_route53_record" "corp_spf" {
#   zone_id = data.aws_route53_zone.corp.zone_id
#   name    = local.corp_domain
#   type    = "TXT"
#   ttl     = 300
#   records = ["v=spf1 include:amazonses.com ~all"]
#
#   lifecycle {
#     create_before_destroy = true
#   }
# }

# # resource "aws_route53_record" "corp_dmarc" {
#   zone_id = data.aws_route53_zone.corp.zone_id
#   name    = "_dmarc.${local.corp_domain}"
#   type    = "TXT"
#   ttl     = 300
#   records = ["v=DMARC1; p=none; rua=mailto:postmaster@${local.corp_domain}"]
#
#   lifecycle {
#     create_before_destroy = true
#   }
# }

# # resource "aws_route53_record" "corp_dkim" {
#   count   = 3
#   zone_id = data.aws_route53_zone.corp.zone_id
#   name    = "${element(aws_ses_domain_dkim.corp.dkim_tokens, count.index)}._domainkey.${local.corp_domain}"
#   type    = "CNAME"
#   ttl     = 300
#   records = ["${element(aws_ses_domain_dkim.corp.dkim_tokens, count.index)}.dkim.amazonses.com"]
#
#   lifecycle {
#     create_before_destroy = true
#   }
# }

# ⚠️ DISABLED - Using Zoho Mail, no SES receipt rules needed
# # --------------- SES RECEIPT RULES (into existing set) ---------------
# # Reuse existing active rule set used by myphonefriend
# resource "aws_ses_receipt_rule" "corp_email_jlapp" {
#   name          = "corp-email-jlapp"
#   rule_set_name = local.active_rule_set_name
#   enabled       = true
#   recipients    = ["jlapp@${local.corp_domain}"]
#
#   s3_action {
#     bucket_name      = aws_s3_bucket.corp_email_storage.id
#     object_key_prefix = "corp/jlapp/"
#     position         = 1
#   }
#
#   lambda_action {
#     function_arn = local.email_forwarder_arn
#     position     = 2
#   }
# }

# resource "aws_ses_receipt_rule" "corp_email_vthaker" {
#   name          = "corp-email-vthaker"
#   rule_set_name = local.active_rule_set_name
#   enabled       = true
#   recipients    = ["vthaker@${local.corp_domain}"]
#
#   s3_action {
#     bucket_name      = aws_s3_bucket.corp_email_storage.id
#     object_key_prefix = "corp/vthaker/"
#     position         = 1
#   }
#
#   lambda_action {
#     function_arn = local.email_forwarder_arn
#     position     = 2
#   }
# }

# # Reference to existing Lambda (declared elsewhere). If not present in this root, import or define data source.
# data "aws_lambda_function" "email_forwarder" {
#   function_name = "myphonefriend-email-forwarder"
# }

# # Provide alias to use in the rules above whether defined as resource or data
# locals {
#   email_forwarder_arn = data.aws_lambda_function.email_forwarder.arn
# }

# # If Lambda is not defined in this stack, create a shim resource to expose ARN for interpolation
# # No-op placeholder removed; using data source for Lambda ARN
