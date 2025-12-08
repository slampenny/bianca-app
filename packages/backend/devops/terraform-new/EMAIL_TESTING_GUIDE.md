# Email Testing Guide

## ⚠️ Common Issue: Domain Typo

### Error Message:
```
Address not found
Your message wasn't delivered to vthaker@biancatechnolgies.com because the domain 
biancatechnolgies.com couldn't be found.
```

**Problem**: There's a typo in the domain name:
- ❌ **WRONG**: `biancatechnolgies.com` (missing 'o')
- ✅ **CORRECT**: `biancatechnologies.com`

## ✅ Correct Email Addresses

When sending test emails, use these **exact** addresses:

1. **Jordan Lapp**: `jlapp@biancatechnologies.com`
   - Forwards to: `negascout@gmail.com`

2. **Viren Thaker**: `vthaker@biancatechnologies.com`
   - Forwards to: `virenthaker@gmail.com`

## How to Test

### Step 1: Send Test Email
Use Gmail or any email client to send to:
- **To**: `vthaker@biancatechnologies.com` (NOTE: "techno**lo**gies" not "techno**lg**ies")
- **From**: Any email address (Gmail works fine)
- **Subject**: Test Email
- **Body**: Any test message

### Step 2: Monitor Processing
```bash
# Watch Lambda logs in real-time
aws logs tail /aws/lambda/bianca-corp-email-forwarder --follow

# Check S3 for stored emails
aws s3 ls s3://bianca-corp-email-storage-730335291008/emails/ --recursive

# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=bianca-corp-email-forwarder \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Step 3: Verify Delivery
1. Check `virenthaker@gmail.com` inbox (should receive within 1-2 minutes)
2. Check spam folder if not in inbox
3. Check Lambda logs for any errors

## Domain Configuration ✅

**Domain**: `biancatechnologies.com` (verified in SES)

**DNS Records** (all configured):
- ✅ MX: `10 inbound-smtp.us-east-2.amazonaws.com`
- ✅ SPF: `v=spf1 include:amazonses.com ~all`
- ✅ DMARC: Configured
- ✅ DKIM: 3 CNAME records

**Receipt Rules**:
- ✅ Active rule set: `myphonefriend-email-forwarding`
- ✅ Rules configured for both addresses

## Troubleshooting

### Email Bounces
1. **Check domain spelling**: Must be `biancatechnologies.com` (with 'o')
2. **Verify sender email**: In SES sandbox mode, sender must be verified
3. **Check Lambda logs**: Look for processing errors
4. **Check S3**: Verify email was stored

### Email Not Forwarding
1. **Check Lambda logs**: `aws logs tail /aws/lambda/bianca-corp-email-forwarder --follow`
2. **Verify mapping**: Lambda environment variable `EMAIL_MAPPINGS` should contain the recipient
3. **Check SES**: Verify domain is still verified
4. **Check S3 bucket**: Email should be stored there first

### Domain Not Found Error
This usually means:
- ❌ Typo in the email address (most common)
- ❌ DNS records not propagated (wait 24-48 hours after creation)
- ❌ MX record not configured correctly

**For `biancatechnologies.com`**, verify:
```bash
# Check MX record
dig +short MX biancatechnologies.com
# Should return: 10 inbound-smtp.us-east-2.amazonaws.com.

# Check domain verification
aws ses get-identity-verification-attributes --identities biancatechnologies.com
```

## Testing with Script

Use the provided test script:
```bash
./test-email-send.sh negascout@gmail.com vthaker@biancatechnologies.com
```

This will:
1. Verify the sender email (if needed)
2. Send a test email via SES
3. Monitor delivery

---

**Remember**: Always double-check the domain spelling: `biancatechnologies.com` (with 'o' before 'l')





