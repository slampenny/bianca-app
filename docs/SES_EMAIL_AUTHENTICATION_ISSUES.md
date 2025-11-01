# SES Email Authentication Issues - Troubleshooting Guide

## Problem Statement
Email sending via SES is failing authentication. This document outlines potential causes and solutions.

## Potential Root Causes

### 1. **Email Identity Verification** ⚠️ MOST LIKELY ISSUE

**Issue**: The "from" email address (`support@myphonefriend.com`) must be verified in SES, even if the domain is verified.

**Check Status**:
```bash
aws ses get-identity-verification-attributes \
  --identities support@myphonefriend.com \
  --region us-east-2
```

**Solution**:
- If the domain `myphonefriend.com` is verified via DNS, individual email addresses are automatically verified
- If domain verification fails or is incomplete, verify the email address explicitly:
```bash
aws ses verify-email-identity --email-address support@myphonefriend.com --region us-east-2
```

**Terraform Fix**: Add email identity verification resource:
```hcl
resource "aws_ses_email_identity" "support_email" {
  email = "support@myphonefriend.com"
}
```

### 2. **IAM Role Configuration** 

**Issue**: ECS task might not have proper SES permissions attached.

**Current Configuration**:
- ✅ IAM policy `ecs_task_ses_policy` exists with correct permissions
- ✅ Policy attached to `ecs_task_role`
- ⚠️ **VERIFY**: Task definition must use `task_role_arn` not just `execution_role_arn`

**Check**:
```bash
# Verify task definition has task_role_arn
aws ecs describe-task-definition \
  --task-definition bianca-app-task \
  --query 'taskDefinition.taskRoleArn'

# Verify role has SES policy attached
aws iam list-attached-role-policies --role-name <task-role-name>
```

**Terraform Check**: In `main-production.tf` line 1197:
```hcl
task_role_arn = aws_iam_role.ecs_task_role.arn  # ✅ This should be set
```

### 3. **Region Mismatch**

**Issue**: SES domain might be verified in one region, but the app is using a different region.

**Current Config**:
- SES domain configured in Terraform (assumes default region)
- App uses: `config.email.ses.region || env.AWS_SES_REGION || 'us-east-2'`

**Check**:
```bash
# Check which region domain is verified in
aws ses get-identity-verification-attributes \
  --identities myphonefriend.com \
  --region us-east-1  # Try different regions

aws ses get-identity-verification-attributes \
  --identities myphonefriend.com \
  --region us-east-2
```

**Solution**: Ensure SES domain identity is created in the same region the app uses.

### 4. **SES Sandbox Mode**

**Issue**: If SES is in sandbox mode, you can only send to verified email addresses.

**Check**:
```bash
aws sesv2 get-account --query ProductionAccessEnabled
```

**Solution**: Request production access in SES console, or verify recipient email addresses.

### 5. **Nodemailer SES Transport Configuration**

**Issue**: The nodemailer SES transport configuration might be incorrect.

**Current Code** (`email.service.js` lines 73-79):
```javascript
transport = nodemailer.createTransport({
  SES: { 
    ses: sesClient, 
    aws: { SendRawEmailCommand } 
  },
  sendingRate: 14,
});
```

**Potential Issue**: The `aws` parameter format might be incorrect for AWS SDK v3.

**Correct Format for SDK v3**:
```javascript
transport = nodemailer.createTransport({
  SES: { 
    ses: sesClient,
    aws: require('@aws-sdk/client-ses')  // Pass the entire module
  }
});
```

Or use the proper SDK v3 format:
```javascript
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');

transport = nodemailer.createTransport({
  SES: {
    ses: sesClient,
    aws: {
      SendRawEmailCommand: SendRawEmailCommand
    }
  }
});
```

### 6. **Domain Verification Status**

**Issue**: Domain verification might not be complete or DNS records incorrect.

**Check DNS Records**:
```bash
# Check verification record
dig TXT _amazonses.myphonefriend.com

# Check DKIM records
dig CNAME <dkim-token>._domainkey.myphonefriend.com

# Check SPF record
dig TXT myphonefriend.com | grep spf
```

**Expected Records**:
- `_amazonses.myphonefriend.com` TXT record with verification token
- 3 DKIM CNAME records
- SPF record: `v=spf1 include:amazonses.com ~all`

### 7. **Credentials Not Available to ECS Task**

**Issue**: ECS task might not be able to assume the IAM role or get credentials.

**Symptoms**: 
- Error: "Unable to locate credentials"
- Error: "The security token included in the request is invalid"

**Check**:
```bash
# Test from within ECS task (via ECS Exec)
aws sts get-caller-identity

# Check CloudWatch logs for credential errors
aws logs tail /aws/ecs/bianca-app --follow
```

**Solution**: 
- Verify task definition has correct `taskRoleArn`
- Check ECS task execution role permissions
- Verify VPC has NAT gateway/interface for STS calls

## Diagnostic Steps

### Step 1: Check Email Identity Status
```bash
aws ses get-identity-verification-attributes \
  --identities support@myphonefriend.com \
  --region us-east-2 \
  --query 'VerificationAttributes."support@myphonefriend.com"'
```

Expected: `VerificationStatus: Success`

### Step 2: Test SES Connectivity from App
The app already does this in `email.service.js` lines 62-70:
```javascript
const { GetSendQuotaCommand } = require('@aws-sdk/client-ses');
const testCommand = new GetSendQuotaCommand({});
await sesClient.send(testCommand);
```

Check logs for "SES connectivity test passed" or error details.

### Step 3: Verify IAM Permissions
```bash
# Get task role name from task definition
TASK_ROLE=$(aws ecs describe-task-definition \
  --task-definition bianca-app-task \
  --query 'taskDefinition.taskRoleArn' --output text | cut -d'/' -f2)

# List attached policies
aws iam list-attached-role-policies --role-name $TASK_ROLE

# Check if SES policy is attached
aws iam get-policy --policy-arn arn:aws:iam::<account>:policy/ECSTaskSESPolicy
```

### Step 4: Test Manual Email Send
```bash
# Test sending email directly via SES CLI
aws ses send-email \
  --from support@myphonefriend.com \
  --destination "ToAddresses=test@example.com" \
  --message "Subject={Data=Test},Body={Text={Data=Test email}}" \
  --region us-east-2
```

## Most Likely Fixes (in order of probability)

1. **Verify email identity** - Add explicit email identity verification in Terraform
2. **Fix nodemailer SES config** - Update the AWS SDK v3 integration format
3. **Check region consistency** - Ensure domain verified in same region as app
4. **Verify IAM role attachment** - Confirm task_role_arn is set in task definition
5. **Check DNS records** - Verify all SES DNS records are correct and propagated

## Immediate Actions

1. Check CloudWatch logs for specific error messages
2. Run identity verification check command above
3. Update Terraform to add email identity resource
4. Fix nodemailer SES transport configuration if needed
5. Verify task definition has correct role ARNs

## Testing After Fixes

```bash
# From within the app (or ECS Exec):
node -e "
const emailService = require('./src/services/email.service');
emailService.initializeEmailTransport()
  .then(() => emailService.sendEmail('test@example.com', 'Test', 'Test body'))
  .then(() => console.log('Success'))
  .catch(err => console.error('Error:', err));
"
```

