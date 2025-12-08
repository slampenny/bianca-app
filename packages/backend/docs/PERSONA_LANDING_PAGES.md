# Landing Pages & Technical Workflows for Three Personas

> **Complete guide to onboarding and setup for each user type**

---

## 🎯 **Persona 1: Organization Admin (New Organization Setup)**

### **Landing Page: `/register` or `/signup`**

**Purpose**: First-time organization admin creating a new healthcare organization

**What They See**:
- Welcome message: "Welcome to Bianca Wellness - Set Up Your Healthcare Organization"
- Registration form with fields:
  - Full Name
  - Email Address
  - Phone Number
  - Password (with strength requirements)
  - Organization Name
  - Optional: SSO login options (Google, Microsoft)

**Key Features**:
- Clear value proposition: "Connect with your patients through AI-powered voice conversations"
- Security indicators: HIPAA-compliant, encrypted
- Call-to-action: "Create Organization"

---

### **Technical Workflow**

#### **Step 1: Registration**
```
User fills form → POST /v1/auth/register
```

**Backend Process**:
1. Validate email format and uniqueness
2. Validate phone number format
3. Hash password with bcrypt
4. Create `Caregiver` record with:
   - `role: 'orgAdmin'`
   - `isEmailVerified: false`
   - `isPhoneVerified: false`
   - `org: null` (will be created next)
5. Create `Org` record linked to caregiver
6. Send email verification email
7. Return success response with auth token

**Database Changes**:
- `Caregiver` collection: New record created
- `Org` collection: New organization created
- `AuditLog`: Registration event logged

---

#### **Step 2: Email Verification**
```
User clicks email link → GET /v1/auth/verify-email?token=xxx
```

**Backend Process**:
1. Validate verification token
2. Update `Caregiver.isEmailVerified = true`
3. Redirect to app or show success message
4. Log verification event

**User Experience**:
- Redirected to `EmailVerifiedScreen`
- Message: "Email verified! Please verify your phone number to receive emergency alerts."

---

#### **Step 3: Phone Verification**
```
User navigates to VerifyPhoneScreen → POST /v1/phone-verification/send-code
```

**Backend Process**:
1. Format phone number to E.164 format
2. Generate 6-digit verification code
3. Store code with expiration (10 minutes)
4. Send SMS via Twilio
5. Return masked phone number

**User Experience**:
- Enter verification code
- `POST /v1/phone-verification/verify`
- On success: `isPhoneVerified = true`
- Can now receive emergency alerts

---

#### **Step 4: Organization Setup**
```
User navigates to OrgScreen → Configure organization settings
```

**Backend Process**:
1. `GET /v1/org` - Fetch organization details
2. `PATCH /v1/org` - Update organization:
   - Logo upload
   - Organization name
   - Settings
   - Billing information

**User Experience**:
- Upload organization logo
- Configure organization-wide settings
- Set up payment method (Stripe)
- Invite team members

---

#### **Step 5: Add First Patient**
```
User navigates to HomeScreen → Tap "Add Patient"
```

**Backend Process**:
1. `POST /v1/patients` - Create patient record
2. Required fields:
   - Name, email, phone
   - Preferred language
   - Age (optional)
   - Medical conditions (optional)
3. Auto-assign current orgAdmin as caregiver

**User Experience**:
- Fill patient information form
- Upload patient avatar
- Set preferred language
- Save patient

---

#### **Step 6: Invite Caregivers**
```
User navigates to CaregiversScreen → Tap "Invite Caregiver"
```

**Backend Process**:
1. `POST /v1/caregivers/invite` - Send invitation
2. Create `Caregiver` record with:
   - `role: 'invited'`
   - `isEmailVerified: false`
   - `org: [organizationId]`
3. Send invitation email with magic link
4. Invited user can accept and set password

---

### **Complete Setup Checklist for Org Admin**

- [ ] Register account
- [ ] Verify email address
- [ ] Verify phone number
- [ ] Configure organization settings
- [ ] Upload organization logo
- [ ] Set up payment method
- [ ] Add first patient
- [ ] Invite team members
- [ ] Assign caregivers to patients

---

## 👨‍⚕️ **Persona 2: Caregiver/Staff (Joining Existing Organization)**

### **Landing Page: `/caregiver-invited` or `/login`**

**Purpose**: Healthcare provider joining an existing organization

**Two Entry Points**:

#### **A. Invited Caregiver**
- Receives invitation email
- Clicks magic link
- Lands on `CaregiverInvitedScreen`
- Sees: "You've been invited to join [Organization Name]"

#### **B. Existing User Login**
- Navigates to `/login`
- Enters email/password
- If account exists but not verified, redirected to verification screens

---

### **Technical Workflow**

#### **Step 1: Accept Invitation (Invited Caregivers)**
```
User clicks invitation link → GET /v1/caregivers/accept-invitation?token=xxx
```

**Backend Process**:
1. Validate invitation token
2. Check if `Caregiver` exists with `role: 'invited'`
3. Redirect to password setup screen
4. User sets password
5. Update `Caregiver`:
   - `role: 'staff'` (or role specified in invitation)
   - `password: [hashed]`
   - `isEmailVerified: true` (invitation email counts as verification)

**User Experience**:
- `CaregiverInvitedScreen` shows organization name
- Form to set password
- Submit → Account activated

---

#### **Step 2: Email Verification (If Not Already Verified)**
```
Same as Org Admin Step 2
```

**Backend Process**:
- If email not verified, send verification email
- User clicks link to verify

---

#### **Step 3: Phone Verification**
```
Same as Org Admin Step 3
```

**Backend Process**:
- Required for receiving emergency alerts
- Same SMS verification flow

---

#### **Step 4: Login & Access**
```
User logs in → GET /v1/auth/profile
```

**Backend Process**:
1. Authenticate user
2. Return caregiver profile with:
   - Assigned patients
   - Organization details
   - Role and permissions
3. Load `HomeScreen` with patient list

**User Experience**:
- See dashboard with assigned patients
- Can view patient details
- Can initiate calls to patients
- Can view alerts and conversations

---

#### **Step 5: First Patient Interaction**
```
User selects patient → Navigate to PatientScreen
```

**Backend Process**:
1. `GET /v1/patients/:id` - Fetch patient details
2. Check permissions (staff can only see assigned patients)
3. Return patient data with:
   - Recent conversations
   - Alerts
   - Health metrics
   - Caregiver assignments

**User Experience**:
- View patient profile
- See conversation history
- Initiate call to patient
- Review AI analysis

---

### **Complete Setup Checklist for Caregiver**

- [ ] Accept invitation (if invited) OR register account
- [ ] Set password
- [ ] Verify email address
- [ ] Verify phone number
- [ ] Log in to app
- [ ] Review assigned patients
- [ ] Make first call to patient
- [ ] Review conversation analysis

---

## 👤 **Persona 3: Patient (Added to System)**

### **Landing Page: No Direct Landing Page**

**Purpose**: Patients are added by caregivers, they don't directly use the app

**Note**: Patients interact with Bianca via phone calls, not through the app interface. However, they need to be set up in the system.

---

### **Technical Workflow**

#### **Step 1: Patient Creation (By Caregiver)**
```
Caregiver navigates to HomeScreen → Tap "Add Patient" → Fill form → Submit
```

**Backend Process**:
1. `POST /v1/patients` - Create patient record
2. Required fields:
   - `name`: Patient's full name
   - `email`: Patient's email (for notifications)
   - `phone`: Patient's phone number (for calls)
   - `preferredLanguage`: Language for conversations (default: 'en')
   - `org`: Organization ID
3. Optional fields:
   - `preferredName`: What they like to be called
   - `age`: Patient's age
   - `medicalConditions`: Array of conditions
   - `allergies`: Array of allergies
   - `currentMedications`: Array of medications
   - `notes`: General notes about patient
4. Auto-assign creating caregiver to patient
5. Create patient record in database

**Database Changes**:
- `Patient` collection: New record created
- `Patient.caregivers`: Array includes creating caregiver ID
- `AuditLog`: Patient creation event logged

---

#### **Step 2: Assign Caregivers**
```
Caregiver navigates to PatientScreen → Tap "Assign Caregivers"
```

**Backend Process**:
1. `GET /v1/caregivers?org=xxx` - Fetch available caregivers
2. `PATCH /v1/patients/:id` - Update patient caregivers array
3. Add/remove caregiver IDs from `Patient.caregivers`

**User Experience**:
- See list of organization caregivers
- Select/deselect caregivers
- Save assignments

---

#### **Step 3: Configure Patient Settings**
```
Caregiver navigates to PatientScreen → Edit patient details
```

**Backend Process**:
1. `PATCH /v1/patients/:id` - Update patient record
2. Configure:
   - Preferred language
   - Emergency contacts
   - Call schedules
   - Health baseline information

**User Experience**:
- Edit patient information
- Set communication preferences
- Add medical history
- Configure emergency alerts

---

#### **Step 4: First Call to Patient**
```
Caregiver navigates to PatientScreen → Tap "Call Now"
```

**Backend Process**:
1. `POST /v1/calls/initiate` - Initiate call
2. Create call record
3. Connect to Twilio
4. Twilio calls patient's phone
5. When patient answers, connect to OpenAI Realtime API
6. Bianca starts conversation

**User Experience (Patient)**:
- Patient receives phone call
- Bianca introduces herself
- Conversation begins
- Patient talks naturally with Bianca

---

#### **Step 5: Emergency Alert Setup**
```
Caregiver navigates to PatientScreen → Configure emergency settings
```

**Backend Process**:
1. Ensure caregivers have verified phone numbers
2. `GET /v1/patients/:id/caregivers` - Fetch assigned caregivers
3. Verify all caregivers have `isPhoneVerified: true`
4. Emergency alerts will be sent to all assigned caregivers

**User Experience**:
- See list of caregivers who will receive alerts
- Verify phone numbers are correct
- Test emergency alert system

---

### **Complete Setup Checklist for Patient**

**Performed by Caregiver**:
- [ ] Create patient record
- [ ] Enter patient information (name, email, phone)
- [ ] Set preferred language
- [ ] Assign caregivers
- [ ] Add medical history (optional)
- [ ] Configure emergency contacts
- [ ] Set up call schedules (optional)
- [ ] Make first test call
- [ ] Verify emergency alert system

**Patient Experience**:
- Receives phone call from Bianca
- Talks naturally with AI
- Emergency alerts sent to caregivers automatically

---

## 🔄 **Common Technical Patterns**

### **Authentication Flow**
```
Register/Login → Email Verification → Phone Verification → Access App
```

### **Permission Checks**
- All endpoints check user role and permissions
- Staff can only access assigned patients
- OrgAdmin can access all patients in organization
- SuperAdmin has full access

### **Audit Logging**
- All actions logged to `AuditLog` collection
- Includes: user ID, action type, resource, timestamp
- HIPAA-compliant audit trail

### **Error Handling**
- Validation errors return 400 status
- Authentication errors return 401 status
- Permission errors return 403 status
- Not found errors return 404 status

---

## 📱 **Frontend Screen Flow**

### **Org Admin Flow**
```
RegisterScreen → EmailVerifiedScreen → VerifyPhoneScreen → HomeScreen → OrgScreen → PatientScreen
```

### **Caregiver Flow**
```
CaregiverInvitedScreen (or LoginScreen) → EmailVerifiedScreen → VerifyPhoneScreen → HomeScreen → PatientScreen
```

### **Patient Flow**
```
(No direct app access - managed by caregivers)
Phone Call → Conversation with Bianca → Emergency Alerts (if needed)
```

---

## 🚀 **Quick Start Guides**

### **For Organization Admins**
1. Go to `/register`
2. Fill out registration form
3. Verify email
4. Verify phone
5. Add first patient
6. Invite team members

### **For Caregivers**
1. Click invitation link (or go to `/login`)
2. Set password
3. Verify email and phone
4. Log in
5. View assigned patients
6. Make first call

### **For Adding Patients**
1. Log in as caregiver/orgAdmin
2. Tap "Add Patient"
3. Fill patient information
4. Assign caregivers
5. Configure settings
6. Make first call

---

## 📚 **Related Documentation**

- [WORKFLOWS.md](./WORKFLOWS.md) - Detailed user workflows
- [VERIFICATION_UX_ANALYSIS.md](./VERIFICATION_UX_ANALYSIS.md) - Verification best practices
- [HIPAA_Procedures](../hipaa/HIPAA_Procedures/) - Compliance documentation




