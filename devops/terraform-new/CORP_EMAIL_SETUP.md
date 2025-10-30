# Corporate Email Forwarding Setup Guide

This guide explains how to set up AWS SES email forwarding from `biancatechnologies.com` to Gmail addresses using Lambda and S3.

## Overview

The system works as follows:
1. Emails sent to `@biancatechnologies.com` addresses are received by AWS SES
2. SES saves the emails to an S3 bucket
3. SES triggers a Lambda function
4. Lambda reads the email from S3, parses it, and forwards it to the mapped Gmail address

## Prerequisites

1. AWS Account with appropriate permissions
2. Domain `biancatechnologies.com` registered (you've already purchased this)
3. Access to DNS records for `biancatechnologies.com`
4. Terraform installed (>= 1.3.0)
5. AWS CLI configured with appropriate profile
6. Python 3.11+ (for local testing of Lambda)

## Step 1: Verify Domain in SES

Before setting up the infrastructure, you need to verify ownership of `biancatechnologies.com` in AWS SES.

### Option A: Using AWS Console

1. Go to AWS SES Console → Verified identities
2. Click "Create identity"
3. Select "Domain"
4. Enter `biancatechnologies.com`
5. Click "Create identity"
6. AWS will provide DNS records to add to your domain

### Option B: Using Terraform (Recommended)

The Terraform configuration includes domain verification:

```bash
cd devops/terraform-new
terraform plan
```

This will show the DNS records you need to add. After applying Terraform:

```bash
terraform apply
```

Check the outputs:

```bash
terraform output corp_email_domain_verification_record
terraform output corp_email_dkim_records
```

## Step 2: Add DNS Records

Add the following DNS records to your domain registrar (where you bought biancatechnologies.com):

### A. Domain Verification (TXT Record)

Add a TXT record:
- **Name/Host**: `_amazonses.biancatechnologies.com` or just `@` (depending on your DNS provider)
- **Value**: `[value from terraform output]`
- **TTL**: 3600 (or default)

### B. DKIM Verification (3 CNAME Records)

Add three CNAME records for DKIM:
- **Name**: `[dkim-token-1]._domainkey.biancatechnologies.com`
- **Value**: `[dkim-token-1].dkim.amazonses.com`

- **Name**: `[dkim-token-2]._domainkey.biancatechnologies.com`
- **Value**: `[dkim-token-2].dkim.amazonses.com`

- **Name**: `[dkim-token-3]._domainkey.biancatechnologies.com`
- **Value**: `[dkim-token-3].dkim.amazonses.com`

### C. MX Record (for receiving emails)

Add MX record:
- **Name/Host**: `@` or `biancatechnologies.com`
- **Priority**: `10`
- **Value**: `10 inbound-smtp.us-east-2.amazonaws.com` (or your SES region)
- **TTL**: 3600

### D. SPF Record (TXT Record)

Add SPF record:
- **Name/Host**: `@` or `biancatechnologies.com`
- **Value**: `v=spf1 include:amazonses.com ~all`
- **TTL**: 3600

### E. DMARC Record (TXT Record - Optional but Recommended)

Add DMARC record:
- **Name/Host**: `_dmarc.biancatechnologies.com`
- **Value**: `v=DMARC1; p=quarantine; rua=mailto:dmarc@biancatechnologies.com`
- **TTL**: 3600

## Step 3: Request SES Production Access

**Important**: AWS SES starts in "Sandbox mode" which only allows sending/receiving emails to verified email addresses.

To receive emails from any sender:
1. Go to AWS SES Console → Account dashboard
2. Click "Request production access"
3. Fill out the form explaining your use case
4. Usually approved within 24-48 hours

While in sandbox mode, you can only receive emails from verified addresses.

## Step 4: Deploy Infrastructure

```bash
cd devops/terraform-new

# Initialize Terraform (if not already done)
terraform init

# Review the plan
terraform plan

# Apply the infrastructure
terraform apply
```

This will create:
- S3 bucket for email storage
- Lambda function for email forwarding
- SES receipt rules
- IAM roles and policies

## Step 5: Configure Email Mappings

Email mappings are stored as environment variables in the Lambda function. The initial mappings are:

```json
{
  "jlapp@biancatechnologies.com": "negascout@gmail.com",
  "vthaker@biancatechnologies.com": "virenthaker@gmail.com"
}
```

### To Add New Email Mappings

**Option 1: Update Terraform** (requires redeploy)

1. Edit `corp-email-forwarding.tf`
2. Update the `EMAIL_MAPPINGS` environment variable:

```hcl
environment {
  variables = {
    EMAIL_MAPPINGS = jsonencode({
      "jlapp@biancatechnologies.com"    = "negascout@gmail.com"
      "vthaker@biancatechnologies.com"  = "virenthaker@gmail.com"
      "newuser@biancatechnologies.com"  = "newuser@gmail.com"
    })
  }
}
```

3. Add a new SES receipt rule for the new email:

```hcl
resource "aws_ses_receipt_rule" "corp_email_newuser" {
  name          = "bianca-corp-email-newuser"
  rule_set_name = aws_ses_receipt_rule_set.corp_email_forwarding.rule_set_name
  recipients    = ["newuser@biancatechnologies.com"]
  enabled       = true

  s3_action {
    bucket_name       = aws_s3_bucket.corp_email_storage.bucket
    object_key_prefix = "emails/"
    position          = 1
  }

  lambda_action {
    function_arn    = aws_lambda_function.corp_email_forwarder.arn
    invocation_type = "Event"
    position        = 2
  }

  depends_on = [aws_lambda_permission.corp_allow_ses]
}
```

4. Run `terraform apply`

**Option 2: Update Lambda Environment Variables** (no code change needed)

1. Go to AWS Lambda Console
2. Select `bianca-corp-email-forwarder`
3. Go to Configuration → Environment variables
4. Edit `EMAIL_MAPPINGS` JSON
5. Save

**Note**: If you add a new email via Option 2, you still need to add a new SES receipt rule via Terraform.

## Step 6: Test the Setup

### Test 1: Send a Test Email

1. Send an email from your personal Gmail to `jlapp@biancatechnologies.com`
2. Check that it arrives at `negascout@gmail.com`
3. Verify the original sender is in the Reply-To header

### Test 2: Check CloudWatch Logs

1. Go to AWS CloudWatch → Log groups
2. Find `/aws/lambda/bianca-corp-email-forwarder`
3. Check for any errors

### Test 3: Verify S3 Storage

1. Go to AWS S3 Console
2. Find the bucket `bianca-corp-email-storage-<account-id>`
3. Check that emails are being stored in the `emails/` prefix

## Step 7: Verify SES Settings

1. Go to AWS SES Console → Verified identities
2. Verify that `biancatechnologies.com` shows as "Verified"
3. Check that DKIM shows "Success" for all 3 tokens
4. Verify the receipt rule set is active

## Troubleshooting

### Emails Not Being Received

1. **Check SES Sandbox Mode**: If still in sandbox, you can only receive from verified addresses
2. **Check DNS Records**: Use `dig` or `nslookup` to verify DNS records are correct
3. **Check CloudWatch Logs**: Lambda function logs errors here
4. **Check SES Bounce/Complaint**: Go to SES → Reputation → Bounce and complaint notifications

### Lambda Function Errors

1. **Check IAM Permissions**: Lambda needs S3 read and SES send permissions
2. **Check Environment Variables**: Verify `EMAIL_MAPPINGS` format is valid JSON
3. **Check S3 Bucket**: Ensure bucket exists and is accessible
4. **Check Email Format**: Some emails with complex encoding may cause issues

### Domain Verification Issues

1. **Wait for DNS Propagation**: Can take up to 48 hours
2. **Check Record Format**: DNS records must match exactly (case-sensitive)
3. **Use AWS CLI to Check**: `aws ses get-identity-verification-attributes --identities biancatechnologies.com`

### SES Sending Limits

In sandbox mode:
- 200 emails per day
- 1 email per second

After production access:
- No daily limit (but can be increased on request)
- Based on your sending reputation

## Monitoring and Maintenance

### View Email Storage

```bash
aws s3 ls s3://bianca-corp-email-storage-<account-id>/emails/ --recursive
```

### Check Lambda Invocations

```bash
aws lambda get-function --function-name bianca-corp-email-forwarder
```

### View CloudWatch Metrics

1. Go to CloudWatch → Metrics
2. Select Lambda namespace
3. View `Invocations`, `Errors`, `Duration` for your function

### Cost Considerations

- **S3 Storage**: ~$0.023 per GB/month (first 50TB)
- **SES Receiving**: First 1000 emails/month free, then $0.10 per 1000
- **Lambda**: Free tier includes 1M requests/month
- **Data Transfer**: Minimal (within AWS regions)

Emails are automatically deleted from S3 after 30 days (configured in lifecycle policy).

## Security Considerations

1. **S3 Bucket Encryption**: Enabled by default (AES-256)
2. **IAM Roles**: Least privilege principle applied
3. **Email Content**: All emails stored in S3 with versioning enabled
4. **Lambda Execution**: Runs in AWS managed environment
5. **SES Validation**: Domain and DKIM verification required

## Updating Email Mappings Without Redeploying

To quickly add a new email mapping without changing Terraform:

```bash
# Get current environment variables
aws lambda get-function-configuration \
  --function-name bianca-corp-email-forwarder \
  --query 'Environment.Variables.EMAIL_MAPPINGS'

# Update environment variable
aws lambda update-function-configuration \
  --function-name bianca-corp-email-forwarder \
  --environment "Variables={EMAIL_MAPPINGS='{\"jlapp@biancatechnologies.com\":\"negascout@gmail.com\",\"vthaker@biancatechnologies.com\":\"virenthaker@gmail.com\",\"new@biancatechnologies.com\":\"newemail@gmail.com\"}'}"
```

**Remember**: You still need to add a new SES receipt rule via Terraform for new email addresses.

## Support

For issues or questions:
1. Check CloudWatch Logs for Lambda errors
2. Review SES bounce/complaint notifications
3. Verify DNS records are correct
4. Ensure domain is verified in SES
5. Check that production access is granted if needed

---

**Last Updated**: January 15, 2025

