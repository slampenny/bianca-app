# SMS Not Working - Troubleshooting Guide

## Most Likely Issue: SMS Sandbox Mode

**AWS accounts start in "SMS Sandbox" mode**, which only allows sending SMS to **verified phone numbers**. To send to unverified numbers (like phone verification codes), you need **production access**.

## Quick Check

1. **Check if you're in sandbox mode:**
   - Go to: https://console.aws.amazon.com/sns/v3/home#/sms/settings
   - Look for "SMS sandbox" status
   - If it says "In sandbox" or shows sandbox restrictions, you need production access

2. **Request Production Access:**
   - In the SMS settings page, click "Request production access"
   - Fill out the form with your use case
   - You already have the details in `AWS_SNS_QUOTA_RESPONSE.md`
   - Approval usually takes 24-48 hours

## Test SMS Sending

Run the test script with your phone number:

```bash
cd bianca-app-backend
node scripts/test-sms-send.js +1234567890
```

Replace `+1234567890` with your actual phone number in E.164 format.

## Common Error Messages

### "InvalidParameter: PhoneNumber is not valid to publish to"
- **Cause:** Account is in SMS sandbox mode
- **Solution:** Request production access (see above)

### "AuthorizationError"
- **Cause:** IAM permissions missing
- **Solution:** Verify IAM role has `sns:Publish` permission (already configured ✅)

### "Monthly spending limit exceeded"
- **Cause:** Hit the $50/month limit
- **Solution:** Increase limit in AWS Console or wait for next month

## Current Configuration Status

✅ **DefaultSMSType:** Set to "Transactional"  
✅ **IAM Permissions:** Configured in Terraform  
✅ **SNS Service Code:** Properly implemented  
❓ **SMS Sandbox Status:** Need to verify in AWS Console

## Next Steps

1. **Check sandbox status** in AWS Console
2. **Request production access** if in sandbox mode
3. **Test with the script** once production access is granted
4. **Check application logs** for any errors when sending verification codes

## Application Logs

Check your application logs for SMS sending errors:

```bash
# If using CloudWatch
aws logs tail /ecs/bianca-app --follow --profile jordan

# Or check your application's log output
# Look for lines containing "[SMS Verification]" or "SNS"
```

## Still Not Working?

1. Verify phone number format (must be E.164: `+1234567890`)
2. Check if phone number has opted out of SMS
3. Verify AWS region is correct (`us-east-2`)
4. Check CloudWatch metrics for SMS delivery success/failure rates
5. Contact AWS Support if production access is approved but still not working

