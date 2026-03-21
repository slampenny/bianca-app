# Twilio Configuration Guide

## Current Setup

### Asterisk Configuration
Your Asterisk is configured to accept SIP calls from Twilio using:
- **SIP Transport**: TCP on port 5061
- **SIP Username**: `bianca`
- **IP Allowlist**: Twilio's SIP IP ranges (configured in `pjsip.conf.template`)
- **Codecs**: ulaw, alaw

### Twilio Requirements

**No changes needed on Twilio side** - Your current configuration is correct:

1. **SIP Domain/Trunk**: Not required - You're using direct SIP dialing
2. **IP Allowlist**: Not required - Asterisk allows Twilio IPs
3. **Authentication**: Not required - Using IP-based identification
4. **SIP URI Format**: `sip:bianca@sip.biancawellness.com:5061;transport=tcp`

### What Twilio Needs

When Twilio makes a call, it:
1. Connects to `sip.biancawellness.com:5061` (TCP)
2. Sends SIP INVITE to `sip:bianca@sip.biancawellness.com:5061;transport=tcp`
3. Asterisk identifies it as Twilio based on source IP (from allowlist)
4. Routes call to `from-twilio` context → `bianca` extension → Stasis ARI

### Twilio Console Settings

**No Terraform for Twilio** - Twilio doesn't have Terraform provider for SIP trunks.

**What to check in Twilio Console:**
1. **Phone Number** → Voice Configuration:
   - Webhook URL: `https://api.biancawellness.com/v1/twilio/call`
   - HTTP Method: POST
   - Status Callback: `https://api.biancawellness.com/v1/twilio/status`

2. **SIP Trunking** (if using):
   - Not required for your setup
   - You're using direct SIP dialing via TwiML

### Current TwiML Generation

Your backend generates TwiML like this:
```xml
<Response>
  <Say>Hello, connecting you to Bianca</Say>
  <Dial callerId="+19786256514" timeout="20">
    <Sip>sip:bianca@sip.biancawellness.com:5061;transport=tcp;callSid=XXX;patientId=YYY</Sip>
  </Dial>
</Response>
```

### IP Address Changes

**Important**: If `sip.biancawellness.com` IP changes:
- ✅ **Now handled automatically** - EIP ensures IP never changes
- ✅ **DNS updates automatically** - Terraform manages Route53
- ❌ **No Twilio changes needed** - Twilio uses DNS name, not IP

### Security

Your Asterisk security group allows:
- ✅ Port 5061 TCP from Twilio IP ranges
- ✅ Port 5060 UDP from Twilio IP ranges  
- ✅ RTP ports 10000-10100 UDP from Twilio IP ranges

### Testing

To test SIP connection:
```bash
# Test endpoint
curl https://api.biancawellness.com/v1/twilio/test-sip

# Or make a real call
# Twilio will connect to sip.biancawellness.com:5061
```

## Twilio warning 32011 — “Unable to connect” to `sip:bianca@sip.biancawellness.com:5061`

This means **Twilio could not open a TCP connection** to your SIP host (failure happens *before* SIP INVITE / auth). Staging can work while production fails if **only production’s** SIP path is broken.

### Checklist (in order)

1. **DNS matches the instance that runs Asterisk**  
   - `sip.biancawellness.com` is an **A record** to the production **EIP** (`production.tf` → `aws_eip.production`).  
   - After **blue/green**, the EIP must be **associated** with the instance that actually runs the `asterisk` container. If the EIP is detached or still on the old instance, Twilio connects to the wrong host or nothing.  
   - Verify:
     ```bash
     dig +short sip.biancawellness.com
     aws ec2 describe-addresses --filters "Name=tag:Name,Values=bianca-production-eip" \
       --query 'Addresses[*].[PublicIp,InstanceId]' --output text
     ```
     The **A record IP** and **EIP public IP** should match; **InstanceId** should be the live instance (not empty).

2. **Something listens on `public_ip:5061` (TCP)**  
   On the instance that owns the EIP:
   ```bash
   docker ps | grep -i asterisk
   ss -lntp | grep 5061 || sudo ss -lntp | grep 5061
   ```
   Expect Asterisk up and **5061/tcp** bound (via Docker publish).

3. **From your laptop (tests network path)**  
   ```bash
   nc -vz sip.biancawellness.com 5061
   # or
   timeout 5 bash -c 'echo | cat >/dev/tcp/sip.biancawellness.com/5061' 2>/dev/null && echo ok || echo fail
   ```
   If this **fails**, Twilio will see 32011 too.

4. **`EXTERNAL_ADDRESS` / compose after EIP move**  
   If SIP broke right after a deploy/swap, Asterisk may still advertise the **old** public IP. Fix: see `devops/docs/ASTERISK_PRODUCTION_DEBUG.md` §5 (update `EXTERNAL_ADDRESS` in `docker-compose.yml` and restart `asterisk` + `app`).

5. **New Twilio SIP edge IPs (less common for pure “connect”)**  
   Ranges live in `devops/asterisk/configs/pjsip.conf.template` under `[twilio-identify]`. If Twilio adds ranges, update the template and redeploy Asterisk. A **mismatch** more often causes **403 / identify** issues after connect, not always 32011 — but worth checking if 1–4 look fine.

### Staging vs production

| | Staging | Production |
|---|---------|------------|
| SIP hostname | `staging-sip.biancawellness.com` | `sip.biancawellness.com` |
| Terraform record | `staging-sip.${primary_domain}` | `sip.${primary_domain}` → **production EIP** |

They use **different DNS names and EIPs**. Compare staging’s working path to production using the same checks above.

---

## Summary

✅ **No Twilio configuration changes needed**
✅ **No Terraform for Twilio** (Twilio doesn't support it for SIP)
✅ **Everything is configured correctly**
✅ **EIP ensures IP stability** - no more manual updates needed








