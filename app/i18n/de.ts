import { Translations } from "./en"

const de: Translations = {
  common: {
    ok: "OK",
    cancel: "Abbrechen",
    close: "Schließen",
    error: "Fehler",
    anErrorOccurred: "Ein Fehler ist aufgetreten",
    back: "Zurück",
    logOut: "Abmelden",
    selectImage: "Bild auswählen",
    calling: "Anrufen...",
    callNow: "Jetzt anrufen",
    ending: "Beenden...",
    endCall: "Anruf beenden",
    loading: "Laden...",
  },
  alertScreen: {
    markAllAsRead: "Alle als gelesen markieren",
    unreadAlerts: "Ungelesene Benachrichtigungen",
    allAlerts: "Alle Benachrichtigungen",
    noAlerts: "Keine Benachrichtigungen",
    noAlertsTitle: "Alles erledigt!",
    noAlertsSubtitle: "Sie haben keine ungelesenen Benachrichtigungen. Gute Arbeit, dass Sie auf dem Laufenden bleiben!",
    emptyHeading: "So leer... so traurig",
    refreshing: "Aktualisiere...",
    refresh: "Aktualisieren",
    patient: "Patient:",
    importance: "Wichtigkeit:",
    expires: "Läuft ab:",
  },
  legalLinks: {
    privacyPolicy: "Datenschutzrichtlinie",
    privacyPractices: "HIPAA-Datenschutzpraktiken",
    termsOfService: "Nutzungsbedingungen",
  },
  welcomeScreen: {
    postscript: "psst — Das ist wahrscheinlich nicht so, wie deine App aussieht. (Außer dein Designer hat dir diese Bildschirme gegeben, in diesem Fall, stelle sie in Produktion!)",
    readyForLaunch: "Deine App, fast bereit für den Start!",
    exciting: "(ohh, das ist aufregend!)",
    letsGo: "Los geht's!",
  },
  errorScreen: {
    title: "Etwas ist schief gelaufen!",
    friendlySubtitle: "Ein Fehler ist aufgetreten. Du möchtest wahrscheinlich auch das Design anpassen (`app/screens/ErrorScreen`). Wenn du das komplett entfernen möchtest, schaue dir `app/app.tsx` für die <ErrorBoundary> Komponente an.",
    reset: "APP NEUSTARTEN",
    traceTitle: "Fehler-Stack %{name}",
  },
  emptyStateComponent: {
    generic: {
      heading: "So leer... so traurig",
      content: "Noch keine Daten gefunden. Versuche auf den Button zu klicken, um zu aktualisieren oder die App neu zu laden.",
      button: "Lass uns das nochmal versuchen",
    },
  },
  errors: {
    invalidEmail: "Ungültige E-Mail-Adresse.",
  },
  loginScreen: {
    signIn: "Anmelden",
    register: "Registrieren",
    enterDetails: "Geben Sie Ihre Daten unten ein, um top-sekretäre Informationen freizuschalten. Sie werden nie erraten, was wir für Sie bereithalten. Oder vielleicht schon; es ist keine Raketenwissenschaft.",
    emailFieldLabel: "E-Mail",
    passwordFieldLabel: "Passwort",
    emailFieldPlaceholder: "Geben Sie Ihre E-Mail-Adresse ein",
    passwordFieldPlaceholder: "Super-geheimes Passwort hier",
    forgotPassword: "Passwort vergessen?",
    hint: "Hinweis: Sie können jede E-Mail-Adresse und Ihr Lieblingspasswort verwenden :)",
  },
  logoutScreen: {
    logoutButton: "Abmelden",
    logoutMessage: "Sind Sie sicher?",
  },
  registerScreen: {
    title: "Registrieren",
    nameFieldLabel: "Name",
    emailFieldLabel: "E-Mail",
    phoneFieldLabel: "Telefon",
    passwordFieldLabel: "Passwort",
    goBack: "Zurück",
    confirmPasswordFieldLabel: "Passwort bestätigen",
    organizationNameFieldLabel: "Organisationsname",
    nameFieldPlaceholder: "Geben Sie Ihren Namen ein",
    emailFieldPlaceholder: "Geben Sie Ihre E-Mail-Adresse ein",
    passwordFieldPlaceholder: "Geben Sie Ihr Passwort ein",
    confirmPasswordFieldPlaceholder: "Bestätigen Sie Ihr Passwort",
    phoneFieldPlaceholder: "(xxx)xxx-xxxx",
    organizationNameFieldPlaceholder: "Geben Sie den Namen Ihrer Organisation ein",
    organizationButton: "Organisation",
    individualButton: "Einzeln",
    individualExplanation: "Registrieren Sie sich als Einzelperson für den persönlichen Gebrauch.",
    organizationExplanation: "Registrieren Sie sich als Organisation für den Firmen- oder Gruppengebrauch.",
    consentText: "Mit der Anmeldung stimmen Sie unseren",
    consentAnd: "und",
    termsOfService: "Nutzungsbedingungen",
    privacyPolicy: "Datenschutzrichtlinie",
  },
  signupScreen: {
    title: "Vervollständigen Sie Ihre Einladung",
    fullNameLabel: "Vollständiger Name",
    fullNamePlaceholder: "Ihr vollständiger Name",
    emailLabel: "E-Mail-Adresse",
    emailPlaceholder: "ihre.email@beispiel.com",
    phoneLabel: "Telefonnummer",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "Passwort",
    passwordPlaceholder: "Geben Sie Ihr Passwort ein",
    confirmPasswordLabel: "Passwort bestätigen",
    confirmPasswordPlaceholder: "Bestätigen Sie Ihr Passwort",
    completeRegistration: "Registrierung abschließen",
    preconfiguredMessage: "Ihr Name, E-Mail und Organisationsdetails wurden von Ihrem Administrator vorkonfiguriert.",
  },
  homeScreen: {
    welcome: "Willkommen, {{name}}",
    guest: "Gast",
    addPatient: "Patient hinzufügen",
    adminOnlyMessage: "Nur Organisationsadministratoren und Super-Administratoren können Patienten hinzufügen",
    noPatientsFound: "Keine Patienten gefunden",
  },
  tabs: {
    home: "Start",
    org: "Org",
    reports: "Berichte",
    alerts: "Benachrichtigungen",
  },
  headers: {
    home: "Start",
    patient: "Patient",
    schedule: "Zeitplan",
    conversations: "Gespräche",
    call: "Anruf",
    profile: "Profil",
    logout: "Abmelden",
    alerts: "Benachrichtigungen",
    organization: "Organisation",
    caregivers: "Pflegekräfte",
    caregiver: "Pflegekraft",
    caregiverInvited: "Pflegekraft eingeladen",
    payments: "Zahlungen",
    reports: "Berichte",
    sentimentAnalysis: "Stimmungsanalyse",
    medicalAnalysis: "Medizinische Analyse",
    privacyPolicy: "Datenschutzrichtlinie",
    termsOfService: "Nutzungsbedingungen",
    mentalHealthReport: "Bericht zur psychischen Gesundheit",
  },
  loginScreen: {
    signIn: "Anmelden",
    register: "Registrieren",
    enterDetails: "Gib deine Details unten ein, um geheime Informationen freizuschalten. Du wirst nie erraten, was wir für dich bereithalten. Oder vielleicht doch; es ist hier keine Raketenwissenschaft.",
    emailFieldLabel: "E-Mail",
    passwordFieldLabel: "Passwort",
    emailFieldPlaceholder: "Gib deine E-Mail-Adresse ein",
    passwordFieldPlaceholder: "Super geheimes Passwort hier",
    forgotPassword: "Passwort vergessen?",
    hint: "Hinweis: Du kannst jede E-Mail-Adresse und dein Lieblingspasswort verwenden :)",
  },
  logoutScreen: {
    logoutButton: "Abmelden",
    logoutMessage: "Bist du sicher?",
  },
  registerScreen: {
    title: "Registrieren",
    nameFieldLabel: "Name",
    emailFieldLabel: "E-Mail",
    phoneFieldLabel: "Telefon",
    passwordFieldLabel: "Passwort",
    goBack: "Zurück",
    confirmPasswordFieldLabel: "Passwort bestätigen",
    organizationNameFieldLabel: "Organisationsname",
    nameFieldPlaceholder: "Gib deinen Namen ein",
    emailFieldPlaceholder: "Gib deine E-Mail-Adresse ein",
    passwordFieldPlaceholder: "Gib dein Passwort ein",
    confirmPasswordFieldPlaceholder: "Bestätige dein Passwort",
    organizationNameFieldPlaceholder: "Gib den Namen deiner Organisation ein",
    signUp: "Registrieren",
    signIn: "Anmelden",
    alreadyHaveAccount: "Hast du bereits ein Konto?",
    dontHaveAccount: "Hast du kein Konto?",
    termsAndConditions: "Geschäftsbedingungen",
    privacyPolicy: "Datenschutzrichtlinie",
    agreeToTerms: "Durch die Registrierung stimmst du unseren",
    and: "und",
  },
  requestResetScreen: {
    title: "Passwort-Reset anfordern",
    emailFieldLabel: "E-Mail",
    emailFieldPlaceholder: "Gib deine E-Mail-Adresse ein",
    requestReset: "Reset anfordern",
    successMessage: "Reset-Code an deine E-Mail gesendet!",
    requestFailed: "Anfrage fehlgeschlagen. Bitte überprüfe deine E-Mail und versuche es erneut.",
  },
  ssoLinkingScreen: {
    title: "Ihr Konto verknüpfen",
    message: "Dieses Konto wurde mit {{provider}} erstellt. Um die Anmeldung per E-Mail/Passwort zu verwenden, legen Sie bitte unten ein Passwort fest oder fahren Sie mit {{provider}} fort.",
    passwordLabel: "Passwort",
    passwordPlaceholder: "Geben Sie Ihr Passwort ein",
    confirmPasswordLabel: "Passwort bestätigen",
    confirmPasswordPlaceholder: "Bestätigen Sie Ihr Passwort",
    setPasswordButton: "Passwort festlegen",
    backToLoginButton: "Zurück zur Anmeldung",
    orDivider: "Oder",
    successMessage: "✓ Passwort erfolgreich festgelegt! Sie können sich jetzt mit Ihrer E-Mail und Ihrem Passwort anmelden.",
    errorNoPassword: "Bitte geben Sie ein Passwort ein",
    errorNoConfirmPassword: "Bitte bestätigen Sie Ihr Passwort",
    errorPasswordMismatch: "Die Passwörter stimmen nicht überein",
    errorPasswordTooShort: "Das Passwort muss mindestens 8 Zeichen lang sein",
    errorSetPasswordFailed: "Fehler beim Festlegen des Passworts",
    errorSSOFailed: "SSO-Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.",
    providerGoogle: "Google",
    providerMicrosoft: "Microsoft",
    providerSSO: "SSO",
  },
  ssoButtons: {
    orContinueWith: "Oder fortfahren mit",
    google: "Google",
    microsoft: "Microsoft",
    companySSO: "Unternehmens-SSO",
    ssoNotAvailable: "SSO nicht verfügbar",
    signInFailed: "Anmeldung fehlgeschlagen",
    companySSOTitle: "Unternehmens-SSO",
    companySSOMessage: "Dies würde zum SSO-Anbieter Ihres Unternehmens weiterleiten. Bitte kontaktieren Sie Ihren Administrator für die Einrichtung.",
  },
  emailVerificationScreen: {
    title: "Überprüfen Sie Ihre E-Mail",
    message: "Wir haben einen Verifizierungslink an Ihre E-Mail-Adresse gesendet. Bitte klicken Sie auf den Link, um Ihr Konto zu verifizieren, bevor Sie sich anmelden.",
    emailFieldLabel: "E-Mail-Adresse",
    emailFieldPlaceholder: "Geben Sie Ihre E-Mail-Adresse ein",
    resendButton: "Verifizierungs-E-Mail erneut senden",
    backToLoginButton: "Zurück zur Anmeldung",
    successMessage: "✓ Verifizierungs-E-Mail gesendet! Bitte überprüfen Sie Ihren Posteingang.",
    errorNoEmail: "Bitte geben Sie Ihre E-Mail-Adresse ein",
    errorSendFailed: "Fehler beim Senden der Verifizierungs-E-Mail",
  },
  emailVerifiedScreen: {
    title: "E-Mail verifiziert!",
    message: "Ihr My Phone Friend-Konto wurde erfolgreich verifiziert.",
    redirecting: "Sie werden zur App weitergeleitet...",
  },
  phoneVerificationBanner: {
    title: "Bestätigen Sie Ihre Telefonnummer",
    message: "Bitte bestätigen Sie Ihre Telefonnummer, um Notfallbenachrichtigungen und wichtige Mitteilungen zu erhalten.",
    verifyButton: "Jetzt bestätigen",
  },
  conversationsScreen: {
    title: "Unterhaltungen",
    yesterday: "Gestern",
    noMessages: "Keine Nachrichten",
    noPatientSelected: "Kein Patient ausgewählt",
    firstConversation: "Keine vorherigen Unterhaltungen gefunden. Dies wird die erste Unterhaltung mit diesem Patienten sein.",
    noConversationsToDisplay: "Keine Unterhaltungen anzuzeigen",
    noPreviousConversations: "Keine vorherigen Unterhaltungen für diesen Patienten gefunden",
    errorFetchingConversations: "Fehler beim Laden der Unterhaltungen",
    loadingMoreConversations: "Lade weitere Unterhaltungen...",
  },
  patientScreen: {
    nameLabel: "Name *",
    namePlaceholder: "Gib den Namen des Patienten ein",
    emailLabel: "E-Mail *",
    emailPlaceholder: "Gib die E-Mail-Adresse ein",
    phoneLabel: "Telefon *",
    phonePlaceholder: "Gib die Telefonnummer ein",
    preferredLanguageLabel: "Bevorzugte Sprache",
    updatePatient: "PATIENT AKTUALISIEREN",
    createPatient: "PATIENT ERSTELLEN",
    manageSchedules: "ZEITPLÄNE VERWALTEN",
    manageConversations: "UNTERHALTUNGEN VERWALTEN",
    viewSentimentAnalysis: "STIMMUNGSANALYSE ANZEIGEN",
    manageCaregivers: "BETREUER VERWALTEN",
    confirmDelete: "LÖSCHUNG BESTÄTIGEN",
    deletePatient: "PATIENT LÖSCHEN",
  },
  paymentScreen: {
    paid: "Bezahlt",
    pending: "Ausstehend",
    overdue: "Überfällig",
    processing: "Verarbeitung",
    unknown: "Unbekannt",
    latestInvoice: "Neueste Rechnung",
    paymentMethod: "Zahlungsmethode",
    currentChargesSummary: "Aktuelle Gebührenübersicht",
    basicPlan: "Basis-Plan",
    contactSupport: "Support kontaktieren",
    currentCharges: "Aktuelle Gebühren",
    paymentMethods: "Zahlungsmethoden",
    billingInfo: "Abrechnungsinformationen",
    noOrganizationData: "Keine Organisationsdaten verfügbar",
    authorizationTokenNotAvailable: "Autorisierungstoken nicht verfügbar",
    errorLoadingCurrentCharges: "Fehler beim Laden der aktuellen Gebühren",
    noPendingCharges: "Keine ausstehenden Gebühren",
    allConversationsBilled: "Alle Unterhaltungen wurden abgerechnet",
    totalUnbilledAmount: "Gesamtbetrag nicht abgerechnet",
    period: "Zeitraum",
    lastDays: "Letzte {days} Tage",
    patients: "Patienten",
    patient: "Patient",
    chargesByPatient: "Gebühren nach Patient",
    average: "Durchschnitt",
    noUserData: "Keine Benutzerdaten verfügbar",
    currentPlan: "Aktueller Plan",
    nextBillingDate: "Nächster Abrechnungstermin",
    totalBilledAmount: "Gesamtbetrag abgerechnet",
    acrossInvoices: "in {count} Rechnung{en}",
    invoiceHistory: "Rechnungshistorie ({count})",
    hide: "Verstecken",
    show: "Anzeigen",
    history: "Historie",
    noInvoicesYet: "Noch keine Rechnungen",
    invoicesWillAppear: "Rechnungen werden hier angezeigt, sobald sie generiert wurden",
    loadingUserInformation: "Lade Benutzerinformationen...",
    accessRestricted: "Zugriff eingeschränkt",
    accessRestrictedMessage: "Du hast keine Berechtigung, auf Zahlungsinformationen zuzugreifen.",
    contactAdministrator: "Kontaktiere deinen Administrator für den Zugriff.",
    amount: "Betrag:",
    invoiceNumber: "Rechnungsnummer:",
    issueDate: "Ausstellungsdatum:",
    dueDate: "Fälligkeitsdatum:",
    notes: "Notizen:",
  },
  profileScreen: {
    languageSelector: "Sprache / Language",
    selectLanguage: "Sprache auswählen",
    theme: "Thema",
    selectTheme: "Thema auswählen",
    namePlaceholder: "Name",
    emailPlaceholder: "E-Mail",
    phonePlaceholder: "Telefon",
    yourProfile: "Dein Profil",
    updateProfile: "PROFIL AKTUALISIEREN",
    logout: "ABMELDEN",
    profileUpdatedSuccess: "Dein Profil wurde erfolgreich aktualisiert!",
    profileUpdateFailed: "Fehler beim Aktualisieren des Profils. Bitte versuche es erneut.",
    invalidPhoneFormat: "Ungültiges Telefonformat (10 Ziffern oder +1XXXXXXXXXX)",
    completeProfileTitle: "Vervollständigen Sie Ihr Profil",
    completeProfileMessage: "Bitte vervollständigen Sie Ihr Profil, indem Sie eine Telefonnummer hinzufügen, bevor Sie fortfahren.",
    completeProfileMessageUnverified: "Bitte fügen Sie Ihre Telefonnummer hinzu, um Ihr Profil zu vervollständigen und auf alle Funktionen zuzugreifen.",
    errorUploadingAvatar: "Fehler beim Hochladen des Avatars",
  },
  reportsScreen: {
    selectPatient: "Patient auswählen:",
    choosePatient: "Wähle einen Patienten...",
    sentiment: "Stimmungen",
    medicalAnalysis: "Medizinische Analyse",
    comingSoon: "Demnächst",
    modalTitle: "Patient auswählen",
    modalCancel: "Abbrechen",
  },
  schedulesScreen: {
    scheduleDetails: "Zeitplan-Details",
    selectSchedule: "Wähle einen Zeitplan:",
    scheduleNumber: "Zeitplan",
    noSchedulesAvailable: "Keine Zeitpläne verfügbar. Bitte erstelle einen neuen.",
    errorLoadingSchedules: "Fehler beim Laden der Zeitpläne.",
  },
  scheduleComponent: {
    schedule: "Zeitplan",
    startTime: "Startzeit",
    frequency: "Häufigkeit",
    daily: "Täglich",
    weekly: "Wöchentlich",
    monthly: "Monatlich",
    sunday: "Sonntag",
    monday: "Montag",
    tuesday: "Dienstag",
    wednesday: "Mittwoch",
    thursday: "Donnerstag",
    friday: "Freitag",
    saturday: "Samstag",
    scheduleDetails: "Zeitplan-Details",
    active: "Aktiv",
  },
  conversationsScreen: {
    title: "Unterhaltungen",
    yesterday: "Gestern",
    noMessages: "Keine Nachrichten",
    noPatientSelected: "Kein Patient ausgewählt",
    firstConversation: "Keine vorherigen Unterhaltungen gefunden. Dies wird die erste Unterhaltung mit diesem Patienten sein.",
    noConversationsToDisplay: "Keine Unterhaltungen anzuzeigen",
    noPreviousConversations: "Keine vorherigen Unterhaltungen für diesen Patienten gefunden",
    errorFetchingConversations: "Fehler beim Laden der Unterhaltungen",
    loadingMoreConversations: "Lade weitere Unterhaltungen...",
  },
  caregiversScreen: {
    invited: "Eingeladen",
    edit: "Bearbeiten",
    noCaregiversFound: "Keine Betreuer gefunden",
    notAuthorized: "Nicht autorisiert",
    noPermissionToView: "Du hast keine Berechtigung, Betreuer anzuzeigen",
    addCaregiver: "Betreuer hinzufügen",
  },
  sentimentAnalysis: {
    lastCall: "Letzter Anruf",
    last30Days: "Letzte 30 Tage",
    allTime: "Gesamtzeit",
    noPatientSelected: "Kein Patient ausgewählt",
    selectPatientToView: "Bitte wähle einen Patienten vom Startbildschirm aus, um seine Stimmungsanalyse anzuzeigen.",
    patientSentimentAnalysis: "Patienten-Stimmungsanalyse",
    emotionalWellnessInsights: "Einblicke in emotionales Wohlbefinden und Trends",
    timeRange: "Zeitraum:",
    noSentimentDataAvailable: "Keine Stimmungsdaten verfügbar",
    noSentimentDataMessage: "Die Stimmungsanalyse wird hier angezeigt, sobald der Patient Unterhaltungen abgeschlossen hat.",
    loadingSentimentAnalysis: "Lade Stimmungsanalyse...",
    sentimentAnalysisFooter: "Die Stimmungsanalyse wird automatisch nach jeder Unterhaltung mit KI-Technologie generiert.",
    sentimentOverview: "Stimmungsübersicht",
    averageSentiment: "Durchschnittsstimmung",
    trend: "Trend",
    recentDistribution: "Aktuelle Verteilung",
    keyInsights: "Wichtige Erkenntnisse",
    totalConversations: "Gesamtunterhaltungen",
    analysisCoverage: "Analyseabdeckung",
    recentConversations: "Aktuelle Unterhaltungen",
    analyzed: "analysiert",
    latestAnalysis: "Neueste Analyse",
    conversationsAnalyzed: "Unterhaltungen analysiert",
    recentConversationsTitle: "Aktuelle Unterhaltungen",
    conversationsWithSentiment: "Unterhaltung{0} mit Stimmungen",
    keyEmotions: "Wichtige Emotionen",
    moreEmotions: "mehr Emotionen",
    patientMood: "Patientenstimmung",
    concern: "Besorgnis",
    confidence: "Vertrauen",
    noSentimentAnalysisAvailable: "Keine Stimmungsanalyse verfügbar",
    sentimentTrend: "Stimmungstrend",
    conversationsAnalyzedNoTrend: "Unterhaltung{0} analysiert{0} ohne klaren Trend",
    noSentimentData: "Keine Stimmungsdaten",
    avg: "Durchschnitt",
    negative: "Negativ",
    positive: "Positiv",
    lastCallAnalysis: "Letzter Anruf-Analyse",
    noRecentCall: "Kein aktueller Anruf",
    noRecentCallMessage: "Keine aktuellen Anrufe zum Analysieren. Anrufe werden hier angezeigt, sobald sie abgeschlossen sind.",
    duration: "Dauer",
    analysisDate: "Analysedatum",
    overallSentiment: "Gesamtstimmung",
    scoreRange: "Punktebereich",
    analysisConfidence: "Analysevertrauen",
    keyEmotionsDetected: "Wichtige erkannte Emotionen",
    patientMoodAssessment: "Patientenstimmungsbewertung",
    concernLevel: "Besorgnislevel",
    satisfactionIndicators: "Zufriedenheitsindikatoren",
    positiveIndicators: "Positive Indikatoren",
    areasOfConcern: "Besorgnisbereiche",
    aiSummary: "KI-Zusammenfassung",
    recommendations: "Empfehlungen",
    lowConcernDescription: "Niedriges Besorgnislevel - der Patient scheint in Ordnung zu sein.",
    mediumConcernDescription: "Mittleres Besorgnislevel - Nachverfolgung empfohlen.",
    highConcernDescription: "Hohes Besorgnislevel - sofortige Aufmerksamkeit erforderlich.",
    debugComplete: "Debug abgeschlossen",
    debugFailed: "Debug fehlgeschlagen",
    noPatient: "Kein Patient",
    pleaseSelectPatient: "Bitte wähle zuerst einen Patienten",
    conversationDebugComplete: "Unterhaltungs-Debug abgeschlossen",
    sentimentAnalysisDebug: "Stimmungsanalyse-Debug",
    debugSubtitle: "Debug-Tools für Stimmungsanalyse",
    debugging: "Debuggen...",
    debugSentimentAnalysis: "Stimmungsanalyse debuggen",
    loading: "Laden...",
    debugConversationData: "Unterhaltungsdaten debuggen",
    testing: "Testen...",
    testDirectApiCall: "Direkten API-Aufruf testen",
    forceRefreshCache: "Cache-Refresh erzwingen",
    cacheRefreshed: "Cache aktualisiert",
    cacheRefreshedMessage: "Der Cache wurde erfolgreich aktualisiert",
    currentPatient: "Aktueller Patient",
    noPatientSelected: "Kein Patient ausgewählt",
    debugResults: "Debug-Ergebnisse",
    totalConversations: "Gesamtunterhaltungen",
    withoutSentiment: "Ohne Stimmung",
    successfullyAnalyzed: "Erfolgreich analysiert",
    failedAnalyses: "Fehlgeschlagene Analysen",
    conversationDetails: "Unterhaltungsdetails",
    messages: "Nachrichten",
    sentiment: "Stimmung",
    score: "Punkte",
    mood: "Stimmung",
    emotions: "Emotionen",
    concernLevel: "Besorgnislevel",
    failed: "Fehlgeschlagen",
    noAnalysisPerformed: "Keine Analyse durchgeführt",
  },
  headers: {
    home: "Start",
    patient: "Patient",
    schedule: "Zeitplan",
    conversations: "Unterhaltungen",
    call: "Anruf",
    alerts: "Benachrichtigungen",
    logout: "Abmelden",
  },
  medicalAnalysis: {
    title: "Medizinische Analyse",
    error: "Fehler",
    success: "Erfolg",
    noPatientSelected: "Kein Patient ausgewählt",
    selectPatientToView: "Bitte wähle einen Patienten aus, um die medizinische Analyse anzuzeigen",
    triggering: "Auslösen...",
    triggerAnalysis: "Analyse auslösen",
    loadingResults: "Lade Analyseergebnisse...",
    noResultsAvailable: "Keine Analyseergebnisse verfügbar",
    triggerToGetStarted: "Löse eine Analyse aus, um zu beginnen",
    cognitiveHealth: "Kognitive Gesundheit",
    mentalHealth: "Psychische Gesundheit",
    language: "Sprache",
    risk: "Risiko",
    high: "Hoch",
    medium: "Mittel",
    low: "Niedrig",
    good: "Gut",
    fair: "Mittelmäßig",
    poor: "Schlecht",
    warningsInsights: "Warnungen und Erkenntnisse",
    analysisDetails: "Analysedetails",
    conversations: "Unterhaltungen",
    messages: "Nachrichten",
    totalWords: "Gesamtwörter",
    trigger: "Auslösen",
    trendsOverTime: "Trends über die Zeit",
    overallHealth: "Gesamtgesundheit",
    analyses: "Analysen",
    trendAnalysisComingSoon: "Trendanalyse demnächst",
    analysisResultsAvailable: "Analyseergebnisse verfügbar",
    basedOn: "Basierend auf",
    analysisResultsOver: "Analyseergebnisse über",
    loadFailed: "Fehler beim Laden der medizinischen Analyseergebnisse",
    triggerFailed: "Fehler beim Auslösen der medizinischen Analyse",
    triggerSuccess: "Medizinische Analyse erfolgreich ausgelöst. Ergebnisse erscheinen in etwa 10 Sekunden.",
  },
  homeScreen: {
    welcome: "Willkommen, {{name}}",
    guest: "Gast",
    addPatient: "Patient hinzufügen",
    adminOnlyMessage: "Nur Organisationsadministratoren und Superadministratoren können Patienten hinzufügen",
    noPatientsFound: "Keine Patienten gefunden",
    viewSchedules: "Zeitpläne anzeigen",
    noScheduleWarning: "⚠ Kein Zeitplan konfiguriert",
  },
  tabs: {
    home: "Start",
    org: "Organisation",
    reports: "Berichte",
    alerts: "Benachrichtigungen",
  },
  headers: {
    home: "Start",
    patient: "Patient",
    schedule: "Zeitplan",
    conversations: "Gespräche",
    call: "Anruf",
    profile: "Profil",
    logout: "Abmelden",
    alerts: "Benachrichtigungen",
    organization: "Organisation",
    caregivers: "Betreuer",
    caregiver: "Betreuer",
    caregiverInvited: "Betreuer eingeladen",
    payments: "Zahlungen",
    reports: "Berichte",
    sentimentAnalysis: "Stimmungsanalyse",
    medicalAnalysis: "Medizinische Analyse",
    privacyPolicy: "Datenschutzrichtlinie",
    privacyPractices: "HIPAA-Datenschutzpraktiken",
    termsOfService: "Nutzungsbedingungen",
    mentalHealthReport: "Psychischer Gesundheitsbericht",
    login: "Anmelden",
    register: "Registrieren",
  },
  orgScreen: {
    namePlaceholder: "Organisationsname",
    emailPlaceholder: "E-Mail",
    phonePlaceholder: "Organisationstelefon",
    save: "Speichern",
    viewCaregivers: "Betreuer anzeigen",
    inviteCaregiver: "Betreuer einladen",
    payments: "Zahlungen",
    organizationActions: "Organisationsaktionen",
    organizationLogo: "Organisationslogo",
    noLogoSet: "Kein Logo festgelegt",
  },
  caregiverScreen: {
    nameLabel: "Name *",
    namePlaceholder: "Betreuername eingeben",
    emailLabel: "E-Mail *",
    emailPlaceholder: "E-Mail-Adresse eingeben",
    phoneLabel: "Telefon *",
    phonePlaceholder: "Telefonnummer eingeben",
    updateCaregiver: "BETREUER AKTUALISIEREN",
    createCaregiver: "BETREUER ERSTELLEN",
    loadingUnassignedPatients: "Lade nicht zugewiesene Patienten...",
    assigningPatients: "Weise Patienten zu...",
    patientsAssignedSuccess: "Patienten erfolgreich zugewiesen!",
    loadingCaregivers: "Lade Betreuer...",
    confirmDelete: "LÖSCHUNG BESTÄTIGEN",
    deleteCaregiver: "BETREUER LÖSCHEN",
  },
  signupScreen: {
    title: "Vervollständige deine Einladung",
    fullNameLabel: "Vollständiger Name",
    fullNamePlaceholder: "Dein vollständiger Name",
    emailLabel: "E-Mail-Adresse",
    emailPlaceholder: "deine.email@beispiel.com",
    phoneLabel: "Telefonnummer",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "Passwort",
    passwordPlaceholder: "Gib dein Passwort ein",
    confirmPasswordLabel: "Passwort bestätigen",
    confirmPasswordPlaceholder: "Bestätige dein Passwort",
    completeRegistration: "Registrierung abschließen",
    preconfiguredMessage: "Dein Name, E-Mail und Organisationsdetails wurden von deinem Administrator vorkonfiguriert.",
    alreadyHaveAccount: "Haben Sie bereits ein Konto?",
    dontHaveAccount: "Haben Sie kein Konto?",
    termsAndConditions: "Geschäftsbedingungen",
    privacyPolicy: "Datenschutzrichtlinie",
    agreeToTerms: "Durch die Registrierung stimmen Sie unseren",
    and: "und",
  },
  confirmResetScreen: {
    title: "Passwort-Reset bestätigen",
    codeFieldLabel: "Reset-Code",
    codeFieldPlaceholder: "Reset-Code eingeben",
    newPasswordFieldLabel: "Neues Passwort",
    newPasswordFieldPlaceholder: "Ihr neues Passwort eingeben",
    confirmPasswordFieldLabel: "Neues Passwort bestätigen",
    confirmPasswordFieldPlaceholder: "Ihr neues Passwort bestätigen",
    confirmReset: "Reset bestätigen",
    successMessage: "Passwort erfolgreich zurückgesetzt!",
    requestFailed: "Reset fehlgeschlagen. Bitte überprüfen Sie Ihren Code und versuchen Sie es erneut.",
  },
  themes: {
    healthcare: {
      name: "Gesundheitswesen",
      description: "Professionelles medizinisches Thema mit blauen und grünen Farben",
    },
    colorblind: {
      name: "Farbenblindfreundlich",
      description: "Hochkontrast-Thema optimiert für Farbsehschwäche",
    },
    dark: {
      name: "Dunkler Modus",
      description: "Dunkles Thema optimiert für Umgebungen mit wenig Licht",
    },
    accessibility: {
      wcagLevel: "WCAG-Level",
      colorblindFriendly: "Farbenblindfreundlich",
      highContrast: "Hochkontrast",
      darkMode: "Dunkler Modus",
    },
  },
  privacyPracticesScreen: {
    content: `# Hinweis zu Datenschutzpraktiken
## MyPhoneFriend Healthcare Communication Services

**Gültigkeitsdatum**: 15. Oktober 2025

---

## IHRE INFORMATIONEN. IHRE RECHTE. UNSERE VERANTWORTUNGEN.

**DIESER HINWEIS BESCHREIBT, WIE MEDIZINISCHE INFORMATIONEN ÜBER SIE VERWENDET UND OFFENGELEGT WERDEN KÖNNEN UND WIE SIE ZUGANG ZU DIESEN INFORMATIONEN ERHALTEN KÖNNEN. BITTE LESEN SIE ES SORGFÄLTIG DURCH.**

---

## IHRE RECHTE

Sie haben das Recht:
- Eine Kopie Ihrer Gesundheitsinformationen zu erhalten
- Ihre Gesundheitsinformationen zu korrigieren
- Vertrauliche Kommunikation anzufordern
- Uns zu bitten, die Informationen, die wir teilen, zu begrenzen
- Eine Liste derjenigen zu erhalten, mit denen wir Ihre Informationen geteilt haben
- Eine Kopie dieser Datenschutzerklärung zu erhalten
- Jemanden zu wählen, der für Sie handelt
- Eine Beschwerde einzureichen, wenn Sie glauben, dass Ihre Datenschutzrechte verletzt wurden

---

## IHRE WAHLMÖGLICHKEITEN

Sie haben einige Wahlmöglichkeiten, wie wir Informationen verwenden und teilen, wenn wir:
- Fragen Ihrer Familie und Freunde zu Ihrer Pflege beantworten
- Informationen über Sie in Katastrophenhilfesituationen bereitstellen

**Wir teilen Ihre Informationen niemals für Marketing oder Verkauf Ihrer Daten.**

---

# IHRE DETAILLIERTEN RECHTE

## Kopie Ihrer Gesundheitsinformationen erhalten

**Sie können verlangen, Ihre Gesundheitsinformationen einzusehen oder eine Kopie zu erhalten.**

Was Sie anfordern können:
- Anrufaufzeichnungen und Transkriptionen
- Gesundheitszusammenfassungen und KI-Analyseergebnisse
- Von unserem System generierte medizinische Warnungen
- Notfallbenachrichtigungen
- Kontoinformationen und Einstellungen

**So fordern Sie an**:
- E-Mail: privacy@biancawellness.com
- Telefon: +1-604-562-4263

**Unsere Antwort**: Innerhalb von 30 Tagen

---

## Bitten Sie uns, Ihre Gesundheitsinformationen zu korrigieren

**Sie können uns bitten, Gesundheitsinformationen zu korrigieren, die Sie für falsch oder unvollständig halten.**

**Unsere Antwort**: Innerhalb von 60 Tagen

---

## Vertrauliche Kommunikation anfordern

**Sie können uns bitten, Sie auf eine bestimmte Weise oder an einem bestimmten Ort zu kontaktieren.**

Beispiele:
- "Bitte senden Sie mir eine E-Mail, anstatt anzurufen"
- "Bitte kontaktieren Sie mich nur auf meinem Handy"

Wir werden alle angemessenen Anfragen erfüllen.

---

## Bitten Sie uns, zu begrenzen, was wir verwenden oder teilen

**Sie können uns bitten, bestimmte Gesundheitsinformationen nicht zu verwenden oder zu teilen.**

Wir müssen zustimmen, wenn Sie vollständig aus eigener Tasche bezahlt haben und uns bitten, nicht mit Ihrem Gesundheitsplan zu teilen.

---

## Liste der Offenlegungen erhalten

**Sie können eine "Rechnungslegung der Offenlegungen" anfordern** - eine Liste der Zeiten, in denen wir Ihre Gesundheitsinformationen geteilt haben.

Umfasst: Letzte 6 Jahre  
Schließt aus: Offenlegungen für Behandlung, Zahlung und Betrieb (es sei denn, Sie fordern es an)

---

## Beschwerde einreichen

**Bei uns einreichen**:
- E-Mail: privacy@biancawellness.com
- Telefon: +1-604-562-4263

**Bei HHS einreichen**:
- Website: https://www.hhs.gov/hipaa/filing-a-complaint
- Telefon: 1-800-368-1019

**Wir werden Sie nicht für die Einreichung einer Beschwerde bestrafen.**

---

# UNSERE VERWENDUNGEN UND OFFENLEGUNGEN

## Wie wir Ihre Gesundheitsinformationen verwenden

**Für Behandlung**:
- Bereitstellung von KI-Gesundheitszusammenfassungen für Ihre Betreuer
- Generierung von Notfallwarnungen für dringende Situationen
- Ermöglichen Sie Betreuern, Ihr Wohlbefinden zu überwachen
- Erleichterung der Kommunikation mit Ihrem Pflegeteam

**Für Zahlung**:
- Abrechnung Ihrer Gesundheitsorganisation für Dienstleistungen
- Verarbeitung von Rechnungen für Anrufzeit und Analyse

**Für Gesundheitsbetriebe**:
- Verbesserung unserer KI-Erkennungsalgorithmen
- Qualitätssicherung und -verbesserung
- Schulung unserer Systeme, um Patienten besser zu dienen

---

## Mit wem wir teilen

**Ihre Gesundheitsorganisation**:
- Ihre zugewiesenen Betreuer und Pflegekoordinatoren
- Organisationsadministratoren für Abrechnung

**Geschäftspartner** (Dienstleister):
- KI-Dienste (Azure OpenAI): Für Transkription und Analyse
- Sprachdienste (Twilio): Für Telefonanrufbehandlung
- Cloud-Hosting (AWS): Für sichere Datenspeicherung
- Datenbank (MongoDB Atlas): Für Datenverwaltung

Alle Geschäftspartner unterzeichnen Geschäftspartnervereinbarungen und müssen Ihre Informationen schützen.

**Wie gesetzlich vorgeschrieben**:
- Notdienste (911), wenn Notfall erkannt wird
- Gesundheitsbehörden (Missbrauchs-, Vernachlässigungsmeldung)
- Strafverfolgung (mit gültigem Rechtsbefehl)

**Wir tun NICHT**:
- ❌ Verkaufen Sie Ihre Gesundheitsinformationen
- ❌ Mit Vermarktern oder Werbetreibenden teilen
- ❌ Ohne Ihre Autorisierung für Marketing verwenden
- ❌ In sozialen Medien teilen

---

# GESUNDHEITSINFORMATIONEN, DIE WIR SAMMELN

**Während der Nutzung unserer Dienste**:
- Patientename, Telefonnummer, Geburtsdatum
- Anrufaufzeichnungen und Transkriptionen
- Gesundheitsbezogene Informationen aus Anrufen (Symptome, Medikamente, Stimmung)
- Notfallwarnungen und Vorfälle
- Gesundheitstrends und -muster
- Betreuernotizen und Beobachtungen
- Medizinische Analyseergebnisse von KI

---

# IHRE VERANTWORTUNGEN

**Wenn Sie unseren Dienst verwenden, um eine andere Person anzurufen**, sind Sie verantwortlich für:
- Erhalt der notwendigen Einverständnisse für Aufzeichnung
- Sicherstellung, dass sie den Dienst verstehen
- Befolgung der geltenden Aufzeichnungseinverständnisgesetze

---

# VERLETZUNGSBENACHRICHTIGUNG

**Wenn auf Ihre Gesundheitsinformationen unangemessen zugegriffen oder sie offengelegt werden**, werden wir:
- Den Vorfall untersuchen
- Sie innerhalb von 60 Tagen benachrichtigen, wenn meldepflichtige Verletzung
- Erklären, was passiert ist und was wir tun
- Informationen zu Schritten bereitstellen, die Sie unternehmen können

---

# ÄNDERUNGEN AN DIESEM HINWEIS

- Wir können diesen Hinweis ändern und Änderungen gelten für alle Informationen, die wir haben
- Neuer Hinweis wird in der App und auf unserer Website verfügbar sein
- Sie können jederzeit eine aktuelle Kopie anfordern

---

# KONTAKTINFORMATIONEN

**Datenschutzbeauftragter**:
- E-Mail: privacy@biancawellness.com
- Telefon: +1-604-562-4263
- Post: MyPhoneFriend Privacy Office, 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

**Stunden**: Montag-Freitag, 9-17 Uhr PST

---

# BESCHWERDE EINREICHEN

**Bei uns**:
- E-Mail: privacy@biancawellness.com
- Telefon: +1-604-562-4263

**Bei der Bundesregierung (HHS)**:
- Website: https://www.hhs.gov/hipaa/filing-a-complaint
- Telefon: 1-800-368-1019
- Post: Office for Civil Rights, U.S. Department of Health and Human Services, 200 Independence Avenue S.W., Washington, D.C. 20201

---

**Gültigkeitsdatum**: 15. Oktober 2025  
**Version**: 1.0

Dieser Hinweis zu Datenschutzpraktiken entspricht der HIPAA-Datenschutzregel (45 CFR §164.520)

---

## Sprachunterstützung

**Englisch**: Wenn Sie Hilfe beim Verstehen dieses Hinweises benötigen, kontaktieren Sie privacy@biancawellness.com

**Español**: Si necesita ayuda, comuníquese con privacy@biancawellness.com`,
  },
  mfa: {
    setupTitle: "Multi-Faktor-Authentifizierung",
    setupSubtitle: "Fügen Sie eine zusätzliche Sicherheitsebene zu Ihrem Konto hinzu",
    setupInstructions: "Scannen Sie den QR-Code mit Ihrer Authentifizierungs-App und geben Sie dann den Code zur Überprüfung ein.",
    verificationTitle: "Zwei-Faktor-Authentifizierung",
    verificationSubtitle: "Geben Sie den 6-stelligen Code von Ihrer Authentifizierungs-App ein",
    tokenLabel: "Bestätigungscode",
    tokenPlaceholder: "000000",
    pleaseEnterVerificationCode: "Bitte geben Sie den Bestätigungscode von Ihrer Authentifizierungs-App ein",
    verifyButton: "Überprüfen",
    useBackupCode: "Backup-Code verwenden",
    verifyAndEnable: "Überprüfen und aktivieren",
    enable: "MFA aktivieren",
    enableMFA: "Multi-Faktor-Authentifizierung aktivieren",
    manageMFA: "Multi-Faktor-Authentifizierung verwalten",
    disable: "MFA deaktivieren",
    disableTitle: "MFA deaktivieren",
    disableSubtitle: "Geben Sie Ihren aktuellen MFA-Code ein, um die Multi-Faktor-Authentifizierung zu deaktivieren",
    disableConfirmTitle: "MFA deaktivieren?",
    disableConfirmMessage: "Sind Sie sicher, dass Sie die Multi-Faktor-Authentifizierung deaktivieren möchten? Dies verringert die Sicherheit Ihres Kontos.",
    enabled: "Aktiviert",
    disabled: "Deaktiviert",
    enabledSuccess: "Die Multi-Faktor-Authentifizierung wurde erfolgreich aktiviert.",
    disabledSuccess: "Die Multi-Faktor-Authentifizierung wurde deaktiviert.",
    status: "Status",
    enrolledOn: "Registriert am",
    backupCodesRemaining: "Verbleibende Backup-Codes",
    backupCodesTitle: "Backup-Codes",
    backupCodesWarning: "Speichern Sie diese Codes an einem sicheren Ort. Sie können sie verwenden, um auf Ihr Konto zuzugreifen, wenn Sie Ihr Authentifizierungsgerät verlieren.",
    backupCodeLength: "Backup-Codes sind 8 Zeichen lang",
    regenerateBackupCodes: "Backup-Codes neu generieren",
    regenerateBackupCodesTitle: "Backup-Codes neu generieren?",
    regenerateBackupCodesSubtitle: "Geben Sie Ihren aktuellen MFA-Code ein, um neue Backup-Codes zu generieren",
    regenerateBackupCodesMessage: "Ihre alten Backup-Codes funktionieren nicht mehr. Stellen Sie sicher, dass Sie die neuen Codes sicher speichern.",
    regenerate: "Neu generieren",
    backupCodesRegenerated: "Backup-Codes neu generiert",
    backupCodesRegeneratedMessage: "Ihre neuen Backup-Codes wurden generiert. Bitte speichern Sie sie sicher.",
    secretLabel: "Oder geben Sie dieses Geheimnis manuell ein:",
    invalidTokenLength: "Bitte geben Sie einen 6-stelligen Code ein",
    verificationFailed: "Ungültiger Code. Bitte versuchen Sie es erneut.",
    enableFailed: "MFA-Aktivierung fehlgeschlagen",
    disableFailed: "MFA-Deaktivierung fehlgeschlagen. Bitte überprüfen Sie Ihren Code.",
    regenerateFailed: "Backup-Codes konnten nicht neu generiert werden.",
  },
}

export default de
