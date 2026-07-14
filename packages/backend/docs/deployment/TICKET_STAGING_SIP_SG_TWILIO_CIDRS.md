# Ticket: Restrict staging SIP SG to Twilio signaling CIDRs

**Status:** Report only — do **not** apply until reviewed.  
**Scope:** `packages/backend/devops/terraform/staging.tf` security group `aws_security_group.staging`  
**Today:** TCP/UDP `5060–5061` allow `0.0.0.0/0`.

## Goal

Replace wide-open SIP ingress with Twilio Elastic SIP Trunking **signaling** source ranges (all edges, for resiliency). Keep RTP rule separate (`10000–10100/udp` today); media uses Twilio’s published media range (`168.86.128.0/18` UDP 10000–60000 per [Twilio SIP IPs](https://www.twilio.com/docs/sip-trunking/ip-addresses)) — consider a follow-up ticket to scope RTP similarly.

## Signaling CIDR list (public Elastic SIP Trunking edges)

Verify against Twilio docs before apply (ranges can change):

| Edge | CIDR / hosts | Ports |
|------|----------------|-------|
| North America Virginia | `54.172.60.0/30` | 5060 UDP/TCP, 5061 TLS |
| North America Oregon | `54.244.51.0/30` | 5060 UDP/TCP, 5061 TLS |
| Europe Ireland | `54.171.127.192/30` | 5060 UDP/TCP, 5061 TLS |
| Europe Frankfurt | `35.156.191.128/30` | 5060 UDP/TCP, 5061 TLS |
| Asia Pacific Tokyo | `54.65.63.192/30` | 5060 UDP/TCP, 5061 TLS |
| Asia Pacific Singapore | `54.169.127.128/30` | 5060 UDP/TCP, 5061 TLS |
| Asia Pacific Sydney | `54.252.254.64/30` | 5060 UDP/TCP, 5061 TLS |
| South America São Paulo | `177.71.206.192/30` | 5060 UDP/TCP, 5061 TLS |

Optional: Interconnect edges if you ever terminate staging over Interconnect — see Twilio Interconnect signaling IPs (separate list).

## Proposed Terraform diff (illustrative)

```hcl
# Replace cidr_blocks = ["0.0.0.0/0"] on SIP TCP/UDP 5060-5061 with:
locals {
  twilio_sip_signaling_cidrs = [
    "54.172.60.0/30",
    "54.244.51.0/30",
    "54.171.127.192/30",
    "35.156.191.128/30",
    "54.65.63.192/30",
    "54.169.127.128/30",
    "54.252.254.64/30",
    "177.71.206.192/30",
  ]
}

# Prefer dynamic ingress blocks per CIDR (or one rule per protocol with the list)
# so AWS SG rule count stays clear.
```

AWS allows multiple CIDRs per rule (up to quota). Prefer **one TCP rule + one UDP rule** each listing `local.twilio_sip_signaling_cidrs`.

## Validation after apply

1. `yarn staging:up` && `yarn staging:deploy`
2. Manual inbound call to `+19285758645`
3. Confirm SIP OPTIONS / INVITE still reach Asterisk (`pjsip set logger on` / docker logs)
4. Confirm non-Twilio probes from random IPs are dropped

## Out of scope

- Production SG change (same pattern can follow once staging is proven)
- Changing RTP publish range (`10000–10100`)
