# User Stories: Completion Status & Strategy

This document maps product user stories (US-2–US-17) to what the Bianca codebase already supports and outlines practical ways to close the gaps. Status labels:

- **Done (substantial)** — Core behavior exists end-to-end for typical deployments.
- **Partial** — Some plumbing or UX exists; missing pieces block the full story.
- **Not started** — No meaningful implementation found.

*Assessment date: March 2026, based on `packages/backend` and `packages/frontend`.*

---

## US-2: System Status Visibility

**Story:** As an operator, I can see that Bianca is actively monitoring residents so that I trust the system without logging in daily.

| Status | **Partial** |
|--------|-------------|
| **Already in place** | In-app **Home** shows assigned residents, last-call metadata, glance stats (mood, health, risk, alert counts), and schedule warnings. **Automated outbound calls** run via schedules/call workflow (resident-side monitoring continues without staff opening the app). |
| **Gaps** | No **logged-out** or **low-touch** channel: no public/operator status page, no scheduled **email/SMS “monitoring active” digest**, no push badge that communicates “system OK” vs “attention needed” without opening the app. |
| **How to complete** | (1) **Weekly or daily digest** email: “X residents monitored, Y calls completed, Z open alerts” (batch job + template). (2) Optional **status page** (authenticated or org-scoped token) for exec sponsors. (3) **Push notification** category for non-alert health pings (careful with noise; tie to US-6). |

---

## US-3: High-Confidence Alert with Evidence

**Story:** As an operator, I receive an alert when risk is detected so that I can act immediately with confidence.

| Status | **Partial** |
|--------|-------------|
| **Already in place** | **Emergency pipeline** (`emergencyProcessor.service.js`): localized keyword detection, optional **embedding/LLM** path, **context window**, **false-positive filters**, and **alert deduplication** (`alertDeduplicator.js`). Alerts persist **message**, **importance**, **type**, **relatedClient** / **relatedConversation**, **relevanceUntil**. Utterance-derived alerts tie to **transcript processing** in realtime. |
| **Gaps** | Alert schema has no dedicated **evidence** object (clip, transcript span, model version, confidence score). Operators see a **single message string**, not structured rationale or links to the exact conversation turn. |
| **How to complete** | Extend `alert.model` + API with optional `evidence: { snippet, conversationId, messageIds?, detector, confidence?, language }`. Surface in **Alert** UI with “View in conversation”. Log detector version for auditability. |

---

## US-4: Real-Time Alert Delivery

**Story:** As an operator, I receive alerts instantly so that I don't need to check a dashboard.

| Status | **Partial** |
|--------|-------------|
| **Already in place** | **SNS/push** path when `enableSNSPushNotifications` is on (`emergencyProcessor` → `sns.service`). In-app **alerts list** with RTK Query / polling-style refresh. |
| **Gaps** | Delivery is **config-dependent**; without mobile push end-to-end, staff still rely on **opening the app**. No universal **SMS** for all alert types (emergency path may notify caregivers—verify org config). |
| **How to complete** | Standardize **one** real-time channel per persona (e.g. FCM/APNs + fallback SMS for urgent). Add **server-driven** “alert created” event to websocket or silent push. Measure **p95 latency** from `createAlert` to notification receipt. |

---

## US-5: Resident Risk Profile (Drill-Down)

**Story:** As an operator, I can view a resident's history after an alert so that I understand context and trends.

| Status | **Partial → strong** |
|--------|----------------------|
| **Already in place** | **Home → Reports**: sentiment (incl. last-call window), **medical analysis**, **fraud/abuse analysis**; **conversations** for transcript history; **alerts** filterable by client. **Onboarding responses** journey for structured early capture. |
| **Gaps** | No single **“incident timeline”** that merges alerts + analyses + calls. Deep links from an alert to the **exact** conversation moment (US-3) still shallow. |
| **How to complete** | Add **Client activity timeline** (alerts, calls, analysis runs) and link from each alert row. Reuse `relatedConversation` when present to open conversation scrolled to time range. |

---

## US-6: "No News is Good News" Summary

**Story:** As an operator, I receive periodic confirmation that residents are being monitored so that I perceive ongoing value even without alerts.

| Status | **Not started** |
|--------|-----------------|
| **Already in place** | Implicit: calls and analyses run in background; no proactive **positive** messaging. |
| **How to complete** | Scheduled **digest** (email or in-app inbox): calls attempted/completed, residents with no alerts, optional rollup of sentiment/health **stable** flags. Keep content short; align with compliance/marketing approval. |

---

## US-7: Actionable Alert

**Story:** As staff, I receive a clear alert with next steps so that I know what to do immediately.

| Status | **Partial** |
|--------|-------------|
| **Already in place** | Alerts show **message**, **importance**, **type**, client linkage, read/unread, expiry. |
| **Gaps** | No **playbook** field (e.g. “Call 911”, “Contact POA”, “Review last 3 calls”) or org-configurable **SOP links**. |
| **How to complete** | Add `recommendedActions[]` or `playbookKey` on alert creation (from detector category + org policy). Render as buttons/links in **AlertScreen**; track acknowledgment timestamps for compliance. |

---

## US-7B: Consent Visibility in Alerts

**Story:** As staff, I can confirm consent exists so that I feel safe acting on the alert.

| Status | **Partial (backend > UI)** |
|--------|----------------------------|
| **Already in place** | **Client** model: `consented`, `consentedAt`, `consentEmailVersion`. **`ConsentRecord`** model and **privacy** services for PIPEDA-style records. |
| **Gaps** | **Alert** UI does not surface consent status next to client context; frontend grep shows no consent chip on alert rows. |
| **How to complete** | When loading alerts, **hydrate** `relatedClient` with `consented` + `consentedAt` (or join consent summary). Show compact badge on alert detail: “Recording consent on file” plus recorded date, with link to **privacy/consent** screen or document store (US-17). |

---

## US-8: Zero Daily Workflow Impact

**Story:** As staff, I do not need to interact with Bianca daily so that this does not add to my workload.

| Status | **Partial (product/design)** |
|--------|------------------------------|
| **Already in place** | Monitoring is **call-driven**; staff are not required to complete a daily in-app checklist. |
| **Gaps** | High-severity workflows (US-4/US-7) still **pull** staff when events occur; without digests, some orgs may **feel** they must check the app. |
| **How to complete** | Combine **push for urgent only** + **weekly digest** (US-6) + clear **escalation policies**. Document expected touch frequency by role in onboarding. |

---

## US-9: Daily AI Check-In Call

**Story:** As a resident, I receive a friendly, conversational check-in call so that I feel comfortable and engaged.

| Status | **Done (substantial)** |
|--------|------------------------|
| **Already in place** | **Twilio** outbound flow, **OpenAI Realtime** voice stack, **schedules**, **onboarding** prompts/tools for multi-day conversational capture, multilingual preferences. |
| **Gaps** | “Daily” is **schedule-configured**, not hard-coded; tone quality is prompt-dependent—ongoing tuning. |
| **How to complete** | Product defaults for **default schedule templates**; analytics on **answer rate** and **duration** by cohort; A/B prompt variants stored as versioned templates. |

---

## US-10: Reliable Call Completion

**Story:** As the system, I ensure high call completion rates so that monitoring coverage is consistent.

| Status | **Partial** |
|--------|-------------|
| **Already in place** | Call workflow controller, status callbacks, conversation creation when answered, hangup handling; models track call/conversation lifecycle. |
| **Gaps** | No single **SLO dashboard** or automatic **retry/backoff** policy documented in code for all failure modes (busy, no-answer, technical). |
| **How to complete** | Define **retry rules** per schedule; expose **completion rate** metrics per client/org; alert operators on sustained failure (system alert type). |

---

## US-11: Conversation Capture

**Story:** As the system, I record and transcribe all calls so that conversations can be analyzed.

| Status | **Done (substantial)** |
|--------|------------------------|
| **Already in place** | **Conversations** + **messages** with roles and transcript types; realtime service documents **ASR → DB** flow; summaries and analyzed metadata fields. |
| **Gaps** | Consent gating must remain enforced (client `consented`); retention policies are org/legal-specific. |
| **How to complete** | Automated tests for **consent-off** paths; export pipeline for long-term archive if required by contract. |

---

## US-12: Baseline Creation

**Story:** As the system, I build a behavioral baseline for each resident so that I can detect meaningful change over time.

| Status | **Partial** |
|--------|-------------|
| **Already in place** | **Medical** and **fraud/abuse** analyses compare to **prior results**; API/types include **`changeFromBaseline`**; sentiment trend logic in conversation service. Test-only **in-memory** medical baseline helper exists—production baseline is effectively **“last analysis”**, not a rich stored profile. |
| **Gaps** | No dedicated **baseline** document per client (versioned features, windowing, confidence). |
| **How to complete** | Persist **baseline snapshot** (rolling window or explicit “establish baseline” phase) in Mongo; version baselines when methodology changes; expose in Reports UI. |

---

## US-13: Risk Detection Engine

**Story:** As the system, I analyze conversations for cognitive decline signals, abuse indicators, and financial exploitation signals.

| Status | **Partial → strong** |
|--------|----------------------|
| **Already in place** | **Emergency** utterance-level detection; **medical** conversation analysis; **fraud/abuse** analysis; **sentiment** reports. |
| **Gaps** | Not all three domains share the same **cadence**, **ground truth**, or **evaluation harness**; cognitive vs abuse vs financial are separate pipelines with uneven maturity. |
| **How to complete** | Unified **evaluation set** and per-domain metrics; consistent trigger rules (post-call vs batch); document which models/prompts back each signal. |

---

## US-14: Change Detection

**Story:** As the system, I detect deviations from baseline so that alerts are based on change, not just static signals.

| Status | **Partial** |
|--------|-------------|
| **Already in place** | Analysis outputs include **change from baseline** concepts; sentiment slope / trend labeling for glance UI. |
| **Gaps** | Many **alerts** still originate from **absolute** emergency phrases, not delta-from-baseline; baseline object is thin (US-12). |
| **How to complete** | Wire **analysis deltas** to **alert generation** with thresholds (see US-15); separate “**spike**” alerts from “**chronic**” alerts. |

---

## US-15: Alert Thresholding

**Story:** As the system, I only trigger alerts at high confidence so that staff trust the system and avoid alert fatigue.

| Status | **Partial** |
|--------|-------------|
| **Already in place** | **Deduplication**, multi-stage detection, embedding path, **importance** levels, **relevanceUntil**. |
| **Gaps** | No explicit **confidence score** or org-tunable **thresholds** in the alert model; fatigue controlled mainly by dedupe + manual importance. |
| **How to complete** | Store `confidence` and `thresholdUsed`; admin UI for org-level **sensitivity**; monitor **alerts per resident per week** and auto-tune recommendations. |

---

## US-16: Consent Audit Trail

**Story:** As an operator, I can prove consent was obtained so that I am protected legally.

| Status | **Done (substantial)** |
|--------|------------------------|
| **Already in place** | **`ConsentRecord`** schema with methods, timestamps, withdrawal, legal basis; **client** consent fields; **audit** logging middleware; privacy documentation in `backend/docs`. |
| **Gaps** | Ensure every consent-changing path **writes** `ConsentRecord` + audit event (verify all entry points, not only email link flow). |
| **How to complete** | Audit matrix: registration, SSO, phone consent, withdrawal; export **audit trail** report for an org. |

---

## US-17: Consent Retrieval

**Story:** As an operator, I can retrieve consent documents instantly so that I can respond to audits or family inquiries.

| Status | **Partial** |
|--------|-------------|
| **Already in place** | Backend **privacy** / consent APIs (`privacy.service`, `privacyApi` types on frontend). |
| **Gaps** | Need **operator-facing** UI (org admin) listing consent records per client/caregiver with filter/export; optional attachment storage if “document” means signed PDF. |
| **How to complete** | Build **Consent center** screen: search by resident, show latest `ConsentRecord` rows, download CSV/PDF, deep link from US-7B badge. |

---

## Suggested sequencing (engineering)

1. **Trust & ops:** US-3 evidence object + US-5 timeline + US-7 playbooks (reduces ambiguity when something fires).  
2. **Delivery:** US-4 push/SMS reliability + US-6 digest (reduces “must open app” anxiety).  
3. **Science:** US-12 persisted baseline → US-14/15 delta-based alerting with tunable thresholds.  
4. **Compliance UX:** US-7B + US-17 surfaces on top of existing US-16 data.  
5. **Sponsor story:** US-2 external/status narrative once alerts and digests are trustworthy.

---

## Maintenance

Revisit this doc after major releases (new alert types, new analysis pipelines, or consent flows). Update the “Already in place” bullets to point to canonical services/routes/screens where possible.
