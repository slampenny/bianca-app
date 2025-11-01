# Gmail DNS Verification (Skip Email Verification)

## Problem
Gmail verification emails sent to `jlapp@biancatechnologies.com` aren't arriving because:
- Gmail may not send verification emails to forwarded addresses
- Verification emails might be filtered as spam
- Email forwarding may have delays

## Solution: Use DNS Verification Instead

Gmail allows domain verification via DNS, which doesn't require receiving an email!

## Step-by-Step: DNS Verification in Gmail

### Step 1: Start the Process in Gmail
1. Go to Gmail Settings → Accounts and Import
2. Click "Add another email address"
3. Enter: `jlapp@biancatechnologies.com`
4. **Look for verification options**:
   - If Gmail offers "Verify using DNS" or "TXT record", choose that
   - If not, try to skip or look for "Verify domain ownership"

### Step 2: Get the TXT Record from Gmail
Gmail will provide:
- A TXT record name (like: `google-site-verification=...`)
- Or a verification code (like: `abc123def456...`)

### Step 3: Add TXT Record to Your DNS
Using Route53 or your DNS provider:

**If using Route53**:
```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id <your-zone-id> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "biancatechnologies.com",
        "Type": "TXT",
        "TTL": 300,
        "ResourceRecords": [{"Value": "\"<gmail-provided-value>\""}]
      }
    }]
  }' \
  --profile jordan
```

**Or manually in Route53 Console**:
1. Go to Route53 → Hosted Zones → biancatechnologies.com
2. Click "Create record"
3. Name: `biancatechnologies.com` (or leave blank for root)
4. Type: `TXT`
5. Value: `"<whatever-gmail-provides>"` (include quotes if Gmail shows them)
6. TTL: 300 (or default)
7. Save

### Step 4: Wait for DNS Propagation
- Usually 5-60 minutes
- Check with: `dig TXT biancatechnologies.com`

### Step 5: Verify in Gmail
- Gmail will automatically detect the TXT record
- Or click "Verify" in Gmail settings
- No email needed!

## Alternative: Manual Domain Verification First

If Gmail doesn't offer DNS verification directly, you might need to verify the domain first:

### Verify Domain Ownership in Google
1. Go to: https://search.google.com/search-console
2. Add property: `biancatechnologies.com`
3. Choose "Domain" verification
4. Get DNS TXT record from Google Search Console
5. Add to Route53
6. Verify domain
7. Then go back to Gmail → should work without email verification

## If Gmail INSISTS on Email Verification

If Gmail won't let you skip email verification:

### Option A: Temporary Email Forward
1. Set up a temporary email that DOES work (not forwarded)
2. Verify with that email
3. Then change the forwarding

### Option B: Use Google Workspace
Google Workspace has better domain verification:
- $6/month per user
- Domain verification via DNS (no email needed)
- More professional setup
- No "via gmail.com"

### Option C: Check Spam Folder
Sometimes verification emails end up in spam:
1. Check `negascout@gmail.com` spam folder
2. Check for emails from `noreply@google.com` or similar
3. Mark as "Not Spam" if found

## Quick Fix: Check Your Forwarding Works First

Before worrying about Gmail verification, make sure forwarding works:

```bash
# Send yourself a test email
aws ses send-email \
  --from "test@example.com" \
  --destination "ToAddresses=jlapp@biancatechnologies.com" \
  --message "Subject={Data=Test},Body={Text={Data=Test email}}" \
  --profile jordan \
  --region us-east-2
```

Wait 2-5 minutes, check `negascout@gmail.com` inbox. If it arrives, forwarding works!

## Most Reliable: Google Workspace
If this is too complicated, Google Workspace ($6/month) handles everything:
- Professional email hosting
- Domain verification via DNS
- No email verification needed
- More reliable long-term

See: `docs/EMAIL_ALTERNATIVES.md` for full setup.

