# HIPAA Document Publishing Requirements
## What Goes Where - Simple Guide

---

## 🎯 SIMPLE ANSWER

### Two Types of Documents:

**1. Internal Procedures (CONFIDENTIAL)**
- Location: `HIPAA_Procedures/` folder
- Access: Employees only
- Publishing: **DO NOT publish publicly**
- Security: Keep in private repository

**2. Public Notices (REQUIRED PUBLIC)**
- Location: `bianca-app-frontend/legal/` folder  
- Access: Everyone
- Publishing: **MUST publish on website**
- Display: Website pages + app

---

## 📊 DOCUMENT COMPARISON TABLE

| Document | Type | Audience | Where It Goes | Status |
|----------|------|----------|---------------|--------|
| **PRIVACY.md** | General Privacy Policy | Everyone | Website footer /privacy | ✅ Exists |
| **NOTICE_OF_PRIVACY_PRACTICES.md** | HIPAA NPP | Patients | Website /privacy-practices | ✅ **Just created** |
| **DATA_SAFETY.md** | App Store | App users | Apple/Google stores | ✅ Exists |
| **TERMS.md** | Legal | Everyone | Website /terms | ✅ Exists |
| **HIPAA_Procedures/** | Internal SOPs | Employees | Internal wiki (private) | ✅ Keep confidential |

---

## 🌐 YOUR WEBSITE STRUCTURE

### Public Pages (Must Have):

```
www.biancawellness.com/
│
├── /privacy                    ✅ Privacy Policy (general)
│   → Use: PRIVACY.md
│   → Audience: All website visitors
│   → Link: Website footer
│
├── /privacy-practices          ✅ Notice of Privacy Practices (HIPAA)
│   → Use: NOTICE_OF_PRIVACY_PRACTICES.md
│   → Audience: Healthcare patients
│   → Link: Patient signup, app, healthcare section
│
├── /security                   ✅ Security Information
│   → Use: DATA_SAFETY.md (or create security page)
│   → Audience: Prospects, B2B customers
│   → Link: Marketing, about us
│
├── /terms                      ✅ Terms of Service
│   → Use: TERMS.md
│   → Audience: All users
│   → Link: Website footer, signup
│
└── /hipaa-compliance           🟡 HIPAA Compliance Statement (optional but recommended)
    → Create: High-level compliance overview for marketing
    → Audience: Healthcare organizations (B2B)
    → Link: Enterprise/healthcare section
```

---

## 📱 IN YOUR APP

### Legal Section (Settings → Legal):

```
Legal Information
├── Privacy Policy
│   → Links to: www.biancawellness.com/privacy
│   → Shows: PRIVACY.md content
│
├── Notice of Privacy Practices  🆕 ADD THIS
│   → Links to: www.biancawellness.com/privacy-practices
│   → Shows: NOTICE_OF_PRIVACY_PRACTICES.md content
│   → Required: Show to patients at first signup
│
├── Terms of Service
│   → Links to: www.biancawellness.com/terms
│   → Shows: TERMS.md content
│
└── Security & Data Safety
    → Links to: www.biancawellness.com/security
    → Shows: DATA_SAFETY.md content
```

---

## 📋 KEY DIFFERENCES EXPLAINED

### Privacy Policy vs. Notice of Privacy Practices

| Aspect | Privacy Policy (PRIVACY.md) | Notice of Privacy Practices (NPP) |
|--------|----------------------------|-----------------------------------|
| **Law** | Consumer protection, GDPR, CCPA | HIPAA §164.520 (healthcare specific) |
| **Audience** | Everyone visiting website | Patients receiving healthcare |
| **Focus** | General data: cookies, analytics, marketing | PHI: health information only |
| **Rights** | General privacy rights | Specific HIPAA rights (access, amend, accounting) |
| **Tone** | Marketing-friendly | Legal, plain language, patient-focused |
| **Required By** | Most countries/states | Federal HIPAA law (USA) |
| **Complaints To** | Company, FTC, state AG | HHS Office for Civil Rights |
| **Length** | Shorter (1-3 pages) | Longer (5-8 pages, very detailed) |
| **Updates** | Notify users of changes | Must provide updated copy |
| **Example Content** | "We use cookies for analytics" | "You have right to accounting of disclosures for 6 years" |

---

## ✅ WHAT TO DO THIS WEEK

### Step 1: Add NPP to Your Website

**File created**: `bianca-app-frontend/legal/NOTICE_OF_PRIVACY_PRACTICES.md` ✅

**Add to your website**:
```javascript
// Create new page route
// URL: /privacy-practices

// In your Next.js/React app:
// pages/privacy-practices.js or app/privacy-practices/page.tsx

import NoticeOfPrivacyPractices from '../legal/NOTICE_OF_PRIVACY_PRACTICES.md'

export default function PrivacyPracticesPage() {
  return (
    <div className="legal-document">
      <NoticeOfPrivacyPractices />
    </div>
  )
}
```

**Add link in website footer**:
```jsx
<footer>
  <a href="/privacy">Privacy Policy</a>
  <a href="/privacy-practices">HIPAA Privacy Practices</a>  {/* NEW */}
  <a href="/terms">Terms of Service</a>
  <a href="/security">Security</a>
</footer>
```

---

### Step 2: Add NPP to Your App

**Patient Signup Flow**:
```javascript
// When patient first signs up:
1. Show abbreviated NPP
2. Checkbox: "I have read and understand the Notice of Privacy Practices"
3. Link: "View full Notice of Privacy Practices"
4. Save acknowledgment with timestamp
```

**Settings Screen**:
```javascript
// Settings → Legal
<MenuItem 
  title="Notice of Privacy Practices"
  subtitle="Your HIPAA rights and our privacy practices"
  onPress={() => navigation.navigate('PrivacyPractices')}
/>
```

---

### Step 3: Keep Internal Procedures Private

**Current location**: `/home/jordanlapp/code/bianca-app/HIPAA_Procedures/`

**DO**:
- ✅ Keep in this private repository
- ✅ Upload to internal employee portal (Confluence, Notion, SharePoint)
- ✅ Email employees about availability
- ✅ Require employees to read and acknowledge

**DON'T**:
- ❌ Publish on public website
- ❌ Post to public GitHub
- ❌ Share on social media
- ❌ Give to patients (they get NPP instead)

---

## 📧 DISTRIBUTION SUMMARY

### Public Website (Anyone Can See):
```
www.biancawellness.com/privacy              ← General Privacy Policy
www.biancawellness.com/privacy-practices    ← HIPAA Notice (NEW)
www.biancawellness.com/terms                ← Terms of Service  
www.biancawellness.com/security             ← Security info
```

### Mobile App (Patients):
```
Settings → Legal
  → Privacy Policy (link to website)
  → Notice of Privacy Practices (link to website) ← ADD THIS
  → Terms of Service (link to website)
  → Data Safety (informational)
```

### Internal Portal (Employees Only - Private):
```
Internal Wiki / SharePoint / Confluence
  → HIPAA_Procedures/ (all 13 documents)
  → Training materials
  → Forms and templates
  → Access: Employees only, MFA required
```

### Provided to Patients:
```
At First Contact / Signup:
  → Notice of Privacy Practices (show in app, get acknowledgment)
  → Privacy Policy (link)
  → Terms of Service (agree to use)
```

### Provided to Auditors (On Request):
```
During HHS/External Audit:
  → All HIPAA_Procedures/ documents
  → Training records
  → Audit logs
  → Incident reports
  → Under NDA, secure transmission
```

---

## 🎯 IMPLEMENTATION CHECKLIST

### This Week:

- [ ] **Verify repository is PRIVATE** (critical!)
  ```bash
  cd /home/jordanlapp/code/bianca-app
  git remote -v
  # If GitHub: Verify repository is private in GitHub settings
  # If public: IMMEDIATELY make private
  ```

- [ ] **Add NPP to website**
  - Create /privacy-practices page
  - Use NOTICE_OF_PRIVACY_PRACTICES.md
  - Add link in footer
  - Add to healthcare/patient section

- [ ] **Add NPP to mobile app**
  - Add to Settings → Legal
  - Show during patient signup
  - Get patient acknowledgment
  - Store acknowledgment timestamp

- [ ] **Upload procedures to internal system**
  - Choose: Confluence, SharePoint, Google Drive, or GitHub Wiki
  - Upload all HIPAA_Procedures/ documents
  - Set access: Employees only
  - Track who has read them

- [ ] **Email employees**
  - Announce availability of procedures
  - Provide access link
  - Require acknowledgment within 30 days
  - Schedule HIPAA training

---

## 💡 BOTTOM LINE

### Three Documents on Public Website:

1. **PRIVACY.md** → `/privacy` ✅ (you have this)
   - General privacy for all visitors
   - Consumer protection laws
   - Everyone sees this

2. **NOTICE_OF_PRIVACY_PRACTICES.md** → `/privacy-practices` ✅ (just created)
   - HIPAA-specific for patients
   - Healthcare services only
   - Patients see this
   - **MORE comprehensive than Privacy Policy for healthcare**

3. **TERMS.md** → `/terms` ✅ (you have this)
   - Legal terms of service
   - Everyone sees this

### They Work Together:
- **General users**: See Privacy Policy + Terms
- **Healthcare patients**: See Privacy Policy + **NPP** + Terms
- **Employees**: See everything + internal procedures

**NPP is MORE detailed for healthcare** because HIPAA requires very specific disclosures about PHI, patient rights, and complaint procedures that aren't in a general privacy policy.

---

**Ready to publish?** The Notice of Privacy Practices is now in your frontend/legal folder, ready to add to your website!













