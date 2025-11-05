# Standard Operating Procedure: User Access Management
## MyPhoneFriend - HIPAA Compliance

**SOP ID**: HIPAA-SOP-001  
**Version**: 1.0  
**Effective Date**: October 15, 2025  
**Department**: IT / Security  
**Owner**: HIPAA Security Officer

---

## 1. PURPOSE

To establish procedures for granting, modifying, and revoking user access to systems containing ePHI in compliance with HIPAA §164.308(a)(3) and §164.308(a)(4).

---

## 2. SCOPE

This procedure applies to:
- All employees requiring access to the MyPhoneFriend application
- Contractors and temporary staff
- Business associates requiring system access
- All role assignments (staff, orgAdmin, superAdmin)

---

## 3. ROLES AND RESPONSIBILITIES

- **Security Officer**: Approves all access requests
- **Technical Lead**: Implements access changes in system
- **Hiring Manager**: Initiates access requests for new hires
- **HR**: Notifies IT of terminations

---

## 4. PROCEDURE: GRANTING NEW ACCESS

### 4.1 New Employee Onboarding

**Prerequisites**:
- [ ] Background check completed (if required by role)
- [ ] Employment contract signed
- [ ] HIPAA training scheduled

**Step 1: Access Request Initiation**
1. Hiring manager completes Access Request Form
2. Specifies required role level:
   - `staff` - Basic patient access
   - `orgAdmin` - Organization management
   - `superAdmin` - Full system access (requires approval)
3. Submits form to Security Officer

**Step 2: Security Officer Review**
1. Verify employee information
2. Confirm role appropriateness (minimum necessary)
3. Check background check status (if applicable)
4. Approve or deny request
5. Document decision

**Step 3: Account Creation**
```bash
# Technical Lead executes:
cd bianca-app-backend

# Create new user (via API or database)
curl -X POST https://api.myphonefriend.com/v1/caregivers \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@organization.com",
    "role": "staff",
    "org": "ORGANIZATION_ID",
    "phone": "555-123-4567"
  }'

# System automatically:
# - Sends invitation email
# - Creates audit log entry
# - Sets initial status to 'invited'
```

**Step 4: User Activation**
1. User receives invitation email
2. User clicks link to set password
3. Password must meet requirements:
   - Minimum 8 characters
   - Contains letters and numbers
4. User verifies email address
5. Account status changes to 'unverified' → 'staff'

**Step 5: MFA Enrollment** (Required for admins)
```bash
# If user is orgAdmin or superAdmin:
1. User logs in
2. Redirected to MFA setup page
3. Scans QR code with authenticator app
4. Saves 10 backup codes securely
5. Verifies with test code
6. MFA enabled, account fully active
```

**Step 6: Documentation**
1. Access request form filed
2. Account creation logged in AuditLog
3. MFA enrollment logged (if applicable)
4. Training scheduled

**Timeline**: Complete within 1 business day of approval

---

### 4.2 Role Change / Permission Modification

**When Required**:
- Promotion or role change
- Additional permissions needed
- Organization transfer

**Step 1: Change Request**
1. Manager submits change request
2. Justification required (business need)
3. Minimum necessary principle evaluated

**Step 2: Security Officer Review**
1. Verify business justification
2. Check if role appropriate
3. Approve or deny
4. Document decision

**Step 3: Implementation**
```bash
# Update user role
curl -X PATCH https://api.myphonefriend.com/v1/caregivers/USER_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "orgAdmin"
  }'

# System automatically:
# - Updates permissions
# - Creates audit log entry
# - Applies new access controls (minimum necessary filtering)
```

**Step 4: Notification**
1. User notified of role change
2. Manager notified of completion
3. If admin role: MFA enrollment required

**Step 5: Documentation**
1. Change request filed
2. Role change logged in AuditLog
3. User permissions updated

---

## 5. PROCEDURE: TEMPORARY ACCESS

### 5.1 Temporary Elevated Access

**Use Case**: Support staff needs temporary admin access

**Step 1: Request**
1. Submit request with:
   - Reason for elevated access
   - Duration needed (maximum 7 days)
   - Specific tasks requiring access
2. Manager approval required

**Step 2: Security Officer Approval**
1. Verify business need
2. Assess risk
3. Approve with conditions
4. Set expiration date

**Step 3: Grant Access**
1. Temporarily elevate role
2. Set automatic expiration
3. Enable enhanced monitoring
4. Notify user of responsibilities

**Step 4: Monitoring**
1. All actions logged with `highRiskAction: true`
2. Security Officer reviews access daily
3. Automatic notifications of PHI access

**Step 5: Revocation**
1. Access automatically expires
2. Or manually revoked when task complete
3. Audit log review within 24 hours
4. Report any unusual activity

---

## 6. PROCEDURE: EMERGENCY ACCESS

### 6.1 Break-Glass Access

**When Used**: Production emergencies requiring immediate access

**Step 1: Emergency Declared**
1. Technical lead declares emergency
2. Documents emergency nature
3. Notifies Security Officer (even if after-hours)

**Step 2: Break-Glass Account Use**
```bash
# Use emergency superAdmin account
# Credentials stored in AWS Secrets Manager
# Access: "emergency-admin@myphonefriend.com"

# All actions automatically:
# - Logged with complianceFlags.highRiskAction = true
# - Trigger immediate Security Officer notification
# - Flagged for review
```

**Step 3: Emergency Response**
1. Resolve emergency issue
2. Document all actions taken
3. Restore normal operations
4. Revoke break-glass access

**Step 4: Post-Emergency Review**
1. Security Officer reviews all actions (within 24 hours)
2. Incident report completed
3. Actions justified
4. No unauthorized ePHI access
5. Lessons learned documented

**Documentation**: 
- Emergency access form
- Incident report
- Post-incident review

---

## 7. PROCEDURE: ACCESS REVOCATION

### 7.1 Employee Termination

**Immediate Actions** (within 1 hour of notification):

```bash
# Step 1: Disable account
curl -X PATCH https://api.myphonefriend.com/v1/caregivers/USER_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountLocked": true,
    "lockedReason": "Employee termination"
  }'

# Step 2: Revoke all active sessions
# (Automatic via account lock - sessions expire immediately)

# Step 3: Disable MFA
# (If needed for account cleanup)
```

**Checklist**:
- [ ] Account disabled in production
- [ ] Account disabled in staging
- [ ] MFA devices removed
- [ ] API keys revoked
- [ ] VPN access removed
- [ ] Physical access badges collected
- [ ] Company devices collected
- [ ] Email forwarding set up (if needed)
- [ ] Files transferred to manager
- [ ] Audit log reviewed for final 30 days

**Timeline**: All access revoked within 1 hour of HR notification

**Documentation**:
- Termination checklist completed
- Access revocation logged in AuditLog
- Final access review report
- Equipment return form

---

### 7.2 Contractor End of Engagement

**30 Days Before End**:
- [ ] Manager notified of upcoming termination
- [ ] Knowledge transfer planned
- [ ] Access review scheduled

**Final Day**:
- [ ] Access revoked (same as employee termination)
- [ ] BAA termination procedures (if applicable)
- [ ] Data return/destruction certified
- [ ] Final access audit

---

### 7.3 Long-Term Leave (>30 days)

**Option 1: Disable Account**
- Account locked
- Access removed
- Re-enabled upon return

**Option 2: Maintain Read-Only Access**
- Role downgraded to minimum necessary
- MFA still required
- Enhanced monitoring
- Approval from Security Officer required

---

## 8. PROCEDURE: ACCESS REVIEWS

### 8.1 Quarterly Access Audit

**Frequency**: Every 3 months  
**Owner**: Security Officer

**Steps**:
1. Generate list of all active users
```bash
# Query all active caregivers
db.caregivers.find({ 
  deleted: { $ne: true },
  accountLocked: false 
}).forEach(user => {
  print(`${user.email} - ${user.role} - Last login: ${user.lastLogin}`);
});
```

2. Review each user:
   - [ ] Still employed?
   - [ ] Role still appropriate?
   - [ ] Last login date reasonable?
   - [ ] MFA enabled (if admin)?
   - [ ] Any security concerns?

3. Remove unnecessary access:
   - Inactive accounts (>90 days no login)
   - Terminated employees missed in offboarding
   - Over-privileged accounts

4. Document findings:
   - Users reviewed: [count]
   - Access revoked: [count]
   - Role changes: [count]
   - Issues found: [list]

**Output**: Quarterly Access Audit Report

---

### 8.2 Monthly Privilege Review

Review superAdmin and orgAdmin accounts:
1. List all admin accounts
2. Verify business need for admin access
3. Check recent activity
4. Confirm MFA enabled
5. Review audit logs for unusual activity

---

## 9. MINIMUM NECESSARY ACCESS

### 9.1 Role Selection Guidelines

**staff** - Use for:
- Healthcare providers directly caring for patients
- Staff needing to view patient information
- Limited to assigned patients only
- Cannot access full medical records

**orgAdmin** - Use for:
- Organization managers
- Billing administrators
- Care coordinators
- Access to all patients in organization
- Additional administrative functions

**superAdmin** - Use for:
- Technical administrators
- System operations
- Platform administrators
- Full access to all data
- **Require explicit approval**

### 9.2 Access Justification

All access requests must include:
- Business justification
- Specific job function requiring access
- Duration of access needed
- Minimum role that meets the need

**Principle**: Always grant the **minimum necessary** access level.

---

## 10. MONITORING AND AUDIT

### 10.1 Automated Monitoring

**System automatically monitors**:
- Failed login attempts (5+ triggers breach detection)
- Unusual data access patterns (100+ records/hour)
- Rapid data access (20+ records/minute)
- Off-hours access (10 PM - 7 AM)
- Account lockouts
- MFA changes
- Role changes

**Alerts sent to**: Security Officer via AWS SNS

### 10.2 Manual Reviews

**Daily**:
- Review breach detection alerts
- Investigate account lockouts

**Weekly**:
- Review new user accounts
- Review role changes

**Monthly**:
- Complete audit log review
- Generate compliance metrics

**Quarterly**:
- Full access audit
- Privilege review

---

## 11. TECHNICAL IMPLEMENTATION

### 11.1 Access Control System

**Implementation**: 
- JWT-based authentication
- Role-based access control (RBAC) via AccessControl library
- Minimum necessary middleware (field-level filtering)

**Code Reference**:
- `src/config/roles.js` - Role definitions
- `src/middlewares/auth.js` - Authentication middleware
- `src/middlewares/minimumNecessary.js` - Data filtering

### 11.2 Session Management

**Settings**:
- Idle timeout: 15 minutes
- Session tracking: In-memory (scalable to Redis)
- Logout: Manual + automatic

**Code Reference**:
- `src/middlewares/sessionTimeout.js`

### 11.3 Audit Logging

**All access operations logged**:
- User ID, role, IP address
- Action type (CREATE, READ, UPDATE, DELETE)
- Resource accessed (patient, conversation, etc.)
- Timestamp
- Outcome (SUCCESS/FAILURE)

**Code Reference**:
- `src/models/auditLog.model.js`
- `src/middlewares/auditLog.js`

---

## 12. TROUBLESHOOTING

### Issue: User Cannot Log In

**Diagnosis**:
```bash
# Check if account is locked
db.caregivers.findOne({ email: "user@example.com" })

# Check for recent failed logins
db.audit_logs.find({
  userEmail: "user@example.com",
  action: "LOGIN_FAILED"
}).sort({ timestamp: -1 }).limit(10)
```

**Solutions**:
1. **Account Locked**: Unlock via admin panel or database
2. **Wrong Password**: Password reset link
3. **MFA Issues**: Disable MFA temporarily or use backup code
4. **Expired Session**: Clear sessions and retry

---

### Issue: User Needs Access to Additional Patients

**Solution**:
1. Verify business need
2. Check if current role sufficient
3. If staff role: Assign to specific patients
4. If need broader access: Consider role change to orgAdmin

---

### Issue: Suspicious Activity Detected

**Immediate Actions**:
1. Review breach detection alert
2. Check audit logs for user's recent activity
3. If confirmed suspicious: Lock account immediately
4. Contact user to verify activity
5. If unauthorized: Follow incident response procedures
6. Document in BreachLog

---

## 13. AUDIT LOG QUERIES

### Check Recent Access for User
```javascript
// Find recent actions by user
db.audit_logs.find({
  userId: ObjectId("USER_ID"),
  timestamp: { $gte: new Date(Date.now() - 24*60*60*1000) }
}).sort({ timestamp: -1 })
```

### Check Who Accessed Specific Patient
```javascript
// Find all access to a patient
db.audit_logs.find({
  resource: "patient",
  resourceId: "PATIENT_ID",
  timestamp: { $gte: new Date(Date.now() - 30*24*60*60*1000) }
}).sort({ timestamp: -1 })
```

### Find Failed Login Attempts
```javascript
// Recent failed logins
db.audit_logs.find({
  action: "LOGIN_FAILED",
  timestamp: { $gte: new Date(Date.now() - 7*24*60*60*1000) }
}).sort({ timestamp: -1 })
```

---

## 14. COMPLIANCE VERIFICATION

### Monthly Access Review Checklist

- [ ] Review all new accounts created this month
- [ ] Verify all role changes were approved
- [ ] Check for accounts with no recent login (>90 days)
- [ ] Confirm all admin accounts have MFA enabled
- [ ] Review temporary access grants (all expired?)
- [ ] Audit superAdmin usage (justify all access)
- [ ] Document findings in monthly report

---

## 15. FORMS AND TEMPLATES

**Use these forms** (in `../Forms/` folder):
- `Access_Request_Form.md` - New user access
- `Access_Change_Form.md` - Role changes
- `Access_Termination_Form.md` - User removal
- `Access_Review_Report.md` - Quarterly audit

---

## 16. ESCALATION

### When to Escalate to Security Officer:
- superAdmin access requests
- Access for contractors/vendors
- Unusual access patterns detected
- Policy violations
- Access disputes
- Emergency access needs

### Contact:
- **Email**: security@myphonefriend.com
- **Phone**: [Security Officer phone]
- **After Hours**: [On-call number]

---

## 17. RELATED DOCUMENTS

- **Policy**: `../Policies/Access_Control_Policy.md`
- **Form**: `../Forms/Access_Request_Form.md`
- **Training**: `../Training/Access_Control_Training.md`

---

## 18. REVISION HISTORY

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Oct 15, 2025 | Initial SOP | Security Officer |

---

## 19. APPROVAL

**Reviewed By**: HIPAA Security Officer  
**Approved By**: [CTO/Executive]  
**Date**: October 15, 2025  
**Next Review**: October 15, 2026

---

**For Questions**: Contact HIPAA Security Officer at security@myphonefriend.com












