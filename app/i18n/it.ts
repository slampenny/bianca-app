import { Translations } from "./en"

const it: Translations = {
  common: {
    ok: "OK",
    cancel: "Annulla",
    close: "Chiudi",
    error: "Errore",
    anErrorOccurred: "Si è verificato un errore",
    back: "Indietro",
    logOut: "Esci",
    selectImage: "Seleziona immagine",
    calling: "Chiamando...",
    callNow: "Chiama ora",
    ending: "Terminando...",
    endCall: "Termina chiamata",
    loading: "Caricamento...",
  },
  alertScreen: {
    markAllAsRead: "Segna tutto come letto",
    unreadAlerts: "Avvisi non letti",
    allAlerts: "Tutti gli avvisi",
    noAlerts: "Nessun avviso",
    noAlertsTitle: "Tutto aggiornato!",
    noAlertsSubtitle: "Non hai avvisi non letti. Ottimo lavoro nel rimanere aggiornato!",
    emptyHeading: "Così vuoto... così triste",
    refreshing: "Aggiornamento...",
    refresh: "Aggiorna",
    patient: "Paziente:",
    importance: "Importanza:",
    expires: "Scade:",
  },
  legalLinks: {
    privacyPolicy: "Informativa sulla privacy",
    privacyPractices: "Pratiche sulla Privacy HIPAA",
    termsOfService: "Termini di servizio",
  },
  welcomeScreen: {
    postscript: "psst — Probabilmente non è così che appare la tua app. (A meno che il tuo designer non ti abbia dato questi schermi, in tal caso, mettila in produzione!)",
    readyForLaunch: "La tua app, quasi pronta per il lancio!",
    exciting: "(ohh, è emozionante!)",
    letsGo: "Andiamo!",
  },
  errorScreen: {
    title: "Qualcosa è andato storto!",
    friendlySubtitle: "Si è verificato un errore. Probabilmente vorrai personalizzare anche il design (`app/screens/ErrorScreen`). Se vuoi rimuoverlo completamente, controlla `app/app.tsx` per il componente <ErrorBoundary>.",
    reset: "RIAVVIA APP",
    traceTitle: "Stack di errore %{name}",
  },
  emptyStateComponent: {
    generic: {
      heading: "Così vuoto... così triste",
      content: "Nessun dato trovato ancora. Prova a cliccare sul pulsante per aggiornare o ricaricare l'app.",
      button: "Proviamo di nuovo",
    },
  },
  errors: {
    invalidEmail: "Indirizzo email non valido.",
  },
  loginScreen: {
    signIn: "Accedi",
    register: "Registrati",
    enterDetails: "Inserisci i tuoi dettagli qui sotto per sbloccare informazioni top secret. Non indovinerai mai cosa abbiamo in serbo per te. O forse sì; non è scienza missilistica qui.",
    emailFieldLabel: "Email",
    passwordFieldLabel: "Password",
    emailFieldPlaceholder: "Inserisci il tuo indirizzo email",
    passwordFieldPlaceholder: "Password super segreta qui",
    forgotPassword: "Password dimenticata?",
    hint: "Suggerimento: puoi usare qualsiasi indirizzo email e la tua password preferita :)",
  },
  logoutScreen: {
    logoutButton: "Esci",
    logoutMessage: "Sei sicuro?",
  },
  registerScreen: {
    title: "Registrati",
    nameFieldLabel: "Nome",
    emailFieldLabel: "Email",
    phoneFieldLabel: "Telefono",
    passwordFieldLabel: "Password",
    goBack: "Indietro",
    confirmPasswordFieldLabel: "Conferma password",
    organizationNameFieldLabel: "Nome organizzazione",
    nameFieldPlaceholder: "Inserisci il tuo nome",
    emailFieldPlaceholder: "Inserisci il tuo indirizzo email",
    passwordFieldPlaceholder: "Inserisci la tua password",
    confirmPasswordFieldPlaceholder: "Conferma la tua password",
    phoneFieldPlaceholder: "(xxx)xxx-xxxx",
    organizationNameFieldPlaceholder: "Inserisci il nome della tua organizzazione",
    organizationButton: "Organizzazione",
    individualButton: "Individuale",
    individualExplanation: "Registrati come individuo per uso personale.",
    organizationExplanation: "Registrati come organizzazione per uso aziendale o di gruppo.",
    consentText: "Registrandoti, accetti i nostri",
    consentAnd: "e",
    termsOfService: "Termini di servizio",
    privacyPolicy: "Informativa sulla privacy",
  },
  signupScreen: {
    title: "Completa il tuo invito",
    fullNameLabel: "Nome completo",
    fullNamePlaceholder: "Il tuo nome completo",
    emailLabel: "Indirizzo email",
    emailPlaceholder: "tua.email@esempio.com",
    phoneLabel: "Numero di telefono",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "Password",
    passwordPlaceholder: "Inserisci la tua password",
    confirmPasswordLabel: "Conferma password",
    confirmPasswordPlaceholder: "Conferma la tua password",
    completeRegistration: "Completa registrazione",
    preconfiguredMessage: "Il tuo nome, email e dettagli dell'organizzazione sono stati preconfigurati dal tuo amministratore.",
  },
  homeScreen: {
    welcome: "Benvenuto, {{name}}",
    guest: "Ospite",
    addPatient: "Aggiungi paziente",
    adminOnlyMessage: "Solo gli amministratori dell'organizzazione e i super amministratori possono aggiungere pazienti",
    noPatientsFound: "Nessun paziente trovato",
  },
  tabs: {
    home: "Home",
    org: "Org",
    reports: "Rapporti",
    alerts: "Avvisi",
  },
  headers: {
    home: "Home",
    patient: "Paziente",
    schedule: "Programma",
    conversations: "Conversazioni",
    call: "Chiamata",
    profile: "Profilo",
    logout: "Esci",
    alerts: "Avvisi",
    organization: "Organizzazione",
    caregivers: "Badanti",
    caregiver: "Badante",
    caregiverInvited: "Badante invitato",
    payments: "Pagamenti",
    reports: "Rapporti",
    sentimentAnalysis: "Analisi del sentimento",
    medicalAnalysis: "Analisi medica",
    privacyPolicy: "Informativa sulla privacy",
    termsOfService: "Termini di servizio",
    mentalHealthReport: "Rapporto salute mentale",
  },
  loginScreen: {
    signIn: "Accedi",
    register: "Registrati",
    enterDetails: "Inserisci i tuoi dettagli qui sotto per sbloccare informazioni segrete. Non indovinerai mai cosa abbiamo in serbo per te. O forse sì; non è scienza missilistica qui.",
    emailFieldLabel: "Email",
    passwordFieldLabel: "Password",
    emailFieldPlaceholder: "Inserisci il tuo indirizzo email",
    passwordFieldPlaceholder: "Password super segreta qui",
    forgotPassword: "Password dimenticata?",
    hint: "Suggerimento: puoi usare qualsiasi indirizzo email e la tua password preferita :)",
  },
  logoutScreen: {
    logoutButton: "Esci",
    logoutMessage: "Sei sicuro?",
  },
  registerScreen: {
    title: "Registrati",
    nameFieldLabel: "Nome",
    emailFieldLabel: "Email",
    phoneFieldLabel: "Telefono",
    passwordFieldLabel: "Password",
    goBack: "Indietro",
    confirmPasswordFieldLabel: "Conferma password",
    organizationNameFieldLabel: "Nome organizzazione",
    nameFieldPlaceholder: "Inserisci il tuo nome",
    emailFieldPlaceholder: "Inserisci il tuo indirizzo email",
    passwordFieldPlaceholder: "Inserisci la tua password",
    confirmPasswordFieldPlaceholder: "Conferma la tua password",
    organizationNameFieldPlaceholder: "Inserisci il nome della tua organizzazione",
    signUp: "Registrati",
    signIn: "Accedi",
    alreadyHaveAccount: "Hai già un account?",
    dontHaveAccount: "Non hai un account?",
    termsAndConditions: "Termini e condizioni",
    privacyPolicy: "Informativa sulla privacy",
    agreeToTerms: "Registrandoti, accetti i nostri",
    and: "e",
  },
  requestResetScreen: {
    title: "Richiedi reset password",
    emailFieldLabel: "Email",
    emailFieldPlaceholder: "Inserisci il tuo indirizzo email",
    requestReset: "Richiedi reset",
    successMessage: "Codice di reset inviato alla tua email!",
    requestFailed: "Richiesta fallita. Per favore controlla la tua email e riprova.",
  },
  ssoLinkingScreen: {
    title: "Collega il tuo account",
    message: "Questo account è stato creato con {{provider}}. Per utilizzare l'accesso con email/password, imposta una password qui sotto, oppure continua con {{provider}}.",
    passwordLabel: "Password",
    passwordPlaceholder: "Inserisci la tua password",
    confirmPasswordLabel: "Conferma password",
    confirmPasswordPlaceholder: "Conferma la tua password",
    setPasswordButton: "Imposta password",
    backToLoginButton: "Torna al login",
    orDivider: "Oppure",
    successMessage: "✓ Password impostata con successo! Ora puoi accedere con la tua email e password.",
    errorNoPassword: "Inserisci una password",
    errorNoConfirmPassword: "Conferma la tua password",
    errorPasswordMismatch: "Le password non corrispondono",
    errorPasswordTooShort: "La password deve essere di almeno 8 caratteri",
    errorSetPasswordFailed: "Impostazione password fallita",
    errorSSOFailed: "Accesso SSO fallito. Riprova.",
    providerGoogle: "Google",
    providerMicrosoft: "Microsoft",
    providerSSO: "SSO",
  },
  ssoButtons: {
    orContinueWith: "Oppure continua con",
    google: "Google",
    microsoft: "Microsoft",
    companySSO: "SSO aziendale",
    ssoNotAvailable: "SSO non disponibile",
    signInFailed: "Accesso fallito",
    companySSOTitle: "SSO aziendale",
    companySSOMessage: "Questo reindirizzerebbe al provider SSO della tua azienda. Contatta il tuo amministratore per la configurazione.",
  },
  emailVerificationScreen: {
    title: "Controlla la tua email",
    message: "Abbiamo inviato un link di verifica al tuo indirizzo email. Per favore clicca sul link per verificare il tuo account prima di accedere.",
    emailFieldLabel: "Indirizzo email",
    emailFieldPlaceholder: "Inserisci il tuo indirizzo email",
    resendButton: "Reinvia email di verifica",
    backToLoginButton: "Torna al login",
    successMessage: "✓ Email di verifica inviata! Controlla la tua casella di posta.",
    errorNoEmail: "Per favore inserisci il tuo indirizzo email",
    errorSendFailed: "Invio email di verifica fallito",
  },
  emailVerifiedScreen: {
    title: "Email verificata!",
    message: "Il tuo account My Phone Friend è stato verificato con successo.",
    redirecting: "Reindirizzamento all'app...",
  },
  conversationsScreen: {
    title: "Conversazioni",
    yesterday: "Ieri",
    noMessages: "Nessun messaggio",
    noPatientSelected: "Nessun paziente selezionato",
    firstConversation: "Nessuna conversazione precedente trovata. Questa sarà la prima conversazione con questo paziente.",
    noConversationsToDisplay: "Nessuna conversazione da visualizzare",
    noPreviousConversations: "Nessuna conversazione precedente trovata per questo paziente",
    errorFetchingConversations: "Errore nel recupero delle conversazioni",
    loadingMoreConversations: "Caricamento di più conversazioni...",
  },
  patientScreen: {
    nameLabel: "Nome *",
    namePlaceholder: "Inserisci il nome del paziente",
    emailLabel: "Email *",
    emailPlaceholder: "Inserisci l'indirizzo email",
    phoneLabel: "Telefono *",
    phonePlaceholder: "Inserisci il numero di telefono",
    preferredLanguageLabel: "Lingua preferita",
    updatePatient: "AGGIORNA PAZIENTE",
    createPatient: "CREA PAZIENTE",
    manageSchedules: "GESTISCI ORARI",
    manageConversations: "GESTISCI CONVERSAZIONI",
    viewSentimentAnalysis: "VISUALIZZA ANALISI SENTIMENTI",
    manageCaregivers: "GESTISCI ASSISTENTI",
    confirmDelete: "CONFERMA ELIMINAZIONE",
    deletePatient: "ELIMINA PAZIENTE",
  },
  paymentScreen: {
    paid: "Pagato",
    pending: "In sospeso",
    overdue: "Scaduto",
    processing: "Elaborazione",
    unknown: "Sconosciuto",
    latestInvoice: "Fattura più recente",
    paymentMethod: "Metodo di pagamento",
    currentChargesSummary: "Riepilogo addebiti correnti",
    basicPlan: "Piano base",
    contactSupport: "Contatta supporto",
    currentCharges: "Addebiti correnti",
    paymentMethods: "Metodi di pagamento",
    billingInfo: "Informazioni fatturazione",
    noOrganizationData: "Nessun dato organizzazione disponibile",
    authorizationTokenNotAvailable: "Token di autorizzazione non disponibile",
    errorLoadingCurrentCharges: "Errore nel caricamento degli addebiti correnti",
    noPendingCharges: "Nessun addebito in sospeso",
    allConversationsBilled: "Tutte le conversazioni sono state fatturate",
    totalUnbilledAmount: "Importo totale non fatturato",
    period: "Periodo",
    lastDays: "Ultimi {days} giorni",
    patients: "pazienti",
    patient: "paziente",
    chargesByPatient: "Addebiti per paziente",
    average: "Media",
    noUserData: "Nessun dato utente disponibile",
    currentPlan: "Piano corrente",
    nextBillingDate: "Prossima data di fatturazione",
    totalBilledAmount: "Importo totale fatturato",
    acrossInvoices: "in {count} fattura{e}",
    invoiceHistory: "Cronologia fatture ({count})",
    hide: "Nascondi",
    show: "Mostra",
    history: "cronologia",
    noInvoicesYet: "Nessuna fattura ancora",
    invoicesWillAppear: "Le fatture appariranno qui una volta generate",
    loadingUserInformation: "Caricamento informazioni utente...",
    accessRestricted: "Accesso limitato",
    accessRestrictedMessage: "Non hai il permesso di accedere alle informazioni di pagamento.",
    contactAdministrator: "Contatta il tuo amministratore per l'accesso.",
    amount: "Importo:",
    invoiceNumber: "Numero fattura:",
    issueDate: "Data emissione:",
    dueDate: "Data scadenza:",
    notes: "Note:",
  },
  profileScreen: {
    languageSelector: "Lingua / Language",
    selectLanguage: "Seleziona lingua",
    theme: "Tema",
    selectTheme: "Seleziona tema",
    namePlaceholder: "Nome",
    emailPlaceholder: "Email",
    phonePlaceholder: "Telefono",
    yourProfile: "Il tuo profilo",
    updateProfile: "AGGIORNA PROFILO",
    logout: "ESCI",
    profileUpdatedSuccess: "Il tuo profilo è stato aggiornato con successo!",
    profileUpdateFailed: "Aggiornamento profilo fallito. Per favore riprova.",
    invalidPhoneFormat: "Formato telefono non valido (10 cifre o +1XXXXXXXXXX)",
    completeProfileTitle: "Completa il tuo profilo",
    completeProfileMessage: "Completa il tuo profilo aggiungendo un numero di telefono prima di continuare.",
    completeProfileMessageUnverified: "Aggiungi il tuo numero di telefono per completare il tuo profilo e accedere a tutte le funzionalità.",
    errorUploadingAvatar: "Errore durante il caricamento dell'avatar",
  },
  reportsScreen: {
    selectPatient: "Seleziona paziente:",
    choosePatient: "Scegli un paziente...",
    sentiment: "Sentimenti",
    medicalAnalysis: "Analisi medica",
    comingSoon: "Prossimamente",
    modalTitle: "Seleziona paziente",
    modalCancel: "Annulla",
  },
  schedulesScreen: {
    scheduleDetails: "Dettagli orario",
    selectSchedule: "Seleziona un orario:",
    scheduleNumber: "Orario",
    noSchedulesAvailable: "Nessun orario disponibile. Per favore creane uno nuovo.",
    errorLoadingSchedules: "Errore nel caricamento degli orari.",
  },
  scheduleComponent: {
    schedule: "Orario",
    startTime: "Ora di inizio",
    frequency: "Frequenza",
    daily: "Giornaliero",
    weekly: "Settimanale",
    monthly: "Mensile",
    sunday: "Domenica",
    monday: "Lunedì",
    tuesday: "Martedì",
    wednesday: "Mercoledì",
    thursday: "Giovedì",
    friday: "Venerdì",
    saturday: "Sabato",
    scheduleDetails: "Dettagli orario",
    active: "Attivo",
  },
  conversationsScreen: {
    title: "Conversazioni",
    yesterday: "Ieri",
    noMessages: "Nessun messaggio",
    noPatientSelected: "Nessun paziente selezionato",
    firstConversation: "Nessuna conversazione precedente trovata. Questa sarà la prima conversazione con questo paziente.",
    noConversationsToDisplay: "Nessuna conversazione da visualizzare",
    noPreviousConversations: "Nessuna conversazione precedente trovata per questo paziente",
    errorFetchingConversations: "Errore nel recupero delle conversazioni",
    loadingMoreConversations: "Caricamento di più conversazioni...",
  },
  caregiverScreen: {
    namePlaceholder: "Nome",
    emailPlaceholder: "Email",
    phonePlaceholder: "Telefono",
    loadingUnassignedPatients: "Caricamento pazienti non assegnati...",
    assigningPatients: "Assegnazione pazienti...",
    patientsAssignedSuccess: "Pazienti assegnati con successo!",
    loadingCaregivers: "Caricamento caregiver...",
  },
  caregiversScreen: {
    invited: "Invitato",
    edit: "Modifica",
    noCaregiversFound: "Nessun assistente trovato",
    notAuthorized: "Non autorizzato",
    noPermissionToView: "Non hai il permesso di visualizzare gli assistenti",
    addCaregiver: "Aggiungi assistente",
  },
  sentimentAnalysis: {
    lastCall: "Ultima chiamata",
    last30Days: "Ultimi 30 giorni",
    allTime: "Tutto il tempo",
    noPatientSelected: "Nessun paziente selezionato",
    selectPatientToView: "Per favore seleziona un paziente dalla schermata home per visualizzare la sua analisi dei sentimenti.",
    patientSentimentAnalysis: "Analisi sentimenti paziente",
    emotionalWellnessInsights: "Insights benessere emotivo e tendenze",
    timeRange: "Intervallo di tempo:",
    noSentimentDataAvailable: "Nessun dato sentimenti disponibile",
    noSentimentDataMessage: "L'analisi dei sentimenti apparirà qui una volta che il paziente avrà completato le conversazioni.",
    loadingSentimentAnalysis: "Caricamento analisi sentimenti...",
    sentimentAnalysisFooter: "L'analisi dei sentimenti viene generata automaticamente dopo ogni conversazione usando tecnologia AI.",
    sentimentOverview: "Panoramica sentimenti",
    averageSentiment: "Sentimento medio",
    trend: "tendenza",
    recentDistribution: "Distribuzione recente",
    keyInsights: "Insights chiave",
    totalConversations: "Totale conversazioni",
    analysisCoverage: "Copertura analisi",
    recentConversations: "Conversazioni recenti",
    analyzed: "analizzate",
    latestAnalysis: "Analisi più recente",
    conversationsAnalyzed: "conversazioni analizzate",
    recentConversationsTitle: "Conversazioni recenti",
    conversationsWithSentiment: "conversazione{0} con sentimenti",
    keyEmotions: "Emozioni chiave",
    moreEmotions: "più emozioni",
    patientMood: "Umore paziente",
    concern: "preoccupazione",
    confidence: "fiducia",
    noSentimentAnalysisAvailable: "Nessuna analisi sentimenti disponibile",
    sentimentTrend: "Tendenza sentimenti",
    conversationsAnalyzedNoTrend: "conversazione{0} analizzate{0} senza tendenza chiara",
    noSentimentData: "Nessun dato sentimenti",
    avg: "Media",
    negative: "Negativo",
    positive: "Positivo",
    lastCallAnalysis: "Analisi ultima chiamata",
    noRecentCall: "Nessuna chiamata recente",
    noRecentCallMessage: "Nessuna chiamata recente da analizzare. Le chiamate appariranno qui una volta completate.",
    duration: "Durata",
    analysisDate: "Data analisi",
    overallSentiment: "Sentimento generale",
    scoreRange: "Intervallo punteggio",
    analysisConfidence: "Fiducia analisi",
    keyEmotionsDetected: "Emozioni chiave rilevate",
    patientMoodAssessment: "Valutazione umore paziente",
    concernLevel: "Livello preoccupazione",
    satisfactionIndicators: "Indicatori soddisfazione",
    positiveIndicators: "Indicatori positivi",
    areasOfConcern: "Aree di preoccupazione",
    aiSummary: "Riassunto AI",
    recommendations: "Raccomandazioni",
    lowConcernDescription: "Livello preoccupazione basso - il paziente sembra stare bene.",
    mediumConcernDescription: "Livello preoccupazione medio - follow-up raccomandato.",
    highConcernDescription: "Livello preoccupazione alto - attenzione immediata necessaria.",
    debugComplete: "Debug completato",
    debugFailed: "Debug fallito",
    noPatient: "Nessun paziente",
    pleaseSelectPatient: "Per favore seleziona prima un paziente",
    conversationDebugComplete: "Debug conversazione completato",
    sentimentAnalysisDebug: "Debug analisi sentimenti",
    debugSubtitle: "Strumenti debug per analisi sentimenti",
    debugging: "Debug in corso...",
    debugSentimentAnalysis: "Debug analisi sentimenti",
    loading: "Caricamento...",
    debugConversationData: "Debug dati conversazione",
    testing: "Test in corso...",
    testDirectApiCall: "Testa chiamata API diretta",
    forceRefreshCache: "Forza aggiornamento cache",
    cacheRefreshed: "Cache aggiornata",
    cacheRefreshedMessage: "La cache è stata aggiornata con successo",
    currentPatient: "Paziente corrente",
    noPatientSelected: "Nessun paziente selezionato",
    debugResults: "Risultati debug",
    totalConversations: "Totale conversazioni",
    withoutSentiment: "Senza sentimenti",
    successfullyAnalyzed: "Analizzate con successo",
    failedAnalyses: "Analisi fallite",
    conversationDetails: "Dettagli conversazione",
    messages: "messaggi",
    sentiment: "Sentimento",
    score: "Punteggio",
    mood: "Umore",
    emotions: "Emozioni",
    concernLevel: "Livello preoccupazione",
    failed: "Fallito",
    noAnalysisPerformed: "Nessuna analisi eseguita",
  },
  headers: {
    home: "Home",
    patient: "Paziente",
    schedule: "Orario",
    conversations: "Conversazioni",
    call: "Chiamata",
    alerts: "Avvisi",
    logout: "Esci",
  },
  medicalAnalysis: {
    title: "Analisi medica",
    error: "Errore",
    success: "Successo",
    noPatientSelected: "Nessun paziente selezionato",
    selectPatientToView: "Per favore seleziona un paziente per visualizzare l'analisi medica",
    triggering: "Attivazione...",
    triggerAnalysis: "Attiva analisi",
    loadingResults: "Caricamento risultati analisi...",
    noResultsAvailable: "Nessun risultato analisi disponibile",
    triggerToGetStarted: "Attiva un'analisi per iniziare",
    cognitiveHealth: "Salute cognitiva",
    mentalHealth: "Salute mentale",
    language: "Lingua",
    risk: "Rischio",
    high: "Alto",
    medium: "Medio",
    low: "Basso",
    good: "Buono",
    fair: "Discreto",
    poor: "Scarso",
    warningsInsights: "Avvisi e insights",
    analysisDetails: "Dettagli analisi",
    conversations: "Conversazioni",
    messages: "Messaggi",
    totalWords: "Totale parole",
    trigger: "Attiva",
    trendsOverTime: "Tendenze nel tempo",
    overallHealth: "Salute generale",
    analyses: "analisi",
    trendAnalysisComingSoon: "Analisi tendenze prossimamente",
    analysisResultsAvailable: "risultati analisi disponibili",
    basedOn: "Basato su",
    analysisResultsOver: "risultati analisi nel corso di",
    loadFailed: "Caricamento risultati analisi medica fallito",
    triggerFailed: "Attivazione analisi medica fallita",
    triggerSuccess: "Analisi medica attivata con successo. I risultati appariranno in circa 10 secondi.",
  },
  signupScreen: {
    title: "Completa il tuo invito",
    fullNameLabel: "Nome completo",
    fullNamePlaceholder: "Il tuo nome completo",
    emailLabel: "Indirizzo email",
    emailPlaceholder: "tua.email@esempio.com",
    phoneLabel: "Numero di telefono",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "Password",
    passwordPlaceholder: "Inserisci la tua password",
    confirmPasswordLabel: "Conferma password",
    confirmPasswordPlaceholder: "Conferma la tua password",
    completeRegistration: "Completa registrazione",
    preconfiguredMessage: "Il tuo nome, email e dettagli dell'organizzazione sono stati preconfigurati dal tuo amministratore.",
  },
  homeScreen: {
    welcome: "Benvenuto, {{name}}",
    guest: "Ospite",
    addPatient: "Aggiungi paziente",
    adminOnlyMessage: "Solo gli amministratori dell'organizzazione e i super amministratori possono aggiungere pazienti",
    noPatientsFound: "Nessun paziente trovato",
    viewSchedules: "Visualizza programmi",
  },
  tabs: {
    home: "Home",
    org: "Organizzazione",
    reports: "Rapporti",
    alerts: "Avvisi",
  },
  orgScreen: {
    namePlaceholder: "Nome",
    emailPlaceholder: "Email",
    phonePlaceholder: "Telefono",
    save: "SALVA",
    viewCaregivers: "Visualizza assistenti",
    inviteCaregiver: "Invita assistente",
    payments: "Pagamenti",
    organizationActions: "Azioni organizzazione",
    organizationLogo: "Logo organizzazione",
    noLogoSet: "Nessun logo impostato",
  },
  headers: {
    home: "Home",
    patient: "Paziente",
    schedule: "Programma",
    conversations: "Conversazioni",
    call: "Chiamata",
    profile: "Profilo",
    logout: "Esci",
    alerts: "Avvisi",
    organization: "Organizzazione",
    caregivers: "Assistenti",
    caregiver: "Assistente",
    caregiverInvited: "Assistente invitato",
    payments: "Pagamenti",
    reports: "Rapporti",
    sentimentAnalysis: "Analisi del sentimento",
    medicalAnalysis: "Analisi medica",
    privacyPolicy: "Politica sulla privacy",
    privacyPractices: "Pratiche sulla Privacy HIPAA",
    termsOfService: "Termini di servizio",
    mentalHealthReport: "Rapporto sulla salute mentale",
    login: "Accedi",
    register: "Registrati",
  },
  themes: {
    healthcare: {
      name: "Assistenza sanitaria",
      description: "Tema medico professionale con colori blu e verdi",
    },
    colorblind: {
      name: "Amichevole per daltonici",
      description: "Tema ad alto contrasto ottimizzato per la carenza di visione dei colori",
    },
    dark: {
      name: "Modalità scura",
      description: "Tema scuro ottimizzato per ambienti con poca luce",
    },
    accessibility: {
      wcagLevel: "Livello WCAG",
      colorblindFriendly: "Amichevole per daltonici",
      highContrast: "Alto contrasto",
      darkMode: "Modalità scura",
    },
  },
  privacyPracticesScreen: {
    content: `# Avviso sulle Pratiche di Privacy
## Servizi di Comunicazione Sanitaria MyPhoneFriend

**Data di entrata in vigore**: 15 ottobre 2025

---

## LE TUE INFORMAZIONI. I TUOI DIRITTI. LE NOSTRE RESPONSABILITÀ.

**QUESTO AVVISO DESCRIVE COME LE INFORMAZIONI MEDICHE SU DI TE POSSONO ESSERE UTILIZZATE E DIVULGATE E COME PUOI ACCEDERE A QUESTE INFORMAZIONI. SI PREGA DI LEGGERLO ATTENTAMENTE.**

---

## I TUOI DIRITTI

Hai il diritto di:
- Ottenere una copia delle tue informazioni sanitarie
- Correggere le tue informazioni sanitarie
- Richiedere comunicazione confidenziale
- Chiederci di limitare le informazioni che condividiamo
- Ottenere un elenco di coloro con cui abbiamo condiviso le tue informazioni
- Ottenere una copia di questo avviso sulla privacy
- Scegliere qualcuno per agire per tuo conto
- Presentare un reclamo se ritieni che i tuoi diritti alla privacy siano stati violati

---

## LE TUE SCELTE

Hai alcune scelte su come utilizziamo e condividiamo le informazioni quando:
- Rispondiamo alle domande di famiglia e amici sul tuo trattamento
- Forniamo informazioni su di te in situazioni di soccorso in caso di disastro

**Non condividiamo mai le tue informazioni per marketing o vendita dei tuoi dati.**

---

# I TUOI DIRITTI DETTAGLIATI

## Ottenere una copia delle tue informazioni sanitarie

**Puoi chiedere di vedere o ottenere una copia delle tue informazioni sanitarie.**

Cosa puoi richiedere:
- Registrazioni di chiamate e trascrizioni
- Riassunti di benessere e risultati di analisi IA
- Avvisi medici generati dal nostro sistema
- Notifiche di emergenza
- Informazioni sull'account e preferenze

**Come richiedere**:
- Email: privacy@myphonefriend.com
- Telefono: +1-604-562-4263

**La nostra risposta**: Entro 30 giorni

---

## Chiedici di correggere le tue informazioni sanitarie

**Puoi chiederci di correggere le informazioni sanitarie che ritieni siano errate o incomplete.**

**La nostra risposta**: Entro 60 giorni

---

## Richiedere comunicazioni confidenziali

**Puoi chiederci di contattarti in un modo specifico o in una posizione specifica.**

Esempi:
- "Per favore inviami un'email invece di chiamare"
- "Per favore contattami solo sul mio cellulare"

Accoglieremo tutte le richieste ragionevoli.

---

## Chiedici di limitare ciò che usiamo o condividiamo

**Puoi chiederci di non utilizzare o condividere determinate informazioni sanitarie.**

Dobbiamo essere d'accordo se hai pagato completamente di tasca tua e ci chiedi di non condividere con il tuo piano sanitario.

---

## Ottenere un elenco delle divulgazioni

**Puoi richiedere un "rendiconto delle divulgazioni"** - un elenco delle volte in cui abbiamo condiviso le tue informazioni sanitarie.

Copre: Ultimi 6 anni  
Esclude: Divulgazioni per trattamento, pagamento e operazioni (a meno che tu non lo richieda)

---

## Presentare un reclamo

**Presentare con noi**:
- Email: privacy@myphonefriend.com
- Telefono: +1-604-562-4263

**Presentare con HHS**:
- Sito web: https://www.hhs.gov/hipaa/filing-a-complaint
- Telefono: 1-800-368-1019

**Non ti riterremo responsabile per aver presentato un reclamo.**

---

# I NOSTRI USI E DIVULGAZIONI

## Come utilizziamo le tue informazioni sanitarie

**Per il trattamento**:
- Fornire riassunti di benessere IA ai tuoi assistenti
- Generare avvisi di emergenza per situazioni urgenti
- Consentire agli assistenti di monitorare il tuo benessere
- Facilitare la comunicazione con il tuo team di assistenza

**Per il pagamento**:
- Fatturare la tua organizzazione sanitaria per i servizi
- Elaborare fatture per tempo di chiamata e analisi

**Per le operazioni sanitarie**:
- Migliorare i nostri algoritmi di rilevamento IA
- Garanzia di qualità e miglioramento
- Formare i nostri sistemi per servire meglio i pazienti

---

## Con chi condividiamo

**La tua organizzazione sanitaria**:
- I tuoi assistenti e coordinatori di assistenza assegnati
- Amministratori dell'organizzazione per la fatturazione

**Associati commerciali** (Fornitori di servizi):
- Servizi IA (Azure OpenAI): Per trascrizione e analisi
- Servizi vocali (Twilio): Per la gestione delle chiamate telefoniche
- Hosting cloud (AWS): Per lo storage sicuro dei dati
- Database (MongoDB Atlas): Per la gestione dei dati

Tutti gli associati commerciali firmano accordi di associato commerciale e devono proteggere le tue informazioni.

**Come richiesto dalla legge**:
- Servizi di emergenza (911) se viene rilevata un'emergenza
- Autorità sanitarie pubbliche (segnalazione di abusi, negligenza)
- Forze dell'ordine (con ordine legale valido)

**NON facciamo**:
- ❌ Vendere le tue informazioni sanitarie
- ❌ Condividere con marketer o inserzionisti
- ❌ Utilizzare per marketing senza la tua autorizzazione
- ❌ Condividere sui social media

---

# INFORMAZIONI SANITARIE CHE RACCOGLIAMO

**Durante l'uso dei nostri servizi**:
- Nome del paziente, numero di telefono, data di nascita
- Registrazioni di chiamate e trascrizioni
- Informazioni relative alla salute dalle chiamate (sintomi, farmaci, umore)
- Avvisi e incidenti di emergenza
- Tendenze e modelli di benessere
- Note e osservazioni degli assistenti
- Risultati di analisi medica da IA

---

# LE TUE RESPONSABILITÀ

**Se stai utilizzando il nostro servizio per chiamare un'altra persona**, sei responsabile di:
- Ottenere i consensi necessari per la registrazione
- Assicurarti che comprendano il servizio
- Seguire le leggi applicabili sul consenso alla registrazione

---

# NOTIFICA DI VIOLAZIONE

**Se le tue informazioni sanitarie vengono accessate o divulgate in modo improprio**, noi:
- Indagheremo sull'incidente
- Ti notificheremo entro 60 giorni se si tratta di una violazione segnalabile
- Spiegheremo cosa è successo e cosa stiamo facendo
- Forniremo informazioni sui passaggi che puoi intraprendere

---

# MODIFICHE A QUESTO AVVISO

- Possiamo modificare questo avviso e le modifiche si applicheranno a tutte le informazioni che abbiamo
- Il nuovo avviso sarà disponibile nell'app e sul nostro sito web
- Puoi sempre richiedere una copia attuale

---

# INFORMAZIONI DI CONTATTO

**Responsabile della privacy**:
- Email: privacy@myphonefriend.com
- Telefono: +1-604-562-4263
- Posta: Ufficio Privacy MyPhoneFriend, 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

**Orari**: Lunedì-Venerdì, 9-17 PST

---

# PRESENTARE UN RECLAMO

**Con noi**:
- Email: privacy@myphonefriend.com
- Telefono: +1-604-562-4263

**Con il governo federale (HHS)**:
- Sito web: https://www.hhs.gov/hipaa/filing-a-complaint
- Telefono: 1-800-368-1019
- Posta: Ufficio per i Diritti Civili, Dipartimento della Salute e dei Servizi Umani degli Stati Uniti, 200 Independence Avenue S.W., Washington, D.C. 20201

---

**Data di entrata in vigore**: 15 ottobre 2025  
**Versione**: 1.0

Questo Avviso sulle Pratiche di Privacy è conforme alla Regola sulla Privacy HIPAA (45 CFR §164.520)

---

## Assistenza linguistica

**Inglese**: Se hai bisogno di aiuto per capire questo avviso, contatta privacy@myphonefriend.com

**Español**: Si necesita ayuda, comuníquese con privacy@myphonefriend.com`,
  },
  mfa: {
    setupTitle: "Autenticazione Multi-Fattore",
    setupSubtitle: "Aggiungi un ulteriore livello di sicurezza al tuo account",
    setupInstructions: "Scansiona il codice QR con la tua app di autenticazione, quindi inserisci il codice per verificare.",
    verificationTitle: "Autenticazione a Due Fattori",
    verificationSubtitle: "Inserisci il codice a 6 cifre dalla tua app di autenticazione",
    tokenLabel: "Codice di Verifica",
    tokenPlaceholder: "000000",
    pleaseEnterVerificationCode: "Inserisci il codice di verifica dalla tua app di autenticazione",
    verifyButton: "Verifica",
    useBackupCode: "Usa Codice di Backup",
    verifyAndEnable: "Verifica e Abilita",
    enable: "Abilita MFA",
    enableMFA: "Abilita Autenticazione Multi-Fattore",
    manageMFA: "Gestisci Autenticazione Multi-Fattore",
    disable: "Disabilita MFA",
    disableTitle: "Disabilita MFA",
    disableSubtitle: "Inserisci il tuo codice MFA attuale per disabilitare l'autenticazione multi-fattore",
    disableConfirmTitle: "Disabilitare MFA?",
    disableConfirmMessage: "Sei sicuro di voler disabilitare l'autenticazione multi-fattore? Questo ridurrà la sicurezza del tuo account.",
    enabled: "Abilitato",
    disabled: "Disabilitato",
    enabledSuccess: "L'autenticazione multi-fattore è stata abilitata con successo.",
    disabledSuccess: "L'autenticazione multi-fattore è stata disabilitata.",
    status: "Stato",
    enrolledOn: "Registrato il",
    backupCodesRemaining: "Codici di backup rimanenti",
    backupCodesTitle: "Codici di Backup",
    backupCodesWarning: "Salva questi codici in un luogo sicuro. Puoi usarli per accedere al tuo account se perdi il tuo dispositivo di autenticazione.",
    backupCodeLength: "I codici di backup sono lunghi 8 caratteri",
    regenerateBackupCodes: "Rigenera Codici di Backup",
    regenerateBackupCodesTitle: "Rigenerare i Codici di Backup?",
    regenerateBackupCodesSubtitle: "Inserisci il tuo codice MFA attuale per generare nuovi codici di backup",
    regenerateBackupCodesMessage: "I tuoi vecchi codici di backup non funzioneranno più. Assicurati di salvare i nuovi codici in modo sicuro.",
    regenerate: "Rigenera",
    backupCodesRegenerated: "Codici di Backup Rigenerati",
    backupCodesRegeneratedMessage: "I tuoi nuovi codici di backup sono stati generati. Per favore, salvali in modo sicuro.",
    secretLabel: "Oppure inserisci questo segreto manualmente:",
    invalidTokenLength: "Inserisci un codice a 6 cifre",
    verificationFailed: "Codice non valido. Per favore, riprova.",
    enableFailed: "Impossibile abilitare MFA",
    disableFailed: "Impossibile disabilitare MFA. Per favore, controlla il tuo codice.",
    regenerateFailed: "Impossibile rigenerare i codici di backup.",
  },
}

export default it
