# AWS Support Email - SMS Delivery Status Logging Issue

**Subject:** SNS SMS Delivery Status Logging Not Working - Messages Charged But No Logs

---

**To:** AWS Support  
**From:** [Your Email]  
**Account ID:** 730335291008  
**Region:** us-east-2  
**Service:** Amazon SNS (SMS)

---

## Issue Summary

We have configured SNS SMS delivery status logging to CloudWatch, but delivery status logs are not appearing despite:
- Messages being successfully published (MessageIds returned)
- Messages being charged (spending metrics increasing)
- Delivery status logging properly configured with IAM role

Additionally, SMS messages are not being received by the destination phone number, and we cannot diagnose the issue without delivery status logs.

## Configuration Details

**SNS SMS Attributes:**
- `DeliveryStatusSuccessSamplingRate`: 100
- `DeliveryStatusIAMRole`: arn:aws:iam::730335291008:role/bianca-staging-sns-delivery-status-role
- `DefaultSMSType`: Transactional
- `MonthlySpendLimit`: $50
- Account Status: Production mode (confirmed in console)

**IAM Role Configuration:**
- Role ARN: `arn:aws:iam::730335291008:role/bianca-staging-sns-delivery-status-role`
- Trust Policy: Allows `sns.amazonaws.com` to assume the role
- Permissions: Full CloudWatch Logs permissions for `/aws/sns/*` path:
  - `logs:CreateLogGroup`
  - `logs:CreateLogStream`
  - `logs:PutLogEvents`
  - `logs:PutMetricFilter`
  - `logs:PutRetentionPolicy`

**CloudWatch Log Groups:**
- Created: `/aws/sns/staging/sms-delivery` (custom)
- Expected (per AWS docs): `/aws/sns/us-east-2/730335291008/DirectPublishToPhoneNumber`
- Both log groups exist but contain zero log streams/events

## Evidence

**Recent Test Messages:**
1. MessageId: `d77bc174-5f5d-50ba-a91c-a0ed70101d3c` (2025-11-20T15:00:29Z)
2. MessageId: `cefb4d4a-adaf-5310-8e64-2cd382254b7e` (2025-11-20T15:00:XXZ)
3. MessageId: `487e90cb-4106-5df8-8944-f1526eb14ef1` (2025-11-20T15:01:XXZ)

**Spending Metrics:**
- SMS spending increased from $0.12132 to $0.1348 during testing
- Confirms messages are being processed and charged
- Current spend: $0.1348 (well below $50 limit)

**Phone Number Details:**
- Destination: +16045624263 (Canada, E.164 format)
- Opt-out status: Not opted out (verified via `check-if-phone-number-is-opted-out`)
- Format: Validated as correct E.164 format

**Delivery Status Logs:**
- Zero log streams in any SNS-related log groups
- Zero log events found in `/aws/sns/staging/sms-delivery`
- Zero log events found in any `/aws/sns/*` log groups
- No delivery status logs appearing despite 100% sampling rate

## Troubleshooting Steps Already Taken

1. ✅ Verified account is in Production mode (not Sandbox)
2. ✅ Confirmed phone number is not opted out
3. ✅ Verified IAM role has correct trust policy and permissions
4. ✅ Tested IAM permissions via `simulate-principal-policy` - all allowed
5. ✅ Updated IAM policy to allow SNS standard log group path (`/aws/sns/*`)
6. ✅ Verified SNS SMS attributes are correctly configured
7. ✅ Tested with both application code and direct AWS CLI `publish` command
8. ✅ Confirmed messages are being charged (spending metrics increasing)
9. ✅ Checked for log groups in multiple locations/patterns
10. ✅ Verified phone number format is correct (E.164: +16045624263)

## Questions for AWS Support

1. **Why are delivery status logs not appearing?**
   - We have configured `DeliveryStatusSuccessSamplingRate=100` and `DeliveryStatusIAMRole`
   - Messages are being charged, indicating they're being processed
   - Should we see logs for both successful and failed deliveries?
   - Is there a delay in log delivery, or should logs appear immediately?

2. **Where should delivery status logs appear?**
   - AWS documentation indicates SNS creates log groups automatically
   - Expected pattern: `/aws/sns/<region>/<account-id>/DirectPublishToPhoneNumber`
   - We've created custom log groups but logs aren't appearing in either location
   - Can you confirm the exact log group path SNS uses for our account?

3. **Why are messages not being received?**
   - Messages are being charged, suggesting they reach the carrier
   - Phone number is not opted out
   - Account is in production mode
   - Are there known delivery issues to Canadian carriers (604 area code)?
   - Is there carrier-level blocking we should be aware of?

4. **Can you provide delivery status for recent MessageIds?**
   - MessageId: `d77bc174-5f5d-50ba-a91c-a0ed70101d3c`
   - MessageId: `cefb4d4a-adaf-5310-8e64-2cd382254b7e`
   - MessageId: `487e90cb-4106-5df8-8944-f1526eb14ef1`
   - What was the delivery status for these messages?
   - Were they delivered, failed, or blocked? If failed, what was the error?

5. **IAM Role Permissions:**
   - Is our IAM role configuration correct?
   - Does SNS need additional permissions beyond CloudWatch Logs?
   - Should the role have permissions to create log groups in the standard SNS path?

## Requested Actions

1. Investigate why delivery status logs are not appearing despite correct configuration
2. Provide delivery status for the MessageIds listed above
3. Verify IAM role permissions are sufficient for delivery status logging
4. Check for any account-level restrictions or flags that might affect SMS delivery
5. Confirm if there are known issues with SMS delivery to Canadian phone numbers (604 area code)

## Additional Information

**Environment:** Staging  
**Use Case:** Phone verification codes for healthcare application (HIPAA-compliant)  
**Message Type:** Transactional (verification codes)  
**Expected Volume:** Low (verification codes only, not marketing)

**Application Details:**
- Using AWS SDK v3 (`@aws-sdk/client-sns`)
- Sending via `PublishCommand` with `PhoneNumber` parameter
- No `MessageAttributes` (removed as they're not supported for SMS)
- Region: us-east-2

## Contact Information

**Account:** 730335291008  
**Region:** us-east-2  
**Support Case Priority:** [Normal/High - depending on urgency]  
**Best Contact Method:** [Email/Phone]

---

**Thank you for your assistance in resolving this issue. The delivery status logs are critical for diagnosing SMS delivery problems and ensuring reliable phone verification for our healthcare application.**

