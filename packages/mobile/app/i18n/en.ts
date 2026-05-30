const en = {
  alertScreen: {
    markAllAsRead: "Mark all as read",
    unreadAlerts: "Unread Alerts",
    allAlerts: "All Alerts",
    noAlerts: "No alerts",
    noAlertsTitle: "All caught up!",
    noAlertsSubtitle: "You have no unread alerts. Great job staying on top of things!",
    emptyHeading: "So empty... so sad",
    refreshing: "Refreshing...",
    refresh: "Refresh",
    client: "Client:",
    importance: "Importance:",
    expires: "Expires:",
    filteredByClientBanner: "Showing alerts for {{name}}",
    clearAlertFilter: "Show all",
    noAlertsForFilteredClientTitle: "No alerts for this client",
    noAlertsForFilteredClientSubtitle:
      "There are no alerts linked to {{name}}. Clear the filter to see all alerts, or pick another client from Home.",
  },
  errorScreen: {
    title: "Something went wrong!",
    friendlySubtitle:
      "An error has occurred. You'll want to customize the layout as well (`app/screens/ErrorScreen`). If you want to remove this entirely, check `app/app.tsx` for the <ErrorBoundary> component.",
    reset: "RESET APP",
    traceTitle: "Error from %{name} stack",
  },
  emptyStateComponent: {
    generic: {
      heading: "So empty... so sad",
      content: "No data found yet. Try clicking the button to refresh or reload the app.",
      button: "Let's try this again",
    },
  },

  errors: {
    invalidEmail: "Invalid email address.",
  },
  loginScreen: {
    signIn: "Sign In",
    register: "Register",
    enterDetails:
      "Enter your details below to unlock top secret info. You'll never guess what we've got waiting. Or maybe you will; it's not rocket science here.",
    emailFieldLabel: "Email",
    passwordFieldLabel: "Password",
    emailFieldPlaceholder: "Enter your email address",
    passwordFieldPlaceholder: "Super secret password here",
    forgotPassword: "Forgot Password?",
    hint: "Hint: you can use any email address and your favorite password :)",
    appName: "Bianca",
    tagline: "Wellness Check Communication",
  },
  logoutScreen: {
    logoutButton: "Logout",
    logoutMessage: "Are you sure?",
  },
  registerScreen: {
    title: "Register",
    nameFieldLabel: "Name",
    emailFieldLabel: "Email",
    phoneFieldLabel: "Phone",
    passwordFieldLabel: "Password",
    goBack: "Go Back",
    confirmPasswordFieldLabel: "Confirm Password",
    organizationNameFieldLabel: "Orginization Name",
    nameFieldPlaceholder: "Enter your name",
    emailFieldPlaceholder: "Enter your email address",
    passwordFieldPlaceholder: "Enter your password",
    confirmPasswordFieldPlaceholder: "Confirm your password",
    phoneFieldPlaceholder: "(xxx)xxx-xxxx",
    organizationNameFieldPlaceholder: "Enter your Orginization's Name",
    countryFieldLabel: "Country",
    organizationButton: "Organization",
    individualButton: "Individual",
    individualExplanation: "Register as an individual for personal use.",
    organizationExplanation: "Register as an organization for company or group use.",
    consentText: "By signing up, you agree to our",
    consentAnd: "and",
    termsOfService: "Terms of Service",
    privacyPolicy: "Privacy Policy",
  },
  requestResetScreen: {
    title: "Request Password Reset",
    emailFieldLabel: "Email",
    emailFieldPlaceholder: "Enter your email address",
    requestReset: "Request Reset",
    successMessage: "Reset code sent to your email!",
    requestFailed: "Request failed. Please check your email and try again.",
  },
  emailVerificationScreen: {
    title: "Check Your Email",
    message: "We've sent a verification link to your email address. Please click the link to verify your account before logging in.",
    verifying: "Verifying...",
    emailFieldLabel: "Email Address",
    emailFieldPlaceholder: "Enter your email address",
    resendButton: "Resend Verification Email",
    backToLoginButton: "Back to Login",
    successMessage: "✓ Verification email sent! Please check your inbox.",
    errorNoEmail: "Please enter your email address",
    errorSendFailed: "Failed to send verification email",
    errorNoToken: "Verification token is missing",
    errorVerificationFailed: "Email verification failed",
    errorNetwork: "Unable to connect to server. Please check your internet connection and try again.",
    verificationFailed: "Email verification failed",
  },
  emailVerificationFailedPage: {
    title: "Verification Failed",
    messageExpired: "This verification link has expired. Please request a new verification email.",
    messageInvalid: "This verification link is invalid or has already been used.",
    helpExpired: "Verification links expire after 24 hours for security purposes.",
    helpGeneric: "If you believe this is an error, please contact support.",
    loginButton: "Go to Login",
  },
  emailVerifiedScreen: {
    title: "Email Verified!",
    message: "Your Bianca Wellness account has been successfully verified.",
    redirecting: "Redirecting you to the app...",
  },
  phoneVerificationBanner: {
    title: "Verify Your Phone Number",
    message: "Please verify your phone number to receive emergency alerts and important notifications.",
    verifyButton: "Verify Now",
  },
  phoneVerificationScreen: {
    title: "Verify Your Phone",
    message: "We've sent a 6-digit verification code to {{phone}}. Please enter it below.",
    codeSent: "Verification code sent!",
    codeResent: "Verification code resent!",
    sendCodeButton: "Send Verification Code",
    verifyButton: "Verify Phone",
    resendButton: "Resend Code",
    didntReceiveCode: "Didn't receive the code?",
    resendAvailableIn: "Resend available in",
    invalidCode: "Please enter a 6-digit code",
    errorSendingCode: "Failed to send verification code. Please try again.",
    errorResendingCode: "Failed to resend verification code. Please try again.",
    errorVerifyingCode: "Invalid verification code. Please try again.",
  },
  ssoLinkingScreen: {
    title: "Link Your Account",
    message: "This account was created with {{provider}}. To use email/password login, please set a password below, or continue with {{provider}}.",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    confirmPasswordLabel: "Confirm Password",
    confirmPasswordPlaceholder: "Confirm your password",
    setPasswordButton: "Set Password",
    backToLoginButton: "Back to Login",
    orDivider: "Or",
    successMessage: "✓ Password set successfully! You can now login with your email and password.",
    errorNoPassword: "Please enter a password",
    errorNoConfirmPassword: "Please confirm your password",
    errorPasswordMismatch: "Passwords do not match",
    errorPasswordTooShort: "Password must be at least 8 characters long",
    errorSetPasswordFailed: "Failed to set password",
    errorSSOFailed: "SSO login failed. Please try again.",
    providerGoogle: "Google",
    providerMicrosoft: "Microsoft",
    providerSSO: "SSO",
  },
  ssoButtons: {
    orContinueWith: "Or continue with",
    google: "Google",
    microsoft: "Microsoft",
    continueWithGoogle: "Continue with Google",
    continueWithMicrosoft: "Continue with Microsoft",
    companySSO: "Company SSO",
    ssoNotAvailable: "SSO Not Available",
    signInFailed: "Sign In Failed",
    companySSOTitle: "Company SSO",
    companySSOMessage: "This would redirect to your company's SSO provider. Please contact your administrator for setup.",
  },
  conversationsScreen: {
    title: "Conversations",
    yesterday: "Yesterday",
    noMessages: "No messages",
    noClientSelected: "No client selected",
    firstConversation: "No previous conversations found. This will be the first conversation with this client.",
    noConversationsToDisplay: "No conversations to display",
    noPreviousConversations: "No previous conversations found for this client",
    errorFetchingConversations: "Error fetching conversations",
    loadingMoreConversations: "Loading more conversations...",
  },
  clientScreen: {
    nameLabel: "Name *",
    namePlaceholder: "Enter client name",
    emailLabel: "Email *",
    emailPlaceholder: "Enter email address",
    phoneLabel: "Phone *",
    phonePlaceholder: "Enter phone number",
    preferredLanguageLabel: "Preferred Language",
    updateClient: "UPDATE CLIENT",
    createClient: "CREATE CLIENT",
    manageSchedules: "MANAGE SCHEDULES",
    manageConversations: "MANAGE CONVERSATIONS",
    viewSentimentAnalysis: "VIEW SENTIMENT ANALYSIS",
    manageCaregivers: "MANAGE CAREGIVERS",
    confirmDelete: "CONFIRM DELETE",
    deleteClient: "DELETE CLIENT",
    onboardingCardTitle: "Resident onboarding",
    onboardingNotStarted: "Not started — next: Day 1 of {{total}}",
    onboardingInProgress: "In progress",
    onboardingNextDay: "Next: Day {{day}} of {{total}}",
    onboardingCallsCompleted: "{{completed}} of {{total}} calls completed",
    onboardingCapturesLine: "{{count}} topic captures recorded",
    onboardingComplete: "Onboarding complete — all 4 calls finished",
    viewOnboardingDetails: "VIEW ONBOARDING RESPONSES",
    onboardingButtonCompactComplete: "Onboarding · Complete",
    onboardingButtonCompactDay: "Onboarding · Day {{day}}",
    onboardingButtonA11yHint: "Opens onboarding responses and journey details for this client.",
    onboardingOutboundCallsHint:
      "Outbound calls from Home or the schedule use the onboarding conversation for session {{day}} until that session completes on the phone. No answer means no progress — the next call stays on the same session.",
  },
  callScreen: {
    title: "Call",
    noClientSelected: "No client selected",
    callWith: "Call with {{name}}",
    callDetails: "Call Details",
    clientLabel: "Client:",
    phoneLabel: "Phone:",
    statusLabel: "Status:",
    liveIndicator: "Live",
    aiSpeaking: "AI Speaking...",
    userSpeaking: "User Speaking...",
    onboardingTitle: "Resident onboarding",
    onboardingThisCall:
      "This call is onboarding session {{day}} of {{total}}. The journey advances when the resident answers and the session completes.",
    onboardingProgress: "{{completed}} of {{total}} onboarding sessions completed.",
    onboardingNextRegular:
      "After onboarding finishes, check-ins will use the usual wellness format.",
    onboardingNextWillBe:
      "Until onboarding is complete, the next outbound call will continue onboarding (session {{day}}).",
  },
  clientOnboardingScreen: {
    title: "Onboarding responses",
    noClient: "No client selected.",
    day: "Day",
    filterByDay: "Filter by day",
    allDays: "All days",
    loading: "Loading…",
    error: "Could not load onboarding data.",
    captureCount: "{{count}} captures",
    emptyAllDays: "No onboarding responses recorded yet.",
    emptyForDay: "Day {{day}} onboarding hasn't been completed yet.",
    signalsForDay: "Signals recorded on day {{day}}",
    flag: {
      safety: "Safety",
      memory: "Memory",
      mood: "Mood",
      distress: "Distress",
      confusion: "Confusion",
    },
  },
  paymentScreen: {
    paid: "Paid",
    pending: "Pending",
    overdue: "Overdue",
    processing: "Processing",
    unknown: "Unknown",
    latestInvoice: "Latest Invoice",
    paymentMethod: "Payment Method",
    currentChargesSummary: "Current Charges Summary",
    basicPlan: "Basic Plan",
    contactSupport: "Contact Support",
    currentCharges: "Current Charges",
    paymentMethods: "Payment Methods",
    billingInfo: "Billing Info",
    // Invoice details
    amount: "Amount:",
    invoiceNumber: "Invoice Number:",
    issueDate: "Issue Date:",
    dueDate: "Due Date:",
    notes: "Notes:",
    // Current charges
    noOrganizationData: "No organization data available.",
    authorizationTokenNotAvailable: "Authorization token not available.",
    errorLoadingCurrentCharges: "Error loading current charges.",
    noPendingCharges: "No Pending Charges",
    allConversationsBilled: "All conversations have been billed. New charges will appear here as they accumulate.",
    totalUnbilledAmount: "Total Unbilled Amount:",
    period: "Period:",
    lastDays: "Last {days} days",
    day: "day",
    days: "days",
    clientsWithCharges: "Clients with Charges:",
    clientWord: "client",
    clientsWord: "clients",
    chargesByClient: "Charges by Client",
    conversation: "conversation",
    conversations: "conversations",
    average: "Average:",
    // Billing info
    noUserData: "No user data available.",
    currentPlan: "Current Plan:",
    nextBillingDate: "Next Billing Date:",
    totalBilledAmount: "Total Billed Amount",
    acrossInvoices: "Across {count} invoice{s}",
    invoiceHistory: "Invoice History ({count})",
    hide: "Hide",
    show: "Show",
    history: "History",
    noInvoicesYet: "No Invoices Yet",
    invoicesWillAppear: "Your invoices will appear here once billing begins.",
    // Access control
    accessRestricted: "Access Restricted",
    accessRestrictedMessage: "You do not have the necessary permissions to view or manage payment information.",
    contactAdministrator: "Please contact your organization administrator for assistance.",
    loadingUserInformation: "Loading user information...",
    // Payment methods / Stripe
    addPaymentMethod: "Add Payment Method",
    loadingPaymentSystem: "Loading payment system...",
    loadingPaymentMethods: "Loading payment methods...",
    stripeConfigurationError: "Stripe configuration error. Please contact support.",
    unsupportedPlatform: "Unsupported platform. Please use a web browser or mobile app.",
    errorLoadingPaymentMethods: "Error loading payment methods:",
    existingPaymentMethods: "Existing Payment Methods",
    default: "Default",
    setDefault: "Set Default",
    remove: "Remove",
    addNewCard: "Add New Card",
    deletePaymentMethod: "Delete Payment Method",
    deletePaymentMethodConfirm: "Are you sure you want to delete this payment method? This action cannot be undone.",
    paymentMethodAddedSuccess: "Payment method added successfully!",
    paymentMethodSetDefaultSuccess: "Payment method set as default successfully!",
    paymentMethodDeletedSuccess: "Payment method deleted successfully!",
    failedToSetDefault: "Failed to set default payment method",
    failedToDelete: "Failed to delete payment method",
    expires: "Expires",
    mobilePaymentUnavailable: "Mobile payment system unavailable. Please use the web version.",
    loadingMobilePayment: "Loading mobile payment system...",
    anErrorOccurred: "An error occurred",
  },
  orgScreen: {
    namePlaceholder: "Organization Name",
    emailPlaceholder: "Email",
    phonePlaceholder: "Phone",
    save: "Save",
    viewCaregivers: "View Caregivers",
    inviteCaregiver: "Invite Caregiver",
    payments: "Payments",
    organizationActions: "Organization Actions",
    organizationLogo: "Organization Logo",
    noLogoSet: "No logo set",
    country: "Country",
    countryHelper: "Select your organization's country. This helps determine applicable privacy regulations.",
    timezone: "Timezone",
    timezoneHelper: "Select your organization's timezone. Schedule times will be based on this timezone.",
    callRetrySettings: "Call Retry Settings",
    enableRetriesLabel: "Enable Call Retries",
    enableRetriesHelper: "When enabled, the system will automatically retry failed calls",
    retryCountLabel: "Call Retry Count",
    retryCountHelper: "Number of times to retry a call if it's not answered (1-5)",
    retryIntervalMinutesLabel: "Retry Interval (Minutes)",
    retryIntervalMinutesHelper: "Time to wait between retry attempts (1-60 minutes, default: 15)",
    alertOnAllMissedCallsLabel: "Alert on All Missed Calls",
    alertOnAllMissedCallsHelper: "Send alerts for every missed call and retry attempt",
    clientConsentSettings: "Client Consent Settings",
    requireClientConsentLabel: "Require Client Consent",
    requireClientConsentHelper:
      "When enabled, consent requests will be automatically sent to clients via email.",
  },
  caregiverScreen: {
    nameLabel: "Name",
    namePlaceholder: "Name",
    emailLabel: "Email",
    emailPlaceholder: "Email",
    phoneLabel: "Phone",
    phonePlaceholder: "Phone",
    loadingUnassignedClients: "Loading unassigned clients...",
    assigningClients: "Assigning clients...",
    clientsAssignedSuccess: "Clients assigned successfully!",
    loadingCaregivers: "Loading caregivers...",
    save: "SAVE",
    invite: "INVITE",
    confirmDelete: "CONFIRM DELETE",
    deleteCaregiver: "DELETE CAREGIVER",
    assignUnassignedClients: "Assign Unassigned Clients",
    assignUnassignedClientsTitle: "Assign Unassigned Clients",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    assignSelected: "Assign Selected",
    noUnassignedClientsFound: "No unassigned clients found.",
  },
  caregiversScreen: {
    invited: "Invited",
    edit: "Edit",
    resendInvite: "Resend Invite",
    noCaregiversFound: "No caregivers found",
    notAuthorized: "Not Authorized",
    noPermissionToView: "You don't have permission to view caregivers. Please contact your administrator.",
    addCaregiver: "Add Caregiver",
  },
  signupScreen: {
    title: "Complete Your Invitation",
    fullNameLabel: "Full Name",
    fullNamePlaceholder: "Your full name",
    emailLabel: "Email Address",
    emailPlaceholder: "your.email@example.com",
    phoneLabel: "Phone Number",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    confirmPasswordLabel: "Confirm Password",
    confirmPasswordPlaceholder: "Confirm your password",
    completeRegistration: "Complete Registration",
    preconfiguredMessage: "Your name, email, and organization details have been pre-configured by your administrator.",
  },
  confirmResetScreen: {
    title: "Reset Your Password",
    subtitle: "Enter your new password below. Make sure it's secure and easy for you to remember.",
    newPasswordLabel: "New Password",
    newPasswordPlaceholder: "Enter your new password",
    confirmPasswordLabel: "Confirm New Password",
    confirmPasswordPlaceholder: "Confirm your new password",
    codeFieldLabel: "Reset Code",
    codeFieldPlaceholder: "Enter your reset code",
    newPasswordFieldLabel: "New Password",
    newPasswordFieldPlaceholder: "Enter your new password",
    confirmPasswordFieldLabel: "Confirm New Password",
    confirmPasswordFieldPlaceholder: "Confirm your new password",
    confirmReset: "Confirm Reset",
    successTitle: "Password Reset Successful!",
    successMessage: "Your password has been updated successfully. You can now log in with your new password.",
    redirecting: "Redirecting to login...",
    resetPasswordButton: "Reset Password",
    backToLogin: "Back to Login",
    successMessageShort: "Your password has been reset successfully!",
    requestFailed: "Password reset failed. Please check your code and try again.",
  },
  caregiverInvitedScreen: {
    title: "Invitation Sent!",
    message: "An invitation has been sent to {{name}} at {{email}}.",
    subMessage: "They will receive an email with instructions to complete their registration.",
    continue: "Continue",
  },
  homeScreen: {
    welcome: "Welcome, {{name}}",
    guest: "Guest",
    addClient: "Add Client",
    adminOnlyMessage: "Only org admins and super admins can add clients",
    noClientsFound: "No clients found",
    viewSchedules: "View Schedules",
    noScheduleWarning: "⚠ No schedule set",
    lastCalled: "Last called",
    lastAnsweredCall: "Last answered call",
    neverCalled: "Never",
    noAnsweredCallsYet: "No answered calls yet",
    glanceNoData: "—",
    glanceSentiment: "Mood",
    glanceHealth: "Health",
    glanceRisk: "Risk",
    glanceAlerts: "Alerts",
    sentimentTrendImproving: "Up",
    sentimentTrendStable: "Steady",
    sentimentTrendDeclining: "Down",
    glanceHintButtonA11y: "About {{label}}",
    glanceHintSentimentTitle: "Mood trend",
    glanceHintSentimentBody:
      "Summary of how the client’s tone has sounded in recent analyzed calls (about the last 30 days). Up, steady, or down compares newer calls to slightly older ones. It is not a diagnosis—use the full sentiment report for detail.",
    glanceHintHealthTitle: "Health score",
    glanceHintHealthBody:
      "Overall wellness score from the latest medical conversation analysis (0–100, higher is better). It combines signals such as cognitive and mood-related language patterns from calls. It does not replace clinical judgment or the full health report.",
    glanceHintRiskTitle: "Risk score",
    glanceHintRiskBody:
      "Overall risk score from the latest fraud and safety analysis (0–100, higher means more concern). It reflects patterns in what was said about money, safety, isolation, and similar topics. Check the fraud and abuse report for specifics.",
    glanceHealthA11y: "Health score {{score}} out of one hundred",
    glanceRiskA11y: "Risk score {{score}} out of one hundred",
    glanceHintAlertsTitle: "Alerts for this client",
    glanceHintAlertsBody:
      "How many alerts in your list are linked to this resident (for example client, conversation, or schedule alerts). Open the Alerts tab to read or manage them. Alerts with no linked client are not counted here.",
    glanceAlertsA11y: "{{count}} alerts linked to this client",
    glanceSentimentActionHint: "Opens sentiment analysis for the latest call in Reports.",
    glanceHealthActionHint: "Opens the health analysis report for this client in Reports.",
    glanceRiskActionHint: "Opens the fraud and safety report for this client in Reports.",
    glanceAlertsActionHint: "Opens the alerts list filtered to this client.",
  },
  tabs: {
    home: "Home",
    org: "Org",
    reports: "Reports",
    alerts: "Alerts",
  },
  common: {
    ok: "OK",
    cancel: "Cancel",
    close: "Close",
    back: "Back",
    done: "Done",
    error: "Error",
    anErrorOccurred: "An error occurred",
    selectImage: "Select Image",
    calling: "Calling...",
    callNow: "Call Now",
    ending: "Ending...",
    endCall: "End Call",
    loading: "Loading...",
    delete: "Delete",
    continue: "Continue",
    signInToContinue: "Please sign in to continue.",
  },
  onboarding: {
    aboutYou: {
      title: "Tell us a bit about you",
      subtitle: "This helps us tailor your experience.",
      organization: "Organization",
      caregiver: "Caregiver",
      agingInPlace: "Aging in place",
    },
    howItWorks: {
      title: "How Bianca works",
      next: "Next",
      getStarted: "Get started",
      organization: "Add your clients, schedule when Bianca should call them, and review conversations and reports in one place. Bianca handles the calls so you can focus on care.",
      caregiver: "Add the people you care for, choose when Bianca calls them, and see how they're doing through conversations and reports. You stay in the loop without being on every call.",
      agingInPlace: "Bianca calls you on your schedule for friendly check-ins. You can review your own wellness and reports anytime. It's like having a companion who's always there when you need them.",
    },
    orgInfo: {
      title: "Organization information",
      subtitle: "Tell us about your organization.",
      orgNameLabel: "Organization name",
      orgNamePlaceholder: "Enter your organization name",
      countryLabel: "Country",
      timezoneLabel: "Timezone",
    },
    registration: {
      title: "Your details",
      subtitle: "Confirm your information and accept the terms to continue.",
      nameRequired: "Name is required.",
      emailRequired: "Email is required.",
      termsRequired: "You must accept the Terms of Service and Privacy Policy to continue.",
    },
    termsAndConsent: {
      title: "Terms and consent",
      acceptTerms: "I have read and accept the",
      termsLink: "Terms of Service",
      and: "and",
      privacyLink: "Privacy Policy",
      acceptTermsLabel: "Accept Terms of Service and Privacy Policy",
      singleConsentQuestion: "Are you in a single-consent state? (Only one party needs to consent to recording.)",
      whyImportant: "Why is this important?",
      whyImportantBody: "Call recording laws vary by state and country. In single-consent (one-party) states, only one person needs to agree to recording. In two-party states, everyone on the call must consent. Getting this right keeps you and your organization compliant.",
      yes: "Yes",
      no: "No",
      saveAndContinue: "Save and continue",
    },
  },
  legalLinks: {
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    privacyPractices: "HIPAA Privacy Practices",
  },
  privacyScreen: {
    pipedaContent: `## Bianca Wellness - Privacy Policy (PIPEDA)

**Effective Date:** January 2025  
**Last Updated:** January 2025

Welcome to Bianca Wellness ("we," "us," "our"). We are committed to protecting your privacy in accordance with the **Personal Information Protection and Electronic Documents Act (PIPEDA)**, Canada's federal privacy law. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you use our Bianca Wellness mobile application (the "App") and services (collectively, the "Services").

---

## YOUR PRIVACY RIGHTS UNDER PIPEDA

Under PIPEDA, you have the right to:

- **Access** your personal information
- **Correct** inaccurate information
- **Withdraw consent** for collection, use, or disclosure
- **File a complaint** with the Privacy Commissioner of Canada

---

## 1. INFORMATION WE COLLECT

We collect the following types of personal information:

* **Personal Data:** Your name, email address, phone number, and account credentials
* **Client/Recipient Information:** Name and phone number of individuals you call through our service
* **Call Data:** Recordings, transcriptions, metadata, and wellness information from calls
* **Derivative Data:** Device information, IP address, and usage patterns
* **AI Analysis Data:** Results and insights generated from call analysis

---

## 2. PURPOSES FOR COLLECTION

We collect your personal information for the following purposes:

* To create and manage your account
* To provide wellness check call services
* To record and transcribe calls (with consent)
* To analyze calls and provide wellness summaries
* To enable communication between caregivers and clients
* To improve our services and AI models
* To comply with legal obligations

---

## 3. CONSENT

**Your consent is required** for us to collect, use, or disclose your personal information. We obtain consent:

- **Explicitly** when you register and agree to this policy
- **Implicitly** when you use features that require data collection

**You can withdraw consent** at any time by contacting us. Note: Withdrawing consent for data collection may restrict your ability to use the service.

---

## 4. DISCLOSURE OF YOUR INFORMATION

We may share your information with:

* **Third-Party Service Providers:** 
  - Azure OpenAI (AI services) - United States
  - Twilio (voice services) - United States
  - AWS (cloud hosting) - United States
  - MongoDB Atlas (database) - United States
  
  *Note: These services are located outside Canada. We have contractual safeguards in place to protect your information.*

* **As Required by Law:** When required by Canadian law or court order
* **With Your Consent:** When you explicitly authorize sharing

---

## 5. CROSS-BORDER DATA TRANSFERS

Your personal information may be transferred to and stored in the United States. We ensure adequate protection through:

- Contractual safeguards (Data Processing Agreements)
- Technical safeguards (encryption, access controls)
- Compliance with applicable privacy laws

---

## 6. DATA RETENTION

We retain your personal information only as long as necessary for the purposes outlined in this policy, or as required by law:

- **Client data:** 7 years after last activity
- **Call recordings:** 2 years
- **Conversations:** 5 years
- **Medical analysis:** 7 years
- **Consent records:** 7 years (legal requirement)

---

## 7. YOUR PRIVACY RIGHTS

### Access Your Information
You can request access to your personal information. We will respond within **30 days** (may extend to 60 days with notice).

**How to request:** Email privacy@biancawellness.com or use the "Request My Data" feature in the app.

### Correct Your Information
You can request correction of inaccurate information. We will respond within **30 days**.

### Withdraw Consent
You can withdraw consent for data collection, use, or disclosure. Contact us to withdraw consent.

**Important:** Withdrawing consent for data collection will restrict your account access, as we cannot provide services without collecting necessary information.

---

## 8. BREACH NOTIFICATION

If your personal information is improperly accessed or disclosed, we will:

- Investigate immediately
- Notify you **as soon as feasible** after discovery
- Notify the Privacy Commissioner of Canada if the breach involves significant harm
- Explain what happened and steps we're taking

---

## 9. COMPLAINTS

If you believe we have not handled your personal information in accordance with PIPEDA, you can:

**File a complaint with us:**
- Email: privacy@biancawellness.com
- Phone: +1-604-562-4263

**File a complaint with the Privacy Commissioner of Canada:**
- Website: https://www.priv.gc.ca/en/report-a-concern/
- Phone: 1-800-282-1376
- Mail: Office of the Privacy Commissioner of Canada, 30 Victoria Street, Gatineau, QC K1A 1H3

---

## 10. CONTACT US

**Privacy Officer:**
- Email: privacy@biancawellness.com
- Phone: +1-604-562-4263
- Address: 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

---

**This Privacy Policy complies with PIPEDA (Personal Information Protection and Electronic Documents Act)**
`,
  },
  privacyPracticesScreen: {
    content: `# Notice of Privacy Practices
## Bianca Wellness Healthcare Communication Services

**Effective Date**: October 15, 2025

---

## YOUR INFORMATION. YOUR RIGHTS. OUR RESPONSIBILITIES.

**THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.**

---

## YOUR RIGHTS

You have the right to:
- Get a copy of your health information
- Correct your health information
- Request confidential communication
- Ask us to limit the information we share
- Get a list of those with whom we've shared your information
- Get a copy of this privacy notice
- Choose someone to act for you
- File a complaint if you believe your privacy rights have been violated

---

## YOUR CHOICES

You have some choices in how we use and share information as we:
- Answer questions from your family and friends about your care
- Provide information about you in disaster relief situations

**We never share your information for marketing or sale of your data.**

---

# YOUR DETAILED RIGHTS

## Get a Copy of Your Health Information

**You can ask to see or get a copy of your health information.**

What you can request:
- Call recordings and transcriptions
- Wellness summaries and AI analysis results
- Medical alerts generated by our system
- Emergency notifications
- Account information and preferences

**How to request**:
- Email: privacy@biancawellness.com
- Phone: +1-604-562-4263

**Our response**: Within 30 days

---

## Ask Us to Correct Your Health Information

**You can ask us to correct health information that you think is incorrect or incomplete.**

**Our response**: Within 60 days

---

## Request Confidential Communications

**You can ask us to contact you in a specific way or location.**

Examples:
- "Please email me instead of calling"
- "Please contact me on my cell phone only"

We will accommodate all reasonable requests.

---

## Ask Us to Limit What We Use or Share

**You can ask us not to use or share certain health information.**

We must agree if you paid out-of-pocket in full and ask us not to share with your health plan.

---

## Get a List of Disclosures

**You can ask for an "accounting of disclosures"** - a list of times we've shared your health information.

Covers: Past 6 years  
Excludes: Disclosures for treatment, payment, and operations (unless you request)

---

## File a Complaint

**File with us**:
- Email: privacy@biancawellness.com
- Phone: +1-604-562-4263

**File with HHS**:
- Website: https://www.hhs.gov/hipaa/filing-a-complaint
- Phone: 1-800-368-1019

**We will not retaliate against you for filing a complaint.**

---

# OUR USES AND DISCLOSURES

## How We Use Your Health Information

**For Treatment**:
- Provide AI wellness summaries to your caregivers
- Generate emergency alerts for urgent situations
- Enable caregivers to monitor your wellbeing
- Facilitate communication with your care team

**For Payment**:
- Bill your healthcare organization for services
- Process invoices for call time and analysis

**For Healthcare Operations**:
- Improve our AI detection algorithms
- Quality assurance and improvement
- Training our systems to better serve clients

---

## Who We Share With

**Your Healthcare Organization**:
- Your assigned caregivers and care coordinators
- Organization administrators for billing

**Business Associates** (Service Providers):
- AI Services (Azure OpenAI): For transcription and analysis
- Voice Services (Twilio): For phone call handling
- Cloud Hosting (AWS): For secure data storage
- Database (MongoDB Atlas): For data management

All business associates sign Business Associate Agreements and must protect your information.

**As Required by Law**:
- Emergency services (911) if emergency detected
- Public health authorities (abuse, neglect reporting)
- Law enforcement (with valid legal order)

**We Do NOT**:
- ❌ Sell your health information
- ❌ Share with marketers or advertisers
- ❌ Use for marketing without your authorization
- ❌ Share on social media

---

# HEALTH INFORMATION WE COLLECT

**During Use of Our Services**:
- Client name, phone number, date of birth
- Call recordings and transcriptions
- Health-related information from calls (symptoms, medications, mood)
- Emergency alerts and incidents
- Wellness trends and patterns
- Caregiver notes and observations
- Medical analysis results from AI

---

# YOUR RESPONSIBILITIES

**If you are using our service to call another person**, you are responsible for:
- Obtaining necessary consents for recording
- Ensuring they understand the service
- Following applicable recording consent laws

---

# BREACH NOTIFICATION

**If your health information is improperly accessed or disclosed**, we will:
- Investigate the incident
- Notify you within 60 days if reportable breach
- Explain what happened and what we're doing
- Provide information on steps you can take

---

# CHANGES TO THIS NOTICE

- We may change this notice and changes will apply to all information we have
- New notice will be available in the app and on our website
- You can always request a current copy

---

# CONTACT INFORMATION

**Privacy Officer**:
- Email: privacy@biancawellness.com
- Phone: +1-604-562-4263
- Mail: Bianca Wellness Privacy Office, 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

**Hours**: Monday-Friday, 9 AM - 5 PM PST

---

# FILE A COMPLAINT

**With Us**:
- Email: privacy@biancawellness.com
- Phone: +1-604-562-4263

**With Federal Government (HHS)**:
- Website: https://www.hhs.gov/hipaa/filing-a-complaint
- Phone: 1-800-368-1019
- Mail: Office for Civil Rights, U.S. Department of Health and Human Services, 200 Independence Avenue S.W., Washington, D.C. 20201

---

**Effective Date**: October 15, 2025  
**Version**: 1.0

This Notice of Privacy Practices complies with HIPAA Privacy Rule (45 CFR §164.520)

---

## Language Assistance

**English**: If you need help understanding this notice, contact privacy@biancawellness.com

**Español**: Si necesita ayuda, comuníquese con privacy@biancawellness.com`,
  },
  headers: {
    home: "Home",
    client: "Client",
    schedule: "Schedule",
    conversations: "Conversations",
    call: "Call",
    profile: "Profile",
    logout: "Logout",
    alerts: "Alerts",
    organization: "Organization",
    caregivers: "Caregivers",
    caregiver: "Caregiver",
    caregiverInvited: "Caregiver Invited",
    payments: "Payments",
    reports: "Reports",
    sentimentAnalysis: "Sentiment Analysis",
    clientOnboarding: "Onboarding",
    medicalAnalysis: "Medical Analysis",
    fraudAbuseAnalysis: "Fraud & Abuse Analysis",
    privacyPolicy: "Privacy Policy",
    privacyPractices: "HIPAA Privacy Practices",
    privacyRequest: "Request My Data",
    termsOfService: "Terms of Service",
    mentalHealthReport: "Mental Health Report",
    login: "Sign In",
    register: "Register",
  },
  scheduleScreen: {
    heading: "Schedule Configuration",
    saveSchedule: "Save Schedule",
    deleteSchedule: "Delete Schedule",
  },
  scheduleComponent: {
    schedule: "Schedule",
    startTime: "Start Time",
    frequency: "Frequency",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    sunday: "Sunday",
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    scheduleDetails: "Schedule Details",
    active: "Active",
    everyDayAt: "Every day at {{time}}",
    everyDaysAt: "Every {{days}} at {{time}}",
    everyWeekAt: "Every week at {{time}}",
    everyMonthOn: "Every month on the {{day}}th at {{time}}",
  },
  sentimentAnalysis: {
    lastCall: "Last Call",
    last30Days: "Last 30 Days",
    allTime: "All Time",
    noClientSelected: "No Client Selected",
    selectClientToView: "Please select a client from the Home screen to view their sentiment analysis.",
    sessionRequiredTitle: "Sign in required",
    sessionRequiredMessage:
      "Your session may have expired. Sign in again to view sentiment analysis. If you already see the sign-in window, complete sign-in there.",
    signInToContinueButton: "Sign in",
    accessDeniedTitle: "Unable to load this report",
    accessDeniedMessage:
      "You may not have access to this client’s sentiment data, or your permissions may have changed. Try choosing the client again from Home, or contact an administrator.",
    // Dashboard
    clientSentimentAnalysis: "Client Sentiment Analysis",
    emotionalWellnessInsights: "Emotional wellness insights and trends",
    timeRange: "Time Range:",
    noSentimentDataAvailable: "No Sentiment Data Available",
    noSentimentDataMessage: "Sentiment analysis will appear here once the client has completed conversations.",
    loadingSentimentAnalysis: "Loading sentiment analysis...",
    sentimentAnalysisFooter: "Sentiment analysis is automatically generated after each conversation using AI technology.",
    // Summary Card
    sentimentOverview: "Sentiment Overview",
    averageSentiment: "Average Sentiment",
    trend: "trend",
    recentDistribution: "Recent Distribution",
    keyInsights: "Key Insights",
    totalConversations: "Total Conversations",
    analysisCoverage: "Analysis Coverage",
    recentConversations: "Recent Conversations",
    analyzed: "analyzed",
    latestAnalysis: "Latest Analysis",
    conversationsAnalyzed: "conversations analyzed",
    // Recent Trends
    recentConversationsTitle: "Recent Conversations",
    conversationsWithSentiment: "conversation{s} with sentiment analysis",
    noRecentConversations: "No recent conversations with sentiment analysis",
    keyEmotions: "Key Emotions:",
    moreEmotions: "more",
    clientMood: "Client Mood:",
    concern: "concern",
    confidence: "confidence",
    noSentimentAnalysisAvailable: "No sentiment analysis available",
    // Trend Chart
    sentimentTrend: "Sentiment Trend",
    conversationsAnalyzedNoTrend: "conversation{s} analyzed, but no trend data available yet",
    noSentimentData: "No sentiment data available",
    insufficientDataForTrend: "Insufficient data for trend analysis",
    needMoreConversations: "Need more conversations for reliable trend",
    lowConfidence: "Low confidence",
    avg: "Avg:",
    negative: "Negative",
    positive: "Positive",
    // Last Call
    lastCallAnalysis: "Last Call Analysis",
    noRecentCall: "No Recent Call",
    noRecentCallMessage: "The most recent conversation doesn't have sentiment analysis available yet.",
    noRecentCallButHaveCalls: "Recent calls, no sentiment yet",
    noRecentCallButHaveCallsMessage: "You have recent calls in the last 30 days, but none have sentiment analysis yet. New calls will be analyzed automatically after they end. Older calls may need to be re-processed.",
    duration: "Duration",
    analysisDate: "Analysis Date",
    conversationId: "Conversation ID",
    overallSentiment: "Overall Sentiment",
    scoreRange: "Score Range: -1.0 (Very Negative) to +1.0 (Very Positive)",
    analysisConfidence: "Analysis Confidence:",
    keyEmotionsDetected: "Key Emotions Detected",
    clientMoodAssessment: "Client Mood Assessment",
    concernLevel: "Concern Level",
    lowConcernDescription: "The client appears to be in good spirits with minimal concerns.",
    mediumConcernDescription: "Some areas of concern were noted during the conversation.",
    highConcernDescription: "Significant concerns were identified that may require attention.",
    satisfactionIndicators: "Satisfaction Indicators",
    positiveIndicators: "Positive Indicators",
    areasOfConcern: "Areas of Concern",
    aiSummary: "AI Summary",
    recommendations: "Recommendations",
    // Debug Panel
    sentimentAnalysisDebug: "Sentiment Analysis Debug",
    debugSubtitle: "Debug and fix missing sentiment analysis for recent conversations",
    debugging: "Debugging...",
    debugSentimentAnalysis: "Debug Sentiment Analysis",
    loading: "Loading...",
    debugConversationData: "Debug Conversation Data",
    testing: "Testing...",
    testDirectApiCall: "Test Direct API Call",
    forceRefreshCache: "Force Refresh Cache",
    currentClient: "Current Client:",
    debugResults: "Debug Results",
    withoutSentiment: "Without Sentiment",
    successfullyAnalyzed: "Successfully Analyzed",
    failedAnalyses: "Failed Analyses",
    conversationDetails: "Conversation Details",
    messages: "messages",
    sentiment: "Sentiment",
    score: "Score",
    mood: "Mood",
    emotions: "Emotions",
    failed: "Failed",
    noAnalysisPerformed: "No analysis performed",
    cacheRefreshed: "Cache Refreshed",
    cacheRefreshedMessage: "Sentiment analysis cache has been invalidated. The UI should refresh automatically.",
    debugComplete: "Debug Complete",
    debugFailed: "Debug Failed",
    noClient: "No Client",
    pleaseSelectClient: "Please select a client first",
    conversationDebugComplete: "Conversation Debug Complete",
    directApiTest: "Direct API Test",
  },
  medicalAnalysis: {
    title: "Medical Analysis",
    error: "Error",
    success: "Success",
    noClientSelected: "No client selected",
    selectClientToView: "Please select a client to view medical analysis",
    triggering: "Triggering...",
    triggerAnalysis: "Trigger Analysis",
    loadingResults: "Loading analysis results...",
    noResultsAvailable: "No analysis results available",
    triggerToGetStarted: "Trigger an analysis to get started",
    analysisWillAppearAfterCalls: "Analysis results will appear here after calls are completed.",
    insufficientDataWarning: "Limited data available: {{current}} call(s) analyzed. For more reliable analysis, {{minimum}} or more calls over a longer period are recommended to better understand client patterns.",
    cognitiveHealth: "Cognitive Health",
    mentalHealth: "Mental Health",
    language: "Language",
    risk: "Risk",
    high: "High",
    medium: "Medium",
    low: "Low",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
    warningsInsights: "Warnings & Insights",
    analysisDetails: "Analysis Details",
    conversations: "Conversations",
    messages: "Messages",
    totalWords: "Total Words",
    trigger: "Trigger",
    trendsOverTime: "Trends Over Time",
    overallHealth: "Overall Health",
    analyses: "analyses",
    trendAnalysisComingSoon: "Trend analysis coming soon",
    analysisResultsAvailable: "analysis results available",
    basedOn: "Based on",
    analysisResultsOver: "analysis results over",
    loadFailed: "Failed to load medical analysis results",
    triggerFailed: "Failed to trigger medical analysis",
    triggerSuccess: "Medical analysis completed successfully.",
    disclaimer: "This analysis is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for medical concerns.",
    overview: "Overview",
    confidence: "Confidence",
    noDataAvailable: "No data available for analysis",
    keyIndicators: "Key Indicators",
    fillerWords: "Filler Words",
    vagueReferences: "Vague References",
    temporalConfusion: "Temporal Confusion",
    wordFinding: "Word Finding Difficulties",
    repetition: "Repetition Score",
    informationDensity: "Information Density",
    depressionScore: "Depression Score",
    anxietyScore: "Anxiety Score",
    emotionalTone: "Emotional Tone",
    negativeRatio: "Negative Ratio",
    protectiveFactors: "Protective Factors",
    typeTokenRatio: "Vocabulary Diversity",
    avgWordLength: "Average Word Length",
    avgSentenceLength: "Average Sentence Length",
    uniqueWords: "Unique Words",
    crisisIndicators: "Crisis indicators detected - immediate professional evaluation recommended",
    cognitiveInterpretation: {
      normal: "Communication patterns appear normal with no significant cognitive concerns detected.",
      mildConcern: "Some mild changes in communication patterns detected. Monitor for progression.",
      moderateConcern: "Moderate changes in communication patterns observed. Consider professional evaluation.",
      significantConcern: "Significant changes in communication patterns detected. Professional evaluation strongly recommended.",
    },
    psychiatricInterpretation: {
      stable: "Mental health indicators appear stable with no significant concerns.",
      mildConcern: "Some mild mental health indicators detected. Continue monitoring.",
      moderateConcern: "Moderate mental health indicators observed. Consider professional consultation.",
      significantConcern: "Significant mental health indicators detected. Professional consultation recommended.",
      crisis: "Crisis indicators detected. Immediate professional intervention is strongly recommended.",
    },
    vocabularyInterpretation: {
      strong: "Language complexity and vocabulary usage appear strong and well-maintained.",
      average: "Language complexity and vocabulary usage are within normal ranges.",
      limited: "Language complexity and vocabulary usage appear limited. Monitor for changes.",
    },
  },
  fraudAbuseAnalysis: {
    title: "Fraud & Abuse Analysis",
    error: "Error",
    success: "Success",
    noClientSelected: "No client selected",
    selectClientToView: "Please select a client to view fraud and abuse analysis",
    triggering: "Triggering...",
    triggerAnalysis: "Trigger Analysis",
    loadingResults: "Loading analysis results...",
    noResultsAvailable: "No analysis results available",
    triggerToGetStarted: "Trigger an analysis to get started",
    analysisWillAppearAfterCalls: "Analysis results will appear here after calls are completed.",
    insufficientDataWarning: "Limited data available: {{current}} call(s) analyzed. For more reliable analysis, {{minimum}} or more calls over a longer period are recommended to better understand client patterns.",
    loadFailed: "Failed to load fraud/abuse analysis results",
    triggerFailed: "Failed to trigger fraud/abuse analysis",
    triggerSuccess: "Fraud/abuse analysis completed successfully.",
    disclaimer: "This analysis is for informational purposes only and is not a substitute for professional assessment. If you suspect fraud, abuse, or neglect, contact appropriate authorities immediately.",
    overview: "Overview",
    conversations: "Conversations",
    messages: "Messages",
    riskScore: "Risk Score",
    financialRisk: "Financial Risk",
    abuseRisk: "Abuse Risk",
    relationshipRisk: "Relationship Risk",
    warnings: "Warnings",
    recommendations: "Recommendations",
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
    largeAmountMentions: "Large Amount Mentions",
    transferMethodMentions: "Transfer Method Mentions",
    scamIndicators: "Scam Indicators",
    physicalAbuseScore: "Physical Abuse Score",
    emotionalAbuseScore: "Emotional Abuse Score",
    neglectScore: "Neglect Score",
    newPeopleCount: "New People Count",
    isolationCount: "Isolation Count",
    suspiciousBehaviorCount: "Suspicious Behavior Count",
  },
  profileScreen: {
    telemetryOptIn: "Share anonymous usage data",
    telemetryDescription: "Help us improve the app by sharing anonymous usage data. No personal information is collected.",
    telemetryEnabled: "Telemetry enabled",
    telemetryDisabled: "Telemetry disabled",
    languageSelector: "Language / Idioma",
    selectLanguage: "Select Language",
    theme: "Theme",
    selectTheme: "Select Theme",
    namePlaceholder: "Name",
    emailPlaceholder: "Email",
    emailManagedBySSO: "Email is managed by your sign-in provider and cannot be changed.",
    phonePlaceholder: "Phone",
    yourProfile: "Your Profile",
    updateProfile: "UPDATE PROFILE",
    logout: "LOGOUT",
    profileUpdatedSuccess: "Your profile was updated successfully!",
    profileUpdateFailed: "Failed to update profile. Please try again.",
    requestMyData: "Request My Data",
    invalidPhoneFormat: "Invalid phone format (10 digits or +1XXXXXXXXXX)",
    completeProfileTitle: "Complete Your Profile",
    completeProfileMessage: "Please complete your profile by adding a phone number before continuing.",
    completeProfileMessageUnverified: "Please add your phone number to complete your profile and access all features.",
    verifyPhoneBannerMessage: "Please verify your phone number to receive emergency alerts and important notifications. You can continue using the app with an unverified phone number.",
    errorUploadingAvatar: "Error uploading avatar",
    emailVerified: "Email Verified",
    emailNotVerified: "Email Not Verified",
    phoneVerified: "Phone Verified",
    phoneNotVerified: "Phone Not Verified",
    verifyPhone: "Verify Phone",
    verifyEmail: "Verify Email",
    verificationEmailSent: "Verification email sent! Please check your inbox.",
    verificationEmailFailed: "Failed to send verification email. Please try again.",
    fontSize: "Font Size",
    fontSizeDescription: "Adjust text size for better readability. Changes apply immediately.",
    decreaseFontSize: "Decrease font size",
    increaseFontSize: "Increase font size",
    fontSizeHint: "Adjust font size from 80% to 200%",
  },
  reportsScreen: {
    selectClient: "Select Client:",
    chooseClient: "Choose a client...",
    sentiment: "Sentiment",
    medicalAnalysis: "Medical Analysis",
    fraudAbuseAnalysis: "Fraud & Abuse",
    comingSoon: "Coming Soon",
    modalTitle: "Select Client",
    modalCancel: "Cancel",
  },
  schedulesScreen: {
    scheduleDetails: "Schedule Details",
    selectSchedule: "Select a schedule:",
    scheduleNumber: "Schedule",
    newSchedule: "New Schedule",
    noSchedulesAvailable: "No schedules available. Please create a new one.",
    errorLoadingSchedules: "Error loading schedules.",
    invalidScheduleError: "Please fill in all required schedule fields (frequency, time, and days for weekly/monthly schedules).",
    errorSavingSchedule: "Error saving schedule.",
  },
  themes: {
    healthcare: {
      name: "Healthcare",
      description: "Professional medical theme with blue and green colors",
    },
    colorblind: {
      name: "Color-Blind Friendly",
      description: "High contrast theme optimized for color vision deficiency",
    },
    dark: {
      name: "Dark Mode",
      description: "Dark theme optimized for low-light environments",
    },
    highcontrast: {
      name: "High Contrast",
      description: "Maximum contrast theme for vision impairment (WCAG AAA)",
    },
    accessibility: {
      wcagLevel: "WCAG Level",
      colorblindFriendly: "Color-blind friendly",
      highContrast: "High contrast",
      darkMode: "Dark mode",
    },
  },
  mfa: {
    setupTitle: "Multi-Factor Authentication",
    setupSubtitle: "Add an extra layer of security to your account",
    setupInstructions: "Scan the QR code with your authenticator app, then enter the code to verify.",
    verificationTitle: "Two-Factor Authentication",
    verificationSubtitle: "Enter the 6-digit code from your authenticator app",
    tokenLabel: "Verification Code",
    tokenPlaceholder: "000000",
    pleaseEnterVerificationCode: "Please enter the verification code from your authenticator app",
    verifyButton: "Verify",
    useBackupCode: "Use Backup Code",
    verifyAndEnable: "Verify and Enable",
    enable: "Enable MFA",
    enableMFA: "Enable Multi-Factor Authentication",
    manageMFA: "Manage Multi-Factor Authentication",
    disable: "Disable MFA",
    disableTitle: "Disable MFA",
    disableSubtitle: "Enter your current MFA code to disable multi-factor authentication",
    disableConfirmTitle: "Disable MFA?",
    disableConfirmMessage: "Are you sure you want to disable multi-factor authentication? This will reduce the security of your account.",
    enabled: "Enabled",
    disabled: "Disabled",
    enabledSuccess: "Multi-factor authentication has been successfully enabled.",
    disabledSuccess: "Multi-factor authentication has been disabled.",
    status: "Status",
    enrolledOn: "Enrolled on",
    backupCodesRemaining: "Backup codes remaining",
    backupCodesTitle: "Backup Codes",
    backupCodesWarning: "Save these codes in a secure location. You can use them to access your account if you lose your authenticator device.",
    backupCodeLength: "Backup codes are 8 characters long",
    regenerateBackupCodes: "Regenerate Backup Codes",
    regenerateBackupCodesTitle: "Regenerate Backup Codes?",
    regenerateBackupCodesSubtitle: "Enter your current MFA code to generate new backup codes",
    regenerateBackupCodesMessage: "Your old backup codes will no longer work. Make sure to save the new codes securely.",
    regenerate: "Regenerate",
    backupCodesRegenerated: "Backup Codes Regenerated",
    backupCodesRegeneratedMessage: "Your new backup codes have been generated. Please save them securely.",
    secretLabel: "Or enter this secret manually:",
    invalidTokenLength: "Please enter a 6-digit code",
    verificationFailed: "Invalid code. Please try again.",
    enableFailed: "Failed to enable MFA",
    disableFailed: "Failed to disable MFA. Please check your code.",
    regenerateFailed: "Failed to regenerate backup codes.",
  },
  privacyRequestScreen: {
    title: "Request My Data",
    subtitle: "Under PIPEDA, you have the right to access and correct your personal information. Submit a request to access or correct your data.",
    requestDataTitle: "Data Access Request",
    requestDataDescription: "Describe what information you'd like to access. Leave blank to request all your personal information.",
    correctionRequestTitle: "Data Correction Request",
    correctionRequestDescription: "Request a correction to your personal information. Please provide details about what needs to be corrected.",
    correctionNote: "Note: Most data can be edited directly in the app. Use this form for data that cannot be edited, such as historical logs or system-generated records.",
    informationRequestedLabel: "Information Requested",
    informationRequestedPlaceholder: "All my personal information (or specify what you need)",
    additionalInformationLabel: "Additional Information (Optional)",
    accessMethodLabel: "How would you like to receive your data?",
    accessMethodEmail: "Email",
    accessMethodDownload: "Download",
    accessMethodInfo: "Your data will be emailed to you as a JSON file attachment.",
    submitRequest: "Submit Request",
    requestSubmitted: "Your data request has been submitted. You will receive an email with your data shortly.",
    correctionRequestSubmitted: "Your correction request has been submitted. We will review and process it within 30 days.",
    requestFailed: "Failed to submit request. Please try again.",
    correctionFieldsRequired: "Please fill in the field name and requested value.",
    requestHistoryTitle: "Request History",
    requestTypeAccess: "Access Request",
    requestTypeCorrection: "Correction Request",
    requestedOn: "Requested on",
    completedOn: "Completed on",
    correctionFieldLabel: "Field to Correct",
    correctionFieldPlaceholder: "e.g., Email address, Phone number, Name",
    currentValueLabel: "Current Value (Optional)",
    currentValuePlaceholder: "What is the current value?",
    requestedValueLabel: "Requested Value *",
    requestedValuePlaceholder: "What should the corrected value be?",
    correctionReasonLabel: "Reason for Correction (Optional)",
    correctionReasonPlaceholder: "Why does this information need to be corrected?",
    field: "Field",
    currentValue: "Current Value",
    requestedValue: "Requested Value",
    reason: "Reason",
    requestTypeComplaint: "File Complaint",
    complaintRequestTitle: "Privacy Complaint",
    complaintRequestDescription: "If you believe we have not handled your personal information in accordance with privacy laws, you can file a complaint. We will investigate and respond within 30 days.",
    complaintSubjectLabel: "Subject *",
    complaintSubjectPlaceholder: "Brief description of your complaint",
    complaintDescriptionLabel: "Description *",
    complaintDescriptionPlaceholder: "Please provide details about your complaint, including what happened and when.",
    violationTypeLabel: "Type of Issue (Optional)",
    violationTypeOther: "Other",
    violationTypeAccess: "Access Issue",
    complaintFieldsRequired: "Please fill in subject and description.",
    complaintSubmitted: "Your complaint has been submitted. We will investigate and respond within 30 days.",
    complaintHistoryTitle: "Complaint History",
    filedOn: "Filed on",
    resolvedOn: "Resolved on",
    deletionRequestTitle: "Request Data Deletion",
    deletionRequestDescription: "Under PIPEDA, you can request deletion of your personal information. Note: HIPAA requires 7-year retention, so deletion may not be available for all jurisdictions.",
    deletionDataTypeLabel: "What data would you like to delete?",
    deletionTypeAll: "All Data",
    deletionTypeCalls: "Calls Only",
    deletionTypeConversations: "Conversations Only",
    deletionTypeMedicalAnalysis: "Medical Analysis Only",
    requestDeletion: "Request Data Deletion",
    deletionConfirmTitle: "Confirm Data Deletion",
    deletionConfirmMessage: "This will permanently delete your data. This action cannot be undone. Are you sure you want to proceed?",
    confirmDelete: "Delete",
    deletionCompleted: "Data deletion completed successfully.",
    deletionFailed: "Failed to delete data. This may not be available for your jurisdiction due to legal retention requirements.",
  },
}

export default en
export type Translations = typeof en
/** Use for locale files so they can omit keys (fallback to en) or have legacy keys during migration. */
export type LocaleTranslations = { [key: string]: any }





