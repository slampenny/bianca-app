# Technical Workflows for Three Personas

> **Detailed technical implementation guide for each persona's setup process**

---

## 🎯 **Persona 1: Organization Admin - Technical Workflow**

### **API Endpoints Used**

#### **1. Registration**
```http
POST /v1/auth/register
Content-Type: application/json

{
  "name": "Dr. Jane Smith",
  "email": "jane@healthcare.org",
  "phone": "+1234567890",
  "password": "SecurePass123",
  "orgName": "Smith Healthcare Group"
}
```

**Response**:
```json
{
  "user": {
    "id": "caregiver_id",
    "name": "Dr. Jane Smith",
    "email": "jane@healthcare.org",
    "role": "orgAdmin",
    "isEmailVerified": false,
    "isPhoneVerified": false
  },
  "org": {
    "id": "org_id",
    "name": "Smith Healthcare Group"
  },
  "tokens": {
    "access": { "token": "...", "expires": "..." },
    "refresh": { "token": "...", "expires": "..." }
  }
}
```

**Backend Implementation**:
- `src/controllers/auth.controller.js` → `register()`
- `src/services/auth.service.js` → `registerUserWithOrg()`
- Creates `Caregiver` with `role: 'orgAdmin'`
- Creates `Org` record
- Links caregiver to org
- Sends verification email via `email.service.js`

---

#### **2. Email Verification**
```http
GET /v1/auth/verify-email?token=verification_token
```

**Backend Implementation**:
- `src/controllers/auth.controller.js` → `verifyEmail()`
- Validates token from email
- Updates `Caregiver.isEmailVerified = true`
- Logs verification event

---

#### **3. Phone Verification**
```http
POST /v1/phone-verification/send-code
Authorization: Bearer {token}
Content-Type: application/json

{
  "phoneNumber": "+1234567890"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Verification code sent",
  "expiresAt": "2025-11-26T14:20:00Z",
  "phoneNumber": "+1***7890"
}
```

**Backend Implementation**:
- `src/controllers/phoneVerification.controller.js` → `sendVerificationCode()`
- `src/services/smsVerification.service.js` → `sendVerificationCode()`
- Generates 6-digit code
- Stores in `Caregiver.phoneVerificationCode`
- Sends SMS via `twilioSms.service.js`

```http
POST /v1/phone-verification/verify
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "123456"
}
```

**Backend Implementation**:
- Validates code
- Updates `Caregiver.isPhoneVerified = true`
- Clears verification code

---

#### **4. Organization Configuration**
```http
GET /v1/org
Authorization: Bearer {token}
```

**Response**:
```json
{
  "id": "org_id",
  "name": "Smith Healthcare Group",
  "logo": "https://...",
  "settings": { ... },
  "stripeCustomerId": "...",
  "stripeSubscriptionId": "..."
}
```

```http
PATCH /v1/org
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "name": "Updated Name",
  "logo": [file]
}
```

**Backend Implementation**:
- `src/controllers/org.controller.js` → `updateOrg()`
- Validates orgAdmin role
- Updates `Org` record
- Handles logo upload to storage

---

#### **5. Create Patient**
```http
POST /v1/patients
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1987654321",
  "preferredName": "John",
  "age": 75,
  "preferredLanguage": "en",
  "medicalConditions": ["diabetes", "hypertension"],
  "allergies": ["penicillin"],
  "currentMedications": ["metformin", "lisinopril"]
}
```

**Response**:
```json
{
  "id": "patient_id",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1987654321",
  "preferredLanguage": "en",
  "caregivers": ["caregiver_id"],
  "org": "org_id"
}
```

**Backend Implementation**:
- `src/controllers/patient.controller.js` → `createPatient()`
- `src/services/patient.service.js` → `createPatient()`
- Creates `Patient` record
- Auto-assigns creating caregiver
- Validates phone and email formats
- Logs creation event

---

#### **6. Invite Caregiver**
```http
POST /v1/caregivers/invite
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "nurse@healthcare.org",
  "name": "Nurse Mary",
  "role": "staff"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Invitation sent",
  "caregiver": {
    "id": "caregiver_id",
    "email": "nurse@healthcare.org",
    "role": "invited"
  }
}
```

**Backend Implementation**:
- `src/controllers/caregiver.controller.js` → `inviteCaregiver()`
- `src/services/caregiver.service.js` → `inviteCaregiver()`
- Creates `Caregiver` with `role: 'invited'`
- Generates invitation token
- Sends invitation email with magic link
- Links caregiver to organization

---

### **Database Schema Changes**

**Caregiver Collection**:
```javascript
{
  _id: ObjectId,
  org: ObjectId (ref: 'Org'),
  name: String,
  email: String (unique),
  phone: String,
  password: String (hashed),
  role: 'orgAdmin' | 'staff' | 'invited' | 'unverified',
  isEmailVerified: Boolean,
  isPhoneVerified: Boolean,
  phoneVerificationCode: String,
  phoneVerificationCodeExpires: Date,
  ssoProvider: String (optional),
  ssoProviderId: String (optional)
}
```

**Org Collection**:
```javascript
{
  _id: ObjectId,
  name: String,
  logo: String (URL),
  settings: Object,
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  stripeSubscriptionItemId: String
}
```

**Patient Collection**:
```javascript
{
  _id: ObjectId,
  org: ObjectId (ref: 'Org'),
  name: String,
  email: String (unique),
  phone: String,
  preferredName: String,
  age: Number,
  preferredLanguage: String,
  medicalConditions: [String],
  allergies: [String],
  currentMedications: [String],
  notes: String,
  caregivers: [ObjectId] (ref: 'Caregiver')
}
```

---

## 👨‍⚕️ **Persona 2: Caregiver/Staff - Technical Workflow**

### **API Endpoints Used**

#### **1. Accept Invitation**
```http
GET /v1/caregivers/accept-invitation?token=invitation_token
```

**Backend Implementation**:
- `src/controllers/caregiver.controller.js` → `acceptInvitation()`
- Validates invitation token
- Returns caregiver details
- Frontend shows password setup form

```http
POST /v1/caregivers/accept-invitation
Content-Type: application/json

{
  "token": "invitation_token",
  "password": "SecurePass123"
}
```

**Backend Implementation**:
- Validates token
- Updates `Caregiver`:
  - `role: 'staff'` (or specified role)
  - `password: [hashed]`
  - `isEmailVerified: true` (invitation email counts as verification)
- Returns auth tokens

---

#### **2. Login (Existing Users)**
```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "nurse@healthcare.org",
  "password": "SecurePass123"
}
```

**Response**:
```json
{
  "user": {
    "id": "caregiver_id",
    "name": "Nurse Mary",
    "email": "nurse@healthcare.org",
    "role": "staff",
    "org": {
      "id": "org_id",
      "name": "Smith Healthcare Group"
    }
  },
  "tokens": {
    "access": { "token": "...", "expires": "..." },
    "refresh": { "token": "...", "expires": "..." }
  }
}
```

**Backend Implementation**:
- `src/controllers/auth.controller.js` → `login()`
- `src/services/auth.service.js` → `loginUserWithEmailAndPassword()`
- Validates credentials
- Returns user profile and tokens

---

#### **3. Get Assigned Patients**
```http
GET /v1/patients?caregiver=caregiver_id
Authorization: Bearer {token}
```

**Response**:
```json
{
  "results": [
    {
      "id": "patient_id",
      "name": "John Doe",
      "preferredName": "John",
      "phone": "+1987654321",
      "preferredLanguage": "en",
      "recentConversations": [...],
      "alerts": [...]
    }
  ],
  "totalResults": 1,
  "totalPages": 1
}
```

**Backend Implementation**:
- `src/controllers/patient.controller.js` → `getPatients()`
- `src/services/patient.service.js` → `queryPatients()`
- Filters by `caregivers` array containing current user ID
- Returns paginated results

---

#### **4. Initiate Call**
```http
POST /v1/calls/initiate
Authorization: Bearer {token}
Content-Type: application/json

{
  "patientId": "patient_id"
}
```

**Response**:
```json
{
  "success": true,
  "callId": "call_sid",
  "status": "initiating",
  "twilioCallSid": "CAxxxxx"
}
```

**Backend Implementation**:
- `src/controllers/call.controller.js` → `initiateCall()`
- `src/services/twilioCall.service.js` → `initiateCall()`
- Creates call record
- Calls Twilio API to dial patient
- Connects to OpenAI Realtime when patient answers
- Returns call status

---

### **Permission Checks**

**Middleware**: `src/middleware/auth.js`
- Validates JWT token
- Attaches user to `req.user`

**Role-Based Access**: `src/middleware/authorize.js`
- Checks user role against required permissions
- Staff can only access assigned patients
- OrgAdmin can access all org patients

**Example**:
```javascript
// Staff can only see assigned patients
if (user.role === 'staff') {
  query.caregivers = user.id;
}

// OrgAdmin can see all org patients
if (user.role === 'orgAdmin') {
  query.org = user.org;
}
```

---

## 👤 **Persona 3: Patient - Technical Workflow**

### **No Direct API Access**

Patients don't directly interact with the API. They interact via phone calls with Bianca.

---

### **Phone Call Flow**

#### **1. Call Initiation (By Caregiver)**
```
Caregiver → POST /v1/calls/initiate → Twilio → Patient Phone
```

**Backend Implementation**:
- `src/services/twilioCall.service.js` → `initiateCall()`
- Creates Twilio call via API
- Twilio calls patient's phone number
- When answered, connects to webhook

---

#### **2. Call Webhook (Twilio → Backend)**
```http
POST /v1/twilio/call-status
Content-Type: application/x-www-form-urlencoded

CallSid=CAxxxxx&CallStatus=answered&...
```

**Backend Implementation**:
- `src/controllers/twilio.controller.js` → `handleCallStatus()`
- Validates Twilio signature
- Updates call status
- When `CallStatus=answered`:
  - Connects to OpenAI Realtime API
  - Starts conversation with Bianca

---

#### **3. Real-time Conversation**
```
Patient Phone ↔ Twilio ↔ Backend ↔ OpenAI Realtime API
```

**Backend Implementation**:
- `src/services/openai.realtime.service.js`
- Handles audio streaming
- Processes user speech
- Generates Bianca responses
- Detects emergencies
- Saves conversation transcripts

---

#### **4. Emergency Detection**
```
Patient says emergency phrase → Emergency Processor → Alert Caregivers
```

**Backend Implementation**:
- `src/services/emergencyProcessor.service.js` → `processUtterance()`
- `src/services/localizedEmergencyDetector.service.js` → `detectEmergency()`
- Detects emergency keywords
- Creates alert record
- Sends SMS to all assigned caregivers
- Updates session instructions for AI

---

#### **5. Conversation Saving**
```
Call ends → Save transcript → Generate analysis
```

**Backend Implementation**:
- `src/services/conversation.service.js` → `saveCompleteMessage()`
- Creates `Conversation` record
- Saves messages (user and assistant)
- Triggers medical analysis (optional)
- Updates patient activity

---

### **Database Schema**

**Conversation Collection**:
```javascript
{
  _id: ObjectId,
  patient: ObjectId (ref: 'Patient'),
  callId: String (Twilio CallSid),
  startTime: Date,
  endTime: Date,
  duration: Number (seconds),
  messages: [
    {
      role: 'user' | 'assistant',
      content: String,
      timestamp: Date
    }
  ],
  summary: String,
  sentiment: String,
  medicalAnalysis: ObjectId (ref: 'MedicalAnalysis')
}
```

**Alert Collection**:
```javascript
{
  _id: ObjectId,
  patient: ObjectId (ref: 'Patient'),
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM',
  category: String,
  phrase: String,
  transcript: String,
  caregivers: [ObjectId] (ref: 'Caregiver'),
  sentAt: Date,
  acknowledgedBy: [ObjectId]
}
```

---

## 🔐 **Security & Compliance**

### **Authentication**
- JWT tokens with expiration
- Refresh token rotation
- Password hashing with bcrypt
- SSO support (Google, Microsoft)

### **Authorization**
- Role-based access control (RBAC)
- Permission checks on all endpoints
- Patient data isolation by organization

### **Audit Logging**
- All actions logged to `AuditLog`
- HIPAA-compliant audit trail
- 7-year retention

### **Data Protection**
- PHI encrypted at rest
- TLS for all communications
- Phone numbers masked in logs
- No PHI in audit logs

---

## 🧪 **Testing Workflows**

### **Org Admin Setup Test**
```bash
# 1. Register
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Admin","email":"admin@test.com","phone":"+1234567890","password":"Test1234","orgName":"Test Org"}'

# 2. Verify email (use token from email)
curl http://localhost:3000/v1/auth/verify-email?token=xxx

# 3. Send phone verification code
curl -X POST http://localhost:3000/v1/phone-verification/send-code \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890"}'

# 4. Verify phone
curl -X POST http://localhost:3000/v1/phone-verification/verify \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

### **Caregiver Invitation Test**
```bash
# 1. Invite caregiver (as orgAdmin)
curl -X POST http://localhost:3000/v1/caregivers/invite \
  -H "Authorization: Bearer {orgAdmin_token}" \
  -H "Content-Type: application/json" \
  -d '{"email":"nurse@test.com","name":"Test Nurse","role":"staff"}'

# 2. Accept invitation
curl -X POST http://localhost:3000/v1/caregivers/accept-invitation \
  -H "Content-Type: application/json" \
  -d '{"token":"invitation_token","password":"Test1234"}'
```

### **Patient Creation Test**
```bash
# Create patient (as orgAdmin or staff)
curl -X POST http://localhost:3000/v1/patients \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Patient","email":"patient@test.com","phone":"+1987654321","preferredLanguage":"en"}'
```

---

## 📚 **Related Files**

### **Controllers**
- `src/controllers/auth.controller.js` - Authentication
- `src/controllers/caregiver.controller.js` - Caregiver management
- `src/controllers/patient.controller.js` - Patient management
- `src/controllers/org.controller.js` - Organization management
- `src/controllers/phoneVerification.controller.js` - Phone verification
- `src/controllers/call.controller.js` - Call management

### **Services**
- `src/services/auth.service.js` - Auth logic
- `src/services/caregiver.service.js` - Caregiver operations
- `src/services/patient.service.js` - Patient operations
- `src/services/twilioCall.service.js` - Call handling
- `src/services/openai.realtime.service.js` - AI conversation
- `src/services/emergencyProcessor.service.js` - Emergency detection

### **Models**
- `src/models/caregiver.model.js` - Caregiver schema
- `src/models/patient.model.js` - Patient schema
- `src/models/org.model.js` - Organization schema
- `src/models/conversation.model.js` - Conversation schema
- `src/models/alert.model.js` - Alert schema

---

## 🚀 **Deployment Considerations**

### **Environment Variables**
- `JWT_SECRET` - Token signing
- `JWT_EXPIRE` - Token expiration
- `TWILIO_ACCOUNT_SID` - Twilio credentials
- `TWILIO_AUTH_TOKEN` - Twilio credentials
- `TWILIO_PHONE_NUMBER` - Twilio phone number
- `OPENAI_API_KEY` - OpenAI API key
- `MONGODB_URI` - Database connection

### **Required Services**
- MongoDB database
- Twilio account (for calls and SMS)
- OpenAI API account (for AI conversations)
- Email service (for verification emails)
- File storage (for avatars and logos)

---

## 📖 **Next Steps**

1. Review [PERSONA_LANDING_PAGES.md](./PERSONA_LANDING_PAGES.md) for user-facing documentation
2. Review [WORKFLOWS.md](./WORKFLOWS.md) for detailed user journeys
3. Test each workflow end-to-end
4. Update frontend screens to match workflows
5. Add error handling and edge cases




