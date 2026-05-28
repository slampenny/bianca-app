# Subprocessors

**Document type:** Legal / compliance placeholder  
**Last updated:** May 2026  
**Status:** Draft — SCCs and transfer mechanisms must be executed by legal counsel before EU/GDPR routing is enabled in production.

This registry lists third parties that process personal or health-related data on behalf of Bianca Wellness. Actual Standard Contractual Clauses (SCCs) and Data Processing Agreements are legal agreements maintained outside this repository — not code artifacts.

---

## AWS (Amazon Web Services)

| Field | Detail |
| --- | --- |
| **Current region** | `us-east-2` (US East — Ohio) |
| **Target EU region** | `eu-central-1` (Frankfurt) — not yet provisioned |
| **Data types processed** | Application hosting, MongoDB persistence (EBS), S3 object storage (debug audio, artifacts), CloudWatch logs, SES email, SNS SMS, Secrets Manager, CodePipeline/CodeBuild artifacts |
| **Transfer mechanism** | **PENDING SCC** — AWS DPA + SCC Module Two (controller-to-processor) required before storing GDPR-regulated health data in EU or transferring EU subject data to US regions |
| **Notes** | EU S3 bucket and EU MongoDB endpoint are configuration placeholders until infrastructure is provisioned. See `DATA_RESIDENCY_MODE`, `EU_S3_BUCKET`, and `EU_MONGODB_URI` in backend configuration. |

---

## OpenAI

| Field | Detail |
| --- | --- |
| **Processing location** | United States (`api.openai.com` — Realtime API WebSocket and REST endpoints) |
| **Data types processed** | Call audio streams, real-time transcriptions, conversation content, AI-generated wellness responses, embeddings for analysis |
| **Transfer mechanism** | **PENDING SCC** — OpenAI DPA + SCCs required before processing GDPR-regulated health data |
| **Notes** | Audio is processed at US endpoints regardless of client jurisdiction until a legally approved EU processing option (if available) and executed agreements are in place. See comment in `openai.realtime.service.js` at connection initialization. |

---

## Telnyx

| Field | Detail |
| --- | --- |
| **Processing location** | United States (primary); global PoPs for telephony signaling and media |
| **Data types processed** | Phone numbers, call metadata (timestamps, duration, status), SIP signaling, voice media paths when Telnyx is the telephony provider |
| **Transfer mechanism** | **PENDING SCC** — Telnyx DPA + SCCs required for GDPR-regulated call data |
| **Notes** | Configured via `VOICE_TELEPHONY_PROVIDER=telnyx` when enabled. Twilio may remain in use for some environments. |

---

## Stripe

| Field | Detail |
| --- | --- |
| **Processing location** | United States (Stripe, Inc.); EU entities available for certain products |
| **Data types processed** | Billing account identifiers, payment method tokens, subscription and invoice metadata, transaction records (no full card numbers stored by Bianca) |
| **Transfer mechanism** | **PENDING SCC** — Stripe DPA + SCCs required where GDPR applies to billing-related personal data |
| **Notes** | Stripe keys loaded from AWS Secrets Manager per environment. |

---

## Change control

| Subprocessor | SCC status | Owner | Target completion |
| --- | --- | --- | --- |
| AWS | PENDING SCC | Legal / Engineering | Before `DATA_RESIDENCY_MODE` set to `AUTO` or `EU` in production |
| OpenAI | PENDING SCC | Legal | Before GDPR health-data calls use Realtime API |
| Telnyx | PENDING SCC | Legal | Before EU orgs use Telnyx voice |
| Stripe | PENDING SCC | Legal | Before EU billing go-live |

When an SCC is executed, update the **Transfer mechanism** row for that subprocessor in this file and record the agreement reference (date, version) in your contract repository — not in git secrets or application code.
