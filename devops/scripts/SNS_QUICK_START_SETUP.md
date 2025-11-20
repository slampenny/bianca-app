# AWS SNS Quick Start Setup Guide

Based on the AWS SNS Quick Start guide, we need to set up:
1. Phone pool (for failover)
2. Configuration set (for logging - **THIS IS KEY!**)
3. Protect configuration (for country controls)
4. Test SMS sending

## Step 1: Create a Phone Pool

**Purpose:** Set up a phone pool to send messages with failover capabilities.

**Via AWS Console:**
1. Go to AWS SNS Console: https://console.aws.amazon.com/sns/v3/home
2. Navigate to **Text messaging (SMS)** → **Phone pools**
3. Click **Create pool**
4. Configure:
   - **Pool name:** `bianca-staging-sms-pool` (or `bianca-production-sms-pool`)
   - **Two-way SMS:** Enable if you need replies
   - **Origination identities:** Add phone numbers (if you have dedicated numbers) or leave empty to use AWS shared numbers
5. Click **Create pool**

**Note:** For basic SMS sending, you can skip this step and use AWS shared numbers. Phone pools are mainly for:
- Using your own dedicated phone numbers
- Failover between multiple numbers
- Two-way messaging

## Step 2: Create a Configuration Set ⚠️ **CRITICAL FOR LOGGING**

**Purpose:** Organize, track, and configure logging for SMS and voice events.

**This is the missing piece for delivery status logging!**

**Via AWS Console:**
1. Go to AWS SNS Console: https://console.aws.amazon.com/sns/v3/home
2. Navigate to **Text messaging (SMS)** → **Configuration sets**
3. Click **Create set**
4. Configure:
   - **Configuration set name:** `bianca-sms-config`
   - **Event destinations:** 
     - Click **Add destination**
     - **Destination type:** CloudWatch Logs
     - **Log group:** `/aws/sns/staging/sms-delivery` (or create new)
     - **IAM role:** `arn:aws:iam::730335291008:role/bianca-staging-sns-delivery-status-role`
     - **Events to log:** Select all (Success, Failure, etc.)
   - **Delivery status logging:**
     - **Success sample rate:** 100%
     - **Failure sample rate:** 100%
5. Click **Create set**

**After creating the configuration set:**
- You need to associate it with your SMS sends
- This might require updating the `PublishCommand` to include the configuration set

## Step 3: Create a Protect Configuration

**Purpose:** Configure country-specific messaging controls to block countries where you don't do business and enable AIT risk monitoring and filtering.

**Via AWS Console:**
1. Go to AWS SNS Console: https://console.aws.amazon.com/sns/v3/home
2. Navigate to **Text messaging (SMS)** → **Protect configurations**
3. Click **Create configuration**
4. Configure:
   - **Configuration name:** `bianca-protect-config`
   - **Allowed countries:** Select countries you do business in (e.g., United States, Canada)
   - **Blocked countries:** Select countries you don't do business in
   - **AIT (Account Intelligence Tool) risk monitoring:** Enable for fraud detection
5. Click **Create configuration**

## Step 4: Update Code to Use Configuration Set

Once the configuration set is created, we need to update our code to use it:

```javascript
const command = new PublishCommand({
  PhoneNumber: formattedPhone,
  Message: message,
  MessageAttributes: {
    'AWS.SNS.SMS.SMSType': {
      DataType: 'String',
      StringValue: 'Transactional'
    },
    'AWS.SNS.SMS.ConfigurationSet': {
      DataType: 'String',
      StringValue: 'bianca-sms-config'  // Your configuration set name
    }
  }
});
```

**Note:** Wait - we removed MessageAttributes because they're not supported for SMS! This might be a newer feature. Let me check if there's a different way to specify the configuration set.

## Alternative: Use Console Settings

If the configuration set can't be specified in code, it might be:
1. Account-level setting (applies to all SMS)
2. Set via console only
3. Requires phone pool association

## Next Steps

1. **Set up via Console first:**
   - Create configuration set with CloudWatch logging
   - Create protect configuration (optional but recommended)
   - Create phone pool (optional - can use shared numbers)

2. **Test SMS sending:**
   - Use the console "Send test message" feature
   - Check if delivery status logs appear

3. **Update code if needed:**
   - If configuration set requires code changes, update `sns.service.js`
   - If it's account-level, no code changes needed

4. **Verify logs:**
   - Check CloudWatch for delivery status logs
   - Should appear in the log group specified in configuration set

## Important Notes

- **Configuration sets might be a newer feature** not yet available in AWS CLI
- **Phone pools are optional** - you can use AWS shared numbers without a pool
- **Protect configuration is recommended** for production to prevent fraud
- **Configuration set is CRITICAL** for delivery status logging

## References

- AWS SNS Console: https://console.aws.amazon.com/sns/v3/home
- SNS SMS Documentation: https://docs.aws.amazon.com/sns/latest/dg/sms_publish-to-phone.html

