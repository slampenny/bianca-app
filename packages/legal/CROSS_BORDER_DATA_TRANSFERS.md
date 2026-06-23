# Cross-Border Data Transfers - PIPEDA Compliance


**Last Updated:** June 16, 2026


---

## Overview

Bianca Wellness operates in Canada and the United States, and uses third-party service providers located in the United States. This document outlines our cross-border data transfer practices in compliance with PIPEDA (Personal Information Protection and Electronic Documents Act) requirements.

---

## Third-Party Service Providers

The following third-party service providers process personal information on our behalf and are located outside of Canada:

### 1. Azure OpenAI (Microsoft)
- **Location:** United States
- **Purpose:** AI-powered conversation analysis, transcription, and wellness insights
- **Data Processed:** 
  - Call recordings (audio)
  - Call transcriptions
  - Conversation metadata
  - Wellness analysis data
- **Safeguards:** 
  - Data Processing Agreement (DPA) in place
  - Encryption in transit (TLS 1.2+)
  - Encryption at rest
  - Access controls and audit logging
  - Microsoft's compliance with SOC 2, ISO 27001

### 2. Twilio
- **Location:** United States
- **Purpose:** Voice call services, call routing, and telephony infrastructure
- **Data Processed:**
  - Phone numbers
  - Call metadata (duration, timestamps, call status)
  - Call recordings (if enabled)
- **Safeguards:**
  - Data Processing Agreement (DPA) in place
  - Encryption in transit (TLS)
  - Encryption at rest
  - Twilio's compliance with HIPAA, SOC 2, ISO 27001
  - Access controls and audit logging

### 3. Amazon Web Services (AWS)
- **Location:** United States
- **Purpose:** Cloud hosting, data storage, and infrastructure services
- **Data Processed:**
  - All application data
  - User account information
  - Call recordings and transcriptions
  - Medical analysis data
  - Audit logs
- **Safeguards:**
  - Data Processing Agreement (DPA) in place
  - Encryption in transit (TLS 1.2+)
  - Encryption at rest (AES-256)
  - AWS compliance with HIPAA, SOC 2, ISO 27001, PCI DSS
  - Access controls, MFA, and comprehensive audit logging
  - Data residency controls

### 4. MongoDB Atlas
- **Location:** United States
- **Purpose:** Database hosting and data storage
- **Data Processed:**
  - All structured application data
  - User profiles
  - Patient information
  - Call records
  - Conversation data
  - Medical analysis results
- **Safeguards:**
  - Data Processing Agreement (DPA) in place
  - Encryption in transit (TLS)
  - Encryption at rest (AES-256)
  - MongoDB's compliance with SOC 2, ISO 27001
  - Access controls and audit logging
  - Automated backups with encryption

---

## Legal Basis for Transfers

Under PIPEDA, we transfer personal information to the United States based on:

1. **Contractual Safeguards:** All third-party service providers are bound by Data Processing Agreements (DPAs) that include:
   - Obligations to protect personal information
   - Restrictions on use and disclosure
   - Requirements for security safeguards
   - Data breach notification obligations
   - Right to audit compliance

2. **Technical Safeguards:** We implement technical measures including:
   - End-to-end encryption for data in transit
   - Encryption at rest for stored data
   - Access controls and authentication
   - Audit logging and monitoring
   - Regular security assessments

3. **Organizational Safeguards:** We maintain:
   - Privacy impact assessments
   - Regular vendor security reviews
   - Incident response procedures
   - Staff training on privacy and security

---

## Data Subject Rights

Canadian users have the right to:

- **Access:** Request information about what data is transferred and where
- **Correction:** Request correction of inaccurate information
- **Withdrawal of Consent:** Withdraw consent for cross-border transfers (may impact service availability)
- **Complaint:** File a complaint with the Privacy Commissioner of Canada

To exercise these rights, contact our Privacy Officer:
- **Email:** privacy@biancawellness.com
- **Phone:** +1-604-562-4263
- **Address:** 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

---

## Safeguards Summary

### Technical Safeguards
- ✅ Encryption in transit (TLS 1.2+)
- ✅ Encryption at rest (AES-256)
- ✅ Secure authentication (MFA where available)
- ✅ Access controls and role-based permissions
- ✅ Comprehensive audit logging
- ✅ Regular security updates and patches

### Contractual Safeguards
- ✅ Data Processing Agreements (DPAs) with all vendors
- ✅ Standard Contractual Clauses where applicable
- ✅ Vendor compliance certifications (SOC 2, ISO 27001, HIPAA)
- ✅ Right to audit vendor compliance
- ✅ Data breach notification requirements
- ✅ Data retention and deletion requirements

### Organizational Safeguards
- ✅ Privacy impact assessments
- ✅ Vendor security reviews (annual)
- ✅ Staff privacy and security training
- ✅ Incident response procedures
- ✅ Regular compliance audits

---

## Data Retention and Deletion

Personal information transferred to third-party service providers is subject to:

- **Retention Periods:** As outlined in our Privacy Policy
  - Patient data: 7 years after last activity
  - Call recordings: 2 years (PIPEDA) / 7 years (HIPAA)
  - Conversations: 5 years (PIPEDA) / 7 years (HIPAA)
  - Medical analysis: 7 years

- **Deletion:** Upon expiration of retention periods or upon user request (where legally permitted), we:
  1. Request deletion from third-party providers
  2. Verify deletion completion
  3. Maintain audit logs of deletion activities

---

## Risk Assessment

We have conducted a privacy impact assessment of our cross-border data transfers and determined that:

- **Risk Level:** Low to Moderate
- **Mitigation:** Comprehensive safeguards in place (see above)
- **Monitoring:** Regular reviews of vendor compliance and security practices
- **Updates:** This document is reviewed annually or when vendor relationships change

---

## Changes to This Document

We may update this document to reflect:
- Changes in third-party service providers
- Updates to safeguards or practices
- Changes in applicable laws or regulations

Users will be notified of material changes through:
- Email notification (for registered users)
- In-app notification
- Updated "Last Updated" date on this document

---

## Contact Information

**Privacy Officer:**
- Email: privacy@biancawellness.com
- Phone: +1-604-562-4263
- Address: 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

**Privacy Commissioner of Canada:**
- Website: https://www.priv.gc.ca/en/report-a-concern/
- Phone: 1-800-282-1376
- Mail: Office of the Privacy Commissioner of Canada, 30 Victoria Street, Gatineau, QC K1A 1H3

---

## Related Documents

- [Privacy Policy (Canada)](https://biancawellness.com/privacy-pipeda)
- [Privacy Policy](https://biancawellness.com/privacy)
- [Notice of Privacy Practices](https://biancawellness.com/privacy-practices)
- [Cross-Border Data Transfers](https://biancawellness.com/cross-border-data-transfers)

---

**This document complies with PIPEDA requirements for cross-border data transfer documentation.**
