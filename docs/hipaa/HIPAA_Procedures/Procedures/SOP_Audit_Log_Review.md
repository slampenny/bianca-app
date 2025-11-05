# Standard Operating Procedure: Audit Log Review
## MyPhoneFriend - HIPAA Compliance

**SOP ID**: HIPAA-SOP-004  
**Version**: 1.0  
**Effective Date**: October 15, 2025  
**Department**: Security / Compliance  
**Owner**: HIPAA Security Officer

---

## 1. PURPOSE

To establish procedures for regular review of audit logs to detect security incidents and ensure HIPAA compliance with §164.308(a)(1)(ii)(D) - Information System Activity Review.

---

## 2. SCOPE

This procedure covers:
- Monthly audit log reviews
- Compliance flag monitoring
- Access pattern analysis
- Breach detection verification
- Incident investigation

---

## 3. REVIEW FREQUENCY

| Review Type | Frequency | Owner | Documentation |
|-------------|-----------|-------|---------------|
| Automated monitoring | Continuous | System | Breach detection alerts |
| High-risk actions | Daily | Security Officer | Daily review log |
| Failed logins | Daily | Security Officer | Failed login report |
| Complete audit review | Monthly | Security Officer | Monthly audit report |
| Compliance audit | Quarterly | External auditor | Audit report |

---

## 4. DAILY REVIEW PROCEDURE

### 4.1 High-Risk Action Review

**Every Morning** (15 minutes):

**Step 1: Check Breach Detection Alerts**
```bash
# Check for overnight breaches
mongo "${MONGODB_URL}"

# Query breaches from last 24 hours
db.breachlogs.find({
  detectedAt: { $gte: new Date(Date.now() - 24*60*60*1000) },
  status: { $in: ["INVESTIGATING", "CONFIRMED"] }
}).sort({ detectedAt: -1 })
```

**Step 2: Review Locked Accounts**
```javascript
// Find recently locked accounts
db.caregivers.find({
  accountLocked: true,
  lockedAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
})

// Check why they were locked
db.audit_logs.find({
  action: "ACCOUNT_LOCKED",
  timestamp: { $gte: new Date(Date.now() - 24*60*60*1000) }
})
```

**Step 3: Review High-Risk Actions**
```javascript
// Find actions flagged for review
db.audit_logs.find({
  "complianceFlags.requiresReview": true,
  timestamp: { $gte: new Date(Date.now() - 24*60*60*1000) }
}).sort({ timestamp: -1 })

// High-risk actions include:
// - superAdmin actions
// - Data exports
// - Mass updates
// - Configuration changes
// - Emergency access
```

**Step 4: Review Failed Logins**
```javascript
// Check for unusual failed login patterns
db.audit_logs.aggregate([
  {
    $match: {
      action: "LOGIN_FAILED",
      timestamp: { $gte: new Date(Date.now() - 24*60*60*1000) }
    }
  },
  {
    $group: {
      _id: "$userEmail",
      failures: { $sum: 1 },
      ips: { $addToSet: "$ipAddress" }
    }
  },
  {
    $match: { failures: { $gte: 3 } }  // 3+ failures
  }
])
```

**Step 5: Document Findings**
```
Daily Review Log - [Date]
-------------------------
Breaches Detected: [count]
Accounts Locked: [count]
High-Risk Actions: [count]
Failed Logins: [count]
Issues Requiring Attention: [list]
Actions Taken: [list]
```

**Time**: 10-15 minutes  
**Document**: Daily review log (simple notes)

---

## 5. MONTHLY AUDIT LOG REVIEW

### 5.1 Comprehensive Monthly Review

**First Monday of Each Month** (2-3 hours):

**Step 1: Generate Monthly Statistics**
```javascript
// MongoDB query for monthly stats
const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

// Total actions
db.audit_logs.countDocuments({
  timestamp: { $gte: startOfMonth, $lte: endOfMonth }
})

// Breakdown by action type
db.audit_logs.aggregate([
  {
    $match: {
      timestamp: { $gte: startOfMonth, $lte: endOfMonth }
    }
  },
  {
    $group: {
      _id: "$action",
      count: { $sum: 1 }
    }
  },
  {
    $sort: { count: -1 }
  }
])

// Breakdown by resource type
db.audit_logs.aggregate([
  {
    $match: {
      timestamp: { $gte: startOfMonth, $lte: endOfMonth }
    }
  },
  {
    $group: {
      _id: "$resource",
      count: { $sum: 1 }
    }
  },
  {
    $sort: { count: -1 }
  }
])

// Success vs. failure rate
db.audit_logs.aggregate([
  {
    $match: {
      timestamp: { $gte: startOfMonth, $lte: endOfMonth }
    }
  },
  {
    $group: {
      _id: "$outcome",
      count: { $sum: 1 }
    }
  }
])
```

**Expected Output**:
```
Monthly Audit Statistics
------------------------
Total Actions: 15,432
  - READ: 12,458
  - CREATE: 1,234
  - UPDATE: 1,456
  - DELETE: 45
  - LOGIN: 239
  
Resources Accessed:
  - patient: 8,456
  - conversation: 5,234
  - medicalAnalysis: 1,234
  - caregiver: 508
  
Success Rate: 99.2%
Failures: 123 (0.8%)
```

---

### 5.2 Review ePHI Access Patterns

**Step 2: Identify Unusual Access Patterns**

**Query 1: Users with High Access Volume**
```javascript
// Find users accessing 100+ patients/month
db.audit_logs.aggregate([
  {
    $match: {
      resource: "patient",
      action: { $in: ["READ", "UPDATE"] },
      timestamp: { $gte: startOfMonth, $lte: endOfMonth }
    }
  },
  {
    $group: {
      _id: "$userId",
      patientsAccessed: { $addToSet: "$resourceId" },
      totalAccess: { $sum: 1 }
    }
  },
  {
    $project: {
      userId: "$_id",
      uniquePatients: { $size: "$patientsAccessed" },
      totalAccess: 1
    }
  },
  {
    $match: { uniquePatients: { $gte: 100 } }
  }
])

// Investigation: Is this normal for their role?
// - Care coordinator: High volume expected
// - Regular staff: Investigate if unusual
```

**Query 2: Off-Hours Access**
```javascript
// Find ePHI access between 10 PM - 7 AM
db.audit_logs.find({
  resource: { $in: ["patient", "conversation", "medicalAnalysis"] },
  "complianceFlags.phiAccessed": true,
  timestamp: { $gte: startOfMonth, $lte: endOfMonth },
  $expr: {
    $or: [
      { $gte: [{ $hour: "$timestamp" }, 22] },  // After 10 PM
      { $lt: [{ $hour: "$timestamp" }, 7] }     // Before 7 AM
    ]
  }
}).sort({ timestamp: -1 })

// Investigation: Verify legitimate business need
// - On-call staff: Normal
// - Daytime-only staff: Investigate
```

**Query 3: Rapid Data Access**
```javascript
// Find instances of 20+ records accessed in 1 minute
db.audit_logs.aggregate([
  {
    $match: {
      resource: { $in: ["patient", "conversation"] },
      action: "READ",
      timestamp: { $gte: startOfMonth, $lte: endOfMonth }
    }
  },
  {
    $bucket: {
      groupBy: {
        userId: "$userId",
        minute: {
          $dateTrunc: { date: "$timestamp", unit: "minute" }
        }
      },
      boundaries: [0, 20, 50, 100, 1000],
      default: "Other"
    }
  }
])

// Investigation: Potential data exfiltration?
```

---

### 5.3 Review Compliance Flags

**Step 3: High-Risk Actions**
```javascript
// Actions flagged for review
db.audit_logs.find({
  "complianceFlags.highRiskAction": true,
  timestamp: { $gte: startOfMonth, $lte: endOfMonth }
}).sort({ timestamp: -1 })

// Common high-risk actions:
// - Export operations
// - Mass data access
// - System configuration changes
// - Emergency access usage
// - superAdmin actions

// For each: Verify authorization and business need
```

---

### 5.4 Failed Access Attempts

**Step 4: Investigate Failures**
```javascript
// All failed actions this month
db.audit_logs.find({
  outcome: "FAILURE",
  timestamp: { $gte: startOfMonth, $lte: endOfMonth }
}).sort({ timestamp: -1 })

// Group by user to find patterns
db.audit_logs.aggregate([
  {
    $match: {
      outcome: "FAILURE",
      timestamp: { $gte: startOfMonth, $lte: endOfMonth }
    }
  },
  {
    $group: {
      _id: { userId: "$userId", action: "$action" },
      count: { $sum: 1 },
      errors: { $addToSet: "$errorMessage" }
    }
  },
  {
    $sort: { count: -1 }
  }
])

// Investigation:
// - Multiple failures same user: Training issue?
// - Multiple failures same action: System issue?
// - Authentication failures: Security concern?
```

---

### 5.5 MFA and Security Events

**Step 5: Review Security Events**
```javascript
// MFA changes
db.audit_logs.find({
  action: { $in: ["MFA_ENABLED", "MFA_DISABLED", "MFA_SETUP_INITIATED"] },
  timestamp: { $gte: startOfMonth, $lte: endOfMonth }
}).sort({ timestamp: -1 })

// Verify: Were these authorized?

// Password changes
db.audit_logs.find({
  action: { $in: ["PASSWORD_CHANGED", "PASSWORD_RESET"] },
  timestamp: { $gte: startOfMonth, $lte: endOfMonth }
}).sort({ timestamp: -1 })

// Account locks/unlocks
db.audit_logs.find({
  action: { $in: ["ACCOUNT_LOCKED", "ACCOUNT_UNLOCKED"] },
  timestamp: { $gte: startOfMonth, $lte: endOfMonth }
}).sort({ timestamp: -1 })
```

---

### 5.6 Data Export and Download

**Step 6: Review Data Exports**
```javascript
// Export and download operations
db.audit_logs.find({
  action: { $in: ["EXPORT", "DOWNLOAD"] },
  timestamp: { $gte: startOfMonth, $lte: endOfMonth }
}).sort({ timestamp: -1 })

// For each export:
// - Who: User and role
// - What: Resource type and count
// - When: Date and time
// - Why: Business justification (verify with user/manager)
// - Authorized: Check approval (if required)
```

---

## 6. SPECIFIC REVIEW QUERIES

### 6.1 User Activity Review

**Review Specific User**:
```javascript
// All actions by a user
db.audit_logs.find({
  userId: ObjectId("USER_ID"),
  timestamp: { $gte: startOfMonth, $lte: endOfMonth }
}).sort({ timestamp: 1 })

// Summary by action
db.audit_logs.aggregate([
  {
    $match: {
      userId: ObjectId("USER_ID"),
      timestamp: { $gte: startOfMonth, $lte: endOfMonth }
    }
  },
  {
    $group: {
      _id: "$action",
      count: { $sum: 1 }
    }
  }
])

// What patients accessed
db.audit_logs.distinct("resourceId", {
  userId: ObjectId("USER_ID"),
  resource: "patient",
  timestamp: { $gte: startOfMonth, $lte: endOfMonth }
})
```

---

### 6.2 Patient Access Review

**Review Who Accessed a Patient**:
```javascript
// All access to specific patient
db.audit_logs.find({
  resource: "patient",
  resourceId: "PATIENT_ID",
  timestamp: { $gte: startOfMonth, $lte: endOfMonth }
}).populate('userId').sort({ timestamp: 1 })

// Group by user
db.audit_logs.aggregate([
  {
    $match: {
      resource: "patient",
      resourceId: "PATIENT_ID",
      timestamp: { $gte: startOfMonth, $lte: endOfMonth }
    }
  },
  {
    $group: {
      _id: "$userId",
      actions: { $push: "$action" },
      accessCount: { $sum: 1 },
      firstAccess: { $min: "$timestamp" },
      lastAccess: { $max: "$timestamp" }
    }
  }
])

// Verify: Are all these users authorized for this patient?
```

---

### 6.3 Resource Access Timeline

**Timeline of Access to Resource**:
```javascript
// Useful for investigating suspicious activity
db.audit_logs.find({
  resource: "patient",
  resourceId: "PATIENT_ID"
}).sort({ timestamp: 1 }).pretty()

// Shows complete access history:
// - Who accessed
// - What they did (READ, UPDATE, etc.)
// - When they did it
// - What was the outcome
// - What IP address
```

---

## 7. AUDIT LOG INTEGRITY VERIFICATION

### 7.1 Monthly Chain Integrity Check

**Purpose**: Verify audit logs haven't been tampered with

**Step 1: Run Verification**
```javascript
// Use built-in verification function
const verification = await AuditLog.verifyChainIntegrity();

// Returns:
// {
//   total: 15432,
//   verified: 15432,
//   failed: 0,
//   errors: []
// }
```

**Step 2: Investigate Failures**
```javascript
// If failed > 0, investigate
verification.errors.forEach(error => {
  console.log(`Log ${error.logId} failed verification:`);
  console.log(`  Expected hash: ${error.expectedHash}`);
  console.log(`  Actual hash: ${error.actualHash}`);
  console.log(`  Timestamp: ${error.timestamp}`);
});

// This indicates potential tampering or data corruption
// Escalate to Security Officer immediately
```

**Documentation**:
- Date of verification
- Total logs verified
- Failed count
- Actions taken if failures found

---

## 8. MONTHLY REPORT GENERATION

### 8.1 Generate Compliance Report

**Automated Report**:
```javascript
// Use built-in report generation
const report = await AuditLog.generateAuditReport(
  startOfMonth,
  endOfMonth
);

// Returns comprehensive report:
{
  period: { start: Date, end: Date },
  summary: {
    totalActions: 15432,
    uniqueUsers: 45,
    uniquePatients: 234,
    successRate: 99.2,
    phiAccessCount: 12458
  },
  byAction: { ... },
  byResource: { ... },
  byUser: { ... },
  complianceFlags: {
    highRiskActions: 23,
    requiresReview: 12,
    phiAccessed: 12458
  },
  securityEvents: {
    failedLogins: 56,
    accountLocks: 2,
    breaches: 1,
    mfaChanges: 5
  }
}
```

---

### 8.2 Monthly Audit Report Template

**Report Structure**:

```markdown
# Monthly Audit Log Review
## [Month Year]

### 1. Executive Summary
- Total audit log entries: [count]
- ePHI access events: [count]
- Security incidents: [count]
- Compliance issues: [count]
- Overall assessment: [Green/Yellow/Red]

### 2. Activity Overview
- Unique users: [count]
- Patient records accessed: [count]
- Conversations accessed: [count]
- Medical analyses accessed: [count]

### 3. Security Events
- Failed login attempts: [count]
- Account lockouts: [count]
- Breach detection alerts: [count]
- MFA changes: [count]
- Password changes: [count]

### 4. Compliance Findings
- High-risk actions: [count] - [All justified? Y/N]
- Off-hours access: [count] - [Authorized? Y/N]
- Unusual access patterns: [count] - [Investigated? Y/N]
- Policy violations: [count] - [Resolved? Y/N]

### 5. Issues Identified
[List any security concerns, policy violations, or unusual activity]

### 6. Actions Taken
[List any actions taken in response to findings]

### 7. Recommendations
[Suggestions for policy or procedure improvements]

### 8. Next Month's Focus
[Areas to monitor more closely]

---
Reviewed by: [Security Officer Name]
Date: [Date]
Signature: __________________
```

**Template**: `../Templates/Monthly_Audit_Report.md`

---

## 9. SPECIFIC REVIEW SCENARIOS

### 9.1 New User Review

**For Each New User This Month**:
```javascript
// Find newly created users
db.caregivers.find({
  createdAt: { $gte: startOfMonth, $lte: endOfMonth }
})

// Review their access patterns
// For each new user:
db.audit_logs.find({
  userId: ObjectId("NEW_USER_ID")
}).sort({ timestamp: 1 })

// Checklist:
// - [ ] First login successful?
// - [ ] MFA enrolled (if admin)?
// - [ ] Access appropriate for role?
// - [ ] Training completed?
// - [ ] No unusual activity?
```

---

### 9.2 Terminated User Review

**Verify Access Was Revoked**:
```javascript
// Find users marked deleted
db.caregivers.find({
  deleted: true,
  deletedAt: { $gte: startOfMonth, $lte: endOfMonth }
})

// Check for any access AFTER termination
db.audit_logs.find({
  userId: ObjectId("TERMINATED_USER_ID"),
  timestamp: { $gte: terminationDate }
})

// Should be ZERO results
// If any found: Security incident!
```

---

### 9.3 Role Change Review

**Verify All Role Changes Were Authorized**:
```javascript
// Find role changes via audit logs
db.audit_logs.find({
  action: "UPDATE",
  resource: "caregiver",
  outcome: "SUCCESS",
  timestamp: { $gte: startOfMonth, $lte: endOfMonth }
})

// For each role change:
// - [ ] Approval documented?
// - [ ] Appropriate for user's job function?
// - [ ] Minimum necessary principle followed?
// - [ ] MFA enrolled if elevated to admin?
```

---

## 10. SUSPICIOUS ACTIVITY INVESTIGATION

### 10.1 Indicators of Suspicious Activity

**Look For**:
1. **Access outside normal hours**
2. **Accessing unassigned patients**
3. **Mass data access** (many records quickly)
4. **Access shortly before resignation**
5. **Multiple failed login attempts**
6. **Unusual IP addresses**
7. **Access from multiple locations simultaneously**

---

### 10.2 Investigation Procedure

**When Suspicious Activity Found**:

**Step 1: Gather Evidence**
```javascript
// Collect all activity for user in suspicious period
db.audit_logs.find({
  userId: ObjectId("SUSPECT_USER_ID"),
  timestamp: {
    $gte: new Date("2025-10-01T22:00:00"),
    $lte: new Date("2025-10-02T02:00:00")
  }
}).sort({ timestamp: 1 })

// What patients were accessed?
const patientsAccessed = db.audit_logs.distinct("resourceId", {
  userId: ObjectId("SUSPECT_USER_ID"),
  resource: "patient",
  timestamp: { $gte: suspiciousStartTime, $lte: suspiciousEndTime }
});

// Were they authorized for these patients?
db.patients.find({
  _id: { $in: patientsAccessed },
  caregivers: { $in: [ObjectId("SUSPECT_USER_ID")] }
})
// If count < patientsAccessed.length, unauthorized access occurred
```

**Step 2: Interview User**
1. Contact user (if not malicious intent suspected)
2. Ask for explanation
3. Verify their story against audit logs
4. Document conversation

**Step 3: Decision**
- **Legitimate**: Document justification, close investigation
- **Policy Violation**: Disciplinary action, retraining
- **Security Breach**: Follow SOP_Breach_Response.md

**Step 4: Document**
- Investigation notes
- Evidence collected
- User explanation
- Decision and action taken
- Preventive measures

---

## 11. AUTOMATED MONITORING VERIFICATION

### 11.1 Verify Breach Detection is Working

**Monthly Check**:
```javascript
// Verify breach detection service is running
// Check for recent detection runs
db.audit_logs.find({
  action: "BREACH_DETECTED",
  timestamp: { $gte: new Date(Date.now() - 7*24*60*60*1000) }
})

// If no BREACH_DETECTED logs in 7 days:
// - Either very secure (good) OR
// - Detection not running (bad - investigate!)

// Check breach detection is actually running:
// Look for application logs showing detection cycles
```

**Verify Detection Rules**:
```javascript
// 1. Check for failed login detections
db.breachlogs.find({
  type: "excessive_failed_logins",
  detectedAt: { $gte: startOfMonth, $lte: endOfMonth }
})

// 2. Check for data access volume detections
db.breachlogs.find({
  type: "unusual_data_access_volume",
  detectedAt: { $gte: startOfMonth, $lte: endOfMonth }
})

// 3. Check for rapid access detections
db.breachlogs.find({
  type: "data_exfiltration_attempt",
  detectedAt: { $gte: startOfMonth, $lte: endOfMonth }
})

// 4. Check for off-hours detections
db.breachlogs.find({
  type: "off_hours_access",
  detectedAt: { $gte: startOfMonth, $lte: endOfMonth }
})
```

---

## 12. COMPLIANCE CHECKLIST

### 12.1 Monthly Audit Review Checklist

Use this checklist for each monthly review:

**Statistics**:
- [ ] Total audit log entries counted
- [ ] Breakdown by action type generated
- [ ] Breakdown by resource type generated
- [ ] Success/failure rate calculated
- [ ] Trends compared to previous months

**User Review**:
- [ ] New users reviewed (all have appropriate access)
- [ ] Terminated users reviewed (all access revoked)
- [ ] Role changes reviewed (all authorized)
- [ ] Admin accounts reviewed (all have MFA)
- [ ] Inactive accounts identified (>90 days no login)

**Access Patterns**:
- [ ] High-volume access investigated
- [ ] Off-hours access reviewed
- [ ] Rapid data access reviewed
- [ ] Failed access attempts investigated
- [ ] Unusual patterns documented

**Security Events**:
- [ ] All breaches investigated
- [ ] All account locks reviewed
- [ ] All MFA changes verified
- [ ] All password resets appropriate
- [ ] All high-risk actions justified

**Compliance**:
- [ ] Audit log integrity verified
- [ ] Automated monitoring confirmed active
- [ ] Breach detection tested
- [ ] Session timeout verified working
- [ ] Minimum necessary filtering confirmed

**Documentation**:
- [ ] Monthly report completed
- [ ] Issues documented
- [ ] Actions tracked
- [ ] Report filed securely
- [ ] Management briefed (if significant findings)

---

## 13. ESCALATION CRITERIA

### 13.1 When to Escalate Immediately

**Escalate to Security Officer if**:
- Unauthorized ePHI access detected
- Potential breach identified
- Repeated policy violations by same user
- System compromise suspected
- Audit log integrity failure
- Unusual access by administrator
- Mass data access unexplained

**Escalate to Management if**:
- Security breach confirmed
- Pattern of policy violations
- System-wide security issue
- Regulatory compliance risk
- Major security incident

---

## 14. TOOLS AND SCRIPTS

### 14.1 Helpful MongoDB Queries

**Save these for quick access**:

```javascript
// === DAILY REVIEW QUERIES ===

// Today's high-risk actions
db.audit_logs.find({
  "complianceFlags.highRiskAction": true,
  timestamp: { $gte: new Date(new Date().setHours(0,0,0,0)) }
})

// Today's failed logins
db.audit_logs.find({
  action: "LOGIN_FAILED",
  timestamp: { $gte: new Date(new Date().setHours(0,0,0,0)) }
})

// Currently locked accounts
db.caregivers.find({ accountLocked: true })


// === MONTHLY REVIEW QUERIES ===

// Top 10 most active users
db.audit_logs.aggregate([
  {
    $match: {
      timestamp: { $gte: startOfMonth, $lte: endOfMonth }
    }
  },
  {
    $group: {
      _id: "$userId",
      actions: { $sum: 1 }
    }
  },
  {
    $sort: { actions: -1 }
  },
  {
    $limit: 10
  }
])

// Most accessed patients
db.audit_logs.aggregate([
  {
    $match: {
      resource: "patient",
      timestamp: { $gte: startOfMonth, $lte: endOfMonth }
    }
  },
  {
    $group: {
      _id: "$resourceId",
      accessCount: { $sum: 1 }
    }
  },
  {
    $sort: { accessCount: -1 }
  },
  {
    $limit: 20
  }
])

// Access by hour of day (find patterns)
db.audit_logs.aggregate([
  {
    $match: {
      timestamp: { $gte: startOfMonth, $lte: endOfMonth }
    }
  },
  {
    $group: {
      _id: { $hour: "$timestamp" },
      count: { $sum: 1 }
    }
  },
  {
    $sort: { _id: 1 }
  }
])
```

---

### 14.2 Audit Review Script

**Create**: `scripts/audit-review.js`

```javascript
#!/usr/bin/env node

const mongoose = require('mongoose');
const { AuditLog, BreachLog } = require('../src/models');

async function monthlyAuditReview() {
  await mongoose.connect(process.env.MONGODB_URL);
  
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  
  console.log(`\n=== Monthly Audit Review: ${startOfMonth.toLocaleDateString()} to ${endOfMonth.toLocaleDateString()} ===\n`);
  
  // Generate automated report
  const report = await AuditLog.generateAuditReport(startOfMonth, endOfMonth);
  
  // Display summary
  console.log('Summary:');
  console.log(`  Total Actions: ${report.summary.totalActions}`);
  console.log(`  Unique Users: ${report.summary.uniqueUsers}`);
  console.log(`  Success Rate: ${report.summary.successRate}%`);
  console.log(`  ePHI Access: ${report.summary.phiAccessCount}`);
  
  // Security events
  console.log('\nSecurity Events:');
  console.log(`  Failed Logins: ${report.securityEvents.failedLogins}`);
  console.log(`  Account Locks: ${report.securityEvents.accountLocks}`);
  console.log(`  Breaches: ${report.securityEvents.breaches}`);
  
  // High-risk actions
  console.log('\nHigh-Risk Actions:');
  const highRisk = await AuditLog.find({
    "complianceFlags.highRiskAction": true,
    timestamp: { $gte: startOfMonth, $lte: endOfMonth }
  }).populate('userId', 'name email role');
  
  highRisk.forEach(action => {
    console.log(`  ${action.timestamp.toISOString()} - ${action.userId.email} - ${action.action} on ${action.resource}`);
  });
  
  // Integrity check
  console.log('\nAudit Log Integrity:');
  const integrity = await AuditLog.verifyChainIntegrity();
  console.log(`  Total Logs: ${integrity.total}`);
  console.log(`  Verified: ${integrity.verified}`);
  console.log(`  Failed: ${integrity.failed}`);
  if (integrity.failed > 0) {
    console.log('  ⚠️  INTEGRITY ISSUES FOUND - INVESTIGATE IMMEDIATELY');
  }
  
  // Save report
  const fs = require('fs');
  fs.writeFileSync(
    `audit-reports/monthly-${startOfMonth.toISOString().slice(0,7)}.json`,
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n✅ Monthly audit review complete');
  console.log(`Report saved to: audit-reports/monthly-${startOfMonth.toISOString().slice(0,7)}.json`);
  
  process.exit(0);
}

monthlyAuditReview().catch(console.error);
```

**Usage**:
```bash
node scripts/audit-review.js > audit-reports/monthly-$(date +%Y-%m)-summary.txt
```

---

## 15. AUDIT LOG RETENTION

### 15.1 Retention Policy

**HIPAA Requirement**: 7 years minimum

**Implementation**: 
- Automatic via MongoDB TTL index
- Index: `{ timestamp: 1 }, { expireAfterSeconds: 220752000 }`
- 220752000 seconds = 2555 days = 7 years

**Verification**:
```javascript
// Check TTL index exists
db.audit_logs.getIndexes()

// Should show:
// {
//   "key": { "timestamp": 1 },
//   "expireAfterSeconds": 220752000
// }
```

---

### 15.2 Archive Before Deletion

**Before Logs Expire** (6 years, 11 months):
1. Export to long-term storage
2. Compress and encrypt
3. Store in Glacier Deep Archive
4. Document archive location
5. Verify retrieval procedure

**Why**: May need for legal/compliance purposes beyond 7 years

---

## 16. PATIENT ACCESS REQUESTS

### 16.1 Patient Right to Accounting of Disclosures

**When Patient Requests**: "Who accessed my records?"

**Procedure**:
```javascript
// Generate disclosure report for patient
const patientId = "PATIENT_ID";
const sixYearsAgo = new Date(Date.now() - 6*365*24*60*60*1000);

// Find all access to patient's data
const disclosures = await AuditLog.find({
  $or: [
    { resource: "patient", resourceId: patientId },
    { resource: "conversation", resourceId: { $in: patientConversationIds } },
    { resource: "medicalAnalysis", resourceId: { $in: patientAnalysisIds } }
  ],
  timestamp: { $gte: sixYearsAgo },
  outcome: "SUCCESS"
}).populate('userId', 'name email role').sort({ timestamp: -1 });

// Format for patient
disclosures.forEach(log => {
  console.log(`${log.timestamp.toLocaleDateString()}: ${log.userId.name} (${log.userId.role}) - ${log.action}`);
});
```

**Provide to Patient**:
- Date of access
- Type of access (READ, UPDATE, etc.)
- Person who accessed (name and role, not email)
- Purpose (healthcare operations, treatment, etc.)

**Exclude**: Treatment, payment, operations (unless patient specifically requests)

---

## 17. REPORTING TO MANAGEMENT

### 17.1 Monthly Executive Summary

**To**: CEO, CTO, Board (if applicable)  
**When**: First Monday after month end

**One-Page Summary**:
```
HIPAA Compliance - Monthly Summary
===================================
Period: [Month Year]
Prepared by: [Security Officer]

Overall Status: ✅ COMPLIANT

Security Metrics:
- Audit logs: 15,432 entries
- Breach alerts: 2 (both false positives)
- Account locks: 3 (all legitimate)
- Failed logins: 56 (0.4% of total logins)

Access Control:
- New users: 5 (all properly authorized)
- Terminated users: 2 (access revoked same day)
- Role changes: 3 (all approved)
- MFA enrollment: 95% for admins

Compliance Activities:
- Daily reviews: 30/30 completed
- Monthly audit: Completed [Date]
- Integrity check: PASSED
- Backup tests: 4/4 passed

Issues:
- None requiring management attention

Recommendations:
- Consider MFA requirement for all staff (currently optional)

Next Month's Focus:
- Quarterly DR drill scheduled
- External audit preparation
```

---

### 17.2 Quarterly Board Report

**More Detailed**:
- Compliance status vs. industry standards
- Security incidents and responses
- Audit findings and remediation
- Cost of security program
- ROI of security investments
- Upcoming compliance initiatives

---

## 18. CONTINUOUS IMPROVEMENT

### 18.1 After Each Review

**Questions to Ask**:
1. Are we detecting what we should?
2. Are there patterns we're missing?
3. Are policies being followed?
4. Are technical controls effective?
5. Do procedures need updating?
6. Is training adequate?

**Action Items**:
- Update detection rules if gaps found
- Enhance monitoring if blind spots exist
- Revise policies if outdated
- Additional training if violations recurring

---

### 18.2 Metrics Trending

**Track Month-over-Month**:
- Total activity (growing with user base?)
- Failed login rate (decreasing = better training?)
- Breach alerts (decreasing = better security?)
- Policy violations (decreasing = better awareness?)
- MFA enrollment (increasing toward 100%?)

**Goal**: Continuous improvement in security posture

---

## 19. SPECIAL REVIEWS

### 19.1 Post-Incident Review

**After Security Incident**:
1. Review all audit logs related to incident
2. Reconstruct complete timeline
3. Identify how breach occurred
4. Verify detection and response
5. Update procedures to prevent recurrence

---

### 19.2 Compliance Audit Preparation

**Before External Audit**:
1. Generate reports for past year
2. Verify all monthly reviews completed
3. Compile all documentation
4. Test audit log integrity
5. Prepare evidence package
6. Review with legal

---

## 20. TOOLS

### 20.1 MongoDB Compass

**GUI Tool for Audit Log Review**:
1. Install MongoDB Compass
2. Connect to database
3. Navigate to audit_logs collection
4. Use filters for visual review
5. Export results for documentation

**Filters**:
- Date range: Last 30 days
- Outcome: FAILURE
- High risk: complianceFlags.highRiskAction = true

---

### 20.2 Audit Log Analysis Tool (Future)

**Consider Implementing**:
- Web dashboard for audit log review
- Visualization of access patterns
- Automated anomaly detection
- One-click report generation
- Exportable compliance reports

**Estimated Effort**: 2-3 weeks development

---

## 21. REFERENCES

- **HIPAA §164.308(a)(1)(ii)(D)**: Information System Activity Review
- **HIPAA §164.312(b)**: Audit Controls
- **Code**: `src/models/auditLog.model.js`
- **Template**: `../Templates/Monthly_Audit_Report.md`
- **Related**: `SOP_Breach_Response.md`

---

## 22. APPROVAL

**Reviewed By**: HIPAA Security Officer  
**Approved By**: CTO  
**Date**: October 15, 2025  
**Next Review**: October 15, 2026

---

**For Questions**: Contact HIPAA Security Officer at security@myphonefriend.com

**Remember**: Audit log review is required by HIPAA. Missing reviews = compliance violation.












