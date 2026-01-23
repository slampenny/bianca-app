# Superadmin Login-as-User Feature Design Document

## Overview

This document describes the design and implementation of a secure "Login as User" feature that allows superadmins to access any user account without knowing their password. This feature is critical for customer support, debugging, and administrative tasks while maintaining security, auditability, and HIPAA compliance.

## Table of Contents

1. [Security Requirements](#security-requirements)
2. [Architecture Overview](#architecture-overview)
3. [Implementation Details](#implementation-details)
4. [Audit & Compliance](#audit--compliance)
5. [User Experience](#user-experience)
6. [API Design](#api-design)
7. [Security Considerations](#security-considerations)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Considerations](#deployment-considerations)

---

## Security Requirements

### Core Security Principles

1. **Zero Trust**: Every superadmin action must be authenticated, authorized, and audited
2. **Principle of Least Privilege**: Superadmins can only access accounts they explicitly request
3. **Immutability**: All superadmin actions must be logged and cannot be deleted
4. **Transparency**: Target users should be notified when their account is accessed (optional but recommended)
5. **Time-Limited Access**: Sessions should have shorter expiration times
6. **MFA Requirement**: Superadmins must have MFA enabled and verified before using this feature

### HIPAA Compliance Requirements

- **§164.312(b) - Audit Controls**: All access must be logged
- **§164.308(a)(1)(ii)(D) - Information System Activity Review**: Regular review of superadmin access
- **§164.308(a)(3)(ii)(A) - Log-in Monitoring**: Monitor all superadmin logins
- **§164.312(a)(2)(i) - Unique User Identification**: Maintain clear audit trail of who accessed what

---

## Architecture Overview

### High-Level Flow

```
┌─────────────────┐
│  Superadmin    │
│  (MFA Enabled) │
└────────┬───────┘
         │
         │ 1. Request login-as-user
         ▼
┌─────────────────────────────────┐
│  Authentication Service          │
│  - Verify superadmin MFA         │
│  - Validate target user          │
│  - Create impersonation session   │
└────────┬────────────────────────┘
         │
         │ 2. Generate impersonation token
         ▼
┌─────────────────────────────────┐
│  Token Service                   │
│  - Create special token type     │
│  - Shorter expiration (1 hour)    │
│  - Include impersonation metadata │
└────────┬────────────────────────┘
         │
         │ 3. Return token + audit log
         ▼
┌─────────────────────────────────┐
│  Audit Log Service               │
│  - Log impersonation start       │
│  - Mark as high-risk action       │
│  - Flag for compliance review     │
└─────────────────────────────────┘
```

### Key Components

1. **Impersonation Token**: Special JWT token type that includes:
   - Original superadmin ID
   - Target user ID
   - Impersonation flag
   - Shorter expiration (1 hour vs 7 days)
   - Timestamp of impersonation start

2. **Audit Trail**: Comprehensive logging of:
   - Who (superadmin)
   - What (impersonation action)
   - When (timestamp)
   - Why (reason/justification)
   - Target (user being impersonated)
   - Duration (session length)
   - Actions taken (all API calls made)

3. **Session Management**: 
   - Separate session tracking for impersonation
   - Clear distinction in UI between normal and impersonation sessions
   - Automatic session termination after expiration

---

## Implementation Details

### 1. Database Schema Changes

#### Add to Caregiver Model (Optional Enhancement)
```javascript
// Track if account has been accessed by superadmin
impersonationHistory: [{
  superadminId: ObjectId,
  superadminEmail: String,
  accessedAt: Date,
  reason: String,
  duration: Number, // in seconds
  actionsCount: Number
}]
```

#### New Token Type
```javascript
// In token.model.js or token.service.js
tokenTypes.IMPERSONATION = 'impersonation';
```

### 2. New API Endpoints

#### POST `/v1/auth/superadmin/impersonate`
**Purpose**: Initiate impersonation session

**Request Body**:
```json
{
  "targetUserEmail": "user@example.com",
  "reason": "Customer support - user reported login issues",
  "mfaToken": "123456" // Required if superadmin has MFA enabled
}
```

**Response**:
```json
{
  "tokens": {
    "access": { "token": "...", "expires": "..." },
    "refresh": { "token": "...", "expires": "..." }
  },
  "impersonation": {
    "superadminId": "...",
    "superadminEmail": "...",
    "targetUserId": "...",
    "targetUserEmail": "...",
    "startedAt": "2026-01-23T10:00:00Z",
    "expiresAt": "2026-01-23T11:00:00Z",
    "reason": "..."
  },
  "caregiver": { /* target user data */ }
}
```

**Security Checks**:
- Verify requester is superadmin
- Verify superadmin has MFA enabled and token is valid
- Verify target user exists and is not another superadmin
- Verify target user account is not locked
- Check if superadmin has exceeded daily impersonation limit (configurable)

#### POST `/v1/auth/superadmin/end-impersonation`
**Purpose**: Explicitly end impersonation session

**Request**: No body required (uses token to identify session)

**Response**:
```json
{
  "ended": true,
  "sessionDuration": 1800, // seconds
  "actionsPerformed": 42
}
```

#### GET `/v1/auth/superadmin/impersonation-status`
**Purpose**: Check if current session is impersonation

**Response**:
```json
{
  "isImpersonating": true,
  "superadmin": {
    "id": "...",
    "email": "...",
    "name": "..."
  },
  "targetUser": {
    "id": "...",
    "email": "...",
    "name": "..."
  },
  "startedAt": "...",
  "expiresAt": "...",
  "timeRemaining": 3600 // seconds
}
```

### 3. Token Service Modifications

#### Enhanced Token Generation
```javascript
// In token.service.js
async generateImpersonationTokens(superadmin, targetUser, reason) {
  const accessTokenExpires = moment().add(1, 'hours'); // Shorter expiration
  const refreshTokenExpires = moment().add(2, 'hours');
  
  const accessTokenPayload = {
    sub: targetUser.id, // Target user ID
    iat: moment().unix(),
    exp: accessTokenExpires.unix(),
    type: tokenTypes.IMPERSONATION,
    // Impersonation metadata
    impersonation: {
      superadminId: superadmin.id,
      superadminEmail: superadmin.email,
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      startedAt: moment().toISOString(),
      reason: reason
    }
  };
  
  const accessToken = jwt.sign(accessTokenPayload, config.jwt.secret);
  
  // Store refresh token with impersonation metadata
  const refreshTokenDoc = await Token.create({
    token: randomTokenString(),
    user: targetUser.id,
    type: tokenTypes.IMPERSONATION,
    expires: refreshTokenExpires.toDate(),
    impersonation: {
      superadminId: superadmin.id,
      reason: reason
    }
  });
  
  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshTokenDoc.token,
      expires: refreshTokenExpires.toDate(),
    },
  };
}
```

### 4. Auth Middleware Enhancement

#### Detect Impersonation in Requests
```javascript
// In middlewares/auth.js
const auth = (...requiredRights) => {
  return async (req, res, next) => {
    try {
      // ... existing auth logic ...
      
      // Check if this is an impersonation session
      if (req.caregiver.tokenType === tokenTypes.IMPERSONATION) {
        // Add impersonation context to request
        req.impersonation = {
          isActive: true,
          superadminId: req.caregiver.impersonation?.superadminId,
          targetUserId: req.caregiver.id,
          startedAt: req.caregiver.impersonation?.startedAt,
          reason: req.caregiver.impersonation?.reason
        };
        
        // Log all actions during impersonation
        await AuditLog.create({
          userId: req.impersonation.superadminId,
          userRole: 'superAdmin',
          action: 'ACCESS',
          resource: req.impersonation.targetUserId,
          resourceId: req.impersonation.targetUserId,
          outcome: 'SUCCESS',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          requestMethod: req.method,
          requestPath: req.path,
          statusCode: res.statusCode,
          complianceFlags: {
            phiAccessed: true, // Assume PHI access during impersonation
            highRiskAction: true,
            requiresReview: true
          },
          metadata: {
            impersonationSession: 'true',
            targetUserId: req.impersonation.targetUserId,
            targetUserEmail: req.caregiver.email,
            action: req.method + ' ' + req.path
          }
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

### 5. Controller Implementation

#### Impersonation Controller
```javascript
// controllers/superadmin.controller.js
const impersonateUser = catchAsync(async (req, res) => {
  const { targetUserEmail, reason, mfaToken } = req.body;
  const superadmin = req.caregiver;
  
  // 1. Verify superadmin has MFA enabled and token is valid
  if (superadmin.mfaEnabled) {
    if (!mfaToken) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'MFA token required for impersonation');
    }
    const isValid = await mfaService.verifyToken(superadmin, mfaToken);
    if (!isValid) {
      await auditAuthFailure(superadmin, req, 'IMPERSONATION_MFA_FAILED');
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid MFA token');
    }
  }
  
  // 2. Find target user
  const targetUser = await Caregiver.findOne({ email: targetUserEmail })
    .populate('org')
    .populate('patients');
  
  if (!targetUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Target user not found');
  }
  
  // 3. Prevent impersonating other superadmins
  if (targetUser.role === 'superAdmin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Cannot impersonate other superadmins');
  }
  
  // 4. Check account status
  if (targetUser.accountLocked) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Target user account is locked');
  }
  
  // 5. Check daily impersonation limit (configurable, e.g., 10 per day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const impersonationCount = await AuditLog.countDocuments({
    userId: superadmin.id,
    action: 'IMPERSONATION_START',
    timestamp: { $gte: today }
  });
  
  const maxImpersonations = config.superadmin.maxImpersonationsPerDay || 10;
  if (impersonationCount >= maxImpersonations) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Daily impersonation limit reached');
  }
  
  // 6. Generate impersonation tokens
  const tokens = await tokenService.generateImpersonationTokens(
    superadmin,
    targetUser,
    reason
  );
  
  // 7. Create comprehensive audit log
  await AuditLog.create({
    userId: superadmin.id,
    userRole: 'superAdmin',
    userEmail: superadmin.email,
    action: 'IMPERSONATION_START',
    resource: 'caregiver',
    resourceId: targetUser.id,
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestMethod: req.method,
    requestPath: req.path,
    statusCode: 200,
    complianceFlags: {
      phiAccessed: true,
      highRiskAction: true,
      requiresReview: true
    },
    metadata: {
      targetUserEmail: targetUser.email,
      targetUserName: targetUser.name,
      reason: reason,
      targetUserRole: targetUser.role,
      targetUserOrg: targetUser.org?.name || 'N/A'
    }
  });
  
  // 8. Optional: Notify target user (if configured)
  if (config.superadmin.notifyUserOnImpersonation) {
    await emailService.sendImpersonationNotification(
      targetUser.email,
      {
        superadminName: superadmin.name,
        superadminEmail: superadmin.email,
        timestamp: new Date(),
        reason: reason
      }
    );
  }
  
  // 9. Return tokens and impersonation metadata
  const caregiverDTO = CaregiverDTO(targetUser);
  res.status(httpStatus.OK).send({
    tokens,
    impersonation: {
      superadminId: superadmin.id,
      superadminEmail: superadmin.email,
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      startedAt: new Date(),
      expiresAt: tokens.access.expires,
      reason
    },
    caregiver: caregiverDTO
  });
});

const endImpersonation = catchAsync(async (req, res) => {
  const superadmin = req.caregiver;
  const impersonation = req.impersonation;
  
  if (!impersonation || !impersonation.isActive) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No active impersonation session');
  }
  
  // Calculate session duration
  const startedAt = new Date(impersonation.startedAt);
  const duration = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  
  // Count actions performed during session
  const actionsCount = await AuditLog.countDocuments({
    userId: impersonation.superadminId,
    'metadata.impersonationSession': 'true',
    'metadata.targetUserId': impersonation.targetUserId,
    timestamp: { $gte: startedAt }
  });
  
  // Log end of impersonation
  await AuditLog.create({
    userId: impersonation.superadminId,
    userRole: 'superAdmin',
    action: 'IMPERSONATION_END',
    resource: 'caregiver',
    resourceId: impersonation.targetUserId,
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    complianceFlags: {
      highRiskAction: true,
      requiresReview: true
    },
    metadata: {
      duration: duration.toString(),
      actionsCount: actionsCount.toString(),
      targetUserEmail: req.caregiver.email
    }
  });
  
  // Invalidate impersonation tokens
  await Token.deleteMany({
    user: impersonation.targetUserId,
    type: tokenTypes.IMPERSONATION
  });
  
  res.status(httpStatus.OK).send({
    ended: true,
    sessionDuration: duration,
    actionsPerformed: actionsCount
  });
});
```

---

## Audit & Compliance

### Required Audit Log Actions

1. **IMPERSONATION_START**: When impersonation begins
2. **IMPERSONATION_END**: When impersonation ends (explicit or timeout)
3. **ACCESS**: Every API call made during impersonation
4. **IMPERSONATION_MFA_FAILED**: Failed MFA attempt for impersonation
5. **IMPERSONATION_LIMIT_EXCEEDED**: When daily limit is reached

### Audit Log Fields for Impersonation

All impersonation-related logs must include:
- `userId`: Superadmin ID
- `userRole`: 'superAdmin'
- `action`: One of the actions above
- `resource`: 'caregiver'
- `resourceId`: Target user ID
- `metadata.impersonationSession`: 'true'
- `metadata.targetUserId`: Target user ID
- `metadata.targetUserEmail`: Target user email (hashed)
- `metadata.reason`: Reason for impersonation
- `complianceFlags.highRiskAction`: true
- `complianceFlags.requiresReview`: true
- `complianceFlags.phiAccessed`: true (if PHI was accessed)

### Compliance Review Process

1. **Daily Review**: Automated report of all impersonations from previous day
2. **Weekly Review**: Summary report sent to compliance officer
3. **Monthly Review**: Full audit trail review
4. **Anomaly Detection**: Alert on unusual patterns (e.g., >5 impersonations in 1 hour)

### Audit Report Query

```javascript
// Get all impersonations for a date range
const impersonations = await AuditLog.find({
  action: { $in: ['IMPERSONATION_START', 'IMPERSONATION_END'] },
  timestamp: { $gte: startDate, $lte: endDate }
}).populate('userId', 'name email').sort({ timestamp: -1 });
```

---

## User Experience

### Frontend Considerations

1. **Visual Indicator**: Clear banner/indicator showing "Viewing as [User Name]"
2. **Exit Button**: Prominent button to end impersonation
3. **Session Timer**: Display remaining time before automatic logout
4. **Restricted Actions**: Disable certain actions during impersonation (e.g., password changes, payment updates)
5. **Warning Messages**: Show warnings before performing sensitive actions

### UI Mockup Concept

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ IMPERSONATION MODE                                │
│ You are viewing as: John Doe (john@example.com)      │
│ Session expires in: 45:23                            │
│ [End Impersonation]                                  │
└─────────────────────────────────────────────────────┘
│                                                      │
│  [Normal App Content]                                │
│                                                      │
```

### Mobile App Considerations

- Same visual indicators
- Swipe gesture to end impersonation
- Push notification when session is about to expire (5 min warning)

---

## API Design

### Route Definitions

```javascript
// routes/v1/superadmin.route.js
router.post(
  '/impersonate',
  auth('superAdmin'),
  validate(superadminValidation.impersonate),
  superadminController.impersonateUser
);

router.post(
  '/end-impersonation',
  auth('superAdmin'),
  superadminController.endImpersonation
);

router.get(
  '/impersonation-status',
  auth('superAdmin'),
  superadminController.getImpersonationStatus
);

router.get(
  '/impersonation-history',
  auth('superAdmin'),
  superadminController.getImpersonationHistory
);
```

### Validation Schema

```javascript
// validations/superadmin.validation.js
const impersonate = {
  body: Joi.object().keys({
    targetUserEmail: Joi.string().email().required(),
    reason: Joi.string().min(10).max(500).required(),
    mfaToken: Joi.string().length(6).when('$superadmin.mfaEnabled', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })
};
```

---

## Security Considerations

### 1. Token Security

- **Shorter Expiration**: 1 hour vs 7 days for normal tokens
- **No Refresh**: Impersonation tokens should not be refreshable (or very limited refresh)
- **Single Use**: Consider making tokens single-use for critical operations
- **Token Rotation**: Rotate tokens if session extends beyond initial expiration

### 2. Rate Limiting

- **Per Superadmin**: Max 10 impersonations per day (configurable)
- **Per Target User**: Max 3 impersonations per user per day
- **Global**: Max 50 total impersonations per day across all superadmins

### 3. Access Restrictions During Impersonation

**Actions to Disable**:
- Password changes
- MFA setup/changes
- Payment method changes
- Account deletion
- Email changes
- Critical billing operations

**Actions to Allow**:
- View patient data
- View conversations
- View alerts
- View settings (read-only)
- Test functionality
- Debug issues

### 4. Network Security

- **IP Whitelist**: Optionally restrict impersonation to specific IP ranges
- **VPN Requirement**: Require VPN connection for impersonation
- **Geolocation**: Log and alert on impersonation from unusual locations

### 5. Session Security

- **Concurrent Sessions**: Prevent multiple impersonation sessions simultaneously
- **Session Hijacking Prevention**: Use secure, httpOnly cookies
- **CSRF Protection**: Require CSRF tokens for impersonation endpoints

### 6. Monitoring & Alerts

**Real-time Alerts**:
- Impersonation of high-value accounts (org admins)
- Impersonation outside business hours
- Multiple impersonations in short time
- Impersonation from new IP address
- Failed impersonation attempts

**Daily Reports**:
- All impersonations from previous day
- Duration and actions per session
- Unusual patterns or anomalies

---

## Testing Strategy

### Unit Tests

1. **Token Generation**: Verify impersonation tokens include correct metadata
2. **MFA Verification**: Test MFA requirement and validation
3. **Access Control**: Verify only superadmins can impersonate
4. **Rate Limiting**: Test daily limits and restrictions
5. **Audit Logging**: Verify all actions are logged correctly

### Integration Tests

1. **End-to-End Impersonation**: Full flow from request to token generation
2. **API Access**: Verify impersonated user can access their resources
3. **Session Management**: Test session expiration and termination
4. **Audit Trail**: Verify complete audit trail is created

### Security Tests

1. **Authorization**: Attempt impersonation without superadmin role
2. **MFA Bypass**: Attempt to bypass MFA requirement
3. **Token Manipulation**: Attempt to modify impersonation tokens
4. **Rate Limit Bypass**: Attempt to exceed daily limits
5. **Concurrent Sessions**: Test multiple simultaneous impersonations

### Compliance Tests

1. **Audit Log Integrity**: Verify logs cannot be modified
2. **Data Retention**: Verify logs are retained for required period
3. **PHI Access Tracking**: Verify all PHI access is logged
4. **Review Flagging**: Verify high-risk actions are flagged

---

## Deployment Considerations

### Configuration

```javascript
// config/config.js
superadmin: {
  maxImpersonationsPerDay: 10,
  impersonationTokenExpirationHours: 1,
  requireMfaForImpersonation: true,
  notifyUserOnImpersonation: false, // Set to true in production
  allowedIpRanges: [], // Optional IP whitelist
  restrictedActionsDuringImpersonation: [
    'password_change',
    'mfa_setup',
    'payment_update',
    'account_deletion'
  ]
}
```

### Environment Variables

```bash
SUPERADMIN_MAX_IMPERSONATIONS_PER_DAY=10
SUPERADMIN_IMPERSONATION_TOKEN_EXPIRATION_HOURS=1
SUPERADMIN_REQUIRE_MFA=true
SUPERADMIN_NOTIFY_USER=false
```

### Database Migrations

No schema changes required initially, but consider:
- Adding indexes on audit logs for impersonation queries
- Adding impersonation history to caregiver model (optional)

### Rollout Plan

1. **Phase 1**: Deploy to staging, test with test accounts
2. **Phase 2**: Deploy to production with feature flag disabled
3. **Phase 3**: Enable for single superadmin for testing
4. **Phase 4**: Enable for all superadmins with monitoring
5. **Phase 5**: Review audit logs and adjust as needed

### Monitoring

- **Metrics**: Track impersonation count, duration, actions
- **Alerts**: Set up alerts for anomalies
- **Dashboards**: Create dashboard for compliance reviews

---

## Additional Considerations

### 1. User Notification (Optional but Recommended)

Consider notifying users when their account is accessed:
- Email notification with timestamp and reason
- Option to review access history
- Ability to report suspicious access

### 2. Just-in-Time Access

For enhanced security, consider requiring additional approval:
- Manager approval for high-value accounts
- Time-limited approval windows
- Approval workflow with notifications

### 3. Session Recording (Advanced)

For maximum auditability:
- Record all actions during impersonation
- Screen recording (with user consent)
- Action replay capability

### 4. Emergency Access

Define emergency access procedures:
- Bypass MFA in true emergencies (with additional approval)
- Emergency access logging and review
- Post-emergency audit and justification

---

## Conclusion

This design provides a secure, auditable, and HIPAA-compliant method for superadmins to access user accounts. Key features:

✅ **Security**: MFA requirement, rate limiting, short sessions
✅ **Auditability**: Comprehensive logging of all actions
✅ **Compliance**: HIPAA-compliant audit trail
✅ **User Experience**: Clear indicators and easy exit
✅ **Monitoring**: Real-time alerts and daily reports

The implementation should be done incrementally with thorough testing at each stage.

---

## References

- HIPAA Security Rule: §164.312(b) - Audit Controls
- HIPAA Security Rule: §164.308(a)(1)(ii)(D) - Information System Activity Review
- NIST SP 800-53: AC-3 Access Enforcement
- OWASP: Authentication Cheat Sheet

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-23  
**Author**: System Design  
**Status**: Draft - Pending Review
