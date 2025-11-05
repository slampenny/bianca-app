# Testing Email Forwarding Setup

This guide provides step-by-step instructions to test the corporate email forwarding system.

## Prerequisites

Before testing, ensure:
- ✅ Terraform deployment completed successfully
- ✅ DNS records added to domain registrar
- ✅ Domain verified in SES
- ✅ Lambda function deployed
- ✅ SES receipt rules active

## Test 1: Verify Infrastructure is Deployed

### Check Terraform Outputs

```bash
cd devops/terraform-new

# Get all outputs
terraform output

# Verify specific resources
terraform output corp_email_s3_bucket_name
terraform output corp_email_lambda_function_name
terraform output corp_email_domain_verification_record
```

Expected outputs should show:
- S3 bucket name
- Lambda function name
- DNS verification records

### Verify AWS Resources

```bash
# Check S3 bucket exists
aws s3 ls | grep bianca-corp-email-storage

# Check Lambda function exists
aws lambda get-function --function-name bianca-corp-email-forwarder

# Check SES domain verification
aws ses get-identity-verification-attributes --identities biancatechnologies.com

# Check SES receipt rules
aws ses describe-active-receipt-rule-set --query 'Metadata.RuleSetName'
```

### Verify DNS Records (if using Terraform outputs)

```bash
# Check domain verification TXT record
dig TXT _amazonses.biancatechnologies.com
# OR
nslookup -type=TXT _amazonses.biancatechnologies.com

# Check MX record
dig MX biancatechnologies.com
# OR
nslookup -type=MX biancatechnologies.com

# Check SPF record
dig TXT biancatechnologies.com | grep spf

# Check DKIM records (3 CNAME records)
dig CNAME [dkim-token]._domainkey.biancatechnologies.com
```

## Test 2: Verify Lambda Function Configuration

```bash
# Get Lambda environment variables
aws lambda get-function-configuration \
  --function-name bianca-corp-email-forwarder \
  --query 'Environment.Variables'

# Should show:
# - EMAIL_MAPPINGS (JSON with email mappings)
# - FROM_DOMAIN (biancatechnologies.com)
# - AWS_REGION
# - S3_BUCKET

# Test Lambda invocation with a sample S3 event
aws lambda invoke \
  --function-name bianca-corp-email-forwarder \
  --payload '{
    "Records": [{
      "s3": {
        "bucket": {"name": "bianca-corp-email-storage-730335291008"},
        "object": {"key": "emails/test-message-id"}
      }
    }]
  }' \
  response.json

cat response.json
```

## Test 3: Send Test Email from Verified Address

**Important**: If SES is in sandbox mode, you can only send from verified email addresses.

### Verify Your Test Email Address

```bash
# Verify a test email address
aws ses verify-email-identity --email-address your-test-email@gmail.com

# Check verification status
aws ses get-identity-verification-attributes \
  --identities your-test-email@gmail.com
```

Wait for verification email and click the link.

### Send Test Email

Send an email from your verified Gmail address to:
- `jlapp@biancatechnologies.com` (should forward to negascout@gmail.com)
- `vthaker@biancatechnologies.com` (should forward to virenthaker@gmail.com)

**Expected Result**: Email arrives at the mapped Gmail address within 1-2 minutes.

## Test 4: Monitor CloudWatch Logs

Watch Lambda logs in real-time:

```bash
# Get log group name
LOG_GROUP="/aws/lambda/bianca-corp-email-forwarder"

# Stream logs (requires awslogs CLI: pip install awscli awslogs)
awslogs tail $LOG_GROUP --follow

# OR use AWS CLI to get recent logs
aws logs tail $LOG_GROUP --follow --since 5m
```

Look for:
- ✅ "Received event" - Lambda received the event
- ✅ "Forwarding X -> Y" - Email mapping found
- ✅ "Successfully forwarded email" - Forwarding completed
- ❌ Any error messages

## Test 5: Check S3 Bucket

Verify emails are being stored:

```bash
BUCKET_NAME=$(terraform output -raw corp_email_s3_bucket_name)

# List emails in S3
aws s3 ls s3://$BUCKET_NAME/emails/ --recursive

# Download and inspect an email
aws s3 cp s3://$BUCKET_NAME/emails/[message-id] ./test-email.eml
cat test-email.eml
```

## Test 6: Verify Email Delivery

After sending a test email:

1. **Check Destination Gmail**:
   - Open `negascout@gmail.com` inbox (for jlapp@)
   - Open `virenthaker@gmail.com` inbox (for vthaker@)
   - Look for forwarded email with subject "Fwd: [original subject]"
   - Verify original sender is in Reply-To header

2. **Check Spam Folder**: Forwarded emails might land in spam initially

3. **Verify Email Content**:
   - Original sender should be preserved
   - Original subject should be prefixed with "Fwd:"
   - Original body should be included
   - Attachments should be preserved (if any)

## Test 7: Test Error Handling

### Test with Non-Mapped Email

Send email to a non-mapped address like `test@biancatechnologies.com`.

**Expected**: 
- Email stored in S3 ✅
- Lambda logs warning: "No email mapping found"
- Email NOT forwarded (this is expected)

### Test with Spam Email

If you have access to spam detection:
- Send an email that gets flagged as spam
- Check logs for: "Skipping email - Spam: FAIL"

## Test 8: Functional Test Script

Run this comprehensive test:

```bash
#!/bin/bash
# test-email-forwarding.sh

set -e

echo "=== Testing Email Forwarding Setup ==="

# 1. Check Terraform outputs
echo "1. Checking Terraform outputs..."
cd devops/terraform-new
BUCKET=$(terraform output -raw corp_email_s3_bucket_name)
LAMBDA=$(terraform output -raw corp_email_lambda_function_name)

if [ -z "$BUCKET" ] || [ -z "$LAMBDA" ]; then
  echo "❌ Terraform outputs missing!"
  exit 1
fi
echo "✅ S3 Bucket: $BUCKET"
echo "✅ Lambda: $LAMBDA"

# 2. Check AWS resources exist
echo ""
echo "2. Checking AWS resources..."
aws s3api head-bucket --bucket $BUCKET || { echo "❌ S3 bucket not found!"; exit 1; }
aws lambda get-function --function-name $LAMBDA || { echo "❌ Lambda not found!"; exit 1; }
echo "✅ All resources exist"

# 3. Check Lambda configuration
echo ""
echo "3. Checking Lambda configuration..."
MAPPINGS=$(aws lambda get-function-configuration \
  --function-name $LAMBDA \
  --query 'Environment.Variables.EMAIL_MAPPINGS' \
  --output text)

if [[ "$MAPPINGS" == *"jlapp@biancatechnologies.com"* ]] && \
   [[ "$MAPPINGS" == *"negascout@gmail.com"* ]]; then
  echo "✅ Email mappings configured correctly"
else
  echo "❌ Email mappings incorrect!"
  echo "Current: $MAPPINGS"
  exit 1
fi

# 4. Check SES domain verification
echo ""
echo "4. Checking SES domain verification..."
VERIFICATION=$(aws ses get-identity-verification-attributes \
  --identities biancatechnologies.com \
  --query 'VerificationAttributes.biancatechnologies.com.VerificationStatus' \
  --output text)

if [ "$VERIFICATION" == "Success" ]; then
  echo "✅ Domain verified in SES"
else
  echo "⚠️  Domain not verified: $VERIFICATION"
  echo "   Make sure DNS records are added correctly"
fi

# 5. Check recent CloudWatch logs
echo ""
echo "5. Checking recent Lambda invocations..."
LOG_GROUP="/aws/lambda/$LAMBDA"
RECENT_LOGS=$(aws logs filter-log-events \
  --log-group-name $LOG_GROUP \
  --start-time $(($(date +%s) - 3600))000 \
  --query 'events[*].message' \
  --output text 2>/dev/null || echo "")

if [ -n "$RECENT_LOGS" ]; then
  echo "✅ Recent Lambda activity found"
  echo "   Latest: $(echo "$RECENT_LOGS" | tail -1)"
else
  echo "ℹ️  No recent Lambda invocations (this is OK if no emails sent yet)"
fi

# 6. Check S3 for stored emails
echo ""
echo "6. Checking for stored emails..."
EMAIL_COUNT=$(aws s3 ls s3://$BUCKET/emails/ --recursive | wc -l)
echo "   Found $EMAIL_COUNT email(s) stored in S3"

echo ""
echo "=== Test Complete ==="
echo ""
echo "Next steps:"
echo "1. Send a test email to jlapp@biancatechnologies.com"
echo "2. Check CloudWatch logs: aws logs tail /aws/lambda/$LAMBDA --follow"
echo "3. Verify email arrives at negascout@gmail.com"
```

## Test 9: Manual Test Email

Use AWS SES CLI to send a test email (if SES is out of sandbox):

```bash
# Create a test email file
cat > test-email.txt << EOF
From: test@example.com
To: jlapp@biancatechnologies.com
Subject: Test Email from SES
Content-Type: text/plain

This is a test email to verify email forwarding is working.
EOF

# Send via SES (requires SES out of sandbox)
aws ses send-raw-email --raw-message "Data=$(base64 -i test-email.txt)"
```

## Troubleshooting Test Failures

### Email Not Received

1. **Check SES Sandbox Mode**:
   ```bash
   aws ses get-account-sending-enabled
   ```
   If in sandbox, verify sender email is verified

2. **Check Lambda Logs**:
   ```bash
   aws logs tail /aws/lambda/bianca-corp-email-forwarder --follow
   ```

3. **Check S3 for Email**:
   ```bash
   aws s3 ls s3://bianca-corp-email-storage-*/emails/ --recursive
   ```

4. **Check SES Bounce/Complaint**:
   ```bash
   aws ses get-send-statistics
   ```

### Lambda Errors

1. **Check IAM Permissions**:
   ```bash
   aws lambda get-policy --function-name bianca-corp-email-forwarder
   ```

2. **Test Lambda Locally** (see Test 2 above)

3. **Check Environment Variables**:
   ```bash
   aws lambda get-function-configuration \
     --function-name bianca-corp-email-forwarder \
     --query 'Environment'
   ```

### DNS Issues

Use online tools:
- https://mxtoolbox.com/
- https://www.dnswatch.info/

Enter `biancatechnologies.com` and check:
- MX records
- SPF records
- DKIM records

## Success Criteria

✅ All tests pass if:
- Terraform outputs show resources
- AWS resources exist and are configured
- Lambda function can be invoked
- Test emails are forwarded correctly
- CloudWatch logs show successful forwarding
- Emails arrive at destination Gmail accounts

---

**Note**: Remember that SES starts in sandbox mode. For production use, request production access in SES console.





