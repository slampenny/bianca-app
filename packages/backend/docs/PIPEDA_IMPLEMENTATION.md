# PIPEDA Compliance Implementation

**Status**: ✅ Core Systems Implemented  
**Date**: November 28, 2025

---

## 📋 What's Been Implemented

### 1. Database Models

#### PrivacyRequest Model (`src/models/privacyRequest.model.js`)
- Tracks access and correction requests
- 30-day response deadline tracking
- Extension support (up to 60 days)
- Status tracking (pending, processing, completed, denied)
- Fee management
- Appeal process
- Audit trail

#### ConsentRecord Model (`src/models/consentRecord.model.js`)
- Tracks user consent for collection, use, and disclosure
- Explicit and implied consent support
- Consent withdrawal tracking
- Expiration dates
- Collection notice tracking
- Legal basis documentation

### 2. Service Layer (`src/services/privacy.service.js`)

**Access Request Functions:**
- `createAccessRequest()` - Create new access request
- `processAccessRequest()` - Process and gather user information
- `getPrivacyRequestById()` - Get request details
- `queryPrivacyRequests()` - Query requests with pagination

**Correction Request Functions:**
- `createCorrectionRequest()` - Create new correction request
- `processCorrectionRequest()` - Process and apply corrections

**Consent Management Functions:**
- `createConsentRecord()` - Record user consent
- `getActiveConsent()` - Get active consent for user
- `hasConsent()` - Check if user has consent
- `withdrawConsent()` - Withdraw consent
- `getConsentHistory()` - Get consent history

**Administrative Functions:**
- `getApproachingDeadline()` - Get requests approaching deadline
- `getOverdueRequests()` - Get overdue requests
- `getPrivacyStatistics()` - Get compliance statistics
- `updatePrivacyRequest()` - Update request status

### 3. API Endpoints (`/v1/privacy`)

#### Privacy Requests
- `POST /v1/privacy/requests` - Create access request
- `POST /v1/privacy/requests/access` - Create access request (explicit)
- `POST /v1/privacy/requests/correction` - Create correction request
- `GET /v1/privacy/requests` - List requests (user's own or all if admin)
- `GET /v1/privacy/requests/:requestId` - Get request details
- `PATCH /v1/privacy/requests/:requestId` - Update request (admin only)
- `POST /v1/privacy/requests/:requestId/process-access` - Process access request (admin)
- `POST /v1/privacy/requests/:requestId/process-correction` - Process correction request (admin)
- `GET /v1/privacy/requests/approaching-deadline` - Get approaching deadline (admin)
- `GET /v1/privacy/requests/overdue` - Get overdue requests (admin)

#### Consent Management
- `POST /v1/privacy/consent` - Create consent record
- `GET /v1/privacy/consent` - Get active consent
- `GET /v1/privacy/consent/check` - Check if consent exists
- `GET /v1/privacy/consent/history` - Get consent history
- `POST /v1/privacy/consent/:consentId/withdraw` - Withdraw consent

#### Statistics
- `GET /v1/privacy/statistics` - Get privacy statistics (admin only)

---

## 🔧 How to Use

### Creating an Access Request

```javascript
// User creates access request
POST /v1/privacy/requests/access
{
  "informationRequested": "All personal information including call recordings and transcriptions",
  "accessMethod": "download" // or "view", "email", "mail"
}
```

### Creating a Correction Request

```javascript
// User creates correction request
POST /v1/privacy/requests/correction
{
  "informationRequested": "Correction to email address",
  "correctionDetails": {
    "field": "email",
    "currentValue": "old@example.com",
    "requestedValue": "new@example.com",
    "reason": "Email address changed"
  }
}
```

### Recording Consent

```javascript
// Record consent during registration
POST /v1/privacy/consent
{
  "consentType": "collection",
  "purpose": "Account creation and service delivery",
  "method": "explicit",
  "explicitConsent": {
    "provided": true,
    "providedVia": "checkbox",
    "consentText": "I consent to the collection of my personal information...",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  },
  "informationTypes": ["name", "email", "phone"],
  "collectionNoticeProvided": true,
  "collectionNoticeVersion": "1.0"
}
```

### Checking Consent

```javascript
// Check if user has consent before processing
GET /v1/privacy/consent/check?consentType=recording&purpose=wellness_calls
```

### Withdrawing Consent

```javascript
// User withdraws consent
POST /v1/privacy/consent/:consentId/withdraw
{
  "withdrawalMethod": "app",
  "withdrawalReason": "No longer want service",
  "withdrawalImpact": {
    "impactDescription": "Service will be limited",
    "serviceImpact": "service_limited"
  }
}
```

### Processing Requests (Admin)

```javascript
// Process access request
POST /v1/privacy/requests/:requestId/process-access

// Process correction request
POST /v1/privacy/requests/:requestId/process-correction
{
  "field": "email",
  "value": "new@example.com",
  "notes": "Correction applied"
}
```

---

## 📊 Monitoring & Compliance

### Check Approaching Deadlines

```javascript
GET /v1/privacy/requests/approaching-deadline
// Returns requests with deadline within 5 days
```

### Check Overdue Requests

```javascript
GET /v1/privacy/requests/overdue
// Returns requests past deadline
```

### Get Statistics

```javascript
GET /v1/privacy/statistics?startDate=2025-01-01&endDate=2025-12-31
// Returns:
{
  "requests": {
    "total": 50,
    "access": 30,
    "correction": 20,
    "pending": 5,
    "processing": 3,
    "completed": 40,
    "denied": 2,
    "overdue": 1,
    "onTime": 39
  },
  "consent": {
    "total": 1000,
    "granted": 950,
    "withdrawn": 50,
    "explicit": 800,
    "implied": 200
  }
}
```

---

## 🔄 Integration Points

### 1. User Registration

Add consent tracking to registration flow:

```javascript
// In caregiver registration
const consent = await privacyService.createConsentRecord({
  consentType: 'collection',
  purpose: 'Account creation',
  method: 'explicit',
  explicitConsent: {
    provided: true,
    providedVia: 'checkbox',
    consentText: 'I consent to...',
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  },
  informationTypes: ['name', 'email', 'phone'],
  collectionNoticeProvided: true,
  collectionNoticeVersion: '1.0'
}, caregiverId, 'Caregiver');
```

### 2. Call Recording

Check consent before recording:

```javascript
// Before starting call recording
const hasRecordingConsent = await privacyService.hasConsent(
  patientId,
  'Patient',
  'recording',
  'wellness_calls'
);

if (!hasRecordingConsent) {
  throw new ApiError(httpStatus.FORBIDDEN, 'Recording consent not provided');
}
```

### 3. Data Collection

Provide collection notice:

```javascript
// When collecting new information
const noticeProvided = await privacyService.createConsentRecord({
  consentType: 'collection',
  purpose: 'Health monitoring',
  method: 'explicit',
  collectionNoticeProvided: true,
  collectionNoticeVersion: '1.0'
}, userId, 'Patient');
```

---

## ⚠️ What Still Needs to Be Done

### 1. Frontend Integration (2-4 hours)
- [ ] Add simple forms for access/correction requests in Profile/Settings
- [ ] Add list view to see request status
- [ ] Optional: Add consent management page

### 2. Registration Integration (5 minutes)
- [ ] Add consent tracking to registration flow (one line of code)

### 3. Automated Notifications (Optional - 30 minutes)
- [ ] Email notifications for approaching deadlines (admin)
- [ ] Email notifications when requests are processed (user)
- **Note**: Not required for compliance, but helpful

### 3. Privacy Officer Features
- [ ] Designate privacy officer in org settings
- [ ] Privacy officer dashboard
- [ ] Automated assignment of requests to privacy officer

### 4. Breach Notification
- [ ] Integration with existing BreachLog model
- [ ] Privacy Commissioner notification workflow
- [ ] Individual notification workflow

### 5. Documentation
- [ ] Privacy policy updates
- [ ] Collection notice templates
- [ ] User-facing privacy documentation

---

## 🔒 Security Considerations

1. **Authorization**: Users can only see their own requests unless they're admins
2. **Identity Verification**: External requestors require identity verification
3. **Audit Trail**: All actions are logged with timestamps and user IDs
4. **Data Minimization**: Only necessary information is collected and provided

---

## 📝 Compliance Checklist

- [x] Access request system
- [x] Correction request system
- [x] 30-day response tracking
- [x] Consent tracking
- [x] Consent withdrawal
- [x] Collection notice tracking
- [ ] Privacy officer designation
- [ ] Breach notification to Privacy Commissioner
- [ ] Automated deadline reminders
- [ ] Frontend UI for users
- [ ] Privacy policy updates

---

## 🚀 Next Steps

1. **Test the API endpoints** - Verify all endpoints work correctly
2. **Add frontend UI** - Create user-facing privacy management interface
3. **Integrate with registration** - Add consent tracking to signup flow
4. **Set up notifications** - Configure email alerts for deadlines
5. **Designate privacy officer** - Add privacy officer role to org settings
6. **Update privacy policy** - Ensure policy reflects PIPEDA requirements

---

**For questions or issues, contact the development team.**

