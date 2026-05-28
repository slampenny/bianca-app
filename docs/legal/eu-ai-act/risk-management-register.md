# Risk Management Register

**Provider:** Bianca Technologies  
**System:** Bianca Wellness Platform  
**Document version:** 1.0  
**Last updated:** May 2026  
**Regulatory basis:** EU AI Act Article 9 (Risk management system)

This register identifies, assesses, and tracks risks associated with the Bianca AI wellness platform. It supports the risk management summary in [annex-iv-technical-documentation.md](./annex-iv-technical-documentation.md) and the process described in [quality-management-system.md](./quality-management-system.md).

**Scoring:** Likelihood (L) and Impact (I) are rated 1–5. Risk score = L × I.

| Rating | Likelihood | Impact |
| --- | --- | --- |
| 1 | Rare | Negligible |
| 2 | Unlikely | Minor |
| 3 | Possible | Moderate |
| 4 | Likely | Major |
| 5 | Almost certain | Severe / critical |

**Residual risk levels:** LOW (1–6), MEDIUM (7–12), HIGH (13–19), CRITICAL (20–25)

---

## Summary table

| Risk ID | Category | Description | L | I | Score | Residual | Owner | Review date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAF-001 | Safety | False negative — wellness concern not detected | 3 | 5 | 15 | MEDIUM | Bianca Technologies | 2026-08-28 |
| SAF-002 | Safety | False positive — alert fatigue | 3 | 3 | 9 | MEDIUM | Bianca Technologies | 2026-08-28 |
| SAF-003 | Safety | Emergency misclassification — urgent treated as routine | 2 | 5 | 10 | MEDIUM | Bianca Technologies | 2026-08-28 |
| PRI-001 | Privacy | Unauthorised access to resident health conversations | 2 | 5 | 10 | MEDIUM | Bianca Technologies | 2026-08-28 |
| PRI-002 | Privacy | Data residency violation — PHI outside EU without SCC | 4 | 5 | 20 | **HIGH** | Bianca Technologies | 2026-08-28 |
| PRI-003 | Privacy | Consent withdrawal not propagated to active sessions | 2 | 4 | 8 | MEDIUM | Bianca Technologies | 2026-08-28 |
| PRI-004 | Privacy | ClientMemory facts retained beyond retention period | 2 | 3 | 6 | LOW | Bianca Technologies | 2026-08-28 |
| ACC-001 | Accuracy | Hallucinated facts stored in ClientMemory | 3 | 3 | 9 | MEDIUM | Bianca Technologies | 2026-08-28 |
| ACC-002 | Accuracy | Speech recognition errors (elderly / accented speech) | 4 | 3 | 12 | MEDIUM | OpenAI / Bianca | 2026-08-28 |
| ACC-003 | Accuracy | Context drift across long-running resident histories | 2 | 3 | 6 | LOW | Bianca Technologies | 2026-08-28 |
| OPS-001 | Operational | OpenAI Realtime API outage — call failure | 3 | 3 | 9 | MEDIUM | OpenAI / Bianca | 2026-08-28 |
| OPS-002 | Operational | Telephony (Telnyx) failure — resident not reached | 3 | 3 | 9 | MEDIUM | Telnyx / Deployer | 2026-08-28 |
| OPS-003 | Operational | Call scheduling failure — missed wellness check | 2 | 3 | 6 | LOW | Bianca / Deployer | 2026-08-28 |
| LEG-001 | Legal | High-risk AI Act classification requiring notified body | 2 | 4 | 8 | MEDIUM | Bianca Technologies | 2026-08-28 |
| LEG-002 | Legal | SCC gap — PHI processed by OpenAI US endpoints | 5 | 5 | 25 | **HIGH** | Bianca Technologies | 2026-08-28 |
| LEG-003 | Legal | NAIH enforcement action for non-compliant deployment | 3 | 5 | 15 | **HIGH** | Bianca Technologies | 2026-08-28 |

---

## Detailed risk narratives

---

### SAF-001 — False negative: wellness concern not detected

| Field | Detail |
| --- | --- |
| **Category** | Safety |
| **Description** | A resident expresses a genuine wellness or safety concern during a call, but the emergency detection pipeline does not trigger an alert. Staff are not notified and may miss a deteriorating condition. |
| **Likelihood** | 3 — Possible. Detection depends on utterance phrasing, embedding similarity thresholds (0.78), and tense verification filtering past-tense narratives. |
| **Impact** | 5 — Severe. Delayed response to falls, self-harm ideation, or abuse could result in resident harm. |
| **Risk score** | 15 |

**Current mitigation:**

- Multi-stage emergency pipeline: embedding similarity (`text-embedding-3-large` via `emergencyEmbeddingPipeline.service.js`) followed by tense check (`gpt-4.1-mini`)
- Keyword-based fallback detector when `USE_KEYWORD_BASED_DETECTORS` enabled (`localizedEmergencyDetector.service.js`, `emergencyDetector.js`)
- Context window tracks recent utterances for narrative vs. present-tense classification (`conversationContextWindow.js`)
- Post-call fact extraction marks safety facts as `priority: urgent` (`clientMemory.service.js`)
- Corpus regression tests (`emergencyDetector.corpus.test.js`, `emergencyProcessor.test.js`)
- Documented fallback when localized phrase database is empty (`EMERGENCY_DETECTOR_TEST_GAP_ANALYSIS.md`)

**Residual risk:** MEDIUM — inherent limitation of NLP-based detection; subtle or indirect expressions may be missed.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

### SAF-002 — False positive: alert fatigue

| Field | Detail |
| --- | --- |
| **Category** | Safety |
| **Description** | Excessive false alerts cause caregivers to ignore or delay responding to the dashboard and SMS notifications, reducing effective response to genuine emergencies. |
| **Likelihood** | 3 — Possible. Narrative speech, media references, and ambiguous phrasing can trigger detection. |
| **Impact** | 3 — Moderate. Alert fatigue degrades response quality over time. |
| **Risk score** | 9 |

**Current mitigation:**

- False positive filter (`filterFalsePositives` in `emergencyDetector.js`)
- Tense verification rejects past-tense and hypothetical utterances (`emergencyEmbeddingPipeline.service.js`)
- Context-aware narrative classification with high confidence threshold (>0.85) before filtering (`emergencyProcessor.service.js`)
- Alert deduplication prevents repeated alerts for same category (`alertDeduplicator.js`)
- Ultra-short "help me" without context suppressed (EDGE-003 corpus case)
- Financial exploitation alerts are dashboard-only (no SMS) to reduce noise
- Alert `relevanceUntil` expiry reduces stale alert accumulation

**Residual risk:** MEDIUM — tuning balance between sensitivity and specificity is ongoing.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

### SAF-003 — Emergency misclassification: urgent situation handled as routine

| Field | Detail |
| --- | --- |
| **Category** | Safety |
| **Description** | A genuinely urgent situation (e.g., active fall, chest pain) is classified as non-emergency due to tense misclassification, false positive filtering, or deduplication blocking a repeat alert. |
| **Likelihood** | 2 — Unlikely but possible, especially for ambiguous phrasing or repeat utterances within dedup window. |
| **Impact** | 5 — Severe. Same as SAF-001. |
| **Risk score** | 10 |

**Current mitigation:**

- Embedding pipeline positive matches skip keyword false-positive filters (`embeddingPipelinePositive` flag)
- Deduplication allows re-alert with different category or after time window (`alertDeduplicator.js`)
- CRITICAL severity alerts include recommended action "call emergency services" (`buildRecommendedActions`)
- SMS sent for safety emergencies (not financial) when SNS enabled
- AI session prompt updated after confirmed SMS to inform resident alert was sent
- Severity mapping: CRITICAL, HIGH, MEDIUM with different response time targets (`emergency.config.js`)

**Residual risk:** MEDIUM — misclassification of tense or dedup blocking remain edge-case risks.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

### PRI-001 — Unauthorised access to resident health conversations

| Field | Detail |
| --- | --- |
| **Category** | Privacy |
| **Description** | A caregiver, attacker, or insider accesses conversation transcripts, ClientMemory facts, or recordings without authorisation. |
| **Likelihood** | 2 — Unlikely with current controls; credential theft or insider misuse remain possible. |
| **Impact** | 5 — Severe. Special category health data exposure; GDPR breach notification likely required. |
| **Risk score** | 10 |

**Current mitigation:**

- JWT authentication with MFA support (TOTP)
- Role-based access: staff vs. orgAdmin visibility rules (`alert.service.js`, `minimumNecessary.js`)
- Caregiver-client assignment checks (`assertCaregiverClientAccess`)
- Audit logging for READ actions on client, conversation, medicalAnalysis resources (`auditLog.js`)
- Breach detection: excessive failed logins (auto-lock), data access volume (>100/hour), rapid access (>20/min), off-hours access (`breachDetection.service.js`)
- Session timeout middleware
- Field-level minimum necessary filtering per jurisdiction

**Residual risk:** MEDIUM — defence in depth implemented; zero risk not achievable.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

### PRI-002 — Data residency violation: PHI processed outside EU without SCC

| Field | Detail |
| --- | --- |
| **Category** | Privacy |
| **Description** | Health data from EU/Hungarian residents is processed or stored in US regions (AWS `us-east-2`, OpenAI US endpoints) without executed Standard Contractual Clauses or adequate transfer mechanism. |
| **Likelihood** | 4 — Likely if EU deployment proceeds with current configuration. All production infrastructure is currently US-based. |
| **Impact** | 5 — Severe. GDPR Chapter V violation; NAIH enforcement; potential processing ban. |
| **Risk score** | 20 |

**Current mitigation:**

- Documented in [SUBPROCESSORS.md](../SUBPROCESSORS.md) with PENDING SCC status for AWS, OpenAI, Telnyx, Stripe
- Code comment at OpenAI connection initialisation warning of GDPR requirement (`openai.realtime.service.js` line ~1202)
- `DATA_RESIDENCY_MODE` configuration with `EU` and `AUTO` modes; S3 fails closed if EU bucket unset for GDPR (`s3.service.js`)
- `resolveDataResidency` in `config.js` routes GDPR orgs to EU config when mode allows
- EU infrastructure placeholders: `EU_S3_BUCKET`, `EU_MONGODB_URI`, `AWS_EU_REGION=eu-central-1`

**Gap:** SCCs not executed. EU infrastructure not provisioned. **EU health-data processing must not proceed.**

**Residual risk:** **HIGH** — until SCCs executed and transfer mechanism documented.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

### PRI-003 — Consent withdrawal not propagated to active sessions

| Field | Detail |
| --- | --- |
| **Category** | Privacy |
| **Description** | A resident withdraws consent for a processing purpose (e.g., `aiAnalysis` or `recording`) but an active Realtime call session continues processing under prior permissions. |
| **Likelihood** | 2 — Unlikely during typical call durations; possible if withdrawal occurs mid-call. |
| **Impact** | 4 — Major. Unlawful processing after withdrawal; GDPR Art. 7(3) violation. |
| **Risk score** | 8 |

**Current mitigation:**

- Withdrawal immediately updates `client.consentedPurposes` flags (`privacy.service.js` — `withdrawClientConsent`)
- Append-only withdrawal record in `ConsentRecord`
- Per-purpose granularity allows partial withdrawal
- Calls are typically short (wellness check-in); withdrawal during active call is edge case

**Gap:** No explicit mid-call consent re-check or session termination on withdrawal event detected during active Realtime session.

**Residual risk:** MEDIUM — low probability during short calls; gap should be closed before EU scale-up.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

### PRI-004 — ClientMemory facts retained beyond retention period

| Field | Detail |
| --- | --- |
| **Category** | Privacy |
| **Description** | ClientMemory facts persist beyond the jurisdiction retention period due to deletion job failure or missing `extractedAt` filtering. |
| **Likelihood** | 2 — Unlikely. Daily deletion job with logging. |
| **Impact** | 3 — Moderate. Storage limitation principle violation (GDPR Art. 5(1)(e)). |
| **Risk score** | 6 |

**Current mitigation:**

- GDPR retention: 3 years for `clientMemory` (`jurisdiction.utils.js`)
- Daily job: `deleteExpiredClientMemory` soft-deletes facts with `extractedAt` before cutoff (`dataDeletion.service.js`)
- Conversation deletion cascades: `suppressFactsForConversation` with reason `retention_expired`
- Erasure cascade hard-deletes all facts for client (`hardDeleteFactsForClient`)
- `deletedAt` index for efficient querying

**Residual risk:** LOW — automated with logging; monitor job success.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

### ACC-001 — Hallucinated facts stored in ClientMemory

| Field | Detail |
| --- | --- |
| **Category** | Accuracy |
| **Description** | Post-call extraction (`gpt-4o`) stores a fact not supported by the transcript — inferred, exaggerated, or fabricated content persisted in ClientMemory and injected into future call prompts. |
| **Likelihood** | 3 — Possible. LLM extraction with `medium`/`low` confidence facts allowed. |
| **Impact** | 3 — Moderate. May mislead staff or cause inappropriate follow-up questions; does not directly trigger clinical action. |
| **Risk score** | 9 |

**Current mitigation:**

- Extraction prompt: "Extract facts, not summaries"; "Do not diagnose"; "One fact per item"
- Confidence labelling: high / medium / low
- Temperature 0.1 for consistency
- Facts capped at 500 characters
- No automated action on facts — staff review pathway
- Privacy correction requests can update client data (`processCorrectionRequest`)
- Facts visible in GDPR access exports for data subject review

**Gap:** No automated cross-check of facts against source transcript.

**Residual risk:** MEDIUM — inherent LLM limitation.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

### ACC-002 — Speech recognition errors in elderly / accented speech

| Field | Detail |
| --- | --- |
| **Category** | Accuracy |
| **Description** | OpenAI Realtime ASR (`gpt-4o-mini-transcribe`) misrecognises resident speech due to age-related speech patterns, accent, low volume, or telephony artefacts. Downstream detection and extraction operate on incorrect text. |
| **Likelihood** | 4 — Likely given target demographic and telephone channel. |
| **Impact** | 3 — Moderate. May cause missed detection (wrong text) or inappropriate responses. |
| **Risk score** | 12 |

**Current mitigation:**

- OpenAI noise reduction configuration (`near_field` / `far_field`)
- Asterisk RTP audio path with quality improvement strategies documented
- Emergency detection operates on best-available transcript
- Staff can review full transcript in conversation view
- Preferred language setting directs Realtime conversation language

**Residual risk:** MEDIUM — ASR accuracy is largely dependent on OpenAI model quality.

**Owner:** OpenAI (ASR) / Bianca Technologies (integration)  
**Review date:** 2026-08-28

---

### ACC-003 — Context drift across long-running resident histories

| Field | Detail |
| --- | --- |
| **Category** | Accuracy |
| **Description** | Over months of daily calls, ClientMemory accumulates outdated facts (e.g., resolved health concerns, changed relationships) that are injected into prompts, causing Bianca to ask about obsolete topics. |
| **Likelihood** | 2 — Unlikely in short term; increases with tenure. |
| **Impact** | 3 — Moderate. Resident confusion or distress; reduced trust. |
| **Risk score** | 6 |

**Current mitigation:**

- Fact retrieval prioritises recent facts (`extractedAt` sort) with limit of 25 (`getClientFacts`)
- Category prioritisation: urgent > concern/health/mood/cognitive/safety > preference/relationship
- Retention expiry soft-deletes facts after 3 years
- Extraction prompt: "Only extract facts worth remembering across multiple future calls. Skip one-off pleasantries."
- Last contact time injected into prompt to avoid recent repetition

**Gap:** No automatic fact expiry for resolved concerns; outdated facts persist until retention cutoff.

**Residual risk:** LOW — mitigated by recency sorting and retention; may increase over time.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

### OPS-001 — OpenAI Realtime API outage — call failure

| Field | Detail |
| --- | --- |
| **Category** | Operational |
| **Description** | OpenAI Realtime WebSocket API is unavailable or degraded, preventing voice conversation for scheduled or initiated wellness checks. |
| **Likelihood** | 3 — Possible. Third-party dependency with documented outages. |
| **Impact** | 3 — Moderate. Missed wellness check; no safety detection during outage; staff must follow up manually. |
| **Risk score** | 9 |

**Current mitigation:**

- Reconnection manager with error classification and retry (`reconnectionManager`, `openai.realtime.service.js`)
- Connection timeout and status tracking
- Call status reflects failure for staff visibility
- Error logging for post-incident analysis

**Gap:** No automatic retry of failed scheduled calls; no fallback to non-AI call mode.

**Residual risk:** MEDIUM — single-provider dependency.

**Owner:** OpenAI / Bianca Technologies  
**Review date:** 2026-08-28

---

### OPS-002 — Telephony (Telnyx) failure — resident not reached

| Field | Detail |
| --- | --- |
| **Category** | Operational |
| **Description** | Telnyx (or Twilio) telephony failure prevents outbound call connection to resident's phone number. |
| **Likelihood** | 3 — Possible. Network, carrier, or provider issues. |
| **Impact** | 3 — Moderate. Missed wellness check; no conversation or detection for that interval. |
| **Risk score** | 9 |

**Current mitigation:**

- Call status tracking in `Call` model (initiated, ringing, completed, failed)
- `lastCallAttemptAt` and `lastAnsweredCallAt` on client record for staff visibility
- Twilio available as alternative provider in some environments
- Asterisk self-managed for RTP bridging

**Gap:** Telnyx SCC pending for EU. No automatic multi-provider failover documented.

**Residual risk:** MEDIUM — deployer may need manual follow-up.

**Owner:** Telnyx / Deployer  
**Review date:** 2026-08-28

---

### OPS-003 — Call scheduling failure — missed wellness check

| Field | Detail |
| --- | --- |
| **Category** | Operational |
| **Description** | Agenda scheduled job or schedule configuration error fails to initiate a planned wellness check call at the configured time. |
| **Likelihood** | 2 — Unlikely with normal operations; timezone misconfiguration possible. |
| **Impact** | 3 — Moderate. Gap in wellness monitoring coverage. |
| **Risk score** | 6 |

**Current mitigation:**

- Schedule model with UTC-normalised times (`schedule.service.js`, `timezone.utils.js`)
- Manual "Call Now" option for staff-initiated calls (`callWorkflow.controller.js`)
- Facility reports track contact metrics (`facilityReports.service.js`)

**Gap:** No automated alert to staff when scheduled call fails to initiate.

**Residual risk:** LOW — manual override available.

**Owner:** Bianca Technologies / Deployer  
**Review date:** 2026-08-28

---

### LEG-001 — High-risk AI Act classification requiring notified body

| Field | Detail |
| --- | --- |
| **Category** | Legal / Regulatory |
| **Description** | Bianca is determined to be a high-risk AI system under Annex III(5)(c) without benefit of Article 6(3) exclusion, requiring notified body third-party conformity assessment, CE marking, and EU database registration. |
| **Likelihood** | 2 — Unlikely based on current Article 6(3) assessment, but regulatory guidance may evolve. |
| **Impact** | 4 — Major. Significant compliance cost and timeline; market access delay. |
| **Risk score** | 8 |

**Current mitigation:**

- Documented Article 6(3) assessment: Bianca does not replace human decision-making; alerts require staff resolution; no autonomous clinical action (Annex IV §1.5)
- Self-assessment path prepared under Art. 43 + Annex VI
- Legal counsel review planned before EU market placement
- Technical documentation and QMS structured for either path

**Residual risk:** MEDIUM — pending formal legal opinion.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

### LEG-002 — SCC gap: PHI processed by OpenAI US endpoints without executed DPA

| Field | Detail |
| --- | --- |
| **Category** | Legal / Regulatory |
| **Description** | Resident health conversation audio and transcripts are sent to OpenAI US API endpoints (`api.openai.com`) without an executed Data Processing Agreement and Standard Contractual Clauses, violating GDPR Chapter V for EU data subjects. |
| **Likelihood** | 5 — Almost certain under current architecture for any EU processing. |
| **Impact** | 5 — Severe. Unlawful transfer; regulatory enforcement; contract breach with deployers. |
| **Risk score** | 25 |

**Current mitigation:**

- Documented as PENDING in [SUBPROCESSORS.md](../SUBPROCESSORS.md)
- Code-level warning at WebSocket initialisation (`openai.realtime.service.js`)
- Change control gate: no GDPR health-data calls until SCC executed
- Target: OpenAI DPA + SCCs before EU go-live

**Gap:** **No SCC executed. No DPA on file. Processing must not occur for EU health data.**

**Residual risk:** **HIGH** — owner Bianca Technologies until SCCs executed.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

### LEG-003 — NAIH enforcement action for non-compliant deployment

| Field | Detail |
| --- | --- |
| **Category** | Legal / Regulatory |
| **Description** | Hungary's National Authority for Data Protection and Freedom of Information (NAIH) initiates enforcement action due to unlawful health data processing, missing SCCs, inadequate consent, or AI Act non-compliance. |
| **Likelihood** | 3 — Possible if EU deployment proceeds before gaps are closed. |
| **Impact** | 5 — Severe. Fines up to GDPR maximum; processing orders; reputational damage. |
| **Risk score** | 15 |

**Current mitigation:**

- GDPR complaint pathway implemented (`createGdprComplaint` in `privacy.service.js` — `supervisoryAuthority: 'NAIH'`)
- 72-hour breach notification logic for GDPR (`breachDetection.service.js`)
- Per-purpose explicit consent with append-only audit trail
- Honest gap documentation in this register and SUBPROCESSORS.md
- EU deployment gated on SCC completion

**Gap:** EU Authorised Representative not appointed. DPO not designated. SCCs pending.

**Residual risk:** **HIGH** — until all legal gates are cleared.

**Owner:** Bianca Technologies  
**Review date:** 2026-08-28

---

## Review log

| Date | Reviewer | Changes |
| --- | --- | --- |
| 2026-05-28 | Initial draft | Register created from codebase audit |

---

## Acceptance of residual HIGH risks

The following HIGH residual risks require explicit management acceptance or mitigation before EU production deployment with health data:

| Risk ID | Condition for acceptance |
| --- | --- |
| PRI-002 | **Not acceptable** — must execute SCCs and provision EU infrastructure |
| LEG-002 | **Not acceptable** — must execute OpenAI DPA + SCCs |
| LEG-003 | **Not acceptable** — must close PRI-002, LEG-002, appoint Authorised Representative and DPO |

---

*End of Risk Management Register*
