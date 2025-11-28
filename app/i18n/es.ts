import { Translations } from "./en"

const es: Translations = {
  alertScreen: {
    markAllAsRead: "Marcar todo como leído",
    unreadAlerts: "Alertas no leídas",
    allAlerts: "Todas las alertas",
    noAlerts: "Sin alertas",
    noAlertsTitle: "¡Todo al día!",
    noAlertsSubtitle: "No tienes alertas sin leer. ¡Buen trabajo manteniéndote al día!",
    emptyHeading: "Tan vacío... tan triste",
    refreshing: "Actualizando...",
    refresh: "Actualizar",
    patient: "Paciente:",
    importance: "Importancia:",
    expires: "Expira:",
  },
  errorScreen: {
    title: "¡Algo salió mal!",
    friendlySubtitle: "Ha ocurrido un error. Querrás personalizar el diseño también (`app/screens/ErrorScreen`). Si quieres eliminar esto completamente, revisa `app/app.tsx` para el componente <ErrorBoundary>.",
    reset: "REINICIAR APP",
    traceTitle: "Error de la pila %{name}",
  },
  emptyStateComponent: {
    generic: {
      heading: "Tan vacío... tan triste",
      content: "No se encontraron datos aún. Intenta hacer clic en el botón para actualizar o recargar la app.",
      button: "Intentemos esto de nuevo",
    },
  },
  errors: {
    invalidEmail: "Dirección de correo electrónico inválida.",
  },
  loginScreen: {
    signIn: "Iniciar sesión",
    register: "Registrarse",
    enterDetails: "Ingresa tus detalles a continuación para desbloquear información ultra secreta. Nunca adivinarás lo que tenemos esperando. O tal vez sí; no es ciencia espacial aquí.",
    emailFieldLabel: "Correo electrónico",
    passwordFieldLabel: "Contraseña",
    emailFieldPlaceholder: "Ingresa tu dirección de correo electrónico",
    passwordFieldPlaceholder: "Contraseña súper secreta aquí",
    forgotPassword: "¿Olvidaste tu contraseña?",
    hint: "Pista: puedes usar cualquier dirección de correo electrónico y tu contraseña favorita :)",
    appName: "Bianca",
    tagline: "Comunicación de Verificación de Bienestar",
  },
  logoutScreen: {
    logoutButton: "Cerrar sesión",
    logoutMessage: "¿Estás seguro?",
  },
  registerScreen: {
    title: "Registrarse",
    nameFieldLabel: "Nombre",
    emailFieldLabel: "Correo electrónico",
    phoneFieldLabel: "Teléfono",
    passwordFieldLabel: "Contraseña",
    goBack: "Volver",
    confirmPasswordFieldLabel: "Confirmar contraseña",
    organizationNameFieldLabel: "Nombre de la organización",
    nameFieldPlaceholder: "Ingresa tu nombre",
    emailFieldPlaceholder: "Ingresa tu dirección de correo electrónico",
    passwordFieldPlaceholder: "Ingresa tu contraseña",
    confirmPasswordFieldPlaceholder: "Confirma tu contraseña",
    phoneFieldPlaceholder: "(xxx)xxx-xxxx",
    organizationNameFieldPlaceholder: "Ingresa el nombre de tu organización",
    organizationButton: "Organización",
    individualButton: "Individual",
    individualExplanation: "Regístrate como individuo para uso personal.",
    organizationExplanation: "Regístrate como organización para uso empresarial o grupal.",
    consentText: "Al registrarte, aceptas nuestros",
    consentAnd: "y",
    termsOfService: "Términos de Servicio",
    privacyPolicy: "Política de Privacidad",
  },
  requestResetScreen: {
    title: "Solicitar restablecimiento de contraseña",
    emailFieldLabel: "Correo electrónico",
    emailFieldPlaceholder: "Ingresa tu dirección de correo electrónico",
    requestReset: "Solicitar restablecimiento",
    successMessage: "¡Código de restablecimiento enviado a tu correo!",
    requestFailed: "Solicitud fallida. Por favor verifica tu correo y vuelve a intentar.",
  },
  ssoLinkingScreen: {
    title: "Vincular su cuenta",
    message: "Esta cuenta fue creada con {{provider}}. Para usar el inicio de sesión con correo electrónico/contraseña, configure una contraseña a continuación, o continúe con {{provider}}.",
    passwordLabel: "Contraseña",
    passwordPlaceholder: "Ingrese su contraseña",
    confirmPasswordLabel: "Confirmar contraseña",
    confirmPasswordPlaceholder: "Confirme su contraseña",
    setPasswordButton: "Establecer contraseña",
    backToLoginButton: "Volver al inicio de sesión",
    orDivider: "O",
    successMessage: "✓ ¡Contraseña establecida con éxito! Ahora puede iniciar sesión con su correo electrónico y contraseña.",
    errorNoPassword: "Por favor ingrese una contraseña",
    errorNoConfirmPassword: "Por favor confirme su contraseña",
    errorPasswordMismatch: "Las contraseñas no coinciden",
    errorPasswordTooShort: "La contraseña debe tener al menos 8 caracteres",
    errorSetPasswordFailed: "Error al establecer la contraseña",
    errorSSOFailed: "Error en el inicio de sesión SSO. Por favor, inténtelo de nuevo.",
    providerGoogle: "Google",
    providerMicrosoft: "Microsoft",
    providerSSO: "SSO",
  },
  ssoButtons: {
    orContinueWith: "O continuar con",
    google: "Google",
    microsoft: "Microsoft",
    continueWithGoogle: "Continuar con Google",
    continueWithMicrosoft: "Continuar con Microsoft",
    companySSO: "SSO de empresa",
    ssoNotAvailable: "SSO no disponible",
    signInFailed: "Error en el inicio de sesión",
    companySSOTitle: "SSO de empresa",
    companySSOMessage: "Esto redirigiría al proveedor SSO de su empresa. Por favor, contacte a su administrador para la configuración.",
  },
  emailVerificationScreen: {
    title: "Revisa tu correo electrónico",
    message: "Hemos enviado un enlace de verificación a tu dirección de correo electrónico. Por favor, haz clic en el enlace para verificar tu cuenta antes de iniciar sesión.",
    emailFieldLabel: "Dirección de correo electrónico",
    emailFieldPlaceholder: "Ingresa tu dirección de correo electrónico",
    resendButton: "Reenviar correo de verificación",
    backToLoginButton: "Volver al inicio de sesión",
    successMessage: "✓ ¡Correo de verificación enviado! Por favor, revisa tu bandeja de entrada.",
    errorNoEmail: "Por favor ingresa tu dirección de correo electrónico",
    errorSendFailed: "Error al enviar el correo de verificación",
  },
  emailVerifiedScreen: {
    title: "¡Correo verificado!",
    message: "Tu cuenta de My Phone Friend ha sido verificada exitosamente.",
    redirecting: "Redirigiendo a la aplicación...",
  },
  phoneVerificationBanner: {
    title: "Verifica tu número de teléfono",
    message: "Por favor verifica tu número de teléfono para recibir alertas de emergencia y notificaciones importantes.",
    verifyButton: "Verificar ahora",
  },
  conversationsScreen: {
    title: "Conversaciones",
    yesterday: "Ayer",
    noMessages: "Sin mensajes",
    noPatientSelected: "Ningún paciente seleccionado",
    firstConversation: "No se encontraron conversaciones previas. Esta será la primera conversación con este paciente.",
    noConversationsToDisplay: "No hay conversaciones para mostrar",
    noPreviousConversations: "No se encontraron conversaciones previas para este paciente",
    errorFetchingConversations: "Error al obtener conversaciones",
    loadingMoreConversations: "Cargando más conversaciones...",
  },
  patientScreen: {
    nameLabel: "Nombre *",
    namePlaceholder: "Ingresa el nombre del paciente",
    emailLabel: "Correo electrónico *",
    emailPlaceholder: "Ingresa la dirección de correo electrónico",
    phoneLabel: "Teléfono *",
    phonePlaceholder: "Ingresa el número de teléfono",
    preferredLanguageLabel: "Idioma preferido",
    updatePatient: "ACTUALIZAR PACIENTE",
    createPatient: "CREAR PACIENTE",
    manageSchedules: "GESTIONAR HORARIOS",
    manageConversations: "GESTIONAR CONVERSACIONES",
    viewSentimentAnalysis: "VER ANÁLISIS DE SENTIMIENTOS",
    manageCaregivers: "GESTIONAR CUIDADORES",
    confirmDelete: "CONFIRMAR ELIMINACIÓN",
    deletePatient: "ELIMINAR PACIENTE",
  },
  paymentScreen: {
    paid: "Pagado",
    pending: "Pendiente",
    overdue: "Vencido",
    processing: "Procesando",
    unknown: "Desconocido",
    latestInvoice: "Última factura",
    paymentMethod: "Método de pago",
    currentChargesSummary: "Resumen de cargos actuales",
    basicPlan: "Plan básico",
    contactSupport: "Contactar soporte",
    currentCharges: "Cargos actuales",
    paymentMethods: "Métodos de pago",
    billingInfo: "Información de facturación",
    amount: "Cantidad:",
    invoiceNumber: "Número de factura:",
    issueDate: "Fecha de emisión:",
    dueDate: "Fecha de vencimiento:",
    notes: "Notas:",
    noOrganizationData: "No hay datos de organización disponibles.",
    authorizationTokenNotAvailable: "Token de autorización no disponible.",
    errorLoadingCurrentCharges: "Error al cargar los cargos actuales.",
    noPendingCharges: "Sin cargos pendientes",
    allConversationsBilled: "Todas las conversaciones han sido facturadas. Los nuevos cargos aparecerán aquí a medida que se acumulen.",
    totalUnbilledAmount: "Cantidad total sin facturar:",
    period: "Período:",
    lastDays: "Últimos {days} días",
    day: "día",
    days: "días",
    patientsWithCharges: "Pacientes con cargos:",
    patient: "paciente",
    patients: "pacientes",
    chargesByPatient: "Cargos por paciente",
    conversation: "conversación",
    conversations: "conversaciones",
    average: "Promedio:",
    noUserData: "No hay datos de usuario disponibles.",
    currentPlan: "Plan actual:",
    nextBillingDate: "Próxima fecha de facturación:",
    totalBilledAmount: "Cantidad total facturada",
    acrossInvoices: "En {count} factura{s}",
    invoiceHistory: "Historial de facturas ({count})",
    hide: "Ocultar",
    show: "Mostrar",
    history: "Historial",
    noInvoicesYet: "Aún no hay facturas",
    invoicesWillAppear: "Tus facturas aparecerán aquí una vez que comience la facturación.",
    accessRestricted: "Acceso restringido",
    accessRestrictedMessage: "No tienes los permisos necesarios para ver o gestionar información de pagos.",
    contactAdministrator: "Por favor contacta al administrador de tu organización para obtener ayuda.",
    loadingUserInformation: "Cargando información del usuario...",
    // Payment methods / Stripe
    addPaymentMethod: "Agregar método de pago",
    loadingPaymentSystem: "Cargando sistema de pago...",
    loadingPaymentMethods: "Cargando métodos de pago...",
    stripeConfigurationError: "Error de configuración de Stripe. Por favor contacta al soporte.",
    unsupportedPlatform: "Plataforma no compatible. Por favor usa un navegador web o aplicación móvil.",
    errorLoadingPaymentMethods: "Error al cargar métodos de pago:",
    existingPaymentMethods: "Métodos de pago existentes",
    default: "Predeterminado",
    setDefault: "Establecer como predeterminado",
    remove: "Eliminar",
    addNewCard: "Agregar nueva tarjeta",
    deletePaymentMethod: "Eliminar método de pago",
    deletePaymentMethodConfirm: "¿Estás seguro de que deseas eliminar este método de pago? Esta acción no se puede deshacer.",
    paymentMethodAddedSuccess: "¡Método de pago agregado exitosamente!",
    paymentMethodSetDefaultSuccess: "¡Método de pago establecido como predeterminado exitosamente!",
    paymentMethodDeletedSuccess: "¡Método de pago eliminado exitosamente!",
    failedToSetDefault: "Error al establecer método de pago predeterminado",
    failedToDelete: "Error al eliminar método de pago",
    expires: "Vence",
    mobilePaymentUnavailable: "Sistema de pago móvil no disponible. Por favor usa la versión web.",
    loadingMobilePayment: "Cargando sistema de pago móvil...",
    anErrorOccurred: "Ocurrió un error",
  },
  orgScreen: {
    namePlaceholder: "Nombre",
    emailPlaceholder: "Correo electrónico",
    phonePlaceholder: "Teléfono",
    save: "GUARDAR",
    viewCaregivers: "Ver cuidadores",
    inviteCaregiver: "Invitar cuidador",
    payments: "Pagos",
    organizationActions: "Acciones de la organización",
    organizationLogo: "Logo de la organización",
    noLogoSet: "No hay logo establecido",
  },
  caregiverScreen: {
    namePlaceholder: "Nombre",
    emailPlaceholder: "Correo electrónico",
    phonePlaceholder: "Teléfono",
    loadingUnassignedPatients: "Cargando pacientes sin asignar...",
    assigningPatients: "Asignando pacientes...",
    patientsAssignedSuccess: "¡Pacientes asignados exitosamente!",
    loadingCaregivers: "Cargando cuidadores...",
  },
  caregiversScreen: {
    invited: "Invitado",
    edit: "Editar",
    resendInvite: "Reenviar Invitación",
    noCaregiversFound: "No se encontraron cuidadores",
    notAuthorized: "No autorizado",
    noPermissionToView: "No tienes permiso para ver cuidadores",
    addCaregiver: "Agregar cuidador",
  },
  signupScreen: {
    title: "Completa tu invitación",
    fullNameLabel: "Nombre completo",
    fullNamePlaceholder: "Tu nombre completo",
    emailLabel: "Dirección de correo electrónico",
    emailPlaceholder: "tu.correo@ejemplo.com",
    phoneLabel: "Número de teléfono",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "Contraseña",
    passwordPlaceholder: "Ingresa tu contraseña",
    confirmPasswordLabel: "Confirmar contraseña",
    confirmPasswordPlaceholder: "Confirma tu contraseña",
    completeRegistration: "Completar registro",
    preconfiguredMessage: "Tu nombre, correo electrónico y detalles de la organización han sido preconfigurados por tu administrador.",
  },
  confirmResetScreen: {
    title: "Restablece tu contraseña",
    subtitle: "Ingresa tu nueva contraseña a continuación. Asegúrate de que sea segura y fácil de recordar.",
    newPasswordLabel: "Nueva contraseña",
    newPasswordPlaceholder: "Ingresa tu nueva contraseña",
    confirmPasswordLabel: "Confirmar nueva contraseña",
    confirmPasswordPlaceholder: "Confirma tu nueva contraseña",
  },
  homeScreen: {
    welcome: "Bienvenido, {{name}}",
    guest: "Invitado",
    addPatient: "Agregar paciente",
    adminOnlyMessage: "Solo los administradores de organización y super administradores pueden agregar pacientes",
    noPatientsFound: "No se encontraron pacientes",
    viewSchedules: "Ver horarios",
    noScheduleWarning: "⚠ No hay horario configurado",
  },
  tabs: {
    home: "Inicio",
    org: "Org",
    reports: "Reportes",
    alerts: "Alertas",
  },
  common: {
    cancel: "Cancelar",
    close: "Cerrar",
    back: "Atrás",
    error: "Error",
    anErrorOccurred: "Ocurrió un error",
    selectImage: "Seleccionar imagen",
    calling: "Llamando...",
    callNow: "Llamar ahora",
    ending: "Finalizando...",
    endCall: "Finalizar llamada",
    loading: "Cargando...",
  },
  legalLinks: {
    privacyPolicy: "Política de privacidad",
    termsOfService: "Términos de servicio",
    privacyPractices: "Prácticas de Privacidad HIPAA",
  },
  headers: {
    home: "Inicio",
    patient: "Paciente",
    schedule: "Horario",
    conversations: "Conversaciones",
    call: "Llamada",
    profile: "Perfil",
    logout: "Cerrar sesión",
    alerts: "Alertas",
    organization: "Organización",
    caregivers: "Cuidadores",
    caregiver: "Cuidador",
    caregiverInvited: "Cuidador invitado",
    payments: "Pagos",
    reports: "Reportes",
    sentimentAnalysis: "Análisis de sentimientos",
    medicalAnalysis: "Análisis médico",
    fraudAbuseAnalysis: "Análisis de Fraude y Abuso",
    privacyPolicy: "Política de privacidad",
    privacyPractices: "Prácticas de privacidad HIPAA",
    termsOfService: "Términos de servicio",
    mentalHealthReport: "Reporte de salud mental",
    login: "Iniciar sesión",
    register: "Registrarse",
  },
  scheduleScreen: {
    heading: "Configuración de horarios",
    saveSchedule: "Guardar horario",
    deleteSchedule: "Eliminar horario",
  },
  scheduleComponent: {
    schedule: "Horario",
    startTime: "Hora de inicio",
    frequency: "Frecuencia",
    daily: "Diario",
    weekly: "Semanal",
    monthly: "Mensual",
    sunday: "Domingo",
    monday: "Lunes",
    tuesday: "Martes",
    wednesday: "Miércoles",
    thursday: "Jueves",
    friday: "Viernes",
    saturday: "Sábado",
    scheduleDetails: "Detalles del horario",
    active: "Activo",
    everyDayAt: "Todos los días a las {{time}}",
    everyDaysAt: "Cada {{days}} a las {{time}}",
    everyWeekAt: "Cada semana a las {{time}}",
    everyMonthOn: "Cada mes el día {{day}} a las {{time}}",
  },
  sentimentAnalysis: {
    lastCall: "Última llamada",
    last30Days: "Últimos 30 días",
    allTime: "Todo el tiempo",
    noPatientSelected: "Ningún paciente seleccionado",
    selectPatientToView: "Por favor selecciona un paciente desde la pantalla de inicio para ver su análisis de sentimientos.",
    patientSentimentAnalysis: "Análisis de sentimientos del paciente",
    emotionalWellnessInsights: "Perspectivas y tendencias de bienestar emocional",
    timeRange: "Rango de tiempo:",
    noSentimentDataAvailable: "No hay datos de sentimientos disponibles",
    noSentimentDataMessage: "El análisis de sentimientos aparecerá aquí una vez que el paciente haya completado conversaciones.",
    loadingSentimentAnalysis: "Cargando análisis de sentimientos...",
    sentimentAnalysisFooter: "El análisis de sentimientos se genera automáticamente después de cada conversación usando tecnología de IA.",
    sentimentOverview: "Resumen de sentimientos",
    averageSentiment: "Sentimiento promedio",
    trend: "tendencia",
    recentDistribution: "Distribución reciente",
    keyInsights: "Perspectivas clave",
    totalConversations: "Conversaciones totales",
    analysisCoverage: "Cobertura del análisis",
    recentConversations: "Conversaciones recientes",
    analyzed: "analizado",
    latestAnalysis: "Último análisis",
    conversationsAnalyzed: "conversaciones analizadas",
    recentConversationsTitle: "Conversaciones recientes",
    conversationsWithSentiment: "conversación{s} con análisis de sentimientos",
    noRecentConversations: "No hay conversaciones recientes con análisis de sentimientos",
    keyEmotions: "Emociones clave:",
    moreEmotions: "más",
    patientMood: "Estado de ánimo del paciente:",
    concern: "preocupación",
    confidence: "confianza",
    noSentimentAnalysisAvailable: "No hay análisis de sentimientos disponible",
    sentimentTrend: "Tendencia de sentimientos",
    conversationsAnalyzedNoTrend: "conversación{s} analizada{s}, pero aún no hay datos de tendencia disponibles",
    noSentimentData: "No hay datos de sentimientos disponibles",
    avg: "Prom:",
    negative: "Negativo",
    positive: "Positivo",
    lastCallAnalysis: "Análisis de la última llamada",
    noRecentCall: "Sin llamada reciente",
    noRecentCallMessage: "La conversación más reciente aún no tiene análisis de sentimientos disponible.",
    duration: "Duración",
    analysisDate: "Fecha del análisis",
    conversationId: "ID de conversación",
    overallSentiment: "Sentimiento general",
    scoreRange: "Rango de puntuación: -1.0 (Muy negativo) a +1.0 (Muy positivo)",
    analysisConfidence: "Confianza del análisis:",
    keyEmotionsDetected: "Emociones clave detectadas",
    patientMoodAssessment: "Evaluación del estado de ánimo del paciente",
    concernLevel: "Nivel de preocupación",
    concern: "PREOCUPACIÓN",
    lowConcernDescription: "El paciente parece estar de buen ánimo con preocupaciones mínimas.",
    mediumConcernDescription: "Se notaron algunas áreas de preocupación durante la conversación.",
    highConcernDescription: "Se identificaron preocupaciones significativas que pueden requerir atención.",
    satisfactionIndicators: "Indicadores de satisfacción",
    positiveIndicators: "Indicadores positivos",
    areasOfConcern: "Áreas de preocupación",
    aiSummary: "Resumen de IA",
    recommendations: "Recomendaciones",
    sentimentAnalysisDebug: "Depuración de análisis de sentimientos",
    debugSubtitle: "Depurar y corregir análisis de sentimientos faltantes para conversaciones recientes",
    debugging: "Depurando...",
    debugSentimentAnalysis: "Depurar análisis de sentimientos",
    loading: "Cargando...",
    debugConversationData: "Depurar datos de conversación",
    testing: "Probando...",
    testDirectApiCall: "Probar llamada directa a la API",
    forceRefreshCache: "Forzar actualización de caché",
    currentPatient: "Paciente actual:",
    noPatientSelected: "Ningún paciente seleccionado",
    debugResults: "Resultados de depuración",
    totalConversations: "Conversaciones totales",
    withoutSentiment: "Sin sentimientos",
    successfullyAnalyzed: "Analizado exitosamente",
    failedAnalyses: "Análisis fallidos",
    conversationDetails: "Detalles de conversación",
    messages: "mensajes",
    sentiment: "Sentimiento",
    score: "Puntuación",
    mood: "Estado de ánimo",
    emotions: "Emociones",
    concernLevel: "Nivel de preocupación",
    failed: "Fallido",
    noAnalysisPerformed: "No se realizó análisis",
    cacheRefreshed: "Caché actualizado",
    cacheRefreshedMessage: "El caché del análisis de sentimientos ha sido invalidado. La interfaz debería actualizarse automáticamente.",
    debugComplete: "Depuración completa",
    debugFailed: "Depuración fallida",
    noPatient: "Sin paciente",
    pleaseSelectPatient: "Por favor selecciona un paciente primero",
    conversationDebugComplete: "Depuración de conversación completa",
    directApiTest: "Prueba directa de API",
  },
  medicalAnalysis: {
    title: "Análisis médico",
    error: "Error",
    success: "Éxito",
    noPatientSelected: "Ningún paciente seleccionado",
    selectPatientToView: "Por favor selecciona un paciente para ver el análisis médico",
    triggering: "Activando...",
    triggerAnalysis: "Activar análisis",
    loadingResults: "Cargando resultados del análisis...",
    noResultsAvailable: "No hay resultados de análisis disponibles",
    triggerToGetStarted: "Activa un análisis para comenzar",
    cognitiveHealth: "Salud cognitiva",
    mentalHealth: "Salud mental",
    language: "Idioma",
    risk: "Riesgo",
    high: "Alto",
    medium: "Medio",
    low: "Bajo",
    good: "Bueno",
    fair: "Regular",
    poor: "Pobre",
    warningsInsights: "Advertencias y perspectivas",
    analysisDetails: "Detalles del análisis",
    conversations: "Conversaciones",
    messages: "Mensajes",
    totalWords: "Palabras totales",
    trigger: "Activar",
    trendsOverTime: "Tendencias a lo largo del tiempo",
    overallHealth: "Salud general",
    analyses: "análisis",
    trendAnalysisComingSoon: "Análisis de tendencias próximamente",
    analysisResultsAvailable: "resultados de análisis disponibles",
    basedOn: "Basado en",
    analysisResultsOver: "resultados de análisis durante",
    loadFailed: "Error al cargar los resultados del análisis médico",
    triggerFailed: "Error al activar el análisis médico",
    triggerSuccess: "Análisis médico activado exitosamente. Los resultados aparecerán en aproximadamente 10 segundos.",
    disclaimer: "Este análisis es solo para fines informativos y no sustituye el consejo, diagnóstico o tratamiento médico profesional. Siempre consulte con proveedores de atención médica calificados para inquietudes médicas.",
    overview: "Resumen",
    confidence: "Confianza",
    noDataAvailable: "No hay datos disponibles para el análisis",
    insufficientDataWarning: "Datos limitados disponibles: {{current}} llamada(s) analizada(s). Para un análisis más confiable, se recomiendan {{minimum}} o más llamadas durante un período más largo para comprender mejor los patrones del paciente.",
    analysisWillAppearAfterCalls: "Los resultados del análisis aparecerán aquí después de que se completen las llamadas.",
    keyIndicators: "Indicadores Clave",
    fillerWords: "Palabras de Relleno",
    vagueReferences: "Referencias Vagas",
    temporalConfusion: "Confusión Temporal",
    wordFinding: "Dificultades para Encontrar Palabras",
    repetition: "Puntuación de Repetición",
    informationDensity: "Densidad de Información",
    depressionScore: "Puntuación de Depresión",
    anxietyScore: "Puntuación de Ansiedad",
    emotionalTone: "Tono Emocional",
    negativeRatio: "Proporción Negativa",
    protectiveFactors: "Factores Protectores",
    typeTokenRatio: "Diversidad de Vocabulario",
    avgWordLength: "Longitud Promedio de Palabra",
    avgSentenceLength: "Longitud Promedio de Oración",
    uniqueWords: "Palabras Únicas",
    crisisIndicators: "Indicadores de crisis detectados - se recomienda evaluación profesional inmediata",
    cognitiveInterpretation: {
      normal: "Los patrones de comunicación parecen normales sin preocupaciones cognitivas significativas detectadas.",
      mildConcern: "Se detectaron algunos cambios leves en los patrones de comunicación. Monitorear la progresión.",
      moderateConcern: "Se observaron cambios moderados en los patrones de comunicación. Considere una evaluación profesional.",
      significantConcern: "Se detectaron cambios significativos en los patrones de comunicación. Se recomienda encarecidamente una evaluación profesional.",
    },
    psychiatricInterpretation: {
      stable: "Los indicadores de salud mental parecen estables sin preocupaciones significativas.",
      mildConcern: "Se detectaron algunos indicadores leves de salud mental. Continuar monitoreando.",
      moderateConcern: "Se observaron indicadores moderados de salud mental. Considere una consulta profesional.",
      significantConcern: "Se detectaron indicadores significativos de salud mental. Se recomienda consulta profesional.",
      crisis: "Se detectaron indicadores de crisis. Se recomienda encarecidamente una intervención profesional inmediata.",
    },
    vocabularyInterpretation: {
      strong: "La complejidad del lenguaje y el uso del vocabulario parecen fuertes y bien mantenidos.",
      average: "La complejidad del lenguaje y el uso del vocabulario están dentro de rangos normales.",
      limited: "La complejidad del lenguaje y el uso del vocabulario parecen limitados. Monitorear cambios.",
    },
  },
  profileScreen: {
    languageSelector: "Idioma / Language",
    selectLanguage: "Seleccionar idioma",
    theme: "Tema",
    selectTheme: "Seleccionar Tema",
    namePlaceholder: "Nombre",
    emailPlaceholder: "Correo electrónico",
    phonePlaceholder: "Teléfono",
    yourProfile: "Tu perfil",
    updateProfile: "ACTUALIZAR PERFIL",
    logout: "CERRAR SESIÓN",
    profileUpdatedSuccess: "¡Tu perfil fue actualizado exitosamente!",
    profileUpdateFailed: "Error al actualizar el perfil. Por favor vuelve a intentar.",
    invalidPhoneFormat: "Formato de teléfono inválido (10 dígitos o +1XXXXXXXXXX)",
    completeProfileTitle: "Complete su perfil",
    completeProfileMessage: "Complete su perfil agregando un número de teléfono antes de continuar.",
    completeProfileMessageUnverified: "Agregue su número de teléfono para completar su perfil y acceder a todas las funciones.",
    errorUploadingAvatar: "Error al cargar el avatar",
    emailVerified: "Correo electrónico verificado",
    emailNotVerified: "Correo electrónico no verificado",
    phoneVerified: "Teléfono verificado",
    phoneNotVerified: "Teléfono no verificado",
    verifyPhone: "Verificar teléfono",
    fontSize: "Tamaño de fuente",
    fontSizeDescription: "Ajusta el tamaño del texto para una mejor legibilidad. Los cambios se aplican inmediatamente.",
    decreaseFontSize: "Disminuir tamaño de fuente",
    increaseFontSize: "Aumentar tamaño de fuente",
    fontSizeHint: "Ajustar el tamaño de fuente del 80% al 200%",
    telemetryOptIn: "Compartir datos de uso anónimos",
    telemetryDescription: "Ayúdanos a mejorar la aplicación compartiendo datos de uso anónimos. No se recopila información personal.",
    telemetryEnabled: "Telemetría habilitada",
    telemetryDisabled: "Telemetría deshabilitada",
  },
  fraudAbuseAnalysis: {
    title: "Análisis de Fraude y Abuso",
    error: "Error",
    success: "Éxito",
    noPatientSelected: "No se ha seleccionado ningún paciente",
    selectPatientToView: "Por favor seleccione un paciente para ver el análisis de fraude y abuso",
    triggering: "Activando...",
    triggerAnalysis: "Activar Análisis",
    loadingResults: "Cargando resultados del análisis...",
    noResultsAvailable: "No hay resultados de análisis disponibles",
    triggerToGetStarted: "Active un análisis para comenzar",
    analysisWillAppearAfterCalls: "Los resultados del análisis aparecerán aquí después de que se completen las llamadas.",
    insufficientDataWarning: "Datos limitados disponibles: {{current}} llamada(s) analizada(s). Para un análisis más confiable, se recomiendan {{minimum}} o más llamadas durante un período más largo para comprender mejor los patrones del paciente.",
    loadFailed: "Error al cargar los resultados del análisis de fraude/abuso",
    triggerFailed: "Error al activar el análisis de fraude/abuso",
    triggerSuccess: "Análisis de fraude/abuso completado exitosamente.",
    disclaimer: "Este análisis es solo para fines informativos y no sustituye una evaluación profesional. Si sospecha fraude, abuso o negligencia, contacte a las autoridades apropiadas inmediatamente.",
    overview: "Resumen",
    conversations: "Conversaciones",
    messages: "Mensajes",
    riskScore: "Puntuación de Riesgo",
    financialRisk: "Riesgo Financiero",
    abuseRisk: "Riesgo de Abuso",
    relationshipRisk: "Riesgo de Relación",
    warnings: "Advertencias",
    recommendations: "Recomendaciones",
    critical: "Crítico",
    high: "Alto",
    medium: "Medio",
    low: "Bajo",
    largeAmountMentions: "Menciones de Grandes Cantidades",
    transferMethodMentions: "Menciones de Métodos de Transferencia",
    scamIndicators: "Indicadores de Estafa",
    physicalAbuseScore: "Puntuación de Abuso Físico",
    emotionalAbuseScore: "Puntuación de Abuso Emocional",
    neglectScore: "Puntuación de Negligencia",
    newPeopleCount: "Recuento de Nuevas Personas",
    isolationCount: "Recuento de Aislamiento",
    suspiciousBehaviorCount: "Recuento de Comportamiento Sospechoso",
  },
  reportsScreen: {
    selectPatient: "Seleccionar paciente:",
    choosePatient: "Elige un paciente...",
    sentiment: "Sentimientos",
    medicalAnalysis: "Análisis médico",
    fraudAbuseAnalysis: "Fraude y Abuso",
    comingSoon: "Próximamente",
    modalTitle: "Seleccionar paciente",
    modalCancel: "Cancelar",
  },
  schedulesScreen: {
    scheduleDetails: "Detalles del horario",
    selectSchedule: "Selecciona un horario:",
    scheduleNumber: "Horario",
    noSchedulesAvailable: "No hay horarios disponibles. Por favor crea uno nuevo.",
    errorLoadingSchedules: "Error al cargar horarios.",
  },
  themes: {
    healthcare: {
      name: "Atención Médica",
      description: "Tema médico profesional con colores azul y verde",
    },
    colorblind: {
      name: "Amigable para Daltónicos",
      description: "Tema de alto contraste optimizado para deficiencia de visión de color",
    },
    dark: {
      name: "Modo Oscuro",
      description: "Tema oscuro optimizado para entornos con poca luz",
    },
    accessibility: {
      wcagLevel: "Nivel WCAG",
      colorblindFriendly: "Amigable para daltónicos",
      highContrast: "Alto contraste",
      darkMode: "Modo oscuro",
    },
  },
  privacyPracticesScreen: {
    content: `# Aviso de Prácticas de Privacidad
## Servicios de Comunicación de Salud MyPhoneFriend

**Fecha de vigencia**: 15 de octubre de 2025

---

## SU INFORMACIÓN. SUS DERECHOS. NUESTRAS RESPONSABILIDADES.

**ESTE AVISO DESCRIBE CÓMO SE PUEDEN USAR Y DIVULGAR LA INFORMACIÓN MÉDICA SOBRE USTED Y CÓMO PUEDE ACCEDER A ESTA INFORMACIÓN. POR FAVOR, REVÍSELO CUIDADOSAMENTE.**

---

## SUS DERECHOS

Usted tiene derecho a:
- Obtener una copia de su información de salud
- Corregir su información de salud
- Solicitar comunicación confidencial
- Pedirnos que limitemos la información que compartimos
- Obtener una lista de aquellos con quienes hemos compartido su información
- Obtener una copia de este aviso de privacidad
- Elegir a alguien para que actúe en su nombre
- Presentar una queja si cree que se han violado sus derechos de privacidad

---

## SUS OPCIONES

Usted tiene algunas opciones sobre cómo usamos y compartimos información cuando:
- Respondemos preguntas de su familia y amigos sobre su cuidado
- Proporcionamos información sobre usted en situaciones de ayuda en caso de desastre

**Nunca compartimos su información para marketing o venta de sus datos.**

---

# SUS DERECHOS DETALLADOS

## Obtener una copia de su información de salud

**Puede solicitar ver u obtener una copia de su información de salud.**

Lo que puede solicitar:
- Grabaciones de llamadas y transcripciones
- Resúmenes de bienestar y resultados de análisis de IA
- Alertas médicas generadas por nuestro sistema
- Notificaciones de emergencia
- Información de cuenta y preferencias

**Cómo solicitar**:
- Email: privacy@biancawellness.com
- Teléfono: +1-604-562-4263

**Nuestra respuesta**: Dentro de 30 días

---

## Pídanos que corrijamos su información de salud

**Puede pedirnos que corrijamos la información de salud que cree que es incorrecta o incompleta.**

**Nuestra respuesta**: Dentro de 60 días

---

## Solicitar comunicaciones confidenciales

**Puede pedirnos que lo contactemos de una manera específica o en un lugar específico.**

Ejemplos:
- "Por favor, envíeme un correo electrónico en lugar de llamar"
- "Por favor, contácteme solo en mi teléfono celular"

Acomodaremos todas las solicitudes razonables.

---

## Pídanos que limitemos lo que usamos o compartimos

**Puede pedirnos que no usemos o compartamos cierta información de salud.**

Debemos estar de acuerdo si pagó de su bolsillo en su totalidad y nos pide que no compartamos con su plan de salud.

---

## Obtener una lista de divulgaciones

**Puede solicitar un "informe de divulgaciones"** - una lista de las veces que hemos compartido su información de salud.

Cubre: Últimos 6 años  
Excluye: Divulgaciones para tratamiento, pago y operaciones (a menos que lo solicite)

---

## Presentar una queja

**Presentar con nosotros**:
- Email: privacy@biancawellness.com
- Teléfono: +1-604-562-4263

**Presentar con HHS**:
- Sitio web: https://www.hhs.gov/hipaa/filing-a-complaint
- Teléfono: 1-800-368-1019

**No tomaremos represalias contra usted por presentar una queja.**

---

# NUESTROS USOS Y DIVULGACIONES

## Cómo usamos su información de salud

**Para tratamiento**:
- Proporcionar resúmenes de bienestar de IA a sus cuidadores
- Generar alertas de emergencia para situaciones urgentes
- Permitir que los cuidadores monitoreen su bienestar
- Facilitar la comunicación con su equipo de atención

**Para pago**:
- Facturar a su organización de salud por los servicios
- Procesar facturas por tiempo de llamada y análisis

**Para operaciones de salud**:
- Mejorar nuestros algoritmos de detección de IA
- Aseguramiento de calidad y mejora
- Capacitar a nuestros sistemas para servir mejor a los pacientes

---

## Con quién compartimos

**Su organización de salud**:
- Sus cuidadores y coordinadores de atención asignados
- Administradores de organización para facturación

**Asociados comerciales** (Proveedores de servicios):
- Servicios de IA (Azure OpenAI): Para transcripción y análisis
- Servicios de voz (Twilio): Para el manejo de llamadas telefónicas
- Alojamiento en la nube (AWS): Para almacenamiento seguro de datos
- Base de datos (MongoDB Atlas): Para gestión de datos

Todos los asociados comerciales firman acuerdos de asociado comercial y deben proteger su información.

**Según lo requerido por la ley**:
- Servicios de emergencia (911) si se detecta emergencia
- Autoridades de salud pública (informes de abuso, negligencia)
- Aplicación de la ley (con orden legal válida)

**NO hacemos**:
- ❌ Vender su información de salud
- ❌ Compartir con especialistas en marketing o anunciantes
- ❌ Usar para marketing sin su autorización
- ❌ Compartir en redes sociales

---

# INFORMACIÓN DE SALUD QUE RECOPILAMOS

**Durante el uso de nuestros servicios**:
- Nombre del paciente, número de teléfono, fecha de nacimiento
- Grabaciones de llamadas y transcripciones
- Información relacionada con la salud de las llamadas (síntomas, medicamentos, estado de ánimo)
- Alertas e incidentes de emergencia
- Tendencias y patrones de bienestar
- Notas y observaciones de los cuidadores
- Resultados de análisis médico de IA

---

# SUS RESPONSABILIDADES

**Si está usando nuestro servicio para llamar a otra persona**, usted es responsable de:
- Obtener los consentimientos necesarios para la grabación
- Asegurarse de que entiendan el servicio
- Seguir las leyes aplicables de consentimiento de grabación

---

# NOTIFICACIÓN DE VIOLACIÓN

**Si su información de salud se accede o divulga incorrectamente**, nosotros:
- Investigaremos el incidente
- Lo notificaremos dentro de 60 días si es una violación reportable
- Explicaremos qué pasó y qué estamos haciendo
- Proporcionaremos información sobre los pasos que puede tomar

---

# CAMBIOS A ESTE AVISO

- Podemos cambiar este aviso y los cambios se aplicarán a toda la información que tenemos
- El nuevo aviso estará disponible en la aplicación y en nuestro sitio web
- Siempre puede solicitar una copia actual

---

# INFORMACIÓN DE CONTACTO

**Oficial de privacidad**:
- Email: privacy@biancawellness.com
- Teléfono: +1-604-562-4263
- Correo: Oficina de Privacidad MyPhoneFriend, 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

**Horario**: Lunes-Viernes, 9 AM - 5 PM PST

---

# PRESENTAR UNA QUEJA

**Con nosotros**:
- Email: privacy@biancawellness.com
- Teléfono: +1-604-562-4263

**Con el gobierno federal (HHS)**:
- Sitio web: https://www.hhs.gov/hipaa/filing-a-complaint
- Teléfono: 1-800-368-1019
- Correo: Oficina de Derechos Civiles, Departamento de Salud y Servicios Humanos de EE. UU., 200 Independence Avenue S.W., Washington, D.C. 20201

---

**Fecha de vigencia**: 15 de octubre de 2025  
**Versión**: 1.0

Este Aviso de Prácticas de Privacidad cumple con la Regla de Privacidad HIPAA (45 CFR §164.520)

---

## Asistencia de idiomas

**Inglés**: Si necesita ayuda para entender este aviso, contacte privacy@biancawellness.com

**Español**: Si necesita ayuda, comuníquese con privacy@biancawellness.com`,
  },
  mfa: {
    setupTitle: "Autenticación de múltiples factores",
    setupSubtitle: "Agregue una capa adicional de seguridad a su cuenta",
    setupInstructions: "Escanee el código QR con su aplicación de autenticación, luego ingrese el código para verificar.",
    verificationTitle: "Autenticación de dos factores",
    verificationSubtitle: "Ingrese el código de 6 dígitos de su aplicación de autenticación",
    tokenLabel: "Código de verificación",
    tokenPlaceholder: "000000",
    pleaseEnterVerificationCode: "Por favor ingrese el código de verificación de su aplicación de autenticación",
    verifyButton: "Verificar",
    useBackupCode: "Usar código de respaldo",
    verifyAndEnable: "Verificar y habilitar",
    enable: "Habilitar MFA",
    enableMFA: "Habilitar autenticación de múltiples factores",
    manageMFA: "Gestionar autenticación de múltiples factores",
    disable: "Deshabilitar MFA",
    disableTitle: "Deshabilitar MFA",
    disableSubtitle: "Ingrese su código MFA actual para deshabilitar la autenticación de múltiples factores",
    disableConfirmTitle: "¿Deshabilitar MFA?",
    disableConfirmMessage: "¿Está seguro de que desea deshabilitar la autenticación de múltiples factores? Esto reducirá la seguridad de su cuenta.",
    enabled: "Habilitado",
    disabled: "Deshabilitado",
    enabledSuccess: "La autenticación de múltiples factores se ha habilitado correctamente.",
    disabledSuccess: "La autenticación de múltiples factores se ha deshabilitado.",
    status: "Estado",
    enrolledOn: "Inscrito el",
    backupCodesRemaining: "Códigos de respaldo restantes",
    backupCodesTitle: "Códigos de respaldo",
    backupCodesWarning: "Guarde estos códigos en un lugar seguro. Puede usarlos para acceder a su cuenta si pierde su dispositivo de autenticación.",
    backupCodeLength: "Los códigos de respaldo tienen 8 caracteres",
    regenerateBackupCodes: "Regenerar códigos de respaldo",
    regenerateBackupCodesTitle: "¿Regenerar códigos de respaldo?",
    regenerateBackupCodesSubtitle: "Ingrese su código MFA actual para generar nuevos códigos de respaldo",
    regenerateBackupCodesMessage: "Sus códigos de respaldo antiguos ya no funcionarán. Asegúrese de guardar los nuevos códigos de forma segura.",
    regenerate: "Regenerar",
    backupCodesRegenerated: "Códigos de respaldo regenerados",
    backupCodesRegeneratedMessage: "Sus nuevos códigos de respaldo han sido generados. Por favor, guárdelos de forma segura.",
    secretLabel: "O ingrese este secreto manualmente:",
    invalidTokenLength: "Por favor ingrese un código de 6 dígitos",
    verificationFailed: "Código inválido. Por favor intente nuevamente.",
    enableFailed: "Error al habilitar MFA",
    disableFailed: "Error al deshabilitar MFA. Por favor verifique su código.",
    regenerateFailed: "Error al regenerar códigos de respaldo.",
  },
}

export default es