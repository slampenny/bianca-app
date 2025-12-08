# Business Associate Agreement (BAA) Tracking Checklist
## MyPhoneFriend - HIPAA Compliance

**Document Type**: Template / Checklist  
**Owner**: HIPAA Security Officer  
**Review Frequency**: Quarterly

---

## PURPOSE

Track all Business Associate Agreements with vendors who handle ePHI, ensuring HIPAA §164.308(b)(1) compliance.

---

## BUSINESS ASSOCIATE DEFINITION

A Business Associate is any entity that:
- Performs services for us
- Has access to ePHI
- Is not part of our workforce

**Examples**: Cloud providers, AI services, telecom providers, email services, backup services

---

## CURRENT BUSINESS ASSOCIATES

### 1. Azure OpenAI Service (AI Processing)

**Vendor Information**:
- **Company**: Microsoft Corporation
- **Service**: Azure OpenAI Service
- **Contact**: Azure support
- **Website**: https://azure.microsoft.com/en-us/products/ai-services/openai-service

**ePHI Handled**:
- [x] Patient conversation transcripts
- [x] Medical analysis data
- [x] Sentiment analysis data
- [ ] Patient demographic data
- [ ] Other: _______________

**BAA Status**:
- [ ] Not Started
- [ ] In Negotiation
- [ ] Pending Signature
- [x] **SIGNED** (target)
- [ ] Expired

**BAA Details**:
- **Signed Date**: _______________
- **Expiration Date**: _______________  (usually no expiration, but review annually)
- **BAA Document Location**: [S3 bucket or file path]
- **Auto-Renewal**: [ ] Yes [x] No - Review annually

**HIPAA Features Enabled**:
- [x] Zero data retention
- [x] No model training on our data
- [x] Encryption at rest
- [x] Encryption in transit
- [x] Audit logging

**Last Security Review**: _______________  
**Next Security Review**: _______________  (Annual)

**Notes**:
```
Azure OpenAI automatically includes BAA for healthcare customers.
Verify in Azure portal under compliance settings.
```

---

### 2. Twilio (Voice Communications)

**Vendor Information**:
- **Company**: Twilio Inc.
- **Service**: Programmable Voice, SMS
- **Contact**: [Account manager name and email]
- **Website**: https://www.twilio.com

**ePHI Handled**:
- [x] Voice call recordings
- [x] Call metadata (duration, participants)
- [x] Phone numbers
- [ ] Patient conversation transcripts (if recorded)
- [ ] Other: _______________

**BAA Status**:
- [ ] Not Started
- [ ] In Negotiation
- [ ] Pending Signature
- [x] **SIGNED** (target)
- [ ] Expired

**BAA Details**:
- **Signed Date**: _______________
- **Expiration Date**: _______________
- **BAA Document Location**: [File path]
- **Plan**: Twilio Enterprise (HIPAA-eligible)

**HIPAA Features Enabled**:
- [x] Call encryption
- [x] Secure call recording storage
- [x] Encrypted at rest
- [x] Compliance logging
- [ ] Voice print de-identification

**Last Security Review**: _______________  
**Next Security Review**: _______________

**Notes**:
```
Twilio HIPAA features require Enterprise plan. Verify HIPAA eligibility
is enabled in Twilio console under Account Settings > Compliance.
```

---

### 3. Amazon Web Services (Infrastructure)

**Vendor Information**:
- **Company**: Amazon Web Services, Inc.
- **Service**: EC2, S3, RDS, KMS, SNS, SES
- **Contact**: AWS Support
- **Website**: https://aws.amazon.com

**ePHI Handled**:
- [x] Complete database (all ePHI)
- [x] Backups
- [x] File storage
- [x] Email notifications
- [x] Infrastructure hosting

**BAA Status**:
- [ ] Not Started
- [ ] In Negotiation  
- [ ] Pending Signature
- [x] **SIGNED** (target)
- [ ] Expired

**BAA Details**:
- **Signed Via**: AWS Artifact (in AWS Console)
- **Signed Date**: _______________
- **Document Location**: AWS Artifact → Agreements
- **Account ID**: [AWS Account ID]

**HIPAA-Eligible Services Used**:
- [x] EC2 (application servers)
- [x] S3 (backups, file storage)
- [x] RDS/DocumentDB (if used)
- [x] KMS (encryption key management)
- [x] SNS (notifications)
- [x] SES (email)
- [x] VPC (network isolation)
- [x] CloudWatch (monitoring)
- [x] CloudTrail (audit logging)
- [x] Secrets Manager (credential storage)

**Last Security Review**: _______________  
**Next Security Review**: _______________

**Notes**:
```
AWS BAA is signed electronically in AWS Console under Artifact.
Covers all HIPAA-eligible services. Must ensure we only use eligible services
for ePHI. See: https://aws.amazon.com/compliance/hipaa-eligible-services-reference/
```

---

### 4. MongoDB Atlas (Database)

**Vendor Information**:
- **Company**: MongoDB, Inc.
- **Service**: MongoDB Atlas (Database-as-a-Service)
- **Contact**: support@mongodb.com
- **Website**: https://www.mongodb.com/cloud/atlas

**ePHI Handled**:
- [x] All patient data
- [x] All conversation data
- [x] All medical analysis data
- [x] Audit logs
- [x] Complete database

**BAA Status**:
- [ ] Not Started
- [ ] In Negotiation
- [ ] Pending Signature
- [x] **SIGNED** (target)
- [ ] Expired

**BAA Details**:
- **Signed Via**: MongoDB Atlas Console
- **Review Date**: _______________
- **Document Location**: Atlas > Security > Compliance
- **Cluster Tier**: M10+ (HIPAA-eligible)

**HIPAA Features Enabled**:
- [x] Encryption at rest (Customer Key Management)
- [x] Encryption in transit (TLS)
- [x] Continuous backups (point-in-time recovery)
- [x] Access controls and audit logging
- [x] Network isolation
- [x] HIPAA-compliant cluster configuration

**Last Security Review**: _______________  
**Next Security Review**: _______________

**Notes**:
```
MongoDB Atlas includes BAA at M10 tier and above with HIPAA features enabled.
Verify encryption at rest is active in cluster configuration.
```

---

## VENDOR EVALUATION CHECKLIST

Use this checklist when evaluating new vendors:

### Pre-Engagement Evaluation

**Vendor**: _______________  
**Service**: _______________  
**Evaluation Date**: _______________

**Will this vendor have access to ePHI?**
- [ ] YES → BAA required, continue checklist
- [ ] NO → BAA not required, standard vendor process

**Security Documentation**:
- [ ] SOC 2 Type II report (< 1 year old)
- [ ] HIPAA compliance documentation
- [ ] Security questionnaire completed
- [ ] Incident response procedures provided
- [ ] Data handling procedures documented
- [ ] Encryption capabilities confirmed
- [ ] Backup and disaster recovery plan

**BAA Requirements**:
- [ ] BAA template reviewed by legal
- [ ] All required provisions included:
  - [ ] Permitted uses and disclosures
  - [ ] Safeguard requirements
  - [ ] Subcontractor provisions
  - [ ] Incident reporting (within 24 hours)
  - [ ] Data access and amendment rights
  - [ ] Minimum necessary compliance
  - [ ] Data return/destruction upon termination
  - [ ] Audit and inspection rights
  - [ ] Term and termination provisions
- [ ] Signature authority confirmed
- [ ] Executed BAA received

**Risk Assessment**:
- **Data Sensitivity**: [ ] Low [ ] Medium [ ] High
- **Data Volume**: [ ] Low [ ] Medium [ ] High
- **Vendor Security Posture**: [ ] Good [ ] Acceptable [ ] Concerning
- **Overall Risk**: [ ] Low [ ] Medium [ ] High

**Approval**:
- [ ] Security Officer approved
- [ ] Legal counsel approved
- [ ] Executive management approved (if high risk)

**Decision**:
- [ ] APPROVED - Proceed with vendor
- [ ] APPROVED WITH CONDITIONS - List: _______________
- [ ] DENIED - Do not use vendor

---

## BAA RENEWAL PROCESS

### 90 Days Before Expiration:

**Week 1**:
- [ ] Review upcoming BAA expirations (quarterly review)
- [ ] Contact vendor to initiate renewal
- [ ] Request updated security documentation

**Week 2-6**:
- [ ] Receive updated BAA terms
- [ ] Legal review of any changes
- [ ] Negotiate terms if needed
- [ ] Conduct annual security review

**Week 7-12**:
- [ ] Execute renewed BAA
- [ ] Update tracking system
- [ ] File signed BAA
- [ ] Update expiration calendar

**If Vendor Won't Renew**:
- [ ] Initiate vendor replacement process
- [ ] Data migration plan
- [ ] Timeline to migrate before expiration
- [ ] Test replacement vendor
- [ ] Complete migration
- [ ] Verify data destruction by old vendor

---

## ONGOING MONITORING

### Quarterly BAA Review (Every 3 Months)

**Checklist**:
- [ ] All BAAs current (none expired)
- [ ] All vendors still in compliance
- [ ] No security incidents reported by vendors
- [ ] No changes to services that affect ePHI handling
- [ ] All expiration dates noted in calendar
- [ ] Upcoming renewals identified

**Review Date**: _______________  
**Reviewed By**: _______________  
**Issues Found**: _______________  
**Actions Taken**: _______________

---

### Annual Vendor Security Assessment

**For Each Vendor**:

**Documentation Review**:
- [ ] Updated SOC 2 report requested
- [ ] Security questionnaire updated
- [ ] Incident reports reviewed (any breaches?)
- [ ] Compliance certifications verified
- [ ] Service level agreements met

**Performance Evaluation**:
- [ ] Uptime/reliability: _______________
- [ ] Support responsiveness: _______________
- [ ] Security incidents: _______________ (count)
- [ ] Our incidents caused by vendor: _______________ (count)

**Compliance Verification**:
- [ ] HIPAA features still enabled
- [ ] BAA terms being followed
- [ ] Subcontractors approved (if any)
- [ ] Data handling procedures followed
- [ ] Incident reporting working

**Decision**:
- [ ] Continue with vendor (no issues)
- [ ] Continue with remediation plan
- [ ] Consider alternative vendors
- [ ] Terminate relationship

---

## VENDOR INCIDENT REPORTING

### When Vendor Reports Incident:

**Immediate Actions** (within 1 hour):
1. [ ] Acknowledge receipt of notification
2. [ ] Request detailed incident report
3. [ ] Assess impact on our ePHI
4. [ ] Determine if breach notification required
5. [ ] Notify Security Officer
6. [ ] Activate incident response team

**Investigation** (within 24 hours):
1. [ ] Review vendor's incident details
2. [ ] Query our audit logs for affected data
3. [ ] Count affected individuals
4. [ ] Conduct risk assessment
5. [ ] Determine notification requirements

**Response** (within 60 days if breach):
1. [ ] Require vendor remediation plan
2. [ ] Verify vendor corrective actions
3. [ ] Send breach notifications (if required)
4. [ ] File HHS report (if required)
5. [ ] Consider vendor relationship

**Documentation**:
- [ ] Vendor notification email/letter
- [ ] Our incident report
- [ ] Breach notification (if sent)
- [ ] Remediation verification
- [ ] Relationship review decision

---

## VENDOR TERMINATION PROCEDURES

### When Ending Vendor Relationship:

**30 Days Before Termination**:
- [ ] Notify vendor of termination
- [ ] Reference BAA termination clause
- [ ] Request data return/destruction options
- [ ] Plan data migration (if applicable)

**Termination Date**:
- [ ] Revoke all vendor access
- [ ] Disable API keys/credentials
- [ ] Remove from systems
- [ ] Verify data returned or destroyed

**Within 30 Days After**:
- [ ] Receive certification of data destruction
- [ ] Verify destruction method meets HIPAA standards
- [ ] Conduct final security review
- [ ] Close vendor account
- [ ] Update BAA tracking

**Documentation Required**:
- [ ] Termination notice
- [ ] Data destruction certificate
- [ ] Final security review
- [ ] Lessons learned (why terminated?)

---

## BAA STORAGE

### Document Management

**Original BAAs Stored**:
- **Physical**: Locked file cabinet in legal office
- **Electronic**: Encrypted folder on S3
  - Location: `s3://bianca-compliance-docs/BAAs/`
  - Encryption: AWS KMS
  - Access: Security Officer + Legal only

**Backup Copies**:
- Legal counsel office
- Compliance management system
- External auditor (read-only access)

**Retention**: Duration of relationship + 7 years

---

## QUICK STATUS DASHBOARD

| Vendor | Service | ePHI Access | BAA Status | Expiration | Last Review | Risk |
|--------|---------|-------------|------------|------------|-------------|------|
| Azure OpenAI | AI | Yes | ☐ Sign | N/A | - | High |
| Twilio | Voice | Yes | ☐ Sign | - | - | High |
| AWS | Infrastructure | Yes | ☐ Sign | N/A | - | Critical |
| MongoDB Atlas | Database | Yes | ☐ Sign | N/A | - | Critical |

**Legend**:
- ✅ Signed and current
- ⚠️ Expiring soon (<90 days)
- ❌ Expired or not signed
- ☐ To be signed

**Overall BAA Compliance**: 0/4 (0%) ← **CRITICAL GAP**

---

## ESCALATION

### Issues Requiring Immediate Attention:

**Red Flags**:
- [ ] Vendor refuses to sign BAA
- [ ] BAA expired and vendor still has access
- [ ] Vendor had security breach
- [ ] Vendor not meeting BAA terms
- [ ] Vendor wants to subcontract (needs our approval)

**Action**: Contact Security Officer and Legal immediately

---

## CONTACTS

**Internal**:
- Security Officer: security@biancawellness.com
- Legal Counsel: legal@biancawellness.com

**External Vendors**:
- Azure: Azure support portal
- Twilio: [Account manager]
- AWS: AWS Support Console
- MongoDB: support@mongodb.com

---

## NEXT STEPS

### This Month (CRITICAL):
1. [ ] Contact Azure OpenAI for BAA
2. [ ] Contact Twilio for BAA upgrade
3. [ ] Sign AWS BAA in console
4. [ ] Review MongoDB Atlas BAA

### This Quarter:
1. [ ] Complete all BAA signatures
2. [ ] File all signed BAAs
3. [ ] Document in tracking system
4. [ ] Update this checklist

### Ongoing:
1. [ ] Review quarterly
2. [ ] Monitor vendor security
3. [ ] Track expiration dates
4. [ ] Renew before expiration

---

**Last Updated**: October 15, 2025  
**Next Review**: January 15, 2026  
**Maintained By**: HIPAA Security Officer












