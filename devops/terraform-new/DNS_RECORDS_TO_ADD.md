# DNS Records Required for Email Forwarding

## Domain Verification Status
The infrastructure has been deployed, but DNS records need to be added to your domain registrar to complete setup.

## Records to Add

### 1. Domain Verification (TXT Record)
**Name/Host**: `_amazonses.biancatechnologies.com`  
**Type**: `TXT`  
**Value**: `lfieLTlqpSguM302pGeNKpppIdsqPP8nyklkQvCBT14=`  
**TTL**: `3600` (or default)

**OR** (some DNS providers use different format):
**Name/Host**: `@` (root domain)  
**Type**: `TXT`  
**Value**: `_amazonses.lfieLTlqpSguM302pGeNKpppIdsqPP8nyklkQvCBT14=`  
**TTL**: `3600`

### 2. DKIM Verification (3 CNAME Records)
Add these three CNAME records for email authentication:

**Record 1:**
- **Name/Host**: `gec5hxy2uljx2immgtyyitird4ja73vu._domainkey.biancatechnologies.com`
- **Type**: `CNAME`
- **Value**: `gec5hxy2uljx2immgtyyitird4ja73vu.dkim.amazonses.com`
- **TTL**: `3600`

**Record 2:**
- **Name/Host**: `r2n2ohdatusupv2awq3rmvxkknf7jzuz._domainkey.biancatechnologies.com`
- **Type**: `CNAME`
- **Value**: `r2n2ohdatusupv2awq3rmvxkknf7jzuz.dkim.amazonses.com`
- **TTL**: `3600`

**Record 3:**
- **Name/Host**: `65cggovedxszuiy3jpoozke24vbrre22._domainkey.biancatechnologies.com`
- **Type**: `CNAME`
- **Value**: `65cggovedxszuiy3jpoozke24vbrre22.dkim.amazonses.com`
- **TTL**: `3600`

### 3. MX Record (for receiving emails)
**Name/Host**: `@` or `biancatechnologies.com`  
**Type**: `MX`  
**Priority**: `10`  
**Value**: `10 inbound-smtp.us-east-2.amazonaws.com`  
**TTL**: `3600`

### 4. SPF Record (TXT Record)
**Name/Host**: `@` or `biancatechnologies.com`  
**Type**: `TXT`  
**Value**: `v=spf1 include:amazonses.com ~all`  
**TTL**: `3600`

### 5. DMARC Record (TXT Record - Optional but Recommended)
**Name/Host**: `_dmarc.biancatechnologies.com`  
**Type**: `TXT`  
**Value**: `v=DMARC1; p=quarantine; rua=mailto:dmarc@biancatechnologies.com`  
**TTL**: `3600`

## Verification

After adding DNS records, wait 5-60 minutes for propagation, then verify:

```bash
# Check domain verification
aws ses get-identity-verification-attributes --identities biancatechnologies.com

# Check MX record
dig MX biancatechnologies.com

# Check SPF record
dig TXT biancatechnologies.com | grep spf

# Check DKIM records
dig CNAME gec5hxy2uljx2immgtyyitird4ja73vu._domainkey.biancatechnologies.com
```

## Current Status

✅ Infrastructure deployed  
✅ Lambda function configured  
✅ Email mappings set  
✅ SES receipt rules created  
⏳ Waiting for DNS records and domain verification

## Next Steps After DNS Propagation

1. Wait for DNS records to propagate (usually 5-60 minutes)
2. Domain will auto-verify once DNS records are correct
3. If in SES sandbox mode, verify a test sender email address
4. Send a test email to `jlapp@biancatechnologies.com`
5. Check that it arrives at `negascout@gmail.com`


