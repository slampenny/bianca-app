# Security Incident Report
## MyPhoneFriend - HIPAA Compliance

**Incident ID**: [Auto-generated or manual: INC-2025-001]  
**Report Date**: [Date]  
**Reported By**: [Name and title]  
**Security Officer**: [Name]

---

## SECTION 1: INCIDENT OVERVIEW

### 1.1 Incident Classification
- [ ] Security Incident (potential breach)
- [ ] Privacy Incident
- [ ] Policy Violation
- [ ] System Malfunction
- [ ] False Alarm

### 1.2 Discovery Information
**Discovery Date**: [Date]  
**Discovery Time**: [Time with timezone]  
**Discovered By**: [Person or system]  
**Discovery Method**:
- [ ] Automated breach detection
- [ ] Employee report
- [ ] Patient complaint
- [ ] Audit log review
- [ ] External notification
- [ ] Other: _______________

### 1.3 Incident Priority
- [ ] P1 - CRITICAL (Active breach, data exposure)
- [ ] P2 - HIGH (Unauthorized access attempt)
- [ ] P3 - MEDIUM (Policy violation)
- [ ] P4 - LOW (Minor security concern)

---

## SECTION 2: INCIDENT DETAILS

### 2.1 What Happened?
**Brief Description** (2-3 sentences):
```
[Describe the incident in plain language]

Example: "On October 15, 2025, automated breach detection flagged unusual data access 
patterns for user john.doe@example.com who accessed 150 patient records in one hour, 
significantly above their normal access pattern of 10-15 records per day."
```

### 2.2 Timeline

| Date/Time | Event | Source |
|-----------|-------|--------|
| [DateTime] | [First suspicious activity] | [System/User] |
| [DateTime] | [Detection/Discovery] | [How discovered] |
| [DateTime] | [Containment action] | [Who/What] |
| [DateTime] | [Investigation started] | [Security Officer] |
| [DateTime] | [Resolution] | [How resolved] |

### 2.3 Systems Affected
- [ ] Production database
- [ ] Staging environment
- [ ] Application servers
- [ ] API endpoints
- [ ] User accounts
- [ ] Other: _______________

**Specific Systems**: [List servers, services, etc.]

---

## SECTION 3: ePHI INVOLVEMENT

### 3.1 Was ePHI Involved?
- [ ] YES - ePHI was accessed, disclosed, or compromised
- [ ] NO - No ePHI involved
- [ ] UNKNOWN - Investigation ongoing

**If YES, continue to 3.2. If NO, skip to Section 4.**

### 3.2 Types of ePHI Affected
- [ ] Patient names
- [ ] Email addresses
- [ ] Phone numbers
- [ ] Dates of birth
- [ ] Addresses
- [ ] Medical record numbers
- [ ] Conversation transcripts
- [ ] Medical analysis/diagnoses
- [ ] Medication information
- [ ] Emergency alerts
- [ ] Other: _______________

### 3.3 Number of Individuals Affected
**Estimated Count**: ___________ individuals

**Affected Population**:
- [ ] All patients
- [ ] Specific organization: _______________
- [ ] Specific patients (list separately)
- [ ] Patients of specific caregiver

**How Determined**: 
```
[Explain how you counted affected individuals]

Example: "Queried audit logs for all patient records accessed by the 
compromised account during the incident window. Found 150 unique patient IDs."
```

### 3.4 Data Queries

**Audit Log Query Used**:
```javascript
db.audit_logs.find({
  userId: ObjectId("SUSPECT_USER_ID"),
  resource: { $in: ["patient", "conversation", "medicalAnalysis"] },
  timestamp: {
    $gte: ISODate("2025-10-15T14:00:00Z"),
    $lte: ISODate("2025-10-15T16:00:00Z")
  }
})

// Found: [X] distinct patient IDs
```

**Affected Patient List**: [Attached as separate file if large]

---

## SECTION 4: ROOT CAUSE ANALYSIS

### 4.1 How Did This Happen?

**Primary Cause**:
- [ ] Unauthorized access (hacking/intrusion)
- [ ] Employee error/mistake
- [ ] Insider threat (intentional)
- [ ] System misconfiguration
- [ ] Software bug/vulnerability
- [ ] Lost/stolen device
- [ ] Social engineering/phishing
- [ ] Third-party vendor issue
- [ ] Other: _______________

**Detailed Explanation**:
```
[Explain the root cause and contributing factors]

Example: "Employee had legitimate access to patients in their organization but 
accessed an unusually high volume of records in a short time. Investigation revealed 
employee was preparing a report and accessed multiple records for data analysis. 
Access was authorized but volume triggered automated breach detection."
```

### 4.2 Contributing Factors
- [ ] Lack of training
- [ ] Unclear procedures
- [ ] System limitations
- [ ] Time pressure
- [ ] Insufficient controls
- [ ] Other: _______________

### 4.3 Security Control Failures
**Which controls failed** (if any):
- [ ] Authentication - credentials compromised
- [ ] Authorization - permission bypass
- [ ] Audit logging - not captured
- [ ] Encryption - data exposed unencrypted
- [ ] Monitoring - not detected by automated systems
- [ ] None - controls worked as designed

---

## SECTION 5: CONTAINMENT ACTIONS

### 5.1 Immediate Actions Taken

**Within First Hour**:
- [ ] Locked compromised account(s)
- [ ] Terminated active sessions
- [ ] Blocked IP address
- [ ] Disabled compromised credentials
- [ ] Isolated affected systems
- [ ] Preserved evidence
- [ ] Notified Security Officer

**Actions Detail**:
```
Time: [HH:MM] - Action: Locked account via admin panel
Time: [HH:MM] - Action: Exported audit logs for evidence
Time: [HH:MM] - Action: Contacted Security Officer
```

### 5.2 Evidence Preserved
- [ ] Audit log export saved
- [ ] Screenshots captured
- [ ] System logs saved
- [ ] Email communications saved
- [ ] Database snapshot (if applicable)

**Evidence Location**: [File path or system]

---

## SECTION 6: INVESTIGATION

### 6.1 Investigation Team
- **Lead**: [Security Officer]
- **Technical**: [IT/DevOps lead]
- **Legal**: [Legal counsel - if breach confirmed]
- **Management**: [Executive]

### 6.2 Investigation Findings

**Was Access Unauthorized?**:
- [ ] YES - Unauthorized access occurred
- [ ] NO - Access was authorized
- [ ] PARTIAL - Authorized user but unauthorized purpose

**Was ePHI Acquired or Just Viewed?**:
- [ ] Viewed only (no download/copy)
- [ ] Downloaded/exported
- [ ] Copied/transmitted to unauthorized party
- [ ] Unknown

**Duration of Incident**:
- **Start**: [Date/Time]
- **End**: [Date/Time]
- **Total Duration**: [Hours/Days]

**Scope of Access**:
```
Total ePHI records accessed: [count]
Unique patients affected: [count]
Types of information: [list]
Actions performed: [READ, UPDATE, DELETE, EXPORT]
```

---

## SECTION 7: RISK ASSESSMENT

### 7.1 HIPAA Risk of Harm Analysis

**Factor 1: Nature and Extent of ePHI**
- [ ] Limited information (name, phone only)
- [ ] Moderate information (demographics + basic medical)
- [ ] Sensitive information (diagnoses, medications, transcripts)
- [ ] Highly sensitive (mental health, HIV status, substance abuse)

**Risk Level**: [ ] Low [ ] Medium [ ] High

**Factor 2: Unauthorized Person**
- [ ] Internal employee (mistake)
- [ ] Internal employee (intentional)
- [ ] External person (no medical relationship)
- [ ] Competitor or malicious actor
- [ ] Unknown

**Risk Level**: [ ] Low [ ] Medium [ ] High

**Factor 3: Was ePHI Actually Acquired?**
- [ ] No - just viewed
- [ ] Yes - downloaded/copied
- [ ] Yes - transmitted to others
- [ ] Unknown

**Risk Level**: [ ] Low [ ] Medium [ ] High

**Factor 4: Risk Mitigation**
- [ ] ePHI was encrypted
- [ ] Access lasted <5 minutes
- [ ] Data retrieved/deleted immediately
- [ ] Person signed confidentiality agreement
- [ ] Other: _______________

**Mitigation Effect**: [ ] Reduces risk [ ] Doesn't reduce risk

---

### 7.2 Overall Risk Determination

**LOW RISK**: 
- All factors are low
- Minimal PHI exposure
- Immediate mitigation
- No acquisition
- **Decision**: No notification required (document decision)

**REPORTABLE BREACH**:
- One or more factors high
- Significant risk of harm
- ePHI acquired
- **Decision**: Notification required (proceed to Section 8)

**DECISION**: 
- [ ] LOW RISK - No notification required
- [ ] REPORTABLE BREACH - Notification required

**Decision Made By**: [Security Officer name]  
**Date**: [Date]  
**Justification**: 
```
[Explain why this is or is not a reportable breach]

Example: "Determined to be low risk because: (1) Only patient names and 
phone numbers viewed, no sensitive medical information, (2) Internal 
employee with legitimate access who made procedural error, (3) Data was 
only viewed, not downloaded or copied, (4) Access duration was brief 
(15 minutes), (5) Employee immediately reported the error."
```

---

## SECTION 8: BREACH NOTIFICATION (If Required)

### 8.1 Notification Requirements

**If REPORTABLE BREACH**:

**Individuals**:
- [ ] Notification letter drafted
- [ ] Legal review completed
- [ ] Letters mailed (within 60 days)
- [ ] Date mailed: _______________

**HHS Office for Civil Rights**:
- [ ] Report filed (if 500+ individuals)
- [ ] Filed within 60 days
- [ ] Confirmation received
- [ ] Date filed: _______________

**Media** (if 500+ in same state/jurisdiction):
- [ ] Press release prepared
- [ ] Legal review completed
- [ ] Distributed to major media
- [ ] Date distributed: _______________

### 8.2 Notification Details

**Method of Individual Notification**:
- [ ] First class mail
- [ ] Email (if patient consented)
- [ ] Phone call (if insufficient addresses)

**Number Notified**: ___________ individuals

**Notification Date**: _______________

**Template Used**: `../Forms/Breach_Notification_Form.md`

---

## SECTION 9: REMEDIATION

### 9.1 Immediate Remediation

**Actions Taken to Fix**:
1. [Action 1 - e.g., "Changed all system passwords"]
2. [Action 2 - e.g., "Updated firewall rules"]
3. [Action 3 - e.g., "Enhanced monitoring for similar activity"]
4. [Action 4]

**Completion Date**: _______________

### 9.2 Long-Term Remediation

**Preventive Measures**:
1. [Measure 1 - e.g., "Implemented additional access controls"]
2. [Measure 2 - e.g., "Updated training materials"]
3. [Measure 3 - e.g., "Added new breach detection rule"]

**Timeline for Completion**: _______________

### 9.3 Policy/Procedure Updates

**Updates Needed**:
- [ ] Security policy updated
- [ ] Access control procedure updated
- [ ] Training materials updated
- [ ] Technical controls enhanced

**Update Completion Date**: _______________

---

## SECTION 10: LESSONS LEARNED

### 10.1 What Went Well?
```
[Positive aspects of the response]

Examples:
- Automated detection worked as designed
- Response team assembled quickly
- Containment was effective
- Communication was clear
```

### 10.2 What Could Be Improved?
```
[Areas for improvement]

Examples:
- Detection could have been faster
- Need clearer escalation procedures
- Training needs enhancement
- Additional monitoring needed
```

### 10.3 Preventive Recommendations
```
[How to prevent similar incidents]

Examples:
- Implement additional MFA requirements
- Enhanced training on data access policies
- Add new breach detection rule for this pattern
- Review and restrict access for similar roles
```

---

## SECTION 11: FINANCIAL IMPACT

### 11.1 Direct Costs
- Incident response time: [hours] × [hourly rate] = $___________
- Legal consultation: $___________
- Forensic investigation: $___________
- Notification costs (mailing, etc.): $___________
- Credit monitoring services: $___________
- **Total Direct Costs**: $___________

### 11.2 Indirect Costs
- Reputation damage: [Estimated]
- Customer churn: [Estimated]
- Lost productivity: [Estimated]
- Regulatory fines: [If applicable]

---

## SECTION 12: REGULATORY REPORTING

### 12.1 HHS Reporting
**Required**: [ ] YES [ ] NO

**If YES**:
- [ ] Report filed at: https://ocrportal.hhs.gov/ocr/breach/
- [ ] Confirmation number: _______________
- [ ] Date filed: _______________

### 12.2 Other Regulatory Bodies
- [ ] State health department
- [ ] State attorney general
- [ ] Other: _______________

---

## SECTION 13: CLOSURE

### 13.1 Incident Status
- [ ] Under Investigation
- [ ] Contained - Awaiting Notification
- [ ] Notification Complete - Monitoring
- [ ] Mitigated - Enhanced Monitoring
- [ ] Closed - Fully Resolved

### 13.2 Closure Checklist
- [ ] All containment actions complete
- [ ] All notifications sent (if required)
- [ ] All remediation complete
- [ ] Post-incident review completed
- [ ] Lessons learned documented
- [ ] Policies/procedures updated
- [ ] Staff training updated (if needed)
- [ ] Final report submitted to management

### 13.3 Closure Approval
**Incident Closed By**: [Security Officer]  
**Closure Date**: _______________  
**Final Status**: _______________

---

## SECTION 14: ATTACHMENTS

- [ ] Audit log exports
- [ ] Screenshots
- [ ] Email communications
- [ ] Notification letters
- [ ] HHS confirmation
- [ ] Post-incident review notes
- [ ] Updated policies/procedures

**Attachment Location**: [File path or document management system]

---

## SECTION 15: SIGNATURES

**Incident Report Prepared By**:
Name: ___________________________  
Title: ___________________________  
Signature: _______________________  
Date: ____________________________

**Reviewed and Approved By** (Security Officer):
Name: ___________________________  
Signature: _______________________  
Date: ____________________________

**Acknowledged By** (Executive Management):
Name: ___________________________  
Title: ___________________________  
Signature: _______________________  
Date: ____________________________

---

## DISTRIBUTION

- [ ] Security Officer (original)
- [ ] Legal Counsel (copy)
- [ ] Executive Management (copy)
- [ ] Compliance file (copy)
- [ ] External auditor (if requested)

---

## RETENTION

**Retention Period**: 7 years from closure date  
**Storage Location**: Secure compliance file system  
**Destruction Date**: [Closure date + 7 years]

---

## INSTRUCTIONS FOR COMPLETING THIS FORM

1. **Complete Sections 1-3 immediately** upon incident discovery (within 1 hour)
2. **Complete Sections 4-7** during investigation (within 24 hours)
3. **Complete Sections 8-9** during remediation (within 60 days for breach)
4. **Complete Sections 10-13** upon incident closure
5. **Attach all supporting documentation**
6. **Obtain all required signatures**
7. **File in secure location** with 7-year retention

**Questions?** Contact HIPAA Security Officer

---

**Form Version**: 1.0  
**Last Updated**: October 15, 2025  
**Next Review**: October 15, 2026












