# corp-email-forwarding.tf
# Email Configuration for biancatechnologies.com
# 
# HYBRID SETUP: Zoho Mail + AWS SES (both can send AND receive)
# 
# RECEIVING:
# - Zoho Mail: Handles receiving emails (MX records point to Zoho)
#   Users can receive emails at jlapp@biancatechnologies.com, etc.
# 
# SENDING:
# - Zoho Mail: Users can send emails from their Zoho inbox
#   Uses Zoho DKIM record (zmail._domainkey.biancatechnologies.com)
# - AWS SES: WordPress can send emails (notifications, contact forms, etc.)
#   Uses SES DKIM records (3 CNAME records)
# 
# AUTHENTICATION:
# - SPF Record: Authorizes BOTH Zoho and SES to send emails
# - DKIM: Both services have their own DKIM records (no conflict)
# 
# Note: The SES email forwarding resources (S3, Lambda) are commented out
# because we're using Zoho Mail for receiving, not SES.

################################################################################
# S3 BUCKET FOR EMAIL STORAGE
# ⚠️ DISABLED - Using Zoho Mail instead
################################################################################

# # S3 bucket to store incoming emails before forwarding
# resource "aws_s3_bucket" "corp_email_storage" {
#   bucket = "bianca-corp-email-storage-${var.aws_account_id}"
#   
#   tags = {
#     Name        = "Bianca Technologies Email Storage"
#     Environment = var.environment
#     Purpose     = "SES email storage and forwarding"
#   }
# }

# # Enable versioning for email storage (useful for audit trail)
# resource "aws_s3_bucket_versioning" "corp_email_storage_versioning" {
#   bucket = aws_s3_bucket.corp_email_storage.id
#   
#   versioning_configuration {
#     status = "Enabled"
#   }
# }

# # Lifecycle policy to automatically delete old emails after 30 days
# resource "aws_s3_bucket_lifecycle_configuration" "corp_email_storage_lifecycle" {
#   bucket = aws_s3_bucket.corp_email_storage.id
#
#   rule {
#     id     = "delete-old-emails"
#     status = "Enabled"
#
#     expiration {
#       days = 30
#     }
#
#     noncurrent_version_expiration {
#       noncurrent_days = 7
#     }
#   }
# }

# # S3 bucket policy to allow SES to write emails
# resource "aws_s3_bucket_policy" "corp_ses_email_storage_policy" {
#   bucket = aws_s3_bucket.corp_email_storage.id
#
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Sid    = "AllowSESPuts"
#         Effect = "Allow"
#         Principal = {
#           Service = "ses.amazonaws.com"
#         }
#         Action = [
#           "s3:PutObject",
#           "s3:PutObjectAcl"
#         ]
#         Resource = "${aws_s3_bucket.corp_email_storage.arn}/*"
#         Condition = {
#           StringEquals = {
#             "aws:Referer" = var.aws_account_id
#           }
#         }
#       }
#     ]
#   })
# }

# # Encrypt the bucket
# resource "aws_s3_bucket_server_side_encryption_configuration" "corp_email_storage_encryption" {
#   bucket = aws_s3_bucket.corp_email_storage.id
#
#   rule {
#     apply_server_side_encryption_by_default {
#       sse_algorithm = "AES256"
#     }
#   }
# }

################################################################################
# LAMBDA FUNCTION FOR EMAIL FORWARDING
# ⚠️ DISABLED - Using Zoho Mail, no Lambda needed
################################################################################

# # IAM role for Lambda function
# resource "aws_iam_role" "corp_lambda_email_forwarding_role" {
#   name = "bianca-corp-lambda-email-forwarding-role"
#
#   assume_role_policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Action = "sts:AssumeRole"
#         Effect = "Allow"
#         Principal = {
#           Service = "lambda.amazonaws.com"
#         }
#       }
#     ]
#   })
#
#   tags = {
#     Environment = var.environment
#     Purpose     = "Email forwarding Lambda execution"
#   }
# }

# # Basic execution policy for CloudWatch Logs
# resource "aws_iam_role_policy_attachment" "corp_lambda_email_forwarding_basic" {
#   role       = aws_iam_role.corp_lambda_email_forwarding_role.name
#   policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
# }

# # Custom policy for SES and S3 access
# resource "aws_iam_role_policy" "corp_lambda_email_forwarding_ses_s3" {
#   name = "bianca-corp-lambda-email-forwarding-ses-s3"
#   role = aws_iam_role.corp_lambda_email_forwarding_role.id
#
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Effect = "Allow"
#         Action = [
#           "ses:SendEmail",
#           "ses:SendRawEmail"
#         ]
#         Resource = "*"
#       },
#       {
#         Effect = "Allow"
#         Action = [
#           "s3:GetObject"
#         ]
#         Resource = "${aws_s3_bucket.corp_email_storage.arn}/*"
#       }
#     ]
#   })
# }

# # Lambda function for email forwarding
# resource "aws_lambda_function" "corp_email_forwarder" {
#   filename         = "corp-email-forwarder.zip"
#   function_name    = "bianca-corp-email-forwarder"
#   role            = aws_iam_role.corp_lambda_email_forwarding_role.arn
#   handler         = "index.handler"
#   runtime         = "python3.11"
#   timeout         = 60
#   memory_size     = 256
#
#   # Environment variables for email mappings
#   # This is a JSON string containing the mapping: {"corp-email": "personal-gmail"}
#   # Note: AWS_REGION is automatically set by Lambda runtime, don't set it explicitly
#   environment {
#     variables = {
#       EMAIL_MAPPINGS = jsonencode({
#         "jlapp@biancatechnologies.com"    = "negascout@gmail.com"
#         "vthaker@biancatechnologies.com" = "virenthaker@gmail.com"
#       })
#       FROM_DOMAIN    = "biancatechnologies.com"
#       S3_BUCKET      = aws_s3_bucket.corp_email_storage.bucket
#     }
#   }
#
#   depends_on = [
#     aws_iam_role_policy.corp_lambda_email_forwarding_ses_s3,
#     data.archive_file.corp_email_forwarder_zip
#   ]
#
#   tags = {
#     Environment = var.environment
#     Purpose     = "Forward corporate emails to Gmail"
#   }
# }

# # Create Lambda deployment package from local directory
# # Note: boto3 is included in Lambda Python runtime, so no dependencies needed
# data "archive_file" "corp_email_forwarder_zip" {
#   type        = "zip"
#   output_path = "${path.module}/corp-email-forwarder.zip"
#   source_dir  = "${path.module}/lambda-corps-email-forwarder"
#   
#   excludes = [
#     "__pycache__",
#     "*.pyc",
#     ".git*"
#   ]
# }

# # Lambda permission for SES to invoke the function
# resource "aws_lambda_permission" "corp_allow_ses" {
#   statement_id  = "AllowExecutionFromSES"
#   action        = "lambda:InvokeFunction"
#   function_name = aws_lambda_function.corp_email_forwarder.function_name
#   principal     = "ses.amazonaws.com"
#   source_account = var.aws_account_id
# }

# # S3 event notification to trigger Lambda when email is stored
# # This provides a more reliable way to process emails than relying solely on SES events
# resource "aws_s3_bucket_notification" "corp_email_notification" {
#   bucket = aws_s3_bucket.corp_email_storage.id
#
#   lambda_function {
#     lambda_function_arn = aws_lambda_function.corp_email_forwarder.arn
#     events              = ["s3:ObjectCreated:*"]
#     filter_prefix      = "emails/"
#     filter_suffix      = ""
#   }
#
#   depends_on = [aws_lambda_permission.corp_allow_s3]
# }

# # Lambda permission for S3 to invoke the function
# resource "aws_lambda_permission" "corp_allow_s3" {
#   statement_id  = "AllowExecutionFromS3"
#   action        = "lambda:InvokeFunction"
#   function_name = aws_lambda_function.corp_email_forwarder.function_name
#   principal     = "s3.amazonaws.com"
#   source_arn    = aws_s3_bucket.corp_email_storage.arn
# }

################################################################################
# SES RECEIPT RULE SET AND RULES
# ⚠️ DISABLED - Using Zoho Mail, no SES rules needed
################################################################################

# Note: We'll add rules to the existing myphonefriend-email-forwarding rule set
# to avoid conflicts (SES only allows one active rule set)
# The rule set is created in main.tf as aws_ses_receipt_rule_set.email_forwarding

# SES Domain Identity Verification
# Required for WordPress to send emails via SES
# Note: Zoho Mail handles receiving (MX records), SES handles sending (WordPress)
resource "aws_ses_domain_identity" "biancatechnologies" {
  domain = "biancatechnologies.com"
}

# SES Domain DKIM (required for email deliverability)
# Enables DKIM signing for emails sent via SES (WordPress)
resource "aws_ses_domain_dkim" "biancatechnologies" {
  domain = aws_ses_domain_identity.biancatechnologies.domain
}

# Try to find Route53 hosted zone for biancatechnologies.com
# If domain is managed in Route53, we'll create DNS records automatically
# Note: If zone doesn't exist, these records won't be created and you'll need to add DNS manually
data "aws_route53_zone" "biancatechnologies" {
  name         = "biancatechnologies.com."
  private_zone = false
}

# Route53 DNS Records for SES Domain Verification
# Required for WordPress to send emails via SES
resource "aws_route53_record" "corp_ses_verification" {
  zone_id = data.aws_route53_zone.biancatechnologies.zone_id
  name    = "_amazonses.${aws_ses_domain_identity.biancatechnologies.domain}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.biancatechnologies.verification_token]
}

# Route53 DKIM Records (3 CNAME records)
# Required for DKIM signing of emails sent via SES (WordPress)
resource "aws_route53_record" "corp_ses_dkim" {
  count   = 3
  zone_id = data.aws_route53_zone.biancatechnologies.zone_id
  name    = "${element(aws_ses_domain_dkim.biancatechnologies.dkim_tokens, count.index)}._domainkey.${aws_ses_domain_identity.biancatechnologies.domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${element(aws_ses_domain_dkim.biancatechnologies.dkim_tokens, count.index)}.dkim.amazonses.com"]
}

################################################################################
# ZOHO MAIL MX RECORDS
# These MX records point to Zoho Mail servers for receiving emails
################################################################################

resource "aws_route53_record" "zoho_mx" {
  zone_id = data.aws_route53_zone.biancatechnologies.zone_id
  name    = "biancatechnologies.com"
  type    = "MX"
  ttl     = 3600
  records = [
    "10 mx.zohocloud.ca.",
    "20 mx2.zohocloud.ca.",
    "50 mx3.zohocloud.ca."
  ]
}

################################################################################
# SPF RECORD
# Required for email authentication - allows BOTH Zoho Mail AND AWS SES to send emails
# - Zoho Mail: Users can send from their Zoho inbox (jlapp@biancatechnologies.com, etc.)
# - AWS SES: WordPress can send emails (notifications, contact forms, etc.)
# This single SPF record authorizes both services to send emails
################################################################################

resource "aws_route53_record" "zoho_spf" {
  zone_id = data.aws_route53_zone.biancatechnologies.zone_id
  name    = "biancatechnologies.com"
  type    = "TXT"
  ttl     = 3600
  # Merged SPF: includes zohocloud.ca (Canadian server), zoho.com (general), and amazonses.com (AWS)
  records = ["v=spf1 include:zohocloud.ca include:zoho.com include:amazonses.com ~all"]
}

################################################################################
# ZOHO MAIL DKIM RECORD
# Required for email authentication - prevents emails from being marked as spam
################################################################################

resource "aws_route53_record" "zoho_dkim" {
  zone_id = data.aws_route53_zone.biancatechnologies.zone_id
  name    = "zmail._domainkey.biancatechnologies.com"
  type    = "TXT"
  ttl     = 3600
  # DKIM public key from Zoho Mail (exact value from Zoho admin)
  records = ["v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDOeiMSBXNisY9pFu8jtlpLxxBz08vn6NZ8PE3MZGrEFg53X60zC4n9p4+ehH9MZQx3QVc9K6gXteUTMLKgKNiP+fBl0y/oHiRPSZK8Ts1/XUjAphPtWiNQs5JhOnl+fPtN7X0LM1Om2+M+u4HL1lqx//8rbZwgYJWqt3tyjY/vMQIDAQAB"]
}

# ⚠️ DISABLED - DMARC record exists but managed separately (Zoho compatible)
# resource "aws_route53_record" "corp_ses_dmarc" {
#   zone_id = data.aws_route53_zone.biancatechnologies.zone_id
#   name    = "_dmarc.${aws_ses_domain_identity.biancatechnologies.domain}"
#   type    = "TXT"
#   ttl     = 600
#   records = ["v=DMARC1; p=quarantine; rua=mailto:dmarc@${aws_ses_domain_identity.biancatechnologies.domain}"]
# }

# ⚠️ DISABLED - Using Zoho Mail, no SES receipt rules needed
# # SES Receipt Rules - Add to existing myphonefriend-email-forwarding rule set
# # This allows both domains (myphonefriend.com and biancatechnologies.com) to work
# # SES only allows one active receipt rule set, so we add our rules to the existing one
#
# resource "aws_ses_receipt_rule" "corp_email_jlapp" {
#   name          = "bianca-corp-email-jlapp"
#   rule_set_name = "myphonefriend-email-forwarding"  # Add to existing rule set
#   recipients    = ["jlapp@biancatechnologies.com"]
#   enabled       = true
#
#   # Step 1: Save email to S3
#   s3_action {
#     bucket_name       = aws_s3_bucket.corp_email_storage.bucket
#     object_key_prefix = "emails/"
#     position          = 1
#   }
#
#   # Step 2: Trigger Lambda to process and forward
#   lambda_action {
#     function_arn    = aws_lambda_function.corp_email_forwarder.arn
#     invocation_type = "Event"
#     position        = 2
#   }
#
#   depends_on = [
#     aws_lambda_permission.corp_allow_ses
#   ]
# }
#
# resource "aws_ses_receipt_rule" "corp_email_vthaker" {
#   name          = "bianca-corp-email-vthaker"
#   rule_set_name = "myphonefriend-email-forwarding"  # Add to existing rule set
#   recipients    = ["vthaker@biancatechnologies.com"]
#   enabled       = true
#
#   # Step 1: Save email to S3
#   s3_action {
#     bucket_name       = aws_s3_bucket.corp_email_storage.bucket
#     object_key_prefix = "emails/"
#     position          = 1
#   }
#
#   # Step 2: Trigger Lambda to process and forward
#   lambda_action {
#     function_arn    = aws_lambda_function.corp_email_forwarder.arn
#     invocation_type = "Event"
#     position        = 2
#   }
#
#   depends_on = [
#     aws_lambda_permission.corp_allow_ses
#   ]
# }

################################################################################
# OUTPUTS
# ⚠️ DISABLED - Using Zoho Mail, no outputs needed
################################################################################

# output "corp_email_s3_bucket_name" {
#   description = "Name of the S3 bucket storing emails"
#   value       = aws_s3_bucket.corp_email_storage.bucket
# }

# output "corp_email_lambda_function_name" {
#   description = "Name of the Lambda function processing emails"
#   value       = aws_lambda_function.corp_email_forwarder.function_name
# }

# output "corp_email_domain_verification_record" {
#   description = "DNS TXT record for domain verification"
#   value       = aws_ses_domain_identity.biancatechnologies.verification_token
# }

# output "corp_email_dkim_records" {
#   description = "DNS CNAME records for DKIM verification"
#   value       = aws_ses_domain_dkim.biancatechnologies.dkim_tokens
# }

# output "corp_ses_rule_set_name" {
#   description = "Name of the SES receipt rule set (rules added to myphonefriend-email-forwarding)"
#   value       = "myphonefriend-email-forwarding"
# }
