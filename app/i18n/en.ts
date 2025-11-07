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
    patient: "Patient:",
    importance: "Importance:",
    expires: "Expires:",
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
    message: "Your My Phone Friend account has been successfully verified.",
    redirecting: "Redirecting you to the app...",
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
    noPatientSelected: "No patient selected",
    firstConversation: "No previous conversations found. This will be the first conversation with this patient.",
    noConversationsToDisplay: "No conversations to display",
    noPreviousConversations: "No previous conversations found for this patient",
    errorFetchingConversations: "Error fetching conversations",
  },
  patientScreen: {
    nameLabel: "Name *",
    namePlaceholder: "Enter patient name",
    emailLabel: "Email *",
    emailPlaceholder: "Enter email address",
    phoneLabel: "Phone *",
    phonePlaceholder: "Enter phone number",
    preferredLanguageLabel: "Preferred Language",
    updatePatient: "UPDATE PATIENT",
    createPatient: "CREATE PATIENT",
    manageSchedules: "MANAGE SCHEDULES",
    manageConversations: "MANAGE CONVERSATIONS",
    viewSentimentAnalysis: "VIEW SENTIMENT ANALYSIS",
    manageCaregivers: "MANAGE CAREGIVERS",
    confirmDelete: "CONFIRM DELETE",
    deletePatient: "DELETE PATIENT",
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
    patientsWithCharges: "Patients with Charges:",
    patient: "patient",
    patients: "patients",
    chargesByPatient: "Charges by Patient",
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
    namePlaceholder: "Name",
    emailPlaceholder: "Email",
    phonePlaceholder: "Phone",
    save: "SAVE",
    viewCaregivers: "View Caregivers",
    inviteCaregiver: "Invite Caregiver",
    payments: "Payments",
    organizationActions: "Organization Actions",
    organizationLogo: "Organization Logo",
    noLogoSet: "No logo set",
  },
  caregiverScreen: {
    nameLabel: "Name",
    namePlaceholder: "Name",
    emailLabel: "Email",
    emailPlaceholder: "Email",
    phoneLabel: "Phone",
    phonePlaceholder: "Phone",
    loadingUnassignedPatients: "Loading unassigned patients...",
    assigningPatients: "Assigning patients...",
    patientsAssignedSuccess: "Patients assigned successfully!",
    loadingCaregivers: "Loading caregivers...",
    save: "SAVE",
    invite: "INVITE",
    confirmDelete: "CONFIRM DELETE",
    deleteCaregiver: "DELETE CAREGIVER",
    assignUnassignedPatients: "Assign Unassigned Patients",
    assignUnassignedPatientsTitle: "Assign Unassigned Patients",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    assignSelected: "Assign Selected",
    noUnassignedPatientsFound: "No unassigned patients found.",
  },
  caregiversScreen: {
    invited: "Invited",
    edit: "Edit",
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
  },
  homeScreen: {
    welcome: "Welcome, {{name}}",
    guest: "Guest",
    addPatient: "Add Patient",
    adminOnlyMessage: "Only org admins and super admins can add patients",
    noPatientsFound: "No patients found",
    viewSchedules: "View Schedules",
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
    error: "Error",
    anErrorOccurred: "An error occurred",
    selectImage: "Select Image",
    calling: "Calling...",
    callNow: "Call Now",
    ending: "Ending...",
    endCall: "End Call",
    loading: "Loading...",
    delete: "Delete",
  },
  legalLinks: {
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    privacyPractices: "HIPAA Privacy Practices",
  },
  privacyPracticesScreen: {
    content: `# Notice of Privacy Practices
## MyPhoneFriend Healthcare Communication Services

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
- Email: privacy@myphonefriend.com
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
- Email: privacy@myphonefriend.com
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
- Training our systems to better serve patients

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
- Patient name, phone number, date of birth
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
- Email: privacy@myphonefriend.com
- Phone: +1-604-562-4263
- Mail: MyPhoneFriend Privacy Office, 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

**Hours**: Monday-Friday, 9 AM - 5 PM PST

---

# FILE A COMPLAINT

**With Us**:
- Email: privacy@myphonefriend.com
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

**English**: If you need help understanding this notice, contact privacy@myphonefriend.com

**Español**: Si necesita ayuda, comuníquese con privacy@myphonefriend.com`,
  },
  headers: {
    home: "Home",
    patient: "Patient",
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
    medicalAnalysis: "Medical Analysis",
    privacyPolicy: "Privacy Policy",
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
    noPatientSelected: "No Patient Selected",
    selectPatientToView: "Please select a patient from the Home screen to view their sentiment analysis.",
    // Dashboard
    patientSentimentAnalysis: "Patient Sentiment Analysis",
    emotionalWellnessInsights: "Emotional wellness insights and trends",
    timeRange: "Time Range:",
    noSentimentDataAvailable: "No Sentiment Data Available",
    noSentimentDataMessage: "Sentiment analysis will appear here once the patient has completed conversations.",
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
    patientMood: "Patient Mood:",
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
    duration: "Duration",
    analysisDate: "Analysis Date",
    conversationId: "Conversation ID",
    overallSentiment: "Overall Sentiment",
    scoreRange: "Score Range: -1.0 (Very Negative) to +1.0 (Very Positive)",
    analysisConfidence: "Analysis Confidence:",
    keyEmotionsDetected: "Key Emotions Detected",
    patientMoodAssessment: "Patient Mood Assessment",
    concernLevel: "Concern Level",
    concern: "CONCERN",
    lowConcernDescription: "The patient appears to be in good spirits with minimal concerns.",
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
    currentPatient: "Current Patient:",
    noPatientSelected: "No patient selected",
    debugResults: "Debug Results",
    totalConversations: "Total Conversations",
    withoutSentiment: "Without Sentiment",
    successfullyAnalyzed: "Successfully Analyzed",
    failedAnalyses: "Failed Analyses",
    conversationDetails: "Conversation Details",
    messages: "messages",
    sentiment: "Sentiment",
    score: "Score",
    mood: "Mood",
    emotions: "Emotions",
    concernLevel: "Concern Level",
    failed: "Failed",
    noAnalysisPerformed: "No analysis performed",
    cacheRefreshed: "Cache Refreshed",
    cacheRefreshedMessage: "Sentiment analysis cache has been invalidated. The UI should refresh automatically.",
    debugComplete: "Debug Complete",
    debugFailed: "Debug Failed",
    noPatient: "No Patient",
    pleaseSelectPatient: "Please select a patient first",
    conversationDebugComplete: "Conversation Debug Complete",
    directApiTest: "Direct API Test",
  },
  medicalAnalysis: {
    title: "Medical Analysis",
    error: "Error",
    success: "Success",
    noPatientSelected: "No patient selected",
    selectPatientToView: "Please select a patient to view medical analysis",
    triggering: "Triggering...",
    triggerAnalysis: "Trigger Analysis",
    loadingResults: "Loading analysis results...",
    noResultsAvailable: "No analysis results available",
    triggerToGetStarted: "Trigger an analysis to get started",
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
    triggerSuccess: "Medical analysis triggered successfully. Results will appear in about 10 seconds.",
  },
  profileScreen: {
    languageSelector: "Language / Idioma",
    selectLanguage: "Select Language",
    theme: "Theme",
    selectTheme: "Select Theme",
    namePlaceholder: "Name",
    emailPlaceholder: "Email",
    phonePlaceholder: "Phone",
    yourProfile: "Your Profile",
    updateProfile: "UPDATE PROFILE",
    logout: "LOGOUT",
    profileUpdatedSuccess: "Your profile was updated successfully!",
    profileUpdateFailed: "Failed to update profile. Please try again.",
    invalidPhoneFormat: "Invalid phone format (10 digits or +1XXXXXXXXXX)",
    completeProfileTitle: "Complete Your Profile",
    completeProfileMessage: "Please complete your profile by adding a phone number before continuing.",
    completeProfileMessageUnverified: "Please add your phone number to complete your profile and access all features.",
    errorUploadingAvatar: "Error uploading avatar",
  },
  reportsScreen: {
    selectPatient: "Select Patient:",
    choosePatient: "Choose a patient...",
    sentiment: "Sentiment",
    medicalAnalysis: "Medical Analysis",
    comingSoon: "Coming Soon",
    modalTitle: "Select Patient",
    modalCancel: "Cancel",
  },
  schedulesScreen: {
    scheduleDetails: "Schedule Details",
    selectSchedule: "Select a schedule:",
    scheduleNumber: "Schedule",
    noSchedulesAvailable: "No schedules available. Please create a new one.",
    errorLoadingSchedules: "Error loading schedules.",
  },
  conversationsScreen: {
    title: "Conversations",
    yesterday: "Yesterday",
    noMessages: "No messages",
    noPatientSelected: "No patient selected",
    firstConversation: "No previous conversations found. This will be the first conversation with this patient.",
    noConversationsToDisplay: "No conversations to display",
    noPreviousConversations: "No previous conversations found for this patient",
    errorFetchingConversations: "Error fetching conversations",
    loadingMoreConversations: "Loading more conversations...",
  },
  caregiversScreen: {
    invited: "Invited",
    edit: "Edit",
    noCaregiversFound: "No caregivers found",
    notAuthorized: "Not Authorized",
    noPermissionToView: "You don't have permission to view caregivers",
    addCaregiver: "Add Caregiver",
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
    accessibility: {
      wcagLevel: "WCAG Level",
      colorblindFriendly: "Color-blind friendly",
      highContrast: "High contrast",
      darkMode: "Dark mode",
    },
  },
}

export default en
export type Translations = typeof en
