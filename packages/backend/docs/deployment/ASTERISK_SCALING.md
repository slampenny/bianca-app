# Asterisk — scaling and cost notes

**Context:** Platform AWS costs only (OpenAI and Twilio are COGS, tracked separately).

## Current setup (pilot)

Asterisk runs **in Docker on the same EC2 instance** as the backend, MongoDB, and Redis (`docker-compose.production.yml`). Twilio handles PSTN; Asterisk handles SIP/RTP and ARI for the OpenAI Realtime voice pipeline.

A **stable Elastic IP** is required for SIP (see `devops/terraform/STABLE_EXTERNAL_ADDRESSING.md`). HTTPS traffic goes through the ALB; voice does not.

## Scaling constraint

Voice capacity is bounded by **peak concurrent calls**, not total residents. Rough planning assumption: ~1 wellness call per resident per day, ~7 minutes each, clustered in business hours → peak concurrent ≈ 15% of daily call volume during the busiest hour.

| Approx. residents | Peak concurrent calls (planning) | Asterisk on current monolith |
|-------------------|----------------------------------|------------------------------|
| 10–50             | 1–5                              | OK on `t3.small`             |
| 500               | ~8–15                            | Contention; upgrade instance |
| 3,000             | ~45                              | Needs dedicated voice host(s) |
| 12,000            | ~180                             | Needs horizontal voice pool   |
| 60,000            | ~900                             | Large voice fleet or redesign |

Rule of thumb for self-hosted Asterisk: plan **~25–50 concurrent SIP/RTP channels per `m6i.large` vCPU pair**, depending on codec and transcoding load.

## Cost implication

Self-hosted Asterisk on EC2 is cheap at pilot scale (included in the monolith box). It becomes the **dominant AWS platform cost driver** once you need a horizontal pool of voice instances (~12K+ residents), because each concurrent call holds CPU/RTP resources for the full call duration.

## Architecture fork to evaluate at scale

Before building a large Asterisk EC2 fleet, evaluate routing media through **Twilio only** (no self-managed Asterisk/RTP on AWS). That would remove the voice compute pool and the SIP Elastic IP requirement from platform scaling, at the cost of a significant telephony architecture change and different Twilio COGS.

Until that decision is made, scaling path is:

1. **Vertical** — bigger single instance (`m6i.large`) while still monolith.
2. **Horizontal split** — dedicated Asterisk host(s) behind the same stable EIP pattern (or multiple EIPs + load balancing, which complicates Twilio/SIP config).
3. **Redesign** — Twilio-only media if voice EC2 costs dominate.

## Related docs

- `devops/terraform/STABLE_EXTERNAL_ADDRESSING.md` — EIP vs ALB rules for voice
- `devops/docs/ASTERISK_PRODUCTION_DEBUG.md` — production troubleshooting
- `docs/ARCHITECTURE.md` — voice pipeline diagram
