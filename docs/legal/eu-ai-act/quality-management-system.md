# Quality Management System

**Provider:** Bianca Technologies  
**System:** Bianca Wellness Platform  
**Document version:** 1.0  
**Last updated:** May 2026  
**Regulatory basis:** EU AI Act Article 17 (Quality management system for providers of high-risk AI systems)

This document describes Bianca Technologies' quality management system (QMS). It is structured to satisfy Article 17 obligations and to support the provider self-assessment conformity path under Article 43 and Annex VI, regardless of final high-risk classification outcome.

**Status:** Draft — pending management approval, DPO appointment, and EU Authorised Representative designation.

---

## 1. Scope and Policy

### 1.1 QMS scope

The QMS applies to:

- Design, development, deployment, and maintenance of the **Bianca Wellness Platform**
- AI components: OpenAI Realtime voice conversation, post-call fact extraction, emergency/safety detection pipeline, sentiment and medical analysis
- Operational data handling for EU and Hungarian care facility deployments
- Third-party subprocessor management for AI and infrastructure services
- Post-market monitoring and incident response

**Out of scope:** Deployer-side clinical protocols, care home staffing decisions, and physical facility operations (remain deployer responsibility).

### 1.2 Quality policy statement

Bianca Technologies commits to:

1. **Resident safety first** — AI outputs support human caregivers; Bianca does not diagnose, prescribe, or autonomously act on clinical findings
2. **Transparency** — Residents and staff are informed that Bianca is an AI system; limitations are disclosed
3. **Privacy by design** — Per-purpose consent, data minimisation, jurisdiction-aware retention, and erasure capabilities are built into the platform
4. **Continuous improvement** — Safety corpus tests, incident review, and risk register updates drive iterative improvement
5. **Regulatory compliance** — GDPR, Hungarian health data law, and EU AI Act obligations are tracked with documented gap acknowledgment

This policy is reviewed annually by management or upon substantial system modification.

### 1.3 Regulatory compliance strategy

| Regulation | Strategy |
| --- | --- |
| **EU AI Act** | Self-assessment under Art. 43 + Annex VI; Annex IV technical documentation maintained; QMS per Art. 17; risk management per Art. 9 |
| **GDPR** | Privacy-by-design implementation; DPA/SCC execution with subprocessors; 72-hour breach notification for GDPR orgs |
| **Hungarian Act XLVII of 1997** | Health data processing under GDPR-equivalent controls; NAIH supervisory authority complaint pathway |
| **Deployer obligations** | Instructions for use provided to care home operators; deployers responsible for lawful basis, staff training, and clinical decisions |

**Critical gate:** EU production deployment with health data is **blocked** until SCCs are executed and documented in [SUBPROCESSORS.md](../SUBPROCESSORS.md).

---

## 2. Roles and Responsibilities

### 2.1 Provider obligations (Bianca Technologies)

| Responsibility | Description |
| --- | --- |
| System design and development | Maintain codebase, AI pipeline, safety detection |
| Technical documentation | Annex IV documentation, this QMS, risk register |
| Conformity assessment | Self-assessment; engage notified body if reclassified as high-risk |
| Post-market monitoring | Log analysis, incident response, annual review |
| Subprocessor management | DPAs, SCCs, subprocessor registry |
| Software updates | Version control, CI/CD, change management |
| Support to deployers | Instructions for use, limitation disclosures |

### 2.2 Deployer obligations (care home operators)

| Responsibility | Description |
| --- | --- |
| Lawful basis for processing | Ensure appropriate legal basis under GDPR and Hungarian law for resident health data |
| Consent collection | Obtain and record per-purpose resident consent via Bianca consent UI |
| Staff training | Train caregivers on alert review, AI limitations, and escalation procedures |
| Clinical decisions | All care decisions remain with qualified staff |
| Incident reporting to provider | Report systematic AI failures or safety concerns to Bianca Technologies |
| Mandatory reporting | Comply with local obligations (e.g., safeguarding, medical emergency reporting) independent of Bianca alerts |
| Facility infrastructure | Provide telephone access, staff availability for alert response |

### 2.3 EU Authorised Representative

| Field | Status |
| --- | --- |
| **Required under** | EU AI Act Article 22 (for non-EU providers placing on EU market) |
| **Appointee** | **[NOT YET APPOINTED]** |
| **Registered address** | **[TO BE COMPLETED]** |
| **Mandate scope** | Receive authority correspondence; maintain technical documentation access; cooperate with market surveillance |

**Gap:** An EU Authorised Representative must be appointed before EU market placement.

### 2.4 Data Protection Officer

| Field | Status |
| --- | --- |
| **Requirement** | GDPR Article 37 — likely required given large-scale processing of special category health data |
| **Appointee** | **[NOT YET FORMALLY DESIGNATED]** |
| **Responsibilities** | Monitor GDPR compliance, advise on DPIAs, cooperate with NAIH, serve as contact point for data subjects |
| **Interim arrangement** | Privacy request and breach notification workflows are implemented in software; formal DPO designation pending |

**Gap:** Formal DPO appointment and publication of contact details required before EU production scale-up.

---

## 3. Design and Development Controls

### 3.1 Development methodology

| Practice | Implementation |
| --- | --- |
| Version control | Git monorepo (`bianca-app`); feature branches; pull request review |
| Issue tracking | GitHub issues / project boards |
| Code review | Peer review required for production merges |
| Environment separation | Development, staging, test, production environments |
| Configuration management | Environment variables; AWS Secrets Manager for production secrets |
| Dependency management | Yarn workspaces; lockfile for reproducible builds |

AI-specific development controls:

- Prompt changes (extraction, Realtime system prompt) require review for safety and non-diagnosis compliance
- Emergency detection threshold changes require corpus test pass
- Model version changes treated as substantial modifications (see Annex IV §6.1)

### 3.2 Testing requirements before deployment

All production deployments must pass CI test suites. Key test files:

| Test area | Test file(s) | Purpose |
| --- | --- | --- |
| Emergency processor | `tests/unit/emergencyProcessor.test.js` | Alert creation, deduplication, financial path |
| Emergency detector corpus | `tests/unit/emergencyDetector.corpus.test.js` | Regression against labelled emergency utterances |
| Emergency detector unit | `tests/unit/emergencyDetector.test.js` | Core detection logic |
| ClientMemory service | `tests/unit/services/clientMemory.service.test.js` | Fact extraction, suppression, retrieval |
| Client GDPR consent | `tests/unit/services/client.gdprConsent.test.js` | Per-purpose consent, withdrawal |
| Client consent integration | `tests/integration/client.consent.integration.test.js` | End-to-end consent API |
| Privacy / GDPR | `tests/integration/privacy.test.js`, `tests/integration/privacy-gdpr.test.js` | Data subject rights |
| Consent record model | `tests/unit/models/consentRecord.model.test.js` | Append-only GDPR records |
| Jurisdiction utils | `tests/unit/utils/jurisdiction.utils.test.js` | Retention and GDPR country mapping |
| Breach detection | `tests/unit/services/breachDetection.service.test.js` | Security incident rules |
| Minimum necessary | `tests/unit/middlewares/minimumNecessary.test.js` | Field-level access control |

**Pre-deployment checklist:**

- [ ] All unit and integration tests pass
- [ ] Emergency corpus tests pass (no regression on safety detection)
- [ ] No PENDING SCC subprocessor receives new GDPR health data (deployment gate)
- [ ] Substantial modification assessment completed if applicable
- [ ] Release notes updated

### 3.3 Substantial modification assessment process

1. **Identify** — Engineer or product flags change against criteria in Annex IV §6.1
2. **Assess** — Quality / legal review determines if substantial
3. **Test** — Run extended safety corpus and integration tests
4. **Document** — Update Annex IV documentation, risk register, and this QMS if needed
5. **Approve** — Management sign-off before production deploy
6. **Re-assess conformity** — If substantial, trigger conformity re-assessment per Annex VI

---

## 4. Data Management

### 4.1 Training data

**Not applicable.** Bianca does not train proprietary AI models. See Annex IV §2.6.

### 4.2 Operational data governance

Operational data governance is described in Annex IV §4. Key controls:

| Control | Implementation |
| --- | --- |
| Jurisdiction-aware retention | `jurisdiction.utils.js` — `getDataRetentionPeriod` |
| Automated deletion | `dataDeletion.service.js` — daily `processDataDeletion` job |
| Erasure cascade | `cascadeErasureForClients` — GDPR Art. 17 |
| Access minimisation | `minimumNecessary.js` middleware — role-based field filtering |
| Audit logging | `auditLog.js` middleware — PHI access events |
| Consent enforcement | Per-purpose flags on client; append-only `ConsentRecord` |
| Data residency routing | `config.js` — `DATA_RESIDENCY_MODE`, `resolveDataResidency` |

### 4.3 Data quality controls for ClientMemory fact extraction

| Control | Detail |
| --- | --- |
| **Extraction prompt rules** | Facts not summaries; no diagnosis; one fact per item; confidence labelling |
| **Schema validation** | Category enum validation; fact max 500 chars; invalid categories default to `general` |
| **Temperature** | 0.1 for consistent extraction |
| **Parse failure handling** | JSON parse errors logged; extraction skipped without crashing call finalisation |
| **Priority flagging** | Safety/urgent facts marked `priority: urgent` |
| **Soft deletion** | Facts suppressable by erasure, retention expiry, or client deletion |
| **Deduplication** | Mid-call urgent facts deduplicated within 60-second window |
| **Human review path** | Facts visible in privacy exports and client context; staff can identify and report inaccuracies via correction requests |

**Known gap:** No automated fact verification against source transcript. Inaccurate facts rely on staff review and correction requests.

---

## 5. Risk Management Process

Detailed risks are maintained in [risk-management-register.md](./risk-management-register.md).

### Process overview

```
Identify ──► Assess (L × I) ──► Mitigate ──► Monitor ──► Review
   ▲                                              │
   └─────────────── New incidents / changes ───────┘
```

| Step | Activity | Frequency |
| --- | --- | --- |
| **Identify** | Engineering, support, and deployer feedback; codebase audits; subprocessor reviews | Continuous |
| **Assess** | Likelihood (1–5) × Impact (1–5) scoring in risk register | At identification and quarterly review |
| **Mitigate** | Implement technical controls, update prompts, add tests, execute legal agreements | Per risk action plan |
| **Monitor** | Logs, alert resolution rates, privacy request metrics, breach detection alerts | Continuous |
| **Review** | Risk register review with management | Quarterly minimum; annual comprehensive review |

Risk owners are assigned per entry in the risk register. Residual risks rated HIGH require documented acceptance by management or additional mitigation before EU go-live.

---

## 6. Post-Market Monitoring

### 6.1 Incident detection and classification

| Severity | Definition | Examples |
| --- | --- | --- |
| **Critical** | Immediate safety or large-scale data impact | Systematic emergency detection failure; breach >100 records |
| **High** | Significant safety or privacy impact | Single missed emergency with harm; unauthorised PHI access |
| **Medium** | Degraded function or limited privacy impact | Elevated false positive rate; failed scheduled calls |
| **Low** | Minor issue with workaround | UI display error; non-safety false alert |

Detection sources:

- `breachDetection.service.js` — automated rules (failed logins, data access volume, off-hours access, rapid access)
- Application logs — emergency detection decisions, extraction failures, Realtime connection errors
- Deployer reports — staff-reported AI failures
- Privacy complaints — `PrivacyComplaint` model including NAIH pathway

### 6.2 Serious incident reporting

| Obligation | Timeline | Implementation |
| --- | --- | --- |
| **GDPR breach notification to NAIH** | 72 hours of awareness (Art. 33) | `breachDetection.service.js` — `requiresSupervisoryAuthorityNotification` for GDPR jurisdiction; `getBreachNotificationDeadline` returns 72-hour deadline |
| **GDPR notification to data subjects** | Without undue delay if high risk (Art. 34) | Breach response SOP; email via `email.service.js` |
| **EU AI Act serious incident** | Per Art. 73 (when applicable) | Process aligned with breach response; report to market surveillance authority via Authorised Representative |
| **Deployer notification** | Without undue delay | Security team email notification in breach service |

Breach types detected automatically:

- Excessive failed logins (>5 in 5 minutes) — auto-lock account
- Unusual data access volume (>100 client records in 1 hour)
- Off-hours access (22:00–06:00)
- Rapid data access (>20 records in 1 minute)

### 6.3 Corrective action process

1. **Contain** — Disable affected feature, revoke access, or pause EU processing if SCC-related
2. **Investigate** — Root cause analysis; log review; reproduce in test environment
3. **Correct** — Code fix, prompt update, configuration change, or procedural change
4. **Verify** — Regression tests; corpus tests for safety changes
5. **Document** — Update risk register, incident log, and technical documentation
6. **Communicate** — Notify affected deployers and regulators as required
7. **Prevent recurrence** — Add test case, monitoring rule, or process control

### 6.4 Annual review cadence

| Review | Timing | Participants |
| --- | --- | --- |
| QMS effectiveness | Annual (Q1) | Management, engineering lead, legal counsel |
| Risk register comprehensive review | Annual | Quality, engineering, legal |
| Technical documentation update | Annual or on substantial change | Engineering, legal |
| Subprocessor / SCC status | Quarterly until resolved; annual thereafter | Legal, engineering |
| Emergency corpus refresh | Semi-annual | Engineering |
| Deployer feedback review | Annual | Product, support |

---

## 7. Transparency and Information Obligations

### 7.1 Resident disclosure

Residents (via staff-assisted consent flow) must be informed of:

| Topic | Disclosure |
| --- | --- |
| **AI nature** | Bianca is an artificial intelligence system, not a human caregiver |
| **Purpose** | Daily wellness check-in calls; conversation analysis for care team awareness |
| **Recording and transcription** | Calls may be recorded and transcribed if consent granted |
| **AI analysis** | AI analyses conversation content to generate wellness insights and safety alerts |
| **Human oversight** | Care staff review alerts and make all care decisions; Bianca does not diagnose or treat |
| **Third parties** | OpenAI processes voice and text; telephony provider handles call routing (see SUBPROCESSORS.md) |
| **Right to withdraw** | Consent can be withdrawn per purpose at any time via staff |
| **Data retention** | Data retained per jurisdiction policy (3 years for most categories under GDPR) |

Consent UI descriptions are defined in `clientConsent.constants.js` (`PURPOSE_DESCRIPTIONS`).

### 7.2 Care home staff instructions for use

Staff must:

1. Obtain all required per-purpose consents before enabling full Bianca features for a resident
2. Review and resolve alerts promptly; do not rely solely on AI detection
3. Escalate genuine emergencies through facility protocols (Bianca does not call emergency services)
4. Verify AI-generated facts against conversation transcripts when making care decisions
5. Report systematic AI errors to Bianca Technologies support
6. Not use Bianca output as a substitute for clinical assessment
7. Ensure assigned caregivers have valid phone numbers for SMS emergency alerts (when enabled)

### 7.3 Limitations disclosure

Staff and deployers must understand:

- Bianca may fail to detect emergencies (false negatives)
- Bianca may generate false alerts (false positives)
- Speech recognition accuracy varies with audio quality, accent, and speech patterns
- ClientMemory facts may be inaccurate or hallucinated
- OpenAI model behaviour may change with model updates
- SMS alerts are not sent for all alert types (financial exploitation alerts are dashboard-only)
- System availability depends on OpenAI, telephony, and AWS infrastructure

---

## 8. Record Keeping

### 8.1 Records maintained

| Record type | Storage | Retention (GDPR/HU) |
| --- | --- | --- |
| Consent grants and withdrawals | MongoDB `ConsentRecord` collection | 3 years after withdrawal; active consent retained |
| Privacy requests and responses | MongoDB `PrivacyRequest` | 3 years |
| Erasure completion proofs | MongoDB `ErasureCompletionRecord` | 3 years |
| Audit logs (PHI access) | MongoDB `AuditLog` | 3 years |
| Breach logs | MongoDB `BreachLog` | 3 years minimum |
| Conversation transcripts and messages | MongoDB `Conversation`, `Message` | 3 years |
| ClientMemory facts | MongoDB `ClientMemory` | 3 years (soft-deleted facts retained until purge) |
| Call metadata | MongoDB `Call` | 1 year |
| Alert records | MongoDB `Alert` | Duration of relevance + audit retention |
| Technical documentation | Git repository `docs/legal/eu-ai-act/` | Life of system + 10 years |
| Risk register | Git repository | Life of system + 10 years |
| Subprocessor agreements | External contract repository (not in git) | Life of agreement + 6 years |
| CI test results | CI system (CodeBuild) | Per CI retention policy |

Retention periods are configured in `jurisdiction.utils.js` — `GDPR_DATA_RETENTION`.

### 8.2 Record integrity

- GDPR consent records are **append-only** (immutable after creation)
- Audit logs have immutability hooks; erasure suppresses PHI references without deleting event structure
- Git provides version history for documentation and code
- MongoDB backups maintained per HIPAA backup SOP (US); EU backup strategy pending EU infrastructure

---

*End of Quality Management System documentation*
