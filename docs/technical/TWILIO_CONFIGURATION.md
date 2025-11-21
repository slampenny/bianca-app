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

## Summary

✅ **No Twilio configuration changes needed**
✅ **No Terraform for Twilio** (Twilio doesn't support it for SIP)
✅ **Everything is configured correctly**
✅ **EIP ensures IP stability** - no more manual updates needed








