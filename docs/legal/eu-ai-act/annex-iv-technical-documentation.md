# Annex IV Technical Documentation

**Provider:** Bianca Technologies  
**System name:** Bianca Wellness Platform  
**System version:** 1.0.0 (backend package `@bianca-app/backend`)  
**Document version:** 1.0  
**Last updated:** May 2026  
**Status:** Draft — pending legal review, SCC execution, and EU Authorised Representative appointment before EU production deployment

This document satisfies the technical documentation requirements of **Article 11** and **Annex IV** of Regulation (EU) 2024/1689 (EU AI Act) for the Bianca AI wellness platform.

---

## 1. General Description

### 1.1 System name, version, and intended purpose

| Field | Detail |
| --- | --- |
| **Commercial name** | Bianca Wellness (also referenced internally as MyPhoneFriend) |
| **Software version** | 1.0.0 |
| **Provider** | Bianca Technologies |
| **Intended purpose** | Conduct scheduled and on-demand conversational telephone wellness check-ins with elderly residents in care facilities; detect wellness and safety signals from conversation content; maintain a longitudinal fact store per resident to support continuity across calls; surface flagged concerns to assigned care staff for review and action |

Bianca is **not** a medical device, diagnostic system, or treatment recommendation engine. It is a wellness monitoring and communication aid.

### 1.2 Intended users

| User type | Role | Access |
| --- | --- | --- |
| **Care home staff (caregivers)** | Primary operators — initiate or monitor calls, review alerts, manage resident profiles, record consent | Mobile app (React Native / Expo) and web client |
| **Organisation administrators** | Configure schedules, manage staff access, review facility reports, handle privacy requests | Mobile app and web client |
| **Residents (clients)** | Passive participants in outbound wellness calls; may grant or withdraw consent via staff-assisted flows | Telephone only (no direct app access required) |

Bianca is deployed by care home operators (deployers) under their operational control. Bianca Technologies provides the AI system as a software service.

### 1.3 Intended deployment context

| Field | Detail |
| --- | --- |
| **Geography** | European Union care facilities; initial EU target market: **Hungary (HU)** |
| **Regulatory context** | GDPR (Regulation (EU) 2016/679), Hungarian Act XLVII of 1997 on the processing and protection of health-related and related personal data, EU AI Act |
| **Environment** | Licensed residential care facilities with assigned care staff and telephone access for residents |
| **Current production region** | United States (`us-east-2`) — **not yet authorised for GDPR-regulated health data processing** |
| **Planned EU region** | `eu-central-1` (Frankfurt) — infrastructure not yet provisioned |

**Gap:** EU production deployment must not proceed until Standard Contractual Clauses (SCCs) are executed with all subprocessors processing personal health data, and EU infrastructure is provisioned. See [SUBPROCESSORS.md](../SUBPROCESSORS.md).

### 1.4 What the system does and does not do

#### What Bianca does

- Places outbound wellness check-in calls to residents on a schedule or on staff request
- Conducts natural-language voice conversations using OpenAI's Realtime API
- Transcribes and stores conversation content (subject to consent)
- Detects potential safety signals (falls, self-harm expressions, abuse indicators, financial exploitation patterns) during calls using an embedding and tense-verification pipeline
- Creates **alerts** visible to assigned caregivers in the mobile/web dashboard; may send SMS notifications to caregivers for safety-oriented emergencies
- Extracts discrete factual observations from completed call transcripts into a **ClientMemory** longitudinal store
- Injects prior facts into subsequent call prompts to support conversational continuity
- Generates post-call summaries and wellness trend indicators for staff review
- Supports GDPR data subject rights (access, erasure, correction, objection, restriction) via the privacy service

#### What Bianca explicitly does not do

- **Does not diagnose** medical or psychiatric conditions
- **Does not prescribe** medications or treatments
- **Does not make clinical decisions** — all clinical judgments remain with human care staff
- **Does not autonomously contact emergency services** — the AI may inform a resident that an alert was sent to their caregiver, but Bianca cannot place emergency calls
- **Does not autonomously act on findings** — alerts are recommendations for human review; staff must acknowledge and resolve alerts
- **Does not replace** professional medical assessment, nursing judgment, or mandatory reporting obligations of the deployer

The post-call fact extraction prompt explicitly instructs the model: *"Do not diagnose. Note observations, not conclusions."* (`clientMemory.service.js`, `EXTRACTION_SYSTEM_PROMPT`).

### 1.5 High-risk classification basis

#### Candidate Annex III category

Annex III, point **5(c)** lists high-risk AI systems *"intended to be used for wellness purposes involving the health of individuals."* Bianca processes health-related conversational data and generates wellness signals, so this category is **potentially applicable**.

#### Article 6(3) assessment — limited-risk argument

Bianca Technologies assesses that the system may **not** qualify as high-risk under **Article 6(3)**, which excludes AI systems that:

- Perform a **narrow procedural task**, or
- Improve the result of a **previously completed human activity**, or
- Detect decision-making patterns or deviations **without replacing or influencing the human assessment**, and
- Are **not intended to replace or influence** the decision-making outcome without proper human review.

**Basis for this assessment:**

| Factor | Bianca behaviour |
| --- | --- |
| Decision authority | All clinical and care decisions remain with human staff |
| Alert workflow | Alerts are surfaced to caregivers; resolution requires explicit staff action (`alert.service.js` — `resolvedBy`, `resolvedAt`) |
| No autonomous action | Emergency processor creates alerts and optional SMS; does not trigger emergency services |
| Supporting role | ClientMemory facts and wellness signals inform staff awareness; they do not gate access to care or trigger automated interventions |
| Human-in-the-loop | Recommended actions on alerts include "review conversation", "notify care team", "call emergency services" — all require human execution |

**Conclusion:** Bianca is assessed as eligible for the **provider self-assessment conformity path** under **Article 43** and **Annex VI**, rather than notified-body third-party conformity assessment — **subject to confirmation by qualified legal counsel** and ongoing monitoring of EU AI Act guidance on wellness AI systems.

If reclassified as high-risk, Bianca Technologies will update this documentation, appoint a notified body if required, and implement additional obligations (registration, CE marking, etc.).

---

## 2. System Architecture and Development

### 2.1 Technical stack

| Layer | Technology |
| --- | --- |
| Backend API | Node.js (≥18), Express, Passport JWT, Joi validation |
| Mobile client | React Native / Expo 50, Redux Toolkit, RTK Query, TypeScript |
| Web client | Vite, React 18 |
| Database | MongoDB (Mongoose ODM) |
| Cache / sessions | Redis |
| Job scheduler | Agenda |
| Voice infrastructure | Asterisk (ARI, self-managed on AWS), RTP audio bridging |
| Telephony | Telnyx (when `VOICE_TELEPHONY_PROVIDER=telnyx`); Twilio in some environments |
| Cloud infrastructure | AWS — ECS/EC2, S3, SES, SNS, Secrets Manager, CodePipeline/CodeDeploy |
| Infrastructure as code | Terraform |

See [ARCHITECTURE.md](../../ARCHITECTURE.md) for system context diagrams.

### 2.2 AI components

| Component | Model / method | Purpose | When invoked |
| --- | --- | --- | --- |
| **Realtime voice conversation** | OpenAI `gpt-realtime` (GA model) via WebSocket | Live two-way voice wellness check-in with resident | During active call (`openai.realtime.service.js`) |
| **Realtime transcription** | `gpt-4o-mini-transcribe` | Speech-to-text for resident and assistant utterances | During active call |
| **Post-call fact extraction** | `gpt-4o` (temperature 0.1) | Extract discrete facts from completed transcript into ClientMemory | Fire-and-forget after `finalizeConversation` (`clientMemory.service.js`) |
| **Emergency embedding pipeline** | `text-embedding-3-large` + cosine similarity to anchor phrases | Detect semantic similarity to emergency utterance patterns | Per resident utterance during call (`emergencyEmbeddingPipeline.service.js`) |
| **Tense verification** | `gpt-4.1-mini` | Classify utterance as current / past / hypothetical / third-party to reduce false positives | After embedding match, before alert |
| **Post-call summarisation** | LangChain / GPT (via `langChainAPI`) | Generate conversation summary for staff review | During `finalizeConversation` |
| **Sentiment / medical analysis** | GPT-based analysis services | Trend and metric computation for staff dashboards | Scheduled post-call analysis |

Bianca **does not train proprietary foundation models**. All AI inference uses OpenAI hosted models via API.

### 2.3 Data flows

```
Resident telephone
       │
       ▼
Telnyx / Twilio ──► Asterisk (RTP) ──► Backend RTP listener
                                              │
                                              ▼
                                    OpenAI Realtime API (WebSocket)
                                    [audio in ↔ audio out + transcript]
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
            Message collection          Emergency processor         Live UI push
            (MongoDB)                   (per utterance)             (caregiver app)
                    │                         │
                    │              ┌──────────┴──────────┐
                    │              ▼                     ▼
                    │         Alert record          Urgent ClientMemory
                    │         (MongoDB)             fact (safety category)
                    │              │
                    │              ▼
                    │         SMS to caregivers (safety emergencies only)
                    │
                    ▼ (call ends)
            finalizeConversation
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   Summary      Sentiment/    extractAndStoreFacts
   generation    analysis     (gpt-4o → ClientMemory)
        │           │           │
        └───────────┴───────────┘
                    │
                    ▼
         Next call: buildEnhancedPrompt
         injects ClientMemory facts via getClientFacts()
```

**Consent gate:** Per-purpose consent flags on the client record (`consentedPurposes`: recording, transcription, aiAnalysis, familyReports) must be explicitly granted before full processing. Defaults are all `false` (`client.model.js`).

### 2.4 Human oversight mechanisms

Bianca implements human oversight at every point where AI output could affect resident care:

| Stage | AI output | Human oversight mechanism |
| --- | --- | --- |
| **During call — safety detection** | Emergency alert candidate | Alert created in dashboard; optional SMS to assigned caregivers; staff must review and resolve (`alert.service.js`) |
| **During call — AI speech** | Conversational responses | Staff can monitor live conversation in app; call can be ended by staff |
| **Post-call — fact extraction** | ClientMemory facts | Facts visible to staff in client profile and privacy exports; no automated clinical action |
| **Post-call — summary / analysis** | Wellness summary, sentiment trends | Displayed for staff review only; not transmitted to residents as medical advice |
| **Alerts — resolution** | Alert with recommended actions | Caregiver must explicitly resolve alert with `resolvedBy` attribution |
| **Alerts — financial exploitation** | Dashboard-only alert (no SMS) | Staff review required; no automated financial intervention |
| **Consent** | Processing permissions | Per-purpose consent recorded by staff with append-only audit trail; withdrawal updates client flags immediately |
| **Privacy requests** | Erasure, access, correction | Admin review and processing via `privacy.service.js` / `dataDeletion.service.js` |
| **Emergency services** | AI may tell resident alert was sent | AI explicitly instructed it **cannot** call emergency services; staff recommended action is "call emergency services" |

The Realtime service injects emergency instructions into the session prompt only after SMS confirmation: *"Do NOT offer to call emergency services yourself — you cannot make calls."*

### 2.5 Third-party components and subprocessors

Full subprocessor registry: [SUBPROCESSORS.md](../SUBPROCESSORS.md).

| Subprocessor | Role | SCC status |
| --- | --- | --- |
| **AWS** | Hosting, MongoDB persistence, S3, SES, SNS, logs | **PENDING** |
| **OpenAI** | Realtime voice, transcription, fact extraction, embeddings | **PENDING** |
| **Telnyx** | Telephony signalling and media | **PENDING** |
| **Stripe** | Billing (limited personal data) | **PENDING** |

### 2.6 Training data

Bianca Technologies **does not train, fine-tune, or retrain** AI models on resident data. All AI components use OpenAI foundation models accessed via API.

| Topic | Detail |
| --- | --- |
| **Model provider** | OpenAI |
| **Training data governance** | Governed by OpenAI's terms, DPA, and data processing policies |
| **Bianca data sent to OpenAI** | Call audio streams, transcripts, conversation text for extraction and analysis |
| **Retention by OpenAI** | Subject to OpenAI API data usage policies; Bianca configures API usage under OpenAI enterprise/DPA terms when executed |
| **Emergency anchor phrases** | Curated phrase embeddings maintained in Bianca's `embeddingAnchor.service.js`; not resident-derived training data |

**Gap:** OpenAI DPA and SCCs are **not yet executed**. Health data must not be processed via OpenAI US endpoints for EU residents until agreements are in place.

---

## 3. Performance and Monitoring

### 3.1 Performance metrics

| Metric | Description | Current measurement |
| --- | --- | --- |
| **Call completion rate** | Percentage of initiated calls reaching `completed` status | Tracked via Call model status fields; facility reports aggregate contact metrics |
| **Call connection success** | Realtime WebSocket establishment and handshake success | Logged in `openai.realtime.service.js`; connection status tracking |
| **Safety alert precision** | Alerts created vs. staff-confirmed genuine concerns | Alert resolution outcomes (`resolvedBy`, resolution notes); not yet formalised as a KPI dashboard |
| **False positive rate (emergency)** | Utterances filtered by tense check, false-positive filter, deduplication | Logged when `config.logging.logFalsePositives` enabled; corpus tests in `emergencyDetector.corpus.test.js` |
| **Fact extraction yield** | Facts stored per conversation | Logged: `[ClientMemory] Stored N facts for client X` |
| **Fact extraction parse failures** | JSON parse errors from extraction model | Logged as warnings; extraction silently skipped (does not crash call flow) |
| **Privacy request SLA** | Response within jurisdiction deadline | Tracked via `PrivacyRequest.responseDeadline`; overdue query available |

**Gap:** Formal post-market performance dashboards aligned with EU AI Act Article 72 are not yet implemented. Metrics above are derivable from application logs and database records.

### 3.2 Known limitations

| Limitation | Impact | Mitigation |
| --- | --- | --- |
| **Language support** | Realtime conversation supports client's `preferredLanguage` enum (en, es, fr, de, zh, ja, pt, it, ru, ar); emergency phrase coverage varies by language | Localized emergency detector with database phrases; fallback to basic English detector |
| **Elderly speech patterns** | ASR may misrecognise slurred, quiet, or accented speech | Low-temperature extraction; staff review of transcripts; confidence levels on facts |
| **Telephony audio quality** | Low bandwidth, background noise, codec artefacts degrade ASR | OpenAI built-in noise reduction (`near_field` / `far_field` config); Asterisk RTP handling |
| **Narrative vs. present-tense confusion** | Resident describing past events may trigger false alerts | Tense verification (`gpt-4.1-mini`); context window narrative classification (>0.85 confidence threshold) |
| **Hallucinated facts** | Extraction model may infer facts not stated | Confidence labelling (high/medium/low); extraction prompt rules; no automated clinical action on facts |
| **OpenAI API availability** | Outage prevents voice conversation | Reconnection manager; call failure logged; staff notified via failed call status |
| **US data processing** | GDPR transfer risk for EU residents | Block EU health-data processing until SCCs and EU residency are in place |

### 3.3 Post-market monitoring approach

| Activity | Frequency | Owner |
| --- | --- | --- |
| Application error and alert decision logging | Continuous | Engineering |
| Breach detection rule evaluation | Scheduled (Agenda jobs) | Security |
| Privacy request deadline monitoring | Daily | Privacy / Admin |
| Data retention deletion job | Daily (`processDataDeletion`) | Engineering |
| Emergency detector corpus regression tests | CI on every deploy | Engineering |
| Subprocessor SCC status review | Quarterly until resolved; annually thereafter | Legal |
| Risk register review | Quarterly minimum | Quality / Legal |
| Annual QMS and technical documentation review | Annual | Management |

Serious incidents (systematic false negatives on safety detection, data breaches, model behaviour regressions) are escalated via the incident process described in [quality-management-system.md](./quality-management-system.md).

---

## 4. Data Governance

### 4.1 Data categories processed

| Category | Examples | GDPR classification |
| --- | --- | --- |
| **Identity data** | Name, phone, email, room number, age | Personal data (Art. 4) |
| **Health and wellness data** | Conversation transcripts, mood observations, health mentions, cognitive observations, medical analysis metrics | **Special category data (Art. 9)** — health data |
| **Call metadata** | Timestamps, duration, status, scheduling | Personal data |
| **Audio recordings** | Debug audio (when enabled), call recordings | Special category (health context) |
| **AI-derived data** | ClientMemory facts, summaries, sentiment scores, alert evidence | Special category (derived from health conversations) |
| **Consent records** | Purpose grants, withdrawal events, IP address, user agent | Personal data |
| **Audit logs** | PHI access events, authentication events | Personal data |

### 4.2 Consent model

Bianca implements **per-purpose, opt-in consent** for residents (clients):

| Purpose key | Description |
| --- | --- |
| `recording` | Call recording |
| `transcription` | Speech-to-text |
| `aiAnalysis` | AI analysis of call content |
| `familyReports` | Weekly family wellness digests |

**Implementation:**

- All purposes default to `false` — no presumed consent (`client.model.js`, `defaultConsentedPurposes`)
- Consent version tracked per purpose (`CLIENT_CONSENT_VERSION` = `2.0`)
- **Append-only audit trail:** `ConsentRecord` with `recordType: 'grant' | 'withdrawal'`; GDPR records cannot be mutated after creation (`consentRecord.model.js` pre-save hook)
- Withdrawal creates new record and updates `client.consentedPurposes` flags (`privacy.service.js` — `withdrawClientConsent`)
- Full consent required for `consented` virtual to be true (`isFullyConsented`)

### 4.3 Retention periods by jurisdiction

Configured in `jurisdiction.utils.js`. For **GDPR / Hungary (HU)**:

| Data type | Retention | Auto-delete |
| --- | --- | --- |
| Conversations | 3 years | Yes |
| Call recordings | 1 year | Yes |
| Calls (metadata) | 1 year | Yes |
| Medical analysis | 3 years | Yes |
| ClientMemory facts | 3 years | Yes (soft-delete via `deletedAt`) |
| Audit logs | 3 years | Yes |
| Consent records | 3 years (withdrawn only) | Yes — active consent retained |
| Patient data (profile) | 3 years | Yes |

Daily deletion job: `dataDeletion.service.js` — `processDataDeletion()`.

### 4.4 Erasure capabilities

| Mechanism | Scope | Implementation |
| --- | --- | --- |
| **Soft suppression** | ClientMemory facts by client or conversation | `suppressFactsForClient`, `suppressFactsForConversation` — sets `deletedAt`, `deletedReason` |
| **Retention expiry** | Expired facts, conversations, calls | `deleteExpiredClientMemory`, `deleteExpiredConversations` |
| **GDPR erasure request** | Full cascade for data subject | `cascadeErasureForClients` — deletes conversations, messages, calls, medical analysis, hard-deletes ClientMemory, anonymises consent records, suppresses audit log PHI, deletes client record |
| **Erasure completion record** | Proof of erasure scope | `ErasureCompletionRecord` model |

Erasure is **denied** for HIPAA jurisdiction (legal retention obligation); **permitted** for GDPR (`allowsErasureRequest`).

### 4.5 Data residency

| Field | Current state | Target state |
| --- | --- | --- |
| **Primary AWS region** | `us-east-2` (US East — Ohio) | `eu-central-1` (Frankfurt) for EU orgs |
| **MongoDB** | US-hosted EBS volume | EU endpoint (`EU_MONGODB_URI` — not provisioned) |
| **S3** | US buckets | EU bucket (`EU_S3_BUCKET` — not provisioned) |
| **OpenAI processing** | United States (`api.openai.com`) | Remains US unless OpenAI EU processing option is legally approved |
| **Residency mode config** | `DATA_RESIDENCY_MODE=US` (default) | `AUTO` or `EU` after SCC execution |
| **Transfer mechanism** | **PENDING SCC** for all subprocessors | AWS DPA + SCC Module Two; OpenAI DPA + SCCs; Telnyx DPA + SCCs |

S3 service fails closed when GDPR jurisdiction requires EU bucket but `EU_S3_BUCKET` is unset (`s3.service.js`).

---

## 5. Risk Management Summary

A detailed risk register is maintained in [risk-management-register.md](./risk-management-register.md).

Summary of risk domains:

- **Safety:** False negatives/positives in emergency detection; misclassification of urgency
- **Privacy:** Unauthorised access, data residency violations, consent propagation gaps, retention overruns
- **Accuracy:** Hallucinated ClientMemory facts, ASR errors, context drift
- **Operational:** Third-party API and telephony outages; scheduling failures
- **Legal:** High-risk reclassification; pending SCC gap; NAIH enforcement

---

## 6. Change Management

### 6.1 Substantial modifications requiring re-assessment

A modification is **substantial** and triggers conformity re-assessment when it:

| Change type | Example | Required action |
| --- | --- | --- |
| **Foundation model version change** | Migrating from `gpt-realtime` to a new OpenAI model with different behaviour | Re-run safety corpus tests; update this document; evaluate impact on extraction quality and emergency detection |
| **New data category** | Adding video, biometric, or continuous monitoring data | DPIA update; consent model update; subprocessor review |
| **New intended purpose** | Using Bianca output for automated care plan changes or clinical triage | Likely reclassifies as high-risk; legal review mandatory |
| **New jurisdiction** | Deploying in non-EU market with different health data laws | Update `jurisdiction.utils.js`; retention and notification rules |
| **Autonomous action capability** | Any feature that acts on AI findings without human confirmation | Article 6(3) assessment invalidated; human oversight documentation update |
| **Emergency detection pipeline change** | New embedding model, threshold change, removal of tense verification | Full corpus regression; false positive/negative evaluation |
| **Subprocessor change** | New AI or hosting provider | Update SUBPROCESSORS.md; execute DPA/SCC before processing |

Non-substantial changes (bug fixes, UI improvements, logging) are tracked via version control and release notes without full re-assessment.

### 6.2 Version control approach

- Source code: Git (monorepo `bianca-app`, branch-based development)
- Backend version: Semantic versioning in `package.json` (currently 1.0.0)
- Deployment: CodePipeline → CodeDeploy blue/green to ECS/EC2
- Configuration: Environment variables via AWS Secrets Manager; `.env.example` documents required keys
- Consent policy version: `CLIENT_CONSENT_VERSION` constant (currently `2.0`)
- Documentation: Markdown in `docs/legal/` with last-updated dates

---

## 7. Standards and Frameworks Applied

| Standard / regulation | Application | Alignment status |
| --- | --- | --- |
| **GDPR** (Regulation (EU) 2016/679) | Data subject rights, consent, breach notification (72h), DPIA support | Implemented in privacy service, consent model, breach detection — **SCC gap remains** |
| **Hungarian Act XLVII of 1997** | Health data processing in Hungary | Org country `HU` maps to GDPR jurisdiction; NAIH complaint pathway implemented (`createGdprComplaint`) |
| **EU AI Act** (Regulation (EU) 2024/1689) | This documentation; self-assessment per Art. 43 + Annex VI | **In progress** — this document set |
| **ISO/IEC 42001** (AI management system) | Aspirational alignment for QMS structure | **Gap:** No formal ISO 42001 certification or full clause-by-clause alignment |
| **ISO/IEC 27001** | Information security (referenced, not certified) | Partial — AWS infrastructure, JWT auth, MFA, audit logging |
| **HIPAA** (US) | Existing US deployment compliance | Implemented for US orgs; not applicable to EU deployment |

### Known gaps

1. EU Authorised Representative not yet appointed (Art. 22)
2. Data Protection Officer not yet formally designated (recommended for large-scale Art. 9 processing)
3. Standard Contractual Clauses pending for all subprocessors
4. EU infrastructure (`eu-central-1`) not provisioned
5. No ISO 42001 certification
6. Post-market monitoring KPI dashboard not implemented
7. Formal notified-body legal opinion on high-risk classification not yet obtained

---

## 8. EU Declaration of Conformity (Placeholder)

> **This section is a template only.** It must be completed and signed by an authorised representative of Bianca Technologies before placing the system on the EU market.

---

### EU DECLARATION OF CONFORMITY (Annex V template)

**No.** [TO BE ASSIGNED]

**1. AI System name and type:**  
Bianca Wellness Platform v1.0.0 — Conversational AI wellness monitoring system for care facility residents

**2. Name and address of the provider:**  
Bianca Technologies  
[Registered address — TO BE COMPLETED]  
[Country — TO BE COMPLETED]

**3. Declaration of conformity issued under the sole responsibility of the provider.**

**4. The AI system described above is in conformity with:**  
Regulation (EU) 2024/1689 of the European Parliament and of the Council (Artificial Intelligence Act)

**5. Applied conformity procedure:**  
Internal control — Annex VI (Provider self-assessment)

**6. References to harmonised standards or common specifications used:**  
[TO BE COMPLETED — e.g., EN standards if applicable]

**7. Notified body (if applicable):**  
Not applicable — self-assessment path

**8. Additional information:**  
Technical documentation reference: `docs/legal/eu-ai-act/annex-iv-technical-documentation.md`

---

**Signed for and on behalf of:**

Name: _________________________________

Position: _________________________________

Place of issue: _________________________________

Date of issue: ____ / ____ / ________

Signature: _________________________________

---

*End of Annex IV Technical Documentation*
