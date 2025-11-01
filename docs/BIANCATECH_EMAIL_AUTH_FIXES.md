# BiancaTechnologies.com Email Authentication Fixes

## Problem
SMTP authentication for `biancatechnologies.com` email addresses is failing with error: **"535 Authentication Credentials Invalid"**

## Root Cause Found ✅
The SMTP credentials stored in Secrets Manager are invalid or outdated. This happens when:
1. IAM access keys are rotated/deleted
2. SMTP password derivation fails
3. Credentials are regenerated but Secrets Manager isn't updated

## Current Status
- ✅ Domain `biancatechnologies.com` is verified in SES
- ✅ DKIM is enabled
- ✅ IAM users exist with correct policies
- ❌ **SMTP credentials are INVALID** (this is the issue)

## Solution

### Step 1: Regenerate SMTP Credentials
The `corp-email.sh` script will:
1. Create/verify IAM user exists
2. Create new IAM access key
3. Derive SMTP password from access key
4. Store credentials in Secrets Manager

```bash
cd bianca-app-backend
./scripts/corp-email.sh create-smtp jlapp@biancatechnologies.com
```

### Step 2: Verify Credentials
After regenerating, test the connection:
```bash
./scripts/test-smtp-connection.sh jlapp@biancatechnologies.com
```

### Step 3: For All Email Addresses
If you have multiple email addresses, regenerate for each:
```bash
./scripts/corp-email.sh create-smtp jlapp@biancatechnologies.com
./scripts/corp-email.sh create-smtp vthaker@biancatechnologies.com
# etc.
```

## How SMTP Credentials Work

The `corp-email.sh` script uses AWS's SMTP credential format:
1. Creates IAM user: `ses-smtp-<localpart>`
2. Creates IAM access key
3. Derives SMTP password using AWS v4 signing process:
   - Takes IAM access key secret
   - Signs the "SendRawEmail" message with region/service
   - Base64 encodes the signature
   - This becomes the SMTP password

The SMTP username is the IAM access key ID.

## Why Credentials Become Invalid

1. **Access Key Deleted**: If the IAM access key is deleted manually, SMTP password becomes invalid
2. **Access Key Rotated**: Old keys still work until deleted, but if regenerated incorrectly, auth fails
3. **IAM User Policy Changed**: If policy is removed or modified incorrectly
4. **Region Mismatch**: SMTP password is region-specific, must match SES region

## Verification Checklist

- [ ] Domain verified in SES
- [ ] DKIM enabled (shows "Success" status)
- [ ] IAM user exists (`ses-smtp-<localpart>`)
- [ ] IAM user has `ses-send-only` policy attached
- [ ] IAM user has at least 1 active access key
- [ ] SMTP credentials exist in Secrets Manager (`ses/smtp/<localpart>`)
- [ ] SMTP authentication test passes

## Diagnostic Commands

### Check IAM user and access keys
```bash
aws iam get-user --user-name ses-smtp-jlapp --profile jordan
aws iam list-access-keys --user-name ses-smtp-jlapp --profile jordan
```

### Check IAM policy
```bash
aws iam get-user-policy \
  --user-name ses-smtp-jlapp \
  --policy-name ses-send-only \
  --profile jordan
```

### Check Secrets Manager
```bash
aws secretsmanager get-secret-value \
  --secret-id ses/smtp/jlapp \
  --profile jordan \
  --region us-east-2
```

### Test SMTP connection
```bash
./scripts/test-smtp-connection.sh jlapp@biancatechnologies.com
```

### Run full diagnostic
```bash
./scripts/check-corp-email-auth.sh jordan us-east-2 jlapp@biancatechnologies.com
```

## Expected Behavior After Fix

1. ✅ `./scripts/corp-email.sh create-smtp` completes successfully
2. ✅ `./scripts/test-smtp-connection.sh` shows "✓ Authentication successful!"
3. ✅ Can send emails via SMTP using the credentials
4. ✅ No "535 Authentication Credentials Invalid" errors

## Related Files

- `scripts/corp-email.sh` - Main script (line 56-112: `create_smtp` function)
- `scripts/test-smtp-connection.sh` - SMTP connection tester
- `scripts/check-corp-email-auth.sh` - Full diagnostic script
