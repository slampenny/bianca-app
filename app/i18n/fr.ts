import { Translations } from "./en"

const fr: Translations = {
  common: {
    ok: "OK",
    cancel: "Annuler",
    close: "Fermer",
    back: "Retour",
    error: "Erreur",
    anErrorOccurred: "Une erreur s'est produite",
    selectImage: "Sélectionner l'image",
    calling: "Appel en cours...",
    callNow: "Appeler maintenant",
    ending: "Fin...",
    endCall: "Terminer l'appel",
    loading: "Chargement...",
  },
  alertScreen: {
    markAllAsRead: "Marquer tout comme lu",
    unreadAlerts: "Alertes non lues",
    allAlerts: "Toutes les alertes",
    noAlerts: "Aucune alerte",
    noAlertsTitle: "Tout à jour !",
    noAlertsSubtitle: "Vous n'avez aucune alerte non lue. Excellent travail pour rester à jour !",
    emptyHeading: "Si vide... si triste",
    refreshing: "Actualisation...",
    refresh: "Actualiser",
    patient: "Patient :",
    importance: "Importance :",
    expires: "Expire :",
  },
  legalLinks: {
    privacyPolicy: "Politique de confidentialité",
    termsOfService: "Conditions d'utilisation",
    privacyPractices: "Pratiques de Confidentialité HIPAA",
  },
  errorScreen: {
    title: "Quelque chose s'est mal passé !",
    friendlySubtitle:
      "C'est l'écran que vos utilisateurs verront en production lorsqu'une erreur sera lancée. Vous voudrez personnaliser ce message (situé dans `app/i18n/fr.ts`) et probablement aussi la mise en page (`app/screens/ErrorScreen`). Si vous voulez le supprimer complètement, vérifiez `app/app.tsx` pour le composant <ErrorBoundary>.",
    reset: "RÉINITIALISER L'APPLICATION",
    traceTitle: "Erreur depuis %{name}",
  },
  emptyStateComponent: {
    generic: {
      heading: "Si vide... si triste",
      content:
        "Aucune donnée trouvée pour le moment. Essayez de cliquer sur le bouton pour rafraîchir ou recharger l'application.",
      button: "Essayons à nouveau",
    },
  },

  errors: {
    invalidEmail: "Adresse e-mail invalide.",
  },
  loginScreen: {
    signIn: "Se connecter",
    register: "S'inscrire",
    enterDetails: "Entrez vos détails ci-dessous pour débloquer des informations top secrètes. Vous ne devinerez jamais ce qui nous attend. Ou peut-être que si ; ce n'est pas de la science spatiale ici.",
    emailFieldLabel: "E-mail",
    passwordFieldLabel: "Mot de passe",
    emailFieldPlaceholder: "Entrez votre adresse e-mail",
    passwordFieldPlaceholder: "Mot de passe super secret ici",
    forgotPassword: "Mot de passe oublié ?",
    hint: "Astuce : vous pouvez utiliser n'importe quelle adresse e-mail et votre mot de passe préféré :)",
  },
  logoutScreen: {
    logoutButton: "Déconnexion",
    logoutMessage: "Êtes-vous sûr ?",
  },
  registerScreen: {
    title: "S'inscrire",
    nameFieldLabel: "Nom",
    emailFieldLabel: "E-mail",
    phoneFieldLabel: "Téléphone",
    passwordFieldLabel: "Mot de passe",
    goBack: "Retour",
    confirmPasswordFieldLabel: "Confirmer le mot de passe",
    organizationNameFieldLabel: "Nom de l'organisation",
    nameFieldPlaceholder: "Entrez votre nom",
    emailFieldPlaceholder: "Entrez votre adresse e-mail",
    passwordFieldPlaceholder: "Entrez votre mot de passe",
    confirmPasswordFieldPlaceholder: "Confirmez votre mot de passe",
    phoneFieldPlaceholder: "(xxx)xxx-xxxx",
    organizationNameFieldPlaceholder: "Entrez le nom de votre organisation",
    organizationButton: "Organisation",
    individualButton: "Individuel",
    individualExplanation: "S'inscrire en tant qu'individu pour un usage personnel.",
    organizationExplanation: "S'inscrire en tant qu'organisation pour un usage professionnel ou de groupe.",
    consentText: "En vous inscrivant, vous acceptez nos",
    consentAnd: "et",
    termsOfService: "Conditions d'utilisation",
    privacyPolicy: "Politique de confidentialité",
  },
  signupScreen: {
    title: "Complétez votre invitation",
    fullNameLabel: "Nom complet",
    fullNamePlaceholder: "Votre nom complet",
    emailLabel: "Adresse e-mail",
    emailPlaceholder: "votre.email@exemple.com",
    phoneLabel: "Numéro de téléphone",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "Mot de passe",
    passwordPlaceholder: "Entrez votre mot de passe",
    confirmPasswordLabel: "Confirmer le mot de passe",
    confirmPasswordPlaceholder: "Confirmez votre mot de passe",
    completeRegistration: "Terminer l'inscription",
    preconfiguredMessage: "Votre nom, e-mail et détails de l'organisation ont été préconfigurés par votre administrateur.",
  },
  homeScreen: {
    welcome: "Bienvenue, {{name}}",
    guest: "Invité",
    addPatient: "Ajouter un patient",
    adminOnlyMessage: "Seuls les administrateurs d'organisation et les super administrateurs peuvent ajouter des patients",
    noPatientsFound: "Aucun patient trouvé",
    viewSchedules: "Voir les plannings",
  },
  tabs: {
    home: "Accueil",
    org: "Org",
    reports: "Rapports",
    alerts: "Alertes",
  },
  headers: {
    home: "Accueil",
    patient: "Patient",
    schedule: "Horaire",
    conversations: "Conversations",
    call: "Appel",
    profile: "Profil",
    logout: "Déconnexion",
    alerts: "Alertes",
    organization: "Organisation",
    caregivers: "Aidants",
    caregiver: "Aidant",
    caregiverInvited: "Aidant invité",
    payments: "Paiements",
    reports: "Rapports",
    sentimentAnalysis: "Analyse de sentiment",
    medicalAnalysis: "Analyse médicale",
    privacyPolicy: "Politique de confidentialité",
    privacyPractices: "Pratiques de confidentialité HIPAA",
    termsOfService: "Conditions d'utilisation",
    mentalHealthReport: "Rapport de santé mentale",
    login: "Se connecter",
    register: "S'inscrire",
  },
  requestResetScreen: {
    title: "Demander la réinitialisation du mot de passe",
    emailFieldLabel: "E-mail",
    emailFieldPlaceholder: "Entrez votre adresse e-mail",
    requestReset: "Demander la réinitialisation",
    successMessage: "Code de réinitialisation envoyé à votre e-mail !",
    requestFailed: "La demande a échoué. Veuillez vérifier votre e-mail et réessayer.",
  },
  emailVerificationScreen: {
    title: "Vérifiez votre e-mail",
    message: "Nous avons envoyé un lien de vérification à votre adresse e-mail. Veuillez cliquer sur le lien pour vérifier votre compte avant de vous connecter.",
    verifying: "Vérification...",
    emailFieldLabel: "Adresse e-mail",
    emailFieldPlaceholder: "Entrez votre adresse e-mail",
    resendButton: "Renvoyer l'e-mail de vérification",
    backToLoginButton: "Retour à la connexion",
    successMessage: "✓ E-mail de vérification envoyé ! Veuillez vérifier votre boîte de réception.",
    errorNoEmail: "Veuillez entrer votre adresse e-mail",
    errorSendFailed: "Échec de l'envoi de l'e-mail de vérification",
    errorNoToken: "Le jeton de vérification est manquant",
    errorVerificationFailed: "Échec de la vérification de l'e-mail",
    errorNetwork: "Impossible de se connecter au serveur. Veuillez vérifier votre connexion Internet et réessayer.",
    verificationFailed: "Échec de la vérification de l'e-mail",
  },
  emailVerificationFailedPage: {
    title: "Échec de la vérification",
    messageExpired: "Ce lien de vérification a expiré. Veuillez demander un nouvel e-mail de vérification.",
    messageInvalid: "Ce lien de vérification est invalide ou a déjà été utilisé.",
    helpExpired: "Les liens de vérification expirent après 24 heures pour des raisons de sécurité.",
    helpGeneric: "Si vous pensez qu'il s'agit d'une erreur, veuillez contacter le support.",
    loginButton: "Aller à la connexion",
  },
  emailVerifiedScreen: {
    title: "E-mail vérifié !",
    message: "Votre compte My Phone Friend a été vérifié avec succès.",
    redirecting: "Redirection vers l'application...",
  },
  ssoLinkingScreen: {
    title: "Lier votre compte",
    message: "Ce compte a été créé avec {{provider}}. Pour utiliser la connexion par e-mail/mot de passe, veuillez définir un mot de passe ci-dessous, ou continuez avec {{provider}}.",
    passwordLabel: "Mot de passe",
    passwordPlaceholder: "Entrez votre mot de passe",
    confirmPasswordLabel: "Confirmer le mot de passe",
    confirmPasswordPlaceholder: "Confirmez votre mot de passe",
    setPasswordButton: "Définir le mot de passe",
    backToLoginButton: "Retour à la connexion",
    orDivider: "Ou",
    successMessage: "✓ Mot de passe défini avec succès ! Vous pouvez maintenant vous connecter avec votre e-mail et votre mot de passe.",
    errorNoPassword: "Veuillez entrer un mot de passe",
    errorNoConfirmPassword: "Veuillez confirmer votre mot de passe",
    errorPasswordMismatch: "Les mots de passe ne correspondent pas",
    errorPasswordTooShort: "Le mot de passe doit contenir au moins 8 caractères",
    errorSetPasswordFailed: "Échec de la définition du mot de passe",
    errorSSOFailed: "Échec de la connexion SSO. Veuillez réessayer.",
    providerGoogle: "Google",
    providerMicrosoft: "Microsoft",
    providerSSO: "SSO",
  },
  ssoButtons: {
    orContinueWith: "Ou continuer avec",
    google: "Google",
    microsoft: "Microsoft",
    companySSO: "SSO entreprise",
    ssoNotAvailable: "SSO non disponible",
    signInFailed: "Échec de la connexion",
    companySSOTitle: "SSO entreprise",
    companySSOMessage: "Cela redirigerait vers le fournisseur SSO de votre entreprise. Veuillez contacter votre administrateur pour la configuration.",
  },
  conversationsScreen: {
    title: "Conversations",
    yesterday: "Hier",
    noMessages: "Aucun message",
    noPatientSelected: "Aucun patient sélectionné",
    firstConversation: "Aucune conversation précédente trouvée. Ce sera la première conversation avec ce patient.",
    noConversationsToDisplay: "Aucune conversation à afficher",
    noPreviousConversations: "Aucune conversation précédente trouvée pour ce patient",
    errorFetchingConversations: "Erreur lors de la récupération des conversations",
    loadingMoreConversations: "Chargement de plus de conversations...",
  },
  patientScreen: {
    nameLabel: "Nom *",
    namePlaceholder: "Entrez le nom du patient",
    emailLabel: "E-mail *",
    emailPlaceholder: "Entrez l'adresse e-mail",
    phoneLabel: "Téléphone *",
    phonePlaceholder: "Entrez le numéro de téléphone",
    preferredLanguageLabel: "Langue Préférée",
    updatePatient: "METTRE À JOUR LE PATIENT",
    createPatient: "CRÉER LE PATIENT",
    manageSchedules: "GÉRER LES HORAIRES",
    manageConversations: "GÉRER LES CONVERSATIONS",
    viewSentimentAnalysis: "VOIR L'ANALYSE DE SENTIMENT",
    manageCaregivers: "GÉRER LES AIDANTS",
    confirmDelete: "CONFIRMER LA SUPPRESSION",
    deletePatient: "SUPPRIMER LE PATIENT",
  },
  paymentScreen: {
    paid: "Payé",
    pending: "En attente",
    overdue: "En retard",
    processing: "En cours",
    unknown: "Inconnu",
    latestInvoice: "Dernière facture",
    paymentMethod: "Méthode de paiement",
    currentChargesSummary: "Résumé des frais actuels",
    basicPlan: "Plan de base",
    contactSupport: "Contacter le support",
    currentCharges: "Frais actuels",
    paymentMethods: "Méthodes de paiement",
    billingInfo: "Informations de facturation",
    // Invoice details
    amount: "Montant :",
    invoiceNumber: "Numéro de facture :",
    issueDate: "Date d'émission :",
    dueDate: "Date d'échéance :",
    notes: "Notes :",
    // Current charges
    noOrganizationData: "Aucune donnée d'organisation disponible.",
    authorizationTokenNotAvailable: "Token d'autorisation non disponible.",
    errorLoadingCurrentCharges: "Erreur lors du chargement des charges actuelles.",
    noPendingCharges: "Aucune charge en attente",
    allConversationsBilled: "Toutes les conversations ont été facturées. De nouvelles charges apparaîtront ici au fur et à mesure qu'elles s'accumulent.",
    totalUnbilledAmount: "Montant total non facturé :",
    period: "Période :",
    lastDays: "Derniers {days} jours",
    day: "jour",
    days: "jours",
    patientsWithCharges: "Patients avec des charges :",
    patient: "patient",
    patients: "patients",
    chargesByPatient: "Charges par patient",
    conversation: "conversation",
    conversations: "conversations",
    average: "Moyenne :",
    // Billing info
    noUserData: "Aucune donnée utilisateur disponible.",
    currentPlan: "Plan actuel :",
    nextBillingDate: "Prochaine date de facturation :",
    totalBilledAmount: "Montant total facturé",
    acrossInvoices: "Sur {count} facture{s}",
    invoiceHistory: "Historique des factures ({count})",
    hide: "Masquer",
    show: "Afficher",
    history: "Historique",
    noInvoicesYet: "Aucune facture pour le moment",
    invoicesWillAppear: "Vos factures apparaîtront ici une fois que la facturation commencera.",
    // Access control
    accessRestricted: "Accès restreint",
    accessRestrictedMessage: "Vous n'avez pas les permissions nécessaires pour voir ou gérer les informations de paiement.",
    contactAdministrator: "Veuillez contacter votre administrateur d'organisation pour obtenir de l'aide.",
    loadingUserInformation: "Chargement des informations utilisateur...",
  },
  orgScreen: {
    namePlaceholder: "Nom",
    emailPlaceholder: "E-mail",
    phonePlaceholder: "Téléphone",
    save: "ENREGISTRER",
    viewCaregivers: "Voir les aidants",
    inviteCaregiver: "Inviter un aidant",
    payments: "Paiements",
    organizationActions: "Actions de l'organisation",
    organizationLogo: "Logo de l'organisation",
    noLogoSet: "Aucun logo défini",
  },
  caregiverScreen: {
    nameLabel: "Nom",
    namePlaceholder: "Nom",
    emailLabel: "E-mail",
    emailPlaceholder: "E-mail",
    phoneLabel: "Téléphone",
    phonePlaceholder: "Téléphone",
    loadingUnassignedPatients: "Chargement des patients non assignés...",
    assigningPatients: "Assignation des patients...",
    patientsAssignedSuccess: "Patients assignés avec succès !",
    loadingCaregivers: "Chargement des aidants...",
    save: "ENREGISTRER",
    invite: "INVITER",
    confirmDelete: "CONFIRMER LA SUPPRESSION",
    deleteCaregiver: "SUPPRIMER L'AIDANT",
    assignUnassignedPatients: "Assigner les patients non assignés",
    assignUnassignedPatientsTitle: "Assigner les patients non assignés",
    selectAll: "Tout sélectionner",
    deselectAll: "Tout désélectionner",
    assignSelected: "Assigner la sélection",
    noUnassignedPatientsFound: "Aucun patient non assigné trouvé.",
  },
  caregiversScreen: {
    invited: "Invité",
    edit: "Modifier",
    noCaregiversFound: "Aucun aidant trouvé",
    notAuthorized: "Non autorisé",
    noPermissionToView: "Vous n'avez pas la permission de voir les aidants. Veuillez contacter votre administrateur.",
    addCaregiver: "Ajouter un aidant",
  },
  confirmResetScreen: {
    title: "Réinitialiser votre mot de passe",
    subtitle: "Entrez votre nouveau mot de passe ci-dessous. Assurez-vous qu'il est sécurisé et facile à retenir.",
    newPasswordLabel: "Nouveau mot de passe",
    newPasswordPlaceholder: "Entrez votre nouveau mot de passe",
    confirmPasswordLabel: "Confirmer le nouveau mot de passe",
    confirmPasswordPlaceholder: "Confirmez votre nouveau mot de passe",
  },
  scheduleScreen: {
    heading: "Configuration des horaires",
    saveSchedule: "Enregistrer l'horaire",
    deleteSchedule: "Supprimer l'horaire",
  },
  sentimentAnalysis: {
    lastCall: "Dernier appel",
    last30Days: "30 derniers jours",
    allTime: "Tout le temps",
    noPatientSelected: "Aucun patient sélectionné",
    selectPatientToView: "Veuillez sélectionner un patient depuis l'écran d'accueil pour voir son analyse de sentiment.",
    // Dashboard
    patientSentimentAnalysis: "Analyse de sentiment du patient",
    emotionalWellnessInsights: "Insights sur le bien-être émotionnel et les tendances",
    timeRange: "Période :",
    noSentimentDataAvailable: "Aucune donnée de sentiment disponible",
    noSentimentDataMessage: "L'analyse de sentiment apparaîtra ici une fois que le patient aura terminé des conversations.",
    loadingSentimentAnalysis: "Chargement de l'analyse de sentiment...",
    sentimentAnalysisFooter: "L'analyse de sentiment est automatiquement générée après chaque conversation en utilisant la technologie IA.",
    // Summary Card
    sentimentOverview: "Aperçu du sentiment",
    averageSentiment: "Sentiment moyen",
    trend: "tendance",
    recentDistribution: "Distribution récente",
    keyInsights: "Insights clés",
    totalConversations: "Total des conversations",
    analysisCoverage: "Couverture d'analyse",
    recentConversations: "Conversations récentes",
    analyzed: "analysées",
    latestAnalysis: "Dernière analyse",
    conversationsAnalyzed: "conversations analysées",
    // Recent Trends
    recentConversationsTitle: "Conversations récentes",
    conversationsWithSentiment: "conversation{s} avec analyse de sentiment",
    noRecentConversations: "Aucune conversation récente avec analyse de sentiment",
    keyEmotions: "Émotions clés :",
    moreEmotions: "plus",
    patientMood: "Humeur du patient :",
    concern: "préoccupation",
    confidence: "confiance",
    noSentimentAnalysisAvailable: "Aucune analyse de sentiment disponible",
    // Trend Chart
    sentimentTrend: "Tendance du sentiment",
    conversationsAnalyzedNoTrend: "conversation{s} analysées, mais aucune donnée de tendance disponible pour le moment",
    noSentimentData: "Aucune donnée de sentiment disponible",
    avg: "Moy :",
    negative: "Négatif",
    positive: "Positif",
    insufficientDataForTrend: "Données insuffisantes pour l'analyse de tendance",
    needMoreConversations: "Besoin de plus de conversations pour une tendance fiable",
    lowConfidence: "Faible confiance",
    // Last Call
    lastCallAnalysis: "Analyse du dernier appel",
    noRecentCall: "Aucun appel récent",
    noRecentCallMessage: "La conversation la plus récente n'a pas encore d'analyse de sentiment disponible.",
    duration: "Durée",
    analysisDate: "Date d'analyse",
    conversationId: "ID de conversation",
    overallSentiment: "Sentiment global",
    scoreRange: "Échelle de score : -1.0 (Très négatif) à +1.0 (Très positif)",
    analysisConfidence: "Confiance de l'analyse :",
    keyEmotionsDetected: "Émotions clés détectées",
    patientMoodAssessment: "Évaluation de l'humeur du patient",
    concernLevel: "Niveau de préoccupation",
    lowConcernDescription: "Le patient semble être de bonne humeur avec des préoccupations minimales.",
    mediumConcernDescription: "Quelques zones de préoccupation ont été notées pendant la conversation.",
    highConcernDescription: "Des préoccupations importantes ont été identifiées qui peuvent nécessiter une attention.",
    satisfactionIndicators: "Indicateurs de satisfaction",
    positiveIndicators: "Indicateurs positifs",
    areasOfConcern: "Zones de préoccupation",
    aiSummary: "Résumé IA",
    recommendations: "Recommandations",
    // Debug Panel
    sentimentAnalysisDebug: "Débogage de l'analyse de sentiment",
    debugSubtitle: "Déboguer et corriger l'analyse de sentiment manquante pour les conversations récentes",
    debugging: "Débogage...",
    debugSentimentAnalysis: "Déboguer l'analyse de sentiment",
    loading: "Chargement...",
    debugConversationData: "Déboguer les données de conversation",
    testing: "Test...",
    testDirectApiCall: "Tester l'appel API direct",
    forceRefreshCache: "Forcer l'actualisation du cache",
    currentPatient: "Patient actuel :",
    debugResults: "Résultats de débogage",
    withoutSentiment: "Sans sentiment",
    successfullyAnalyzed: "Analysées avec succès",
    failedAnalyses: "Analyses échouées",
    conversationDetails: "Détails de la conversation",
    messages: "messages",
    sentiment: "Sentiment",
    score: "Score",
    mood: "Humeur",
    emotions: "Émotions",
    failed: "Échoué",
    noAnalysisPerformed: "Aucune analyse effectuée",
    cacheRefreshed: "Cache actualisé",
    cacheRefreshedMessage: "Le cache d'analyse de sentiment a été invalidé. L'interface utilisateur devrait se rafraîchir automatiquement.",
    debugComplete: "Débogage terminé",
    debugFailed: "Débogage échoué",
    noPatient: "Aucun patient",
    pleaseSelectPatient: "Veuillez d'abord sélectionner un patient",
    conversationDebugComplete: "Débogage de conversation terminé",
    directApiTest: "Test API direct",
  },
  medicalAnalysis: {
    title: "Analyse médicale",
    error: "Erreur",
    success: "Succès",
    noPatientSelected: "Aucun patient sélectionné",
    selectPatientToView: "Veuillez sélectionner un patient pour voir l'analyse médicale",
    triggering: "Déclenchement...",
    triggerAnalysis: "Déclencher l'analyse",
    loadingResults: "Chargement des résultats d'analyse...",
    noResultsAvailable: "Aucun résultat d'analyse disponible",
    triggerToGetStarted: "Déclenchez une analyse pour commencer",
    cognitiveHealth: "Santé cognitive",
    mentalHealth: "Santé mentale",
    language: "Langue",
    risk: "Risque",
    high: "Élevé",
    medium: "Moyen",
    low: "Faible",
    good: "Bon",
    fair: "Correct",
    poor: "Mauvais",
    warningsInsights: "Avertissements et informations",
    analysisDetails: "Détails de l'analyse",
    conversations: "Conversations",
    messages: "Messages",
    totalWords: "Total des mots",
    trigger: "Déclencheur",
    trendsOverTime: "Tendances dans le temps",
    overallHealth: "Santé globale",
    analyses: "analyses",
    trendAnalysisComingSoon: "Analyse des tendances bientôt disponible",
    analysisResultsAvailable: "résultats d'analyse disponibles",
    basedOn: "Basé sur",
    analysisResultsOver: "résultats d'analyse sur",
    loadFailed: "Échec du chargement des résultats d'analyse médicale",
    triggerFailed: "Échec du déclenchement de l'analyse médicale",
    triggerSuccess: "Analyse médicale déclenchée avec succès. Les résultats apparaîtront dans environ 10 secondes.",
  },
  profileScreen: {
    languageSelector: "Langue / Language",
    selectLanguage: "Sélectionner la langue",
    theme: "Thème",
    selectTheme: "Sélectionner le Thème",
    namePlaceholder: "Nom",
    emailPlaceholder: "E-mail",
    phonePlaceholder: "Téléphone",
    yourProfile: "Votre profil",
    updateProfile: "METTRE À JOUR LE PROFIL",
    logout: "DÉCONNEXION",
    profileUpdatedSuccess: "Votre profil a été mis à jour avec succès !",
    profileUpdateFailed: "Échec de la mise à jour du profil. Veuillez réessayer.",
    invalidPhoneFormat: "Format de téléphone invalide (10 chiffres ou +1XXXXXXXXXX)",
    completeProfileTitle: "Complétez votre profil",
    completeProfileMessage: "Veuillez compléter votre profil en ajoutant un numéro de téléphone avant de continuer.",
    completeProfileMessageUnverified: "Veuillez ajouter votre numéro de téléphone pour compléter votre profil et accéder à toutes les fonctionnalités.",
    errorUploadingAvatar: "Erreur lors du téléchargement de l'avatar",
  },
  reportsScreen: {
    selectPatient: "Sélectionner un patient :",
    choosePatient: "Choisir un patient...",
    sentiment: "Sentiment",
    medicalAnalysis: "Analyse médicale",
    comingSoon: "Bientôt disponible",
    modalTitle: "Sélectionner un patient",
    modalCancel: "Annuler",
  },
  schedulesScreen: {
    scheduleDetails: "Détails du planning",
    selectSchedule: "Sélectionner un planning :",
    scheduleNumber: "Planning",
    noSchedulesAvailable: "Aucun planning disponible. Veuillez en créer un nouveau.",
    errorLoadingSchedules: "Erreur lors du chargement des plannings.",
  },
  scheduleComponent: {
    schedule: "Planning",
    startTime: "Heure de début",
    frequency: "Fréquence",
    daily: "Quotidien",
    weekly: "Hebdomadaire",
    monthly: "Mensuel",
    sunday: "Dimanche",
    monday: "Lundi",
    tuesday: "Mardi",
    wednesday: "Mercredi",
    thursday: "Jeudi",
    friday: "Vendredi",
    saturday: "Samedi",
    scheduleDetails: "Détails du planning",
    active: "Actif",
    everyDayAt: "Tous les jours à {{time}}",
    everyDaysAt: "Tous les {{days}} à {{time}}",
    everyWeekAt: "Toutes les semaines à {{time}}",
    everyMonthOn: "Tous les mois le {{day}} à {{time}}",
  },
  themes: {
    healthcare: {
      name: "Soins de Santé",
      description: "Thème médical professionnel avec des couleurs bleues et vertes",
    },
    colorblind: {
      name: "Adapté aux Daltoniens",
      description: "Thème à haut contraste optimisé pour les déficiences de vision des couleurs",
    },
    dark: {
      name: "Mode Sombre",
      description: "Thème sombre optimisé pour les environnements à faible luminosité",
    },
    accessibility: {
      wcagLevel: "Niveau WCAG",
      colorblindFriendly: "Adapté aux daltoniens",
      highContrast: "Haut contraste",
      darkMode: "Mode sombre",
    },
  },
  privacyPracticesScreen: {
    content: `# Avis sur les pratiques de confidentialité
## Services de communication de santé MyPhoneFriend

**Date d'entrée en vigueur** : 15 octobre 2025

---

## VOS INFORMATIONS. VOS DROITS. NOS RESPONSABILITÉS.

**CET AVIS DÉCRIT COMMENT LES INFORMATIONS MÉDICALES VOUS CONCERNANT PEUVENT ÊTRE UTILISÉES ET DIVULGUÉES ET COMMENT VOUS POUVEZ ACCÉDER À CES INFORMATIONS. VEUILLEZ LE LIRE ATTENTIVEMENT.**

---

## VOS DROITS

Vous avez le droit de :
- Obtenir une copie de vos informations de santé
- Corriger vos informations de santé
- Demander une communication confidentielle
- Nous demander de limiter les informations que nous partageons
- Obtenir une liste de ceux avec qui nous avons partagé vos informations
- Obtenir une copie de cet avis de confidentialité
- Choisir quelqu'un pour agir en votre nom
- Déposer une plainte si vous croyez que vos droits à la confidentialité ont été violés

---

## VOS CHOIX

Vous avez certains choix sur la façon dont nous utilisons et partageons les informations lorsque nous :
- Répondons aux questions de votre famille et de vos amis concernant vos soins
- Fournissons des informations vous concernant dans des situations de secours en cas de catastrophe

**Nous ne partageons jamais vos informations à des fins de marketing ou de vente de vos données.**

---

# VOS DROITS DÉTAILLÉS

## Obtenir une copie de vos informations de santé

**Vous pouvez demander à voir ou obtenir une copie de vos informations de santé.**

Ce que vous pouvez demander :
- Enregistrements d'appels et transcriptions
- Résumés de bien-être et résultats d'analyse IA
- Alertes médicales générées par notre système
- Notifications d'urgence
- Informations de compte et préférences

**Comment faire une demande** :
- Email : privacy@myphonefriend.com
- Téléphone : +1-604-562-4263

**Notre réponse** : Dans les 30 jours

---

## Demandez-nous de corriger vos informations de santé

**Vous pouvez nous demander de corriger les informations de santé que vous pensez être incorrectes ou incomplètes.**

**Notre réponse** : Dans les 60 jours

---

## Demander des communications confidentielles

**Vous pouvez nous demander de vous contacter d'une manière ou à un endroit spécifique.**

Exemples :
- "Veuillez m'envoyer un email au lieu d'appeler"
- "Veuillez me contacter uniquement sur mon téléphone portable"

Nous accommoderons toutes les demandes raisonnables.

---

## Demandez-nous de limiter ce que nous utilisons ou partageons

**Vous pouvez nous demander de ne pas utiliser ou partager certaines informations de santé.**

Nous devons accepter si vous avez payé de votre poche en totalité et nous demandez de ne pas partager avec votre plan de santé.

---

## Obtenir une liste des divulgations

**Vous pouvez demander un "compte rendu des divulgations"** - une liste des moments où nous avons partagé vos informations de santé.

Couvre : 6 dernières années  
Exclut : Divulgations pour traitement, paiement et opérations (sauf si vous le demandez)

---

## Déposer une plainte

**Déposer auprès de nous** :
- Email : privacy@myphonefriend.com
- Téléphone : +1-604-562-4263

**Déposer auprès de HHS** :
- Site web : https://www.hhs.gov/hipaa/filing-a-complaint
- Téléphone : 1-800-368-1019

**Nous ne vous représenterons pas pour avoir déposé une plainte.**

---

# NOS UTILISATIONS ET DIVULGATIONS

## Comment nous utilisons vos informations de santé

**Pour le traitement** :
- Fournir des résumés de bien-être IA à vos aidants
- Générer des alertes d'urgence pour les situations urgentes
- Permettre aux aidants de surveiller votre bien-être
- Faciliter la communication avec votre équipe de soins

**Pour le paiement** :
- Facturer votre organisation de santé pour les services
- Traiter les factures pour le temps d'appel et l'analyse

**Pour les opérations de santé** :
- Améliorer nos algorithmes de détection IA
- Assurance qualité et amélioration
- Formation de nos systèmes pour mieux servir les patients

---

## Avec qui nous partageons

**Votre organisation de santé** :
- Vos aidants et coordinateurs de soins assignés
- Administrateurs d'organisation pour la facturation

**Associés commerciaux** (Fournisseurs de services) :
- Services IA (Azure OpenAI) : Pour transcription et analyse
- Services vocaux (Twilio) : Pour la gestion des appels téléphoniques
- Hébergement cloud (AWS) : Pour le stockage sécurisé des données
- Base de données (MongoDB Atlas) : Pour la gestion des données

Tous les associés commerciaux signent des accords d'associé commercial et doivent protéger vos informations.

**Comme requis par la loi** :
- Services d'urgence (911) si urgence détectée
- Autorités de santé publique (signalement d'abus, de négligence)
- Application de la loi (avec ordre juridique valide)

**Nous ne faisons PAS** :
- ❌ Vendre vos informations de santé
- ❌ Partager avec des spécialistes du marketing ou des annonceurs
- ❌ Utiliser à des fins de marketing sans votre autorisation
- ❌ Partager sur les réseaux sociaux

---

# INFORMATIONS DE SANTÉ QUE NOUS COLLECTONS

**Pendant l'utilisation de nos services** :
- Nom du patient, numéro de téléphone, date de naissance
- Enregistrements d'appels et transcriptions
- Informations liées à la santé provenant d'appels (symptômes, médicaments, humeur)
- Alertes d'urgence et incidents
- Tendances et modèles de bien-être
- Notes et observations des aidants
- Résultats d'analyse médicale de l'IA

---

# VOS RESPONSABILITÉS

**Si vous utilisez notre service pour appeler une autre personne**, vous êtes responsable de :
- Obtenir les consentements nécessaires pour l'enregistrement
- S'assurer qu'ils comprennent le service
- Suivre les lois applicables sur le consentement à l'enregistrement

---

# NOTIFICATION DE VIOLATION

**Si vos informations de santé sont incorrectement consultées ou divulguées**, nous :
- Enquêterons sur l'incident
- Vous notifierons dans les 60 jours si violation signalable
- Expliquerons ce qui s'est passé et ce que nous faisons
- Fournirons des informations sur les mesures que vous pouvez prendre

---

# MODIFICATIONS DE CET AVIS

- Nous pouvons modifier cet avis et les modifications s'appliqueront à toutes les informations que nous avons
- Le nouvel avis sera disponible dans l'application et sur notre site web
- Vous pouvez toujours demander une copie actuelle

---

# INFORMATIONS DE CONTACT

**Responsable de la protection des données** :
- Email : privacy@myphonefriend.com
- Téléphone : +1-604-562-4263
- Courrier : Bureau de la confidentialité MyPhoneFriend, 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

**Heures** : Lundi-Vendredi, 9h - 17h PST

---

# DÉPOSER UNE PLAINTE

**Avec nous** :
- Email : privacy@myphonefriend.com
- Téléphone : +1-604-562-4263

**Avec le gouvernement fédéral (HHS)** :
- Site web : https://www.hhs.gov/hipaa/filing-a-complaint
- Téléphone : 1-800-368-1019
- Courrier : Bureau des droits civils, Département américain de la santé et des services sociaux, 200 Independence Avenue S.W., Washington, D.C. 20201

---

**Date d'entrée en vigueur** : 15 octobre 2025  
**Version** : 1.0

Cet avis sur les pratiques de confidentialité est conforme à la règle de confidentialité HIPAA (45 CFR §164.520)

---

## Assistance linguistique

**Anglais** : Si vous avez besoin d'aide pour comprendre cet avis, contactez privacy@myphonefriend.com

**Español** : Si necesita ayuda, comuníquese con privacy@myphonefriend.com`,
  },
  mfa: {
    setupTitle: "Authentification multi-facteurs",
    setupSubtitle: "Ajoutez une couche de sécurité supplémentaire à votre compte",
    setupInstructions: "Scannez le code QR avec votre application d'authentification, puis entrez le code pour vérifier.",
    verificationTitle: "Authentification à deux facteurs",
    verificationSubtitle: "Entrez le code à 6 chiffres de votre application d'authentification",
    tokenLabel: "Code de vérification",
    tokenPlaceholder: "000000",
    pleaseEnterVerificationCode: "Veuillez entrer le code de vérification de votre application d'authentification",
    verifyButton: "Vérifier",
    useBackupCode: "Utiliser un code de secours",
    verifyAndEnable: "Vérifier et activer",
    enable: "Activer MFA",
    enableMFA: "Activer l'authentification multi-facteurs",
    manageMFA: "Gérer l'authentification multi-facteurs",
    disable: "Désactiver MFA",
    disableTitle: "Désactiver MFA",
    disableSubtitle: "Entrez votre code MFA actuel pour désactiver l'authentification multi-facteurs",
    disableConfirmTitle: "Désactiver MFA ?",
    disableConfirmMessage: "Êtes-vous sûr de vouloir désactiver l'authentification multi-facteurs ? Cela réduira la sécurité de votre compte.",
    enabled: "Activé",
    disabled: "Désactivé",
    enabledSuccess: "L'authentification multi-facteurs a été activée avec succès.",
    disabledSuccess: "L'authentification multi-facteurs a été désactivée.",
    status: "Statut",
    enrolledOn: "Inscrit le",
    backupCodesRemaining: "Codes de secours restants",
    backupCodesTitle: "Codes de secours",
    backupCodesWarning: "Enregistrez ces codes dans un endroit sûr. Vous pouvez les utiliser pour accéder à votre compte si vous perdez votre appareil d'authentification.",
    backupCodeLength: "Les codes de secours font 8 caractères",
    regenerateBackupCodes: "Régénérer les codes de secours",
    regenerateBackupCodesTitle: "Régénérer les codes de secours ?",
    regenerateBackupCodesSubtitle: "Entrez votre code MFA actuel pour générer de nouveaux codes de secours",
    regenerateBackupCodesMessage: "Vos anciens codes de secours ne fonctionneront plus. Assurez-vous de sauvegarder les nouveaux codes en toute sécurité.",
    regenerate: "Régénérer",
    backupCodesRegenerated: "Codes de secours régénérés",
    backupCodesRegeneratedMessage: "Vos nouveaux codes de secours ont été générés. Veuillez les sauvegarder en toute sécurité.",
    secretLabel: "Ou entrez ce secret manuellement :",
    invalidTokenLength: "Veuillez entrer un code à 6 chiffres",
    verificationFailed: "Code invalide. Veuillez réessayer.",
    enableFailed: "Échec de l'activation de MFA",
    disableFailed: "Échec de la désactivation de MFA. Veuillez vérifier votre code.",
    regenerateFailed: "Échec de la régénération des codes de secours.",
  },
}

export default fr
