import { LocaleTranslations } from "./en"

const fr: LocaleTranslations = {
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
    signInToContinue: "Veuillez vous connecter pour continuer.",
    continue: "Continuer",
    delete: "Supprimer",
    done: "Terminé",
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
    client: "Client :",
    importance: "Importance :",
    expires: "Expire :",
    filteredByClientBanner: "Alertes affichées pour {{name}}",
    clearAlertFilter: "Tout afficher",
    noAlertsForFilteredClientTitle: "Aucune alerte pour ce client",
    noAlertsForFilteredClientSubtitle: "Aucune alerte n’est liée à {{name}}. Effacez le filtre pour voir toutes les alertes ou choisissez un autre client depuis l’accueil.",
  },
  legalLinks: {
    privacyPolicy: "Politique de confidentialité",
    termsOfService: "Conditions d'utilisation",
    privacyPractices: "Pratiques de Confidentialité HIPAA",
  },
  errorScreen: {
    title: "Quelque chose s'est mal passé !",
    friendlySubtitle: "C'est l'écran que vos utilisateurs verront en production lorsqu'une erreur sera lancée. Vous voudrez personnaliser ce message (situé dans `app/i18n/fr.ts`) et probablement aussi la mise en page (`app/screens/ErrorScreen`). Si vous voulez le supprimer complètement, vérifiez `app/app.tsx` pour le composant <ErrorBoundary>.",
    reset: "RÉINITIALISER L'APPLICATION",
    traceTitle: "Erreur depuis %{name}",
  },
  emptyStateComponent: {
    generic: {
      heading: "Si vide... si triste",
      content: "Aucune donnée trouvée pour le moment. Essayez de cliquer sur le bouton pour rafraîchir ou recharger l'application.",
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
    appName: "Bianca",
    tagline: "Communication de Vérification du Bien-être",
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
    countryFieldLabel: "Pays",
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
    addClient: "Ajouter un client",
    adminOnlyMessage: "Seuls les administrateurs d'organisation et les super administrateurs peuvent ajouter des clients",
    noClientsFound: "Aucun client trouvé",
    viewSchedules: "Voir les plannings",
    noScheduleWarning: "⚠ Aucun planning configuré",
    glanceAlerts: "Alertes",
    glanceHintAlertsTitle: "Alertes pour ce client",
    glanceHintAlertsBody: "Nombre d’alertes de votre liste liées à ce résident (par exemple alertes client, conversation ou planning). Ouvrez l’onglet Alertes pour les consulter ou les gérer. Les alertes sans client lié ne sont pas comptées ici.",
    glanceAlertsA11y: "{{count}} alertes liées à ce client",
    glanceSentimentActionHint: "Ouvre l’analyse de sentiment du dernier appel dans Rapports.",
    glanceHealthActionHint: "Ouvre le rapport d’analyse de santé de ce client dans Rapports.",
    glanceRiskActionHint: "Ouvre le rapport fraude et sécurité de ce client dans Rapports.",
    glanceAlertsActionHint: "Ouvre la liste des alertes filtrée sur ce client.",
    glanceHealth: "Santé",
    glanceHealthA11y: "Score de santé {{score}} sur cent",
    glanceHintButtonA11y: "À propos de {{label}}",
    glanceHintHealthBody: "Score global de bien-être issu de la dernière analyse médicale de conversation (0–100, plus élevé est mieux). Il combine des signaux comme les schémas cognitifs et d'humeur des appels. Il ne remplace pas le jugement clinique ni le rapport de santé complet.",
    glanceHintHealthTitle: "Score de santé",
    glanceHintRiskBody: "Score global de risque issu de la dernière analyse fraude et sécurité (0–100, plus élevé signifie plus de préoccupation). Il reflète l'argent, la sécurité, l'isolement et des sujets similaires. Consultez le rapport fraude et abus pour les détails.",
    glanceHintRiskTitle: "Score de risque",
    glanceHintSentimentBody: "Résumé du ton du client dans les appels analysés récents (environ les 30 derniers jours). Hausse, stable ou baisse compare les appels plus récents aux un peu plus anciens. Ce n'est pas un diagnostic — consultez le rapport de sentiment complet pour plus de détails.",
    glanceHintSentimentTitle: "Tendance d'humeur",
    glanceNoData: "—",
    glanceRisk: "Risque",
    glanceRiskA11y: "Score de risque {{score}} sur cent",
    glanceSentiment: "Humeur",
    lastAnsweredCall: "Dernier appel décroché",
    lastCalled: "Dernier appel",
    neverCalled: "Jamais",
    noAnsweredCallsYet: "Aucun appel décroché pour l'instant",
    sentimentTrendDeclining: "Baisse",
    sentimentTrendImproving: "Hausse",
    sentimentTrendStable: "Stable",
  },
  tabs: {
    home: "Accueil",
    org: "Org",
    reports: "Rapports",
    alerts: "Alertes",
  },
  onboarding: {
    howItWorks: {
      title: "Comment fonctionne Bianca",
      next: "Suivant",
      getStarted: "Commencer",
      organization: "Ajoutez vos clients, programmez quand Bianca doit les appeler, et consultez les conversations et les rapports en un seul endroit. Bianca gère les appels pour que vous puissiez vous concentrer sur les soins.",
      caregiver: "Ajoutez les personnes dont vous prenez soin, choisissez quand Bianca les appelle, et suivez leur état via les conversations et rapports. Vous restez informé sans être à chaque appel.",
      agingInPlace: "Bianca vous appelle selon votre emploi du temps pour des points réguliers. Vous pouvez consulter votre bien-être et vos rapports à tout moment. C'est comme avoir une compagne toujours là quand vous en avez besoin.",
    },
    registration: {
      title: "Vos coordonnées",
      subtitle: "Confirmez vos informations et acceptez les conditions pour continuer.",
      nameRequired: "Le nom est obligatoire.",
      emailRequired: "L'adresse e-mail est obligatoire.",
      termsRequired: "Vous devez accepter les conditions d'utilisation et la politique de confidentialité pour continuer.",
    },
    aboutYou: {
      agingInPlace: "Vieillissement à domicile",
      caregiver: "Aidant",
      organization: "Organisation",
      subtitle: "Cela nous aide à personnaliser votre expérience.",
      title: "Parlez-nous un peu de vous",
    },
    orgInfo: {
      countryLabel: "Pays",
      orgNameLabel: "Nom de l'organisation",
      orgNamePlaceholder: "Entrez le nom de votre organisation",
      subtitle: "Parlez-nous de votre organisation.",
      timezoneLabel: "Fuseau horaire",
      title: "Informations sur l'organisation",
    },
    termsAndConsent: {
      acceptTerms: "J'ai lu et j'accepte les",
      acceptTermsLabel: "Accepter les Conditions d'utilisation et la Politique de confidentialité",
      and: "et la",
      no: "Non",
      privacyLink: "Politique de confidentialité",
      saveAndContinue: "Enregistrer et continuer",
      singleConsentQuestion: "Êtes-vous dans un État à consentement unilatéral ? (Une seule partie doit consentir à l'enregistrement.)",
      termsLink: "Conditions d'utilisation",
      title: "Conditions et consentement",
      whyImportant: "Pourquoi est-ce important ?",
      whyImportantBody: "Les lois sur l'enregistrement des appels varient selon l'État et le pays. Dans les États à consentement unilatéral, une seule personne doit accepter l'enregistrement. Dans les États à deux parties, tous les participants doivent consentir. Le bon paramétrage assure la conformité de votre organisation.",
      yes: "Oui",
    },
  },
  headers: {
    home: "Accueil",
    client: "Client",
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
    clientOnboarding: "Accueil",
    medicalAnalysis: "Analyse médicale",
    fraudAbuseAnalysis: "Analyse de Fraude et d'Abus",
    privacyPolicy: "Politique de confidentialité",
    privacyPractices: "Pratiques de confidentialité HIPAA",
    termsOfService: "Conditions d'utilisation",
    mentalHealthReport: "Rapport de santé mentale",
    login: "Se connecter",
    register: "S'inscrire",
    privacyRequest: "Demander mes données",
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
  phoneVerificationBanner: {
    title: "Vérifiez votre numéro de téléphone",
    message: "Veuillez vérifier votre numéro de téléphone pour recevoir des alertes d'urgence et des notifications importantes.",
    verifyButton: "Vérifier maintenant",
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
    continueWithGoogle: "Continuer avec Google",
    continueWithMicrosoft: "Continuer avec Microsoft",
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
    noClientSelected: "Aucun client sélectionné",
    firstConversation: "Aucune conversation précédente trouvée. Ce sera la première conversation avec ce client.",
    noConversationsToDisplay: "Aucune conversation à afficher",
    noPreviousConversations: "Aucune conversation précédente trouvée pour ce client",
    errorFetchingConversations: "Erreur lors de la récupération des conversations",
    loadingMoreConversations: "Chargement de plus de conversations...",
  },
  clientScreen: {
    nameLabel: "Nom *",
    namePlaceholder: "Entrez le nom du client",
    emailLabel: "E-mail *",
    emailPlaceholder: "Entrez l'adresse e-mail",
    phoneLabel: "Téléphone *",
    phonePlaceholder: "Entrez le numéro de téléphone",
    preferredLanguageLabel: "Langue Préférée",
    updateClient: "METTRE À JOUR LE CLIENT",
    createClient: "CRÉER LE CLIENT",
    manageSchedules: "GÉRER LES HORAIRES",
    manageConversations: "GÉRER LES CONVERSATIONS",
    viewSentimentAnalysis: "VOIR L'ANALYSE DE SENTIMENT",
    manageCaregivers: "GÉRER LES AIDANTS",
    confirmDelete: "CONFIRMER LA SUPPRESSION",
    deleteClient: "SUPPRIMER LE CLIENT",
    onboardingCardTitle: "Accueil du résident",
    onboardingNotStarted: "Non commencé — prochaine étape : jour 1 sur 4",
    onboardingInProgress: "En cours",
    onboardingNextDay: "Prochain : jour {{day}} sur 4",
    onboardingCallsCompleted: "{{completed}} appels sur 4 terminés",
    onboardingCapturesLine: "{{count}} réponses enregistrées",
    onboardingComplete: "Accueil terminé — les 4 appels sont faits",
    viewOnboardingDetails: "VOIR LES RÉPONSES D'ACCUEIL",
    onboardingButtonCompactComplete: "Accueil · Terminé",
    onboardingButtonCompactDay: "Accueil · Jour {{day}}",
    onboardingButtonA11yHint: "Ouvre les réponses et le parcours d’accueil de ce résident.",
    onboardingOutboundCallsHint: "Les appels sortants depuis l'accueil ou le planning utilisent la conversation d'intégration de la session {{day}} jusqu'à ce que cette session soit terminée au téléphone. Pas de réponse signifie aucune progression — le prochain appel reste sur la même session.",
  },
  clientOnboardingScreen: {
    title: "Réponses d'accueil",
    noClient: "Aucun client sélectionné.",
    day: "Jour",
    filterByDay: "Filtrer par jour",
    allDays: "Tous les jours",
    loading: "Chargement…",
    error: "Impossible de charger les données d'accueil.",
    captureCount: "{{count}} réponses",
    emptyAllDays: "Aucune réponse d’intégration enregistrée pour l’instant.",
    emptyForDay: "L’intégration du jour {{day}} n’a pas encore été effectuée.",
    flag: {
      safety: "Sécurité",
      memory: "Mémoire",
      mood: "Humeur",
      distress: "Détresse",
      confusion: "Confusion",
    },
    signalsForDay: "Signaux enregistrés le jour {{day}}",
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
    amount: "Montant :",
    invoiceNumber: "Numéro de facture :",
    issueDate: "Date d'émission :",
    dueDate: "Date d'échéance :",
    notes: "Notes :",
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
    clientsWithCharges: "Clients avec des charges :",
    clientWord: "client",
    clientsWord: "clients",
    chargesByClient: "Charges par client",
    conversation: "conversation",
    conversations: "conversations",
    average: "Moyenne :",
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
    accessRestricted: "Accès restreint",
    accessRestrictedMessage: "Vous n'avez pas les permissions nécessaires pour voir ou gérer les informations de paiement.",
    contactAdministrator: "Veuillez contacter votre administrateur d'organisation pour obtenir de l'aide.",
    loadingUserInformation: "Chargement des informations utilisateur...",
    addPaymentMethod: "Ajouter un moyen de paiement",
    loadingPaymentSystem: "Chargement du système de paiement...",
    loadingPaymentMethods: "Chargement des moyens de paiement...",
    stripeConfigurationError: "Erreur de configuration Stripe. Veuillez contacter le support.",
    unsupportedPlatform: "Plateforme non prise en charge. Veuillez utiliser un navigateur web ou une application mobile.",
    errorLoadingPaymentMethods: "Erreur lors du chargement des moyens de paiement :",
    existingPaymentMethods: "Moyens de paiement existants",
    default: "Par défaut",
    setDefault: "Définir par défaut",
    remove: "Supprimer",
    addNewCard: "Ajouter une nouvelle carte",
    deletePaymentMethod: "Supprimer le moyen de paiement",
    deletePaymentMethodConfirm: "Êtes-vous sûr de vouloir supprimer ce moyen de paiement ? Cette action ne peut pas être annulée.",
    paymentMethodAddedSuccess: "Moyen de paiement ajouté avec succès !",
    paymentMethodSetDefaultSuccess: "Moyen de paiement défini par défaut avec succès !",
    paymentMethodDeletedSuccess: "Moyen de paiement supprimé avec succès !",
    failedToSetDefault: "Échec de la définition du moyen de paiement par défaut",
    failedToDelete: "Échec de la suppression du moyen de paiement",
    expires: "Expire",
    mobilePaymentUnavailable: "Système de paiement mobile indisponible. Veuillez utiliser la version web.",
    loadingMobilePayment: "Chargement du système de paiement mobile...",
    anErrorOccurred: "Une erreur s'est produite",
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
    alertOnAllMissedCallsHelper: "Envoyer des alertes pour chaque appel manqué et chaque tentative de relance",
    alertOnAllMissedCallsLabel: "Alerter pour tous les appels manqués",
    callRetrySettings: "Paramètres de relance d'appel",
    clientConsentSettings: "Paramètres de consentement client",
    country: "Pays",
    countryHelper: "Sélectionnez le pays de votre organisation. Cela aide à déterminer les réglementations de confidentialité applicables.",
    enableRetriesHelper: "Lorsque cette option est activée, le système relancera automatiquement les appels échoués",
    enableRetriesLabel: "Activer les relances d'appel",
    retryCountHelper: "Nombre de tentatives si l'appel n'est pas décroché (1-5)",
    retryCountLabel: "Nombre de relances",
    retryIntervalMinutesHelper: "Délai d'attente entre les tentatives (1-60 minutes, par défaut : 15)",
    retryIntervalMinutesLabel: "Intervalle de relance (minutes)",
    timezone: "Fuseau horaire",
    timezoneHelper: "Sélectionnez le fuseau horaire de votre organisation. Les horaires du planning seront basés sur ce fuseau horaire.",
    requireClientConsentLabel: "Consentement client requis",
    requireClientConsentHelper: "Si activé, les demandes de consentement seront envoyées automatiquement par e-mail.",
  },
  caregiverScreen: {
    nameLabel: "Nom",
    namePlaceholder: "Nom",
    emailLabel: "E-mail",
    emailPlaceholder: "E-mail",
    phoneLabel: "Téléphone",
    phonePlaceholder: "Téléphone",
    loadingUnassignedClients: "Chargement des clients non assignés...",
    assigningClients: "Assignation des clients...",
    clientsAssignedSuccess: "Clients assignés avec succès !",
    loadingCaregivers: "Chargement des aidants...",
    save: "ENREGISTRER",
    invite: "INVITER",
    confirmDelete: "CONFIRMER LA SUPPRESSION",
    deleteCaregiver: "SUPPRIMER L'AIDANT",
    assignUnassignedClients: "Assigner les clients non assignés",
    assignUnassignedClientsTitle: "Assigner les clients non assignés",
    selectAll: "Tout sélectionner",
    deselectAll: "Tout désélectionner",
    assignSelected: "Assigner la sélection",
    noUnassignedClientsFound: "Aucun client non assigné trouvé.",
  },
  caregiversScreen: {
    invited: "Invité",
    edit: "Modifier",
    resendInvite: "Renvoyer l'invitation",
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
    codeFieldLabel: "Code de réinitialisation",
    codeFieldPlaceholder: "Entrez le code",
    newPasswordFieldLabel: "Nouveau mot de passe",
    newPasswordFieldPlaceholder: "Entrez le nouveau mot de passe",
    confirmPasswordFieldLabel: "Confirmer le nouveau mot de passe",
    confirmPasswordFieldPlaceholder: "Confirmez le mot de passe",
    confirmReset: "Confirmer la réinitialisation",
    successTitle: "Mot de passe réinitialisé !",
    successMessage: "Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.",
    redirecting: "Redirection vers la connexion...",
    resetPasswordButton: "Réinitialiser le mot de passe",
    backToLogin: "Retour à la connexion",
    successMessageShort: "Mot de passe réinitialisé avec succès !",
    requestFailed: "Échec de la réinitialisation. Vérifiez le code et réessayez.",
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
    noClientSelected: "Aucun client sélectionné",
    selectClientToView: "Veuillez sélectionner un client depuis l'écran d'accueil pour voir son analyse de sentiment.",
    sessionRequiredTitle: "Connexion requise",
    sessionRequiredMessage: "Votre session a peut-être expiré. Reconnectez-vous pour voir l’analyse de sentiment. Si la fenêtre de connexion est déjà ouverte, terminez la connexion là.",
    signInToContinueButton: "Se connecter",
    accessDeniedTitle: "Impossible de charger ce rapport",
    accessDeniedMessage: "Vous n’avez peut-être pas accès aux données de sentiment de ce client, ou vos droits ont changé. Réessayez depuis l’accueil ou contactez un administrateur.",
    clientSentimentAnalysis: "Analyse de sentiment du client",
    emotionalWellnessInsights: "Insights sur le bien-être émotionnel et les tendances",
    timeRange: "Période :",
    noSentimentDataAvailable: "Aucune donnée de sentiment disponible",
    noSentimentDataMessage: "L'analyse de sentiment apparaîtra ici une fois que le client aura terminé des conversations.",
    loadingSentimentAnalysis: "Chargement de l'analyse de sentiment...",
    sentimentAnalysisFooter: "L'analyse de sentiment est automatiquement générée après chaque conversation en utilisant la technologie IA.",
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
    recentConversationsTitle: "Conversations récentes",
    conversationsWithSentiment: "conversation{s} avec analyse de sentiment",
    noRecentConversations: "Aucune conversation récente avec analyse de sentiment",
    keyEmotions: "Émotions clés :",
    moreEmotions: "plus",
    clientMood: "Humeur du client :",
    concern: "préoccupation",
    confidence: "confiance",
    noSentimentAnalysisAvailable: "Aucune analyse de sentiment disponible",
    sentimentTrend: "Tendance du sentiment",
    conversationsAnalyzedNoTrend: "conversation{s} analysées, mais aucune donnée de tendance disponible pour le moment",
    noSentimentData: "Aucune donnée de sentiment disponible",
    avg: "Moy :",
    negative: "Négatif",
    positive: "Positif",
    insufficientDataForTrend: "Données insuffisantes pour l'analyse de tendance",
    needMoreConversations: "Besoin de plus de conversations pour une tendance fiable",
    lowConfidence: "Faible confiance",
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
    clientMoodAssessment: "Évaluation de l'humeur du client",
    concernLevel: "Niveau de préoccupation",
    lowConcernDescription: "Le client semble être de bonne humeur avec des préoccupations minimales.",
    mediumConcernDescription: "Quelques zones de préoccupation ont été notées pendant la conversation.",
    highConcernDescription: "Des préoccupations importantes ont été identifiées qui peuvent nécessiter une attention.",
    satisfactionIndicators: "Indicateurs de satisfaction",
    positiveIndicators: "Indicateurs positifs",
    areasOfConcern: "Zones de préoccupation",
    aiSummary: "Résumé IA",
    recommendations: "Recommandations",
    sentimentAnalysisDebug: "Débogage de l'analyse de sentiment",
    debugSubtitle: "Déboguer et corriger l'analyse de sentiment manquante pour les conversations récentes",
    debugging: "Débogage...",
    debugSentimentAnalysis: "Déboguer l'analyse de sentiment",
    loading: "Chargement...",
    debugConversationData: "Déboguer les données de conversation",
    testing: "Test...",
    testDirectApiCall: "Tester l'appel API direct",
    forceRefreshCache: "Forcer l'actualisation du cache",
    currentClient: "Client actuel :",
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
    noClient: "Aucun client",
    pleaseSelectClient: "Veuillez d'abord sélectionner un client",
    conversationDebugComplete: "Débogage de conversation terminé",
    directApiTest: "Test API direct",
    noRecentCallButHaveCalls: "Appels récents, pas encore de sentiment",
    noRecentCallButHaveCallsMessage: "Vous avez des appels récents au cours des 30 derniers jours, mais aucun n'a encore d'analyse de sentiment. Les nouveaux appels seront analysés automatiquement à la fin. Les plus anciens peuvent devoir être retraités.",
  },
  medicalAnalysis: {
    title: "Analyse médicale",
    error: "Erreur",
    success: "Succès",
    noClientSelected: "Aucun client sélectionné",
    selectClientToView: "Veuillez sélectionner un client pour voir l'analyse médicale",
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
    disclaimer: "Cette analyse est à des fins informatives uniquement et ne remplace pas les conseils, diagnostics ou traitements médicaux professionnels. Consultez toujours des professionnels de la santé qualifiés pour les préoccupations médicales.",
    overview: "Aperçu",
    confidence: "Confiance",
    noDataAvailable: "Aucune donnée disponible pour l'analyse",
    insufficientDataWarning: "Données limitées disponibles : {{current}} appel(s) analysé(s). Pour une analyse plus fiable, {{minimum}} appels ou plus sur une période plus longue sont recommandés pour mieux comprendre les modèles du client.",
    analysisWillAppearAfterCalls: "Les résultats de l'analyse apparaîtront ici après la fin des appels.",
    keyIndicators: "Indicateurs Clés",
    fillerWords: "Mots de Remplissage",
    vagueReferences: "Références Vagues",
    temporalConfusion: "Confusion Temporelle",
    wordFinding: "Difficultés à Trouver les Mots",
    repetition: "Score de Répétition",
    informationDensity: "Densité d'Information",
    depressionScore: "Score de Dépression",
    anxietyScore: "Score d'Anxiété",
    emotionalTone: "Ton Émotionnel",
    negativeRatio: "Ratio Négatif",
    protectiveFactors: "Facteurs Protecteurs",
    typeTokenRatio: "Diversité du Vocabulaire",
    avgWordLength: "Longueur Moyenne des Mots",
    avgSentenceLength: "Longueur Moyenne des Phrases",
    uniqueWords: "Mots Uniques",
    crisisIndicators: "Indicateurs de crise détectés - évaluation professionnelle immédiate recommandée",
    cognitiveInterpretation: {
      normal: "Les modèles de communication semblent normaux sans préoccupations cognitives significatives détectées.",
      mildConcern: "Quelques changements légers dans les modèles de communication détectés. Surveiller la progression.",
      moderateConcern: "Changements modérés dans les modèles de communication observés. Envisager une évaluation professionnelle.",
      significantConcern: "Changements significatifs dans les modèles de communication détectés. Évaluation professionnelle fortement recommandée.",
    },
    psychiatricInterpretation: {
      stable: "Les indicateurs de santé mentale semblent stables sans préoccupations significatives.",
      mildConcern: "Quelques indicateurs légers de santé mentale détectés. Continuer la surveillance.",
      moderateConcern: "Indicateurs modérés de santé mentale observés. Envisager une consultation professionnelle.",
      significantConcern: "Indicateurs significatifs de santé mentale détectés. Consultation professionnelle recommandée.",
      crisis: "Indicateurs de crise détectés. Intervention professionnelle immédiate fortement recommandée.",
    },
    vocabularyInterpretation: {
      strong: "La complexité du langage et l'utilisation du vocabulaire semblent fortes et bien maintenues.",
      average: "La complexité du langage et l'utilisation du vocabulaire sont dans les plages normales.",
      limited: "La complexité du langage et l'utilisation du vocabulaire semblent limitées. Surveiller les changements.",
    },
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
    emailVerified: "E-mail vérifié",
    emailNotVerified: "E-mail non vérifié",
    phoneVerified: "Téléphone vérifié",
    phoneNotVerified: "Téléphone non vérifié",
    verifyPhone: "Vérifier le téléphone",
    fontSize: "Taille de police",
    fontSizeDescription: "Ajustez la taille du texte pour une meilleure lisibilité. Les modifications s'appliquent immédiatement.",
    decreaseFontSize: "Diminuer la taille de police",
    increaseFontSize: "Augmenter la taille de police",
    fontSizeHint: "Ajuster la taille de police de 80% à 200%",
    telemetryOptIn: "Partager des données d'utilisation anonymes",
    telemetryDescription: "Aidez-nous à améliorer l'application en partageant des données d'utilisation anonymes. Aucune information personnelle n'est collectée.",
    telemetryEnabled: "Télémétrie activée",
    telemetryDisabled: "Télémétrie désactivée",
    emailManagedBySSO: "L'e-mail est géré par votre fournisseur de connexion et ne peut pas être modifié.",
    requestMyData: "Demander mes données",
    verificationEmailFailed: "Échec de l'envoi de l'e-mail de vérification. Veuillez réessayer.",
    verificationEmailSent: "E-mail de vérification envoyé ! Veuillez consulter votre boîte de réception.",
    verifyEmail: "Vérifier l'e-mail",
    verifyPhoneBannerMessage: "Veuillez vérifier votre numéro de téléphone pour recevoir les alertes d'urgence et les notifications importantes. Vous pouvez continuer à utiliser l'application avec un numéro non vérifié.",
  },
  fraudAbuseAnalysis: {
    title: "Analyse de Fraude et d'Abus",
    error: "Erreur",
    success: "Succès",
    noClientSelected: "Aucun client sélectionné",
    selectClientToView: "Veuillez sélectionner un client pour voir l'analyse de fraude et d'abus",
    triggering: "Déclenchement...",
    triggerAnalysis: "Déclencher l'Analyse",
    loadingResults: "Chargement des résultats de l'analyse...",
    noResultsAvailable: "Aucun résultat d'analyse disponible",
    triggerToGetStarted: "Déclenchez une analyse pour commencer",
    analysisWillAppearAfterCalls: "Les résultats de l'analyse apparaîtront ici après la fin des appels.",
    insufficientDataWarning: "Données limitées disponibles : {{current}} appel(s) analysé(s). Pour une analyse plus fiable, {{minimum}} appels ou plus sur une période plus longue sont recommandés pour mieux comprendre les modèles du client.",
    loadFailed: "Échec du chargement des résultats de l'analyse de fraude/abus",
    triggerFailed: "Échec du déclenchement de l'analyse de fraude/abus",
    triggerSuccess: "Analyse de fraude/abus terminée avec succès.",
    disclaimer: "Cette analyse est à des fins informatives uniquement et ne remplace pas une évaluation professionnelle. Si vous soupçonnez une fraude, un abus ou une négligence, contactez immédiatement les autorités appropriées.",
    overview: "Aperçu",
    conversations: "Conversations",
    messages: "Messages",
    riskScore: "Score de Risque",
    financialRisk: "Risque Financier",
    abuseRisk: "Risque d'Abus",
    relationshipRisk: "Risque de Relation",
    warnings: "Avertissements",
    recommendations: "Recommandations",
    critical: "Critique",
    high: "Élevé",
    medium: "Moyen",
    low: "Faible",
    largeAmountMentions: "Mentions de Montants Importants",
    transferMethodMentions: "Mentions de Méthodes de Transfert",
    scamIndicators: "Indicateurs d'Arnaque",
    physicalAbuseScore: "Score d'Abus Physique",
    emotionalAbuseScore: "Score d'Abus Émotionnel",
    neglectScore: "Score de Négligence",
    newPeopleCount: "Nombre de Nouvelles Personnes",
    isolationCount: "Nombre d'Isolement",
    suspiciousBehaviorCount: "Nombre de Comportements Suspects",
  },
  reportsScreen: {
    selectClient: "Sélectionner un client :",
    chooseClient: "Choisir un client...",
    sentiment: "Sentiment",
    medicalAnalysis: "Analyse médicale",
    fraudAbuseAnalysis: "Fraude et Abus",
    comingSoon: "Bientôt disponible",
    modalTitle: "Sélectionner un client",
    modalCancel: "Annuler",
  },
  schedulesScreen: {
    scheduleDetails: "Détails du planning",
    selectSchedule: "Sélectionner un planning :",
    scheduleNumber: "Planning",
    noSchedulesAvailable: "Aucun planning disponible. Veuillez en créer un nouveau.",
    errorLoadingSchedules: "Erreur lors du chargement des plannings.",
    errorSavingSchedule: "Erreur lors de l'enregistrement du planning.",
    invalidScheduleError: "Veuillez remplir tous les champs obligatoires du planning (fréquence, heure et jours pour les plannings hebdomadaires/mensuels).",
    newSchedule: "Nouveau planning",
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
    highcontrast: {
      description: "Thème à contraste maximal pour déficience visuelle (WCAG AAA)",
      name: "Contraste élevé",
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
- Email : privacy@biancawellness.com
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
- Email : privacy@biancawellness.com
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
- Formation de nos systèmes pour mieux servir les clients

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
- Nom du client, numéro de téléphone, date de naissance
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
- Email : privacy@biancawellness.com
- Téléphone : +1-604-562-4263
- Courrier : Bureau de la confidentialité MyPhoneFriend, 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

**Heures** : Lundi-Vendredi, 9h - 17h PST

---

# DÉPOSER UNE PLAINTE

**Avec nous** :
- Email : privacy@biancawellness.com
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

**Anglais** : Si vous avez besoin d'aide pour comprendre cet avis, contactez privacy@biancawellness.com

**Español** : Si necesita ayuda, comuníquese con privacy@biancawellness.com`,
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
  callScreen: {
    onboardingNextRegular: "Une fois l'intégration terminée, les contrôles utiliseront le format habituel de bien-être.",
    onboardingNextWillBe: "Jusqu'à la fin de l'intégration, le prochain appel sortant poursuivra l'intégration (session {{day}}).",
    onboardingProgress: "{{completed}} sur {{total}} sessions d'intégration terminées.",
    onboardingThisCall: "Cet appel est la session d'intégration {{day}} sur {{total}}. Le parcours avance lorsque le résident répond et que la session se termine.",
    onboardingTitle: "Intégration du résident",
    title: "Appel",
    noClientSelected: "Aucun client sélectionné",
    callWith: "Appel avec {{name}}",
    callDetails: "Détails de l'appel",
    clientLabel: "Client :",
    phoneLabel: "Téléphone :",
    statusLabel: "Statut :",
    liveIndicator: "En direct",
    aiSpeaking: "IA en train de parler...",
    userSpeaking: "Utilisateur en train de parler...",
  },
  phoneVerificationScreen: {
    codeResent: "Code de vérification renvoyé !",
    codeSent: "Code de vérification envoyé !",
    didntReceiveCode: "Vous n'avez pas reçu le code ?",
    errorResendingCode: "Échec du renvoi du code de vérification. Veuillez réessayer.",
    errorSendingCode: "Échec de l'envoi du code de vérification. Veuillez réessayer.",
    errorVerifyingCode: "Code de vérification invalide. Veuillez réessayer.",
    invalidCode: "Veuillez saisir un code à 6 chiffres",
    message: "Nous avons envoyé un code de vérification à 6 chiffres au {{phone}}. Veuillez le saisir ci-dessous.",
    resendAvailableIn: "Renvoi disponible dans",
    resendButton: "Renvoyer le code",
    sendCodeButton: "Envoyer le code de vérification",
    title: "Vérifiez votre téléphone",
    verifyButton: "Vérifier le téléphone",
  },
  privacyRequestScreen: {
    accessMethodDownload: "Téléchargement",
    accessMethodEmail: "E-mail",
    accessMethodInfo: "Vos données vous seront envoyées par e-mail en pièce jointe JSON.",
    accessMethodLabel: "Comment souhaitez-vous recevoir vos données ?",
    additionalInformationLabel: "Renseignements supplémentaires (facultatif)",
    complaintDescriptionLabel: "Description *",
    complaintDescriptionPlaceholder: "Veuillez fournir les détails de votre plainte, y compris ce qui s'est passé et quand.",
    complaintFieldsRequired: "Veuillez remplir l'objet et la description.",
    complaintHistoryTitle: "Historique des plaintes",
    complaintRequestDescription: "Si vous pensez que nous n'avons pas traité vos renseignements personnels conformément aux lois sur la vie privée, vous pouvez déposer une plainte. Nous enquêterons et répondrons dans un délai de 30 jours.",
    complaintRequestTitle: "Plainte relative à la vie privée",
    complaintSubjectLabel: "Objet *",
    complaintSubjectPlaceholder: "Brève description de votre plainte",
    complaintSubmitted: "Votre plainte a été soumise. Nous enquêterons et répondrons dans un délai de 30 jours.",
    completedOn: "Terminé le",
    confirmDelete: "Supprimer",
    correctionFieldLabel: "Champ à corriger",
    correctionFieldPlaceholder: "p. ex., Adresse e-mail, Téléphone, Nom",
    correctionFieldsRequired: "Veuillez remplir le nom du champ et la valeur demandée.",
    correctionNote: "Remarque : La plupart des données peuvent être modifiées directement dans l'application. Utilisez ce formulaire pour les données non modifiables, comme les journaux historiques ou les enregistrements générés par le système.",
    correctionReasonLabel: "Motif de la correction (facultatif)",
    correctionReasonPlaceholder: "Pourquoi ces renseignements doivent-ils être corrigés ?",
    correctionRequestDescription: "Demandez une correction de vos renseignements personnels. Indiquez ce qui doit être corrigé.",
    correctionRequestSubmitted: "Votre demande de correction a été soumise. Nous l'examinerons et la traiterons dans un délai de 30 jours.",
    correctionRequestTitle: "Demande de correction de données",
    currentValue: "Valeur actuelle",
    currentValueLabel: "Valeur actuelle (facultatif)",
    currentValuePlaceholder: "Quelle est la valeur actuelle ?",
    deletionCompleted: "Suppression des données terminée avec succès.",
    deletionConfirmMessage: "Cela supprimera définitivement vos données. Cette action est irréversible. Êtes-vous sûr de vouloir continuer ?",
    deletionConfirmTitle: "Confirmer la suppression des données",
    deletionDataTypeLabel: "Quelles données souhaitez-vous supprimer ?",
    deletionFailed: "Échec de la suppression des données. Cela peut ne pas être disponible dans votre juridiction en raison d'obligations légales de conservation.",
    deletionRequestDescription: "En vertu de la LPRPDE, vous pouvez demander la suppression de vos renseignements personnels. Remarque : la HIPAA exige une conservation de 7 ans ; la suppression peut ne pas être disponible dans toutes les juridictions.",
    deletionRequestTitle: "Demander la suppression des données",
    deletionTypeAll: "Toutes les données",
    deletionTypeCalls: "Appels uniquement",
    deletionTypeConversations: "Conversations uniquement",
    deletionTypeMedicalAnalysis: "Analyse médicale uniquement",
    field: "Champ",
    filedOn: "Déposée le",
    informationRequestedLabel: "Renseignements demandés",
    informationRequestedPlaceholder: "Tous mes renseignements personnels (ou précisez ce dont vous avez besoin)",
    reason: "Motif",
    requestDataDescription: "Décrivez les renseignements auxquels vous souhaitez accéder. Laissez vide pour demander tous vos renseignements personnels.",
    requestDataTitle: "Demande d'accès aux données",
    requestDeletion: "Demander la suppression des données",
    requestFailed: "Échec de la soumission de la demande. Veuillez réessayer.",
    requestHistoryTitle: "Historique des demandes",
    requestSubmitted: "Votre demande de données a été soumise. Vous recevrez bientôt un e-mail avec vos données.",
    requestTypeAccess: "Demande d'accès",
    requestTypeComplaint: "Déposer une plainte",
    requestTypeCorrection: "Demande de correction",
    requestedOn: "Demandé le",
    requestedValue: "Valeur demandée",
    requestedValueLabel: "Valeur demandée *",
    requestedValuePlaceholder: "Quelle devrait être la valeur corrigée ?",
    resolvedOn: "Résolue le",
    submitRequest: "Soumettre la demande",
    subtitle: "En vertu de la LPRPDE, vous avez le droit d'accéder à vos renseignements personnels et de les faire corriger. Soumettez une demande d'accès ou de correction.",
    title: "Demander mes données",
    violationTypeAccess: "Problème d'accès",
    violationTypeLabel: "Type de problème (facultatif)",
    violationTypeOther: "Autre",
  },
  caregiverInvitedScreen: {
    title: "Invitation envoyée !",
    message: "Une invitation a été envoyée à {{name}} à {{email}}.",
    continue: "Continuer",
    subMessage: "Ils recevront un e-mail avec les instructions d'inscription.",
  },
}

export default fr
