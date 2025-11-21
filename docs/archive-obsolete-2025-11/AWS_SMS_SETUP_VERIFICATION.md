# AWS SMS Setup Verification Report

**Date:** Generated automatically  
**AWS Account:** 730335291008  
**Profile:** jordan  
**Region:** us-east-2

## ✅ What's Working

1. **IAM Permissions** ✅
   - Terraform configuration includes `sns:Publish` permission
   - EC2 instance roles have SNS publish permissions
   - ECS task roles have SNS SMS policy attached
   - Location: `devops/terraform-new/main.tf` (lines 2439-2461)

2. **SNS Service Code** ✅
   - SNS service is properly implemented in `src/services/sns.service.js`
   - Phone number formatting is implemented
   - Direct SMS sending (no topic subscriptions needed)
   - Region configured: `us-east-2`

3. **Monthly Spend Limit** ✅
   - Set to $50/month
   - This is sufficient for testing and initial production use

## ❌ Critical Issue Found

### DefaultSMSType is NOT Set

**Problem:** Your AWS account's `DefaultSMSType` is currently `null`. This is **REQUIRED** for sending SMS to unverified phone numbers.

**Impact:** Without this setting, AWS SNS may:
- Reject SMS sends to unverified numbers
- Require phone numbers to be in SMS sandbox mode
- Fail silently or return authorization errors

**Solution:** Set the DefaultSMSType to "Transactional" (recommended for verification codes):

```bash
aws sns set-sms-attributes \
  --attributes DefaultSMSType=Transactional \
  --profile jordan \
  --region us-east-2
```

**Why "Transactional"?**
- Verification codes are transactional messages (not promotional)
- Better delivery rates for transactional messages
- Required for sending to unverified numbers in production

## ⚠️ Additional Recommendations

### 1. Verify SMS Sandbox Status

AWS accounts start in "SMS Sandbox" mode, which only allows sending to verified phone numbers. To send to unverified numbers, you need production access.

**Check if you're in sandbox mode:**
```bash
aws sns get-sms-attributes --profile jordan --query 'attributes' --output json
```

**If you're in sandbox mode**, you need to:
1. Request production access through AWS Support
2. Provide use case details (you already have this in `AWS_SNS_QUOTA_RESPONSE.md`)
3. Wait for approval (usually 24-48 hours)

**Request production access:**
- Go to AWS Console → SNS → Text messaging (SMS)
- Click "Request production access"
- Fill out the form with your use case details

### 2. Test SMS Sending

After setting DefaultSMSType, test with a real phone number:

```bash
aws sns publish \
  --phone-number "+1234567890" \
  --message "Test message from Bianca app" \
  --profile jordan \
  --region us-east-2
```

Replace `+1234567890` with your actual phone number in E.164 format.

### 3. Monitor SMS Delivery

Set up CloudWatch alarms to monitor:
- SMS delivery success rate
- Monthly spending
- Failed SMS attempts

## 📋 Verification Checklist

Run these commands to verify your setup:

```bash
# 1. Check SMS attributes
aws sns get-sms-attributes --profile jordan --region us-east-2

# 2. Set DefaultSMSType (if not set)
aws sns set-sms-attributes \
  --attributes DefaultSMSType=Transactional \
  --profile jordan \
  --region us-east-2

# 3. Verify the setting
aws sns get-sms-attributes \
  --profile jordan \
  --region us-east-2 \
  --query 'attributes.DefaultSMSType'

# 4. Test SMS send (replace with your phone number)
aws sns publish \
  --phone-number "+1YOURPHONENUMBER" \
  --message "Test: Your SMS setup is working!" \
  --profile jordan \
  --region us-east-2
```

## 🔧 Code Configuration

Your application code looks correct:

1. **SNS Service** (`src/services/sns.service.js`):
   - ✅ Properly initializes SNS client
   - ✅ Uses region from environment or defaults to `us-east-2`
   - ✅ Formats phone numbers correctly
   - ✅ Sends directly to phone numbers (no topic needed)

2. **SMS Verification Service** (`src/services/smsVerification.service.js`):
   - ✅ Uses existing SNS service
   - ✅ Properly formats phone numbers
   - ✅ Handles errors correctly

3. **Terraform Configuration**:
   - ✅ IAM policies include `sns:Publish` permission
   - ✅ Resources set to `*` (allows any phone number)
   - ✅ Applied to both EC2 and ECS roles

## 🚀 Next Steps

1. **IMMEDIATE:** Set DefaultSMSType to "Transactional"
   ```bash
   aws sns set-sms-attributes \
     --attributes DefaultSMSType=Transactional \
     --profile jordan \
     --region us-east-2
   ```

2. **VERIFY:** Check if you're in SMS sandbox mode
   - If yes, request production access
   - If no, you're ready to test

3. **TEST:** Send a test SMS to verify end-to-end functionality

4. **MONITOR:** Set up CloudWatch alarms for SMS delivery metrics

## 📚 Additional Resources

- [AWS SNS SMS Documentation](https://docs.aws.amazon.com/sns/latest/dg/sms_publish-to-phone.html)
- [SMS Sandbox Guide](https://docs.aws.amazon.com/sns/latest/dg/sms-sandbox.html)
- [SMS Preferences](https://docs.aws.amazon.com/sns/latest/dg/sms_preferences.html)
- [SMS Pricing](https://aws.amazon.com/sns/sms-pricing/)

## 🐛 Troubleshooting

### Error: "InvalidParameter"
- **Cause:** Phone number format is incorrect
- **Fix:** Ensure phone numbers are in E.164 format (`+1234567890`)

### Error: "AuthorizationError"
- **Cause:** IAM permissions missing
- **Fix:** Verify IAM role has `sns:Publish` permission

### Error: "Account is in SMS sandbox"
- **Cause:** Account hasn't requested production access
- **Fix:** Request production access through AWS Console

### Error: "Monthly spending limit exceeded"
- **Cause:** Hit the $50/month limit
- **Fix:** Increase limit or wait for next month

### SMS not received
- Check phone number format
- Verify DefaultSMSType is set
- Check CloudWatch logs for delivery status
- Verify account is out of sandbox mode

