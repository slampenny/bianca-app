# Standard Operating Procedure: Security Breach Response
## MyPhoneFriend - HIPAA Compliance

**SOP ID**: HIPAA-SOP-002  
**Version**: 1.0  
**Effective Date**: October 15, 2025  
**Department**: IT / Security  
**Owner**: HIPAA Security Officer

---

## 1. PURPOSE

To establish procedures for responding to security breaches affecting ePHI in compliance with HIPAA Breach Notification Rule (45 CFR §164.404-414).

---

## 2. SCOPE

This procedure covers:
- Security incidents involving ePHI
- Breach detection and assessment
- Containment and remediation
- Breach notification (individuals, HHS, media)
- Post-incident review

---

## 3. DEFINITIONS

**Breach**: Unauthorized acquisition, access, use, or disclosure of ePHI that compromises security or privacy.

**Security Incident**: Any attempted or successful unauthorized access, use, disclosure, modification, or destruction of information or interference with system operations.

---

## 4. BREACH DETECTION

### 4.1 Automated Detection

**System monitors for**:
1. **Excessive Failed Logins**: 5+ attempts in 5 minutes
2. **Unusual Data Access**: 100+ records in 1 hour
3. **Rapid Data Access**: 20+ records in 1 minute
4. **Off-Hours Access**: ePHI access 10 PM - 7 AM

**Automated Response**:
- Account automatically locked
- Security Officer notified via AWS SNS
- BreachLog entry created
- 60-day notification deadline set

**Code**: `src/services/breachDetection.service.js`

---

### 4.2 Manual Detection

**Sources**:
- Employee reports
- Patient complaints
- External notifications
- Audit log reviews
- Vendor notifications
- Third-party alerts

**Reporting**: See `SOP_Incident_Reporting.md`

---

## 5. IMMEDIATE RESPONSE (First 1 Hour)

### 5.1 Containment - IMMEDIATE

**Priority**: Stop ongoing breach

**Actions**:
```bash
# 1. Lock compromised account
db.caregivers.updateOne(
  { _id: ObjectId("USER_ID") },
  { 
    $set: { 
      accountLocked: true,
      lockedReason: "Security breach - unauthorized access",
      lockedAt: new Date()
    }
  }
)

# 2. Terminate all active sessions
# (Automatic when account locked)

# 3. Revoke API tokens (if applicable)

# 4. Change credentials if compromised

# 5. Block IP address if external attack
# (Update firewall/security group rules)
```

**Checklist**:
- [ ] Compromised account(s) locked
- [ ] Active sessions terminated
- [ ] Attack vector identified and blocked
- [ ] Systems isolated if necessary
- [ ] Evidence preserved (logs, screenshots)

---

### 5.2 Notification - IMMEDIATE

**Within 1 Hour**:

**Step 1: Notify Security Officer**
- **Email**: security@myphonefriend.com
- **Phone**: [Security Officer phone]
- **Information needed**:
  - What happened?
  - When discovered?
  - What ePHI affected?
  - How many individuals?
  - What actions taken so far?

**Step 2: Assemble Response Team**
- Security Officer (lead)
- Technical Lead / CTO
- Legal Counsel (if breach confirmed)
- Executive Management
- PR/Communications (if media notification needed)

**Step 3: Preserve Evidence**
- Copy all relevant logs
- Take screenshots
- Document timeline
- Save system snapshots
- Don't delete anything

---

## 6. INVESTIGATION (First 24 Hours)

### 6.1 Breach Assessment

**Step 1: Determine Scope**
```bash
# Query audit logs for affected time period
db.audit_logs.find({
  userId: ObjectId("SUSPECTED_USER_ID"),
  timestamp: { 
    $gte: new Date("2025-10-01"),
    $lte: new Date("2025-10-15")
  },
  resource: { $in: ["patient", "conversation", "medicalAnalysis"] }
}).sort({ timestamp: 1 })

# Check what patients were accessed
db.audit_logs.aggregate([
  {
    $match: {
      userId: ObjectId("USER_ID"),
      resource: "patient",
      action: { $in: ["READ", "UPDATE"] }
    }
  },
  {
    $group: {
      _id: "$resourceId",
      accessCount: { $sum: 1 },
      firstAccess: { $min: "$timestamp" },
      lastAccess: { $max: "$timestamp" }
    }
  }
])
```

**Questions to Answer**:
1. What ePHI was accessed/disclosed?
2. How many individuals affected?
3. Who had unauthorized access?
4. When did breach occur?
5. How long did it last?
6. Was ePHI acquired or just accessed?
7. What is risk of harm to individuals?

---

### 6.2 Risk Assessment

**HIPAA Risk of Harm Assessment** (determines if notification required):

**Factors to Consider**:
1. **Nature and extent of ePHI**
   - Limited info (name, phone) = Lower risk
   - Sensitive info (medical, SSN) = Higher risk

2. **Person who accessed**
   - Internal employee mistake = Lower risk
   - External hacker = Higher risk
   - Competitor = Higher risk

3. **Was ePHI acquired or viewed?**
   - Viewed only = Lower risk
   - Downloaded/copied = Higher risk
   - Published/sold = Highest risk

4. **Risk mitigation**
   - ePHI encrypted = Lower risk
   - Account locked immediately = Lower risk
   - Data recovered = Lower risk

**Decision**:
- **Low Risk**: No notification required (document decision)
- **Reportable Breach**: Notification required (proceed to notification)

**Documentation**: Use `../Templates/Risk_Assessment_Template.md`

---

## 7. BREACH NOTIFICATION (If Required)

### 7.1 Timeline Requirements

| Notification | Timeline |
|--------------|----------|
| Individuals | Within 60 days of discovery |
| HHS (500+) | Within 60 days of discovery |
| HHS (<500) | Within 60 days of end of calendar year |
| Media (500+ in jurisdiction) | Within 60 days of discovery |

---

### 7.2 Individual Notification

**Method**: 
- First class mail (preferred)
- Email (if individual agreed to electronic)
- Phone (if insufficient contact info)
- Substitute notice (if >10 insufficient addresses)

**Required Content**:
1. Brief description of what happened
2. Types of ePHI involved
3. Steps individuals should take
4. What we're doing to investigate
5. Contact information for questions

**Template**: `../Forms/Breach_Notification_Form.md`

**Example**:
```
Dear [Patient Name],

We are writing to inform you of a security incident that may have affected 
your protected health information.

What Happened:
On [DATE], we discovered that [DESCRIPTION]. 

What Information Was Involved:
The information that may have been accessed includes [LIST TYPES].

What We Are Doing:
We immediately [ACTIONS TAKEN]. We have also [ADDITIONAL STEPS].

What You Can Do:
[RECOMMENDATIONS FOR INDIVIDUALS]

For More Information:
Contact our Security Officer at [CONTACT INFO]

Sincerely,
[Authorized Representative]
MyPhoneFriend
```

---

### 7.3 HHS Notification

**When Required**: 
- Breaches affecting 500+ individuals: Within 60 days
- Breaches affecting <500 individuals: Annual report

**How to Report**:
1. Go to: https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf
2. Complete breach report form
3. Include all required information
4. Submit electronically
5. Save confirmation

**Information Required**:
- Number of individuals affected
- Date of breach discovery
- Types of ePHI involved
- Brief description
- Actions taken

---

### 7.4 Media Notification

**When Required**: Breach affecting 500+ individuals in same state/jurisdiction

**Method**:
- Press release
- Major media outlets in affected area
- Within 60 days of discovery

**Content**:
- Same information as individual notification
- Contact information for questions

---

## 8. REMEDIATION

### 8.1 Immediate Remediation

**Within 24-48 Hours**:
1. **Close Security Gap**
   - Fix vulnerability
   - Update security controls
   - Patch systems
   - Change credentials

2. **Enhance Monitoring**
   - Increase logging
   - Add specific detection rules
   - Enhanced alerting

3. **Verify Effectiveness**
   - Test security fix
   - Confirm vulnerability closed
   - Monitor for repeat activity

---

### 8.2 Long-Term Remediation

**Within 30-90 Days**:
1. **Process Improvements**
   - Update procedures based on lessons learned
   - Additional training if needed
   - Enhanced controls if necessary

2. **Technical Enhancements**
   - Additional security features
   - Improved detection rules
   - Better monitoring

3. **Policy Updates**
   - Update security policies
   - Revise procedures
   - Communicate changes to staff

---

## 9. POST-INCIDENT REVIEW

### 9.1 Review Meeting

**Timeline**: Within 7 days of incident resolution

**Attendees**:
- Security Officer (facilitator)
- Technical team involved
- Management
- Legal (if applicable)

**Agenda**:
1. Incident timeline review
2. Root cause analysis
3. Response effectiveness
4. What worked well?
5. What could be improved?
6. Action items for prevention

---

### 9.2 Documentation

**Incident Report Must Include**:
1. **Detection**
   - How was breach discovered?
   - When was it discovered?
   - Who discovered it?

2. **Investigation**
   - What ePHI was affected?
   - How many individuals?
   - Root cause
   - Timeline of events

3. **Response**
   - Containment actions
   - Remediation steps
   - Notifications sent
   - External reporting

4. **Lessons Learned**
   - What went well?
   - What needs improvement?
   - Preventive measures
   - Policy/procedure updates

**Template**: `../Forms/Incident_Report_Template.md`

---

## 10. BREACH LOG MANAGEMENT

### 10.1 BreachLog Database

**All incidents stored in**:
```javascript
// Database: bianca_app
// Collection: breachlogs

// Query current investigating breaches
db.breachlogs.find({
  status: "INVESTIGATING"
}).sort({ detectedAt: -1 })

// Query breaches requiring notification
db.breachlogs.find({
  requiresHHSNotification: true,
  hhsNotified: false
}).sort({ notificationDeadline: 1 })
```

---

### 10.2 Breach Status Tracking

**Statuses**:
1. **INVESTIGATING**: Initial detection, under investigation
2. **CONFIRMED**: Breach confirmed, notification in progress
3. **NOTIFIED**: Individuals notified, awaiting responses
4. **MITIGATED**: Remediation complete, monitoring ongoing
5. **CLOSED**: Fully resolved, no further action

**Update Process**:
```javascript
// Update breach status
db.breachlogs.updateOne(
  { _id: ObjectId("BREACH_ID") },
  { 
    $set: { 
      status: "CONFIRMED",
      individualsNotified: true,
      notificationDate: new Date(),
      mitigationSteps: ["Account locked", "Password reset", "Enhanced monitoring"]
    }
  }
)
```

---

## 11. SPECIAL CASES

### 11.1 Insider Threat

**Indicators**:
- Access outside normal work hours
- Accessing patients not assigned
- Downloading large amounts of data
- Accessing data shortly before resignation

**Response**:
1. Do NOT alert suspect
2. Contact Security Officer immediately
3. Preserve all evidence
4. Consult legal before action
5. Law enforcement may be involved

---

### 11.2 Ransomware Attack

**Immediate Actions**:
1. Isolate affected systems (disconnect network)
2. Do NOT pay ransom (FBI recommendation)
3. Activate backup recovery procedures
4. Notify law enforcement (FBI cyber division)
5. Contact cyber insurance provider
6. Begin data restoration from backups

**Communication**:
- Internal: Security team only (confidential)
- External: Only through approved PR channels
- Patients: Only if ePHI compromised

---

### 11.3 Vendor Breach

**When Vendor Notifies You**:
1. Request detailed incident report
2. Assess impact on your ePHI
3. Verify vendor remediation
4. Determine if notification required
5. Review BAA terms
6. Consider vendor termination if severe

**Timeline**: Vendor must notify within 24 hours per BAA terms

---

## 12. TESTING AND DRILLS

### 12.1 Annual Breach Response Drill

**Frequency**: Annually  
**Scenario**: Simulated breach

**Steps**:
1. Security Officer creates scenario
2. Team responds as if real breach
3. Follow all procedures
4. Time response actions
5. Debrief and improve

**Documentation**: Drill results and improvements

---

### 12.2 Tabletop Exercises

**Frequency**: Quarterly  
**Format**: Discussion-based scenario

**Topics**:
- Ransomware scenario
- Insider threat scenario
- Vendor breach scenario
- Physical breach scenario

---

## 13. BREACH NOTIFICATION TEMPLATES

### Quick Reference:

**<500 Individuals**:
- Individual notification: First class mail within 60 days
- HHS notification: Annual report (by March 1 of following year)
- No media notification required

**500+ Individuals**:
- Individual notification: First class mail within 60 days
- HHS notification: Electronic form within 60 days
- Media notification: Press release within 60 days (same jurisdiction)

**Substitute Notice** (if >10 insufficient addresses):
- Conspicuous posting on website for 90 days
- Notice to major media outlets
- Toll-free number for 90 days

---

## 14. EXTERNAL REPORTING

### 14.1 HHS Office for Civil Rights (OCR)

**Website**: https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf

**Information Needed**:
- Organization name and contact
- Number of individuals affected
- Date of breach
- Date of discovery
- Brief description
- Types of ePHI involved
- Steps taken to mitigate

**Deadline**: 60 days from discovery (500+) or annual report (<500)

---

### 14.2 Law Enforcement (If Criminal)

**When to Report**:
- Hacking or unauthorized access
- Ransomware attack
- Insider theft
- Identity theft ring
- Organized data theft

**Who to Contact**:
- Local FBI field office
- FBI Cyber Division
- Local police (if physical theft)

**What to Provide**:
- Incident details
- Evidence collected
- Affected individuals
- Timeline

**Coordination**: Work with legal counsel

---

## 15. LEGAL CONSIDERATIONS

### 15.1 Legal Counsel Involvement

**Contact Legal When**:
- Breach affects 100+ individuals
- Criminal activity suspected
- Media coverage likely
- Lawsuit risk exists
- Regulatory investigation possible

**Legal Review Required For**:
- All breach notifications
- HHS reports
- Media statements
- Settlement negotiations

---

### 15.2 Privilege Protection

**Attorney-Client Privilege**:
- Mark documents "Attorney-Client Privileged"
- Only share with legal team
- Don't forward to unauthorized parties
- Keep separate from general incident docs

---

## 16. COMMUNICATION PLAN

### 16.1 Internal Communication

**Immediate**:
- Security Officer
- CTO/Technical Lead
- CEO/Executive Team
- Legal Counsel

**Within 24 Hours**:
- All technical staff (if needed for remediation)
- Customer support (for patient inquiries)
- HR (if employee involved)

**Need to Know**:
- Only share with those who need to know
- Confidential until public notification
- Use secure communication channels

---

### 16.2 External Communication

**Patients/Individuals**:
- Use approved notification letter template
- Coordinate with legal
- Consistent messaging
- Compassionate tone
- Clear action items

**Media**:
- Only designated spokesperson
- Approved statement only
- Coordinate with PR/Legal
- No speculation
- Factual information only

**Partners/Vendors**:
- Notify if affected
- Coordinate response if vendor-caused
- Review BAA terms

---

## 17. DOCUMENTATION REQUIREMENTS

### 17.1 Incident Documentation

**Create Within 24 Hours**:
1. **Incident Report**
   - Use template: `../Forms/Incident_Report_Template.md`
   - Complete all sections
   - Attach evidence
   - Sign and date

2. **Breach Assessment**
   - Risk of harm analysis
   - Notification determination
   - Supporting documentation

3. **Timeline**
   - Discovery date/time
   - Notification dates
   - Key actions and decisions

4. **Evidence Package**
   - Audit log exports
   - Screenshots
   - System logs
   - Communication records

---

### 17.2 Retention

**All breach documentation**:
- Retained for 7 years minimum
- Stored securely
- Accessible for audits
- Indexed for retrieval

**Location**: 
- BreachLog database (metadata)
- S3 encrypted bucket (documents)
- Legal hold folder (if litigation)

---

## 18. BREACH NOTIFICATION DECISION TREE

```
Incident Discovered
        ↓
Was ePHI accessed/disclosed?
        ↓
    NO → Not a breach (but document incident)
        ↓
    YES → Continue
        ↓
Was access unauthorized?
        ↓
    NO → Not a breach (but review access controls)
        ↓
    YES → Continue
        ↓
Low probability of compromise? (encryption, immediate recovery)
        ↓
    YES → No notification required (document risk assessment)
        ↓
    NO → BREACH CONFIRMED
        ↓
How many individuals affected?
        ↓
    <500 → Individual notification + Annual HHS report
        ↓
    500+ → Individual notification + HHS report + Media notification
            (All within 60 days)
```

---

## 19. COMMON BREACH SCENARIOS

### Scenario 1: Unauthorized Employee Access
**Example**: Staff member accessed ex-spouse's patient record

**Response**:
1. Lock account immediately
2. Review all access by employee
3. Interview employee
4. Determine if acquired or just viewed
5. Risk assessment (low if just viewed once)
6. Likely outcome: Disciplinary action, possibly no notification
7. Enhanced monitoring of similar access

---

### Scenario 2: Lost/Stolen Device
**Example**: Laptop stolen with database access

**Response**:
1. Remote wipe device (if MDM enabled)
2. Change database credentials
3. Review what ePHI was on device
4. Check if disk encryption enabled
5. If encrypted: Low risk, likely no notification
6. If unencrypted: Breach notification required

---

### Scenario 3: Hacking/Unauthorized Access
**Example**: External attacker gains access

**Response**:
1. Isolate systems immediately
2. Block attacker IP addresses
3. Forensic investigation
4. Determine what data was accessed
5. Almost always requires notification
6. Law enforcement involvement
7. Extensive remediation

---

### Scenario 4: Misdirected Email/Fax
**Example**: ePHI sent to wrong person

**Response**:
1. Contact recipient immediately
2. Request return/deletion
3. Confirm deletion
4. Document recipient response
5. Risk assessment (low if deleted)
6. May not require notification if deleted

---

## 20. PREVENTION MEASURES

### 20.1 Technical Controls (Already Implemented ✅)
- ✅ Automatic account lockout (5 failed logins)
- ✅ Breach detection monitoring
- ✅ Audit logging (all ePHI access)
- ✅ Minimum necessary access
- ✅ Session timeout (15 minutes)
- ✅ MFA for administrators
- ✅ Encryption at rest (MongoDB Atlas)
- ✅ TLS encryption in transit

### 20.2 Administrative Controls (Implement)
- [ ] Annual workforce training
- [ ] Quarterly access reviews
- [ ] Security awareness program
- [ ] Phishing simulation tests
- [ ] Background checks for new hires

### 20.3 Monitoring Enhancements
- [ ] Increase audit log review frequency
- [ ] Add custom breach detection rules
- [ ] Implement SIEM solution (if budget allows)
- [ ] Enhanced alerting for admin actions

---

## 21. METRICS AND REPORTING

### 21.1 Breach Metrics

**Track Monthly**:
- Number of incidents detected
- Number meeting breach criteria
- Average response time
- Notification timeliness
- Individuals affected

**Query Breach Statistics**:
```javascript
// Get breach statistics for last 30 days
// (Automated in application)
const stats = await breachDetectionService.getBreachStatistics(30);

// Returns:
// {
//   total: 5,
//   critical: 1,
//   high: 3,
//   medium: 1,
//   investigating: 2,
//   confirmed: 1,
//   mitigated: 2
// }
```

---

### 21.2 Reporting

**Monthly Report Includes**:
- Incidents detected
- Breaches confirmed
- Notifications sent
- Remediation status
- Trends and patterns
- Recommendations

**Submitted To**:
- Executive management
- Board of directors (quarterly)
- External auditor (annually)

---

## 22. CONTACTS

### Internal:
- **Security Officer**: security@myphonefriend.com | [Phone]
- **Legal**: legal@myphonefriend.com | [Phone]
- **CEO**: [Email] | [Phone]
- **CTO**: [Email] | [Phone]

### External:
- **HHS OCR**: https://www.hhs.gov/ocr/ | 1-800-368-1019
- **FBI Cyber**: https://www.fbi.gov/contact-us
- **Cyber Insurance**: [Provider] | [Policy Number]
- **Legal Counsel**: [Firm] | [Attorney]
- **PR Firm**: [Firm] | [Contact]

---

## 23. CHECKLISTS

### Breach Response Checklist

**Hour 1: Containment**
- [ ] Lock compromised account(s)
- [ ] Terminate active sessions
- [ ] Block attack vector
- [ ] Preserve evidence
- [ ] Notify Security Officer

**Hour 2-24: Investigation**
- [ ] Assemble response team
- [ ] Scope breach (what ePHI?)
- [ ] Count affected individuals
- [ ] Root cause analysis
- [ ] Risk assessment (notification needed?)
- [ ] Document everything

**Day 2-60: Notification** (if required)
- [ ] Draft notification letter (legal review)
- [ ] Send individual notifications
- [ ] File HHS report (if 500+)
- [ ] Media notification (if 500+ in jurisdiction)
- [ ] Document all notifications

**Day 61+: Recovery**
- [ ] Remediation complete
- [ ] Enhanced monitoring active
- [ ] Post-incident review meeting
- [ ] Lessons learned documented
- [ ] Policies/procedures updated
- [ ] Staff training (if needed)

---

## 24. REFERENCES

- **HIPAA Breach Notification Rule**: 45 CFR §164.400-414
- **HHS Breach Portal**: https://ocrportal.hhs.gov/ocr/breach/
- **HHS Guidance**: https://www.hhs.gov/hipaa/for-professionals/breach-notification/
- **Code**: `src/services/breachDetection.service.js`
- **Code**: `src/models/breachLog.model.js`

---

## 25. APPROVAL

**Reviewed By**: HIPAA Security Officer  
**Approved By**: [CEO/Executive]  
**Date**: October 15, 2025  
**Next Review**: October 15, 2026

---

**CRITICAL**: In case of breach, contact Security Officer immediately. Time is critical for HIPAA compliance.












