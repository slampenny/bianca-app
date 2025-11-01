# Gmail Verification Email Not Arriving - Solutions

## Problem
Gmail sends a verification email to `jlapp@biancatechnologies.com`, but it's not arriving in your inbox.

## Why This Happens
Gmail verification emails are sent FROM Gmail TO biancatechnologies.com. If your email forwarding isn't working, or if the verification email is being filtered, you won't receive it.

## Solutions (Try in Order)

### Solution 1: Check Email Forwarding Status
Verify that emails to `jlapp@biancatechnologies.com` are being forwarded correctly:

```bash
# Check Lambda mapping
aws lambda get-function-configuration \
  --function-name myphonefriend-email-forwarder \
  --profile jordan \
  --region us-east-2 \
  --query 'Environment.Variables.RECIPIENT_MAP' \
  --output text | jq .

# Check SES receipt rule
aws ses describe-receipt-rule-set \
  --rule-set-name myphonefriend-email-forwarding \
  --profile jordan \
  --region us-east-2 \
  --output json | jq '.Rules[] | select(.Recipients[]? == "jlapp@biancatechnologies.com")'
```

### Solution 2: Send Test Email to Verify Forwarding Works
First, make sure email forwarding is working:

```bash
# Send a test email from any address to jlapp@biancatechnologies.com
# Use your personal email or another email you control
```

If that test email doesn't arrive, fix the forwarding first (see below).

### Solution 3: Use Alternate Verification Method
Gmail allows alternative verification methods in some cases:

1. **Skip Email Verification** (if available):
   - Some accounts allow "Skip verification" if you can prove domain ownership
   - Look for a link or option to skip

2. **Use Google Workspace Instead**:
   - If you're setting up Google Workspace, domain verification can be done via DNS
   - This is more reliable than email verification

### Solution 4: Verify Email Forwarding is Working
If emails aren't arriving, check your forwarding setup:

**Check 1: SES Rule Set**
```bash
# Verify the rule set is active
aws ses describe-active-receipt-rule-set \
  --profile jordan \
  --region us-east-2
```

**Check 2: Lambda Function**
```bash
# Check Lambda logs for recent emails
aws logs tail /aws/lambda/myphonefriend-email-forwarder \
  --follow \
  --profile jordan \
  --region us-east-2
```

**Check 3: S3 Bucket**
```bash
# Check if emails are being stored in S3
aws s3 ls s3://bianca-corp-email-storage-730335291008/corp/jlapp/ \
  --profile jordan \
  --recursive \
  --human-readable
```

### Solution 5: Manual DNS Verification (Better Long-term)
Instead of email verification, verify domain ownership via DNS:

1. **In Gmail Settings**:
   - Look for "Verify using DNS" or "TXT record verification"
   - Gmail will provide a TXT record to add to your DNS

2. **Add DNS Record**:
   - Go to Route53 or your DNS provider
   - Add the TXT record Gmail provides
   - Wait for DNS propagation (5-60 minutes)

3. **Verify in Gmail**:
   - Gmail will automatically detect the TXT record
   - No email needed!

### Solution 6: Temporary Workaround - Use Existing Working Email
If forwarding isn't working yet:

1. **For now, verify with a different email**:
   - Gmail may allow verification to a different email you control
   - Then change the "From" address later

2. **Or set up forwarding first**:
   - Get email forwarding working
   - Then retry Gmail verification

### Solution 7: Use Google Workspace (Bypasses This Issue)
Google Workspace has better domain verification:

1. Sign up for Google Workspace trial
2. Verify domain via DNS (TXT record)
3. Set up email forwarding there
4. More professional, no "via gmail.com"

## Most Likely Issue: Email Forwarding Not Active

If emails to `jlapp@biancatechnologies.com` aren't arriving, check:

1. **Is the receipt rule active?**
   ```bash
   aws ses describe-active-receipt-rule-set --profile jordan --region us-east-2
   ```

2. **Is Lambda function working?**
   - Check CloudWatch logs for errors
   - Verify Lambda has S3 read permissions
   - Verify Lambda has SES send permissions

3. **Is domain verified in SES?**
   ```bash
   aws ses get-identity-verification-attributes \
     --identities biancatechnologies.com \
     --profile jordan \
     --region us-east-2
   ```

4. **Are MX records correct?**
   ```bash
   dig MX biancatechnologies.com
   ```
   Should show: `10 inbound-smtp.us-east-2.amazonaws.com`

## Quick Test
Send yourself a test email TO `jlapp@biancatechnologies.com` from another email address. If it doesn't arrive, forwarding is broken and needs to be fixed first.

