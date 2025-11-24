import { Translations } from "./en"

const pt: Translations = {
  common: {
    ok: "OK",
    cancel: "Cancelar",
    close: "Fechar",
    error: "Erro",
    anErrorOccurred: "Ocorreu um erro",
    back: "Voltar",
    logOut: "Sair",
    selectImage: "Selecionar imagem",
    calling: "Ligando...",
    callNow: "Ligar agora",
    ending: "Finalizando...",
    endCall: "Finalizar chamada",
    loading: "Carregando...",
  },
  alertScreen: {
    markAllAsRead: "Marcar tudo como lido",
    unreadAlerts: "Alertas não lidos",
    allAlerts: "Todos os alertas",
    noAlerts: "Nenhum alerta",
    noAlertsTitle: "Tudo em dia!",
    noAlertsSubtitle: "Você não tem alertas não lidos. Ótimo trabalho em se manter atualizado!",
    emptyHeading: "Tão vazio... tão triste",
    refreshing: "Atualizando...",
    refresh: "Atualizar",
    patient: "Paciente:",
    importance: "Importância:",
    expires: "Expira:",
  },
  legalLinks: {
    privacyPolicy: "Política de privacidade",
    privacyPractices: "Práticas de Privacidade HIPAA",
    termsOfService: "Termos de serviço",
  },
  welcomeScreen: {
    postscript: "psst — Provavelmente não é assim que seu aplicativo se parece. (A menos que seu designer tenha te dado essas telas, nesse caso, coloque em produção!)",
    readyForLaunch: "Seu aplicativo, quase pronto para o lançamento!",
    exciting: "(ohh, isso é emocionante!)",
    letsGo: "Vamos lá!",
  },
  errorScreen: {
    title: "Algo deu errado!",
    friendlySubtitle: "Ocorreu um erro. Você provavelmente vai querer personalizar o design também (`app/screens/ErrorScreen`). Se quiser remover isso completamente, verifique `app/app.tsx` para o componente <ErrorBoundary>.",
    reset: "REINICIAR APP",
    traceTitle: "Stack de erro %{name}",
  },
  emptyStateComponent: {
    generic: {
      heading: "Tão vazio... tão triste",
      content: "Nenhum dado encontrado ainda. Tente clicar no botão para atualizar ou recarregar o app.",
      button: "Vamos tentar isso novamente",
    },
  },
  errors: {
    invalidEmail: "Endereço de email inválido.",
  },
  loginScreen: {
    signIn: "Entrar",
    register: "Registrar",
    enterDetails: "Digite seus detalhes abaixo para desbloquear informações secretas. Você nunca vai adivinhar o que temos esperando por você. Ou talvez sim; não é ciência de foguetes aqui.",
    emailFieldLabel: "Email",
    passwordFieldLabel: "Senha",
    emailFieldPlaceholder: "Digite seu endereço de email",
    passwordFieldPlaceholder: "Senha super secreta aqui",
    forgotPassword: "Esqueceu sua senha?",
    hint: "Dica: você pode usar qualquer endereço de email e sua senha favorita :)",
  },
  logoutScreen: {
    logoutButton: "Sair",
    logoutMessage: "Tem certeza?",
  },
  registerScreen: {
    title: "Registrar",
    nameFieldLabel: "Nome",
    emailFieldLabel: "Email",
    phoneFieldLabel: "Telefone",
    passwordFieldLabel: "Senha",
    goBack: "Voltar",
    confirmPasswordFieldLabel: "Confirmar senha",
    organizationNameFieldLabel: "Nome da organização",
    nameFieldPlaceholder: "Digite seu nome",
    emailFieldPlaceholder: "Digite seu endereço de email",
    passwordFieldPlaceholder: "Digite sua senha",
    confirmPasswordFieldPlaceholder: "Confirme sua senha",
    organizationNameFieldPlaceholder: "Digite o nome da sua organização",
    organizationButton: "Organização",
    individualButton: "Individual",
    individualExplanation: "Registre-se como indivíduo para uso pessoal.",
    organizationExplanation: "Registre-se como organização para uso empresarial ou de grupo.",
    consentText: "Ao se registrar, você concorda com nossos",
    consentAnd: "e",
    termsOfService: "Termos de Serviço",
    privacyPolicy: "Política de Privacidade",
    signUp: "Registrar",
    signIn: "Entrar",
    alreadyHaveAccount: "Já tem uma conta?",
    dontHaveAccount: "Não tem uma conta?",
    termsAndConditions: "Termos e condições",
    agreeToTerms: "Ao se registrar, você concorda com nossos",
    and: "e",
  },
  requestResetScreen: {
    title: "Solicitar redefinição de senha",
    emailFieldLabel: "Email",
    emailFieldPlaceholder: "Digite seu endereço de email",
    requestReset: "Solicitar redefinição",
    successMessage: "Código de redefinição enviado para seu email!",
    requestFailed: "Solicitação falhou. Por favor, verifique seu email e tente novamente.",
  },
  ssoLinkingScreen: {
    title: "Vincular sua conta",
    message: "Esta conta foi criada com {{provider}}. Para usar o login com email/senha, defina uma senha abaixo ou continue com {{provider}}.",
    passwordLabel: "Senha",
    passwordPlaceholder: "Digite sua senha",
    confirmPasswordLabel: "Confirmar senha",
    confirmPasswordPlaceholder: "Confirme sua senha",
    setPasswordButton: "Definir senha",
    backToLoginButton: "Voltar ao login",
    orDivider: "Ou",
    successMessage: "✓ Senha definida com sucesso! Agora você pode fazer login com seu email e senha.",
    errorNoPassword: "Por favor, digite uma senha",
    errorNoConfirmPassword: "Por favor, confirme sua senha",
    errorPasswordMismatch: "As senhas não coincidem",
    errorPasswordTooShort: "A senha deve ter pelo menos 8 caracteres",
    errorSetPasswordFailed: "Falha ao definir senha",
    errorSSOFailed: "Login SSO falhou. Por favor, tente novamente.",
    providerGoogle: "Google",
    providerMicrosoft: "Microsoft",
    providerSSO: "SSO",
  },
  ssoButtons: {
    orContinueWith: "Ou continuar com",
    google: "Google",
    microsoft: "Microsoft",
    companySSO: "SSO da empresa",
    ssoNotAvailable: "SSO não disponível",
    signInFailed: "Falha no login",
    companySSOTitle: "SSO da empresa",
    companySSOMessage: "Isso redirecionaria para o provedor SSO da sua empresa. Entre em contato com seu administrador para configuração.",
  },
  emailVerificationScreen: {
    title: "Verifique seu email",
    message: "Enviamos um link de verificação para o seu endereço de email. Por favor, clique no link para verificar sua conta antes de fazer login.",
    emailFieldLabel: "Endereço de email",
    emailFieldPlaceholder: "Digite seu endereço de email",
    resendButton: "Reenviar email de verificação",
    backToLoginButton: "Voltar ao login",
    successMessage: "✓ Email de verificação enviado! Verifique sua caixa de entrada.",
    errorNoEmail: "Por favor, digite seu endereço de email",
    errorSendFailed: "Falha ao enviar email de verificação",
  },
  emailVerifiedScreen: {
    title: "E-mail verificado!",
    message: "Sua conta My Phone Friend foi verificada com sucesso.",
    redirecting: "Redirecionando para o aplicativo...",
  },
  phoneVerificationBanner: {
    title: "Verifique seu número de telefone",
    message: "Por favor, verifique seu número de telefone para receber alertas de emergência e notificações importantes.",
    verifyButton: "Verificar agora",
  },
  conversationsScreen: {
    title: "Conversas",
    yesterday: "Ontem",
    noMessages: "Nenhuma mensagem",
    noPatientSelected: "Nenhum paciente selecionado",
    firstConversation: "Nenhuma conversa anterior encontrada. Esta será a primeira conversa com este paciente.",
    noConversationsToDisplay: "Nenhuma conversa para exibir",
    noPreviousConversations: "Nenhuma conversa anterior encontrada para este paciente",
    errorFetchingConversations: "Erro ao buscar conversas",
    loadingMoreConversations: "Carregando mais conversas...",
  },
  patientScreen: {
    nameLabel: "Nome *",
    namePlaceholder: "Digite o nome do paciente",
    emailLabel: "Email *",
    emailPlaceholder: "Digite o endereço de email",
    phoneLabel: "Telefone *",
    phonePlaceholder: "Digite o número de telefone",
    preferredLanguageLabel: "Idioma preferido",
    updatePatient: "ATUALIZAR PACIENTE",
    createPatient: "CRIAR PACIENTE",
    manageSchedules: "GERENCIAR HORÁRIOS",
    manageConversations: "GERENCIAR CONVERSAS",
    viewSentimentAnalysis: "VER ANÁLISE DE SENTIMENTOS",
    manageCaregivers: "GERENCIAR CUIDADORES",
    confirmDelete: "CONFIRMAR EXCLUSÃO",
    deletePatient: "EXCLUIR PACIENTE",
  },
  paymentScreen: {
    paid: "Pago",
    pending: "Pendente",
    overdue: "Vencido",
    processing: "Processando",
    unknown: "Desconhecido",
    latestInvoice: "Fatura mais recente",
    paymentMethod: "Método de pagamento",
    currentChargesSummary: "Resumo de cobranças atuais",
    basicPlan: "Plano básico",
    contactSupport: "Contatar suporte",
    currentCharges: "Cobranças atuais",
    paymentMethods: "Métodos de pagamento",
    billingInfo: "Informações de cobrança",
    noOrganizationData: "Nenhum dado de organização disponível",
    authorizationTokenNotAvailable: "Token de autorização não disponível",
    errorLoadingCurrentCharges: "Erro ao carregar cobranças atuais",
    noPendingCharges: "Nenhuma cobrança pendente",
    allConversationsBilled: "Todas as conversas foram cobradas",
    totalUnbilledAmount: "Valor total não cobrado",
    period: "Período",
    lastDays: "Últimos {days} dias",
    patients: "pacientes",
    patient: "paciente",
    chargesByPatient: "Cobranças por paciente",
    average: "Média",
    noUserData: "Nenhum dado de usuário disponível",
    currentPlan: "Plano atual",
    nextBillingDate: "Próxima data de cobrança",
    totalBilledAmount: "Valor total cobrado",
    acrossInvoices: "em {count} fatura{s}",
    invoiceHistory: "Histórico de faturas ({count})",
    hide: "Ocultar",
    show: "Mostrar",
    history: "histórico",
    noInvoicesYet: "Nenhuma fatura ainda",
    invoicesWillAppear: "As faturas aparecerão aqui assim que forem geradas",
    loadingUserInformation: "Carregando informações do usuário...",
    accessRestricted: "Acesso restrito",
    accessRestrictedMessage: "Você não tem permissão para acessar informações de pagamento.",
    contactAdministrator: "Contate seu administrador para obter acesso.",
    amount: "Valor:",
    invoiceNumber: "Número da fatura:",
    issueDate: "Data de emissão:",
    dueDate: "Data de vencimento:",
    notes: "Notas:",
  },
  profileScreen: {
    languageSelector: "Idioma / Language",
    selectLanguage: "Selecionar idioma",
    theme: "Tema",
    selectTheme: "Selecionar tema",
    namePlaceholder: "Nome",
    emailPlaceholder: "Email",
    phonePlaceholder: "Telefone",
    yourProfile: "Seu perfil",
    updateProfile: "ATUALIZAR PERFIL",
    logout: "SAIR",
    profileUpdatedSuccess: "Seu perfil foi atualizado com sucesso!",
    profileUpdateFailed: "Falha ao atualizar perfil. Por favor, tente novamente.",
    invalidPhoneFormat: "Formato de telefone inválido (10 dígitos ou +1XXXXXXXXXX)",
    completeProfileTitle: "Complete seu perfil",
    completeProfileMessage: "Complete seu perfil adicionando um número de telefone antes de continuar.",
    completeProfileMessageUnverified: "Adicione seu número de telefone para completar seu perfil e acessar todos os recursos.",
    errorUploadingAvatar: "Erro ao carregar avatar",
  },
  reportsScreen: {
    selectPatient: "Selecionar paciente:",
    choosePatient: "Escolher um paciente...",
    sentiment: "Sentimentos",
    medicalAnalysis: "Análise médica",
    comingSoon: "Em breve",
    modalTitle: "Selecionar paciente",
    modalCancel: "Cancelar",
  },
  schedulesScreen: {
    scheduleDetails: "Detalhes do horário",
    selectSchedule: "Selecionar um horário:",
    scheduleNumber: "Horário",
    noSchedulesAvailable: "Nenhum horário disponível. Por favor, crie um novo.",
    errorLoadingSchedules: "Erro ao carregar horários.",
  },
  scheduleComponent: {
    schedule: "Horário",
    startTime: "Hora de início",
    frequency: "Frequência",
    daily: "Diário",
    weekly: "Semanal",
    monthly: "Mensal",
    sunday: "Domingo",
    monday: "Segunda-feira",
    tuesday: "Terça-feira",
    wednesday: "Quarta-feira",
    thursday: "Quinta-feira",
    friday: "Sexta-feira",
    saturday: "Sábado",
    scheduleDetails: "Detalhes do horário",
    active: "Ativo",
  },
  conversationsScreen: {
    title: "Conversas",
    yesterday: "Ontem",
    noMessages: "Nenhuma mensagem",
    noPatientSelected: "Nenhum paciente selecionado",
    firstConversation: "Nenhuma conversa anterior encontrada. Esta será a primeira conversa com este paciente.",
    noConversationsToDisplay: "Nenhuma conversa para exibir",
    noPreviousConversations: "Nenhuma conversa anterior encontrada para este paciente",
    errorFetchingConversations: "Erro ao buscar conversas",
    loadingMoreConversations: "Carregando mais conversas...",
  },
  caregiverScreen: {
    namePlaceholder: "Nome",
    emailPlaceholder: "E-mail",
    phonePlaceholder: "Telefone",
    loadingUnassignedPatients: "Carregando pacientes não atribuídos...",
    assigningPatients: "Atribuindo pacientes...",
    patientsAssignedSuccess: "Pacientes atribuídos com sucesso!",
    loadingCaregivers: "Carregando cuidadores...",
  },
  caregiversScreen: {
    invited: "Convidado",
    edit: "Editar",
    noCaregiversFound: "Nenhum cuidador encontrado",
    notAuthorized: "Não autorizado",
    noPermissionToView: "Você não tem permissão para visualizar cuidadores",
    addCaregiver: "Adicionar cuidador",
  },
  sentimentAnalysis: {
    lastCall: "Última chamada",
    last30Days: "Últimos 30 dias",
    allTime: "Todo o tempo",
    noPatientSelected: "Nenhum paciente selecionado",
    selectPatientToView: "Por favor, selecione um paciente da tela inicial para ver sua análise de sentimentos.",
    patientSentimentAnalysis: "Análise de sentimentos do paciente",
    emotionalWellnessInsights: "Insights de bem-estar emocional e tendências",
    timeRange: "Período:",
    noSentimentDataAvailable: "Nenhum dado de sentimento disponível",
    noSentimentDataMessage: "A análise de sentimentos aparecerá aqui assim que o paciente completar conversas.",
    loadingSentimentAnalysis: "Carregando análise de sentimentos...",
    sentimentAnalysisFooter: "A análise de sentimentos é gerada automaticamente após cada conversa usando tecnologia de IA.",
    sentimentOverview: "Visão geral dos sentimentos",
    averageSentiment: "Sentimento médio",
    trend: "tendência",
    recentDistribution: "Distribuição recente",
    keyInsights: "Insights principais",
    totalConversations: "Total de conversas",
    analysisCoverage: "Cobertura da análise",
    recentConversations: "Conversas recentes",
    analyzed: "analisadas",
    latestAnalysis: "Análise mais recente",
    conversationsAnalyzed: "conversas analisadas",
    recentConversationsTitle: "Conversas recentes",
    conversationsWithSentiment: "conversa{0} com sentimentos",
    keyEmotions: "Emoções principais",
    moreEmotions: "mais emoções",
    patientMood: "Humor do paciente",
    concern: "preocupação",
    confidence: "confiança",
    noSentimentAnalysisAvailable: "Nenhuma análise de sentimentos disponível",
    sentimentTrend: "Tendência de sentimentos",
    conversationsAnalyzedNoTrend: "conversa{0} analisada{0} sem tendência clara",
    noSentimentData: "Nenhum dado de sentimento",
    avg: "Média",
    negative: "Negativo",
    positive: "Positivo",
    lastCallAnalysis: "Análise da última chamada",
    noRecentCall: "Nenhuma chamada recente",
    noRecentCallMessage: "Nenhuma chamada recente para analisar. As chamadas aparecerão aqui assim que forem concluídas.",
    duration: "Duração",
    analysisDate: "Data da análise",
    overallSentiment: "Sentimento geral",
    scoreRange: "Faixa de pontuação",
    analysisConfidence: "Confiança da análise",
    keyEmotionsDetected: "Emoções principais detectadas",
    patientMoodAssessment: "Avaliação do humor do paciente",
    concernLevel: "Nível de preocupação",
    satisfactionIndicators: "Indicadores de satisfação",
    positiveIndicators: "Indicadores positivos",
    areasOfConcern: "Áreas de preocupação",
    aiSummary: "Resumo da IA",
    recommendations: "Recomendações",
    lowConcernDescription: "Nível baixo de preocupação - o paciente parece estar bem.",
    mediumConcernDescription: "Nível médio de preocupação - acompanhamento recomendado.",
    highConcernDescription: "Nível alto de preocupação - atenção imediata necessária.",
    debugComplete: "Debug concluído",
    debugFailed: "Debug falhou",
    noPatient: "Nenhum paciente",
    pleaseSelectPatient: "Por favor, selecione um paciente primeiro",
    conversationDebugComplete: "Debug de conversa concluído",
    sentimentAnalysisDebug: "Debug de análise de sentimentos",
    debugSubtitle: "Ferramentas de debug para análise de sentimentos",
    debugging: "Debugando...",
    debugSentimentAnalysis: "Debug análise de sentimentos",
    loading: "Carregando...",
    debugConversationData: "Debug dados de conversa",
    testing: "Testando...",
    testDirectApiCall: "Testar chamada direta da API",
    forceRefreshCache: "Forçar atualização do cache",
    cacheRefreshed: "Cache atualizado",
    cacheRefreshedMessage: "O cache foi atualizado com sucesso",
    currentPatient: "Paciente atual",
    noPatientSelected: "Nenhum paciente selecionado",
    debugResults: "Resultados do debug",
    totalConversations: "Total de conversas",
    withoutSentiment: "Sem sentimento",
    successfullyAnalyzed: "Analisadas com sucesso",
    failedAnalyses: "Análises falharam",
    conversationDetails: "Detalhes da conversa",
    messages: "mensagens",
    sentiment: "Sentimento",
    score: "Pontuação",
    mood: "Humor",
    emotions: "Emoções",
    concernLevel: "Nível de preocupação",
    failed: "Falhou",
    noAnalysisPerformed: "Nenhuma análise realizada",
  },
  headers: {
    home: "Início",
    patient: "Paciente",
    schedule: "Horário",
    conversations: "Conversas",
    call: "Chamada",
    alerts: "Alertas",
    logout: "Sair",
  },
  medicalAnalysis: {
    title: "Análise médica",
    error: "Erro",
    success: "Sucesso",
    noPatientSelected: "Nenhum paciente selecionado",
    selectPatientToView: "Por favor, selecione um paciente para ver a análise médica",
    triggering: "Disparando...",
    triggerAnalysis: "Disparar análise",
    loadingResults: "Carregando resultados da análise...",
    noResultsAvailable: "Nenhum resultado de análise disponível",
    triggerToGetStarted: "Dispare uma análise para começar",
    cognitiveHealth: "Saúde cognitiva",
    mentalHealth: "Saúde mental",
    language: "Idioma",
    risk: "Risco",
    high: "Alto",
    medium: "Médio",
    low: "Baixo",
    good: "Bom",
    fair: "Regular",
    poor: "Ruim",
    warningsInsights: "Avisos e insights",
    analysisDetails: "Detalhes da análise",
    conversations: "Conversas",
    messages: "Mensagens",
    totalWords: "Total de palavras",
    trigger: "Disparar",
    trendsOverTime: "Tendências ao longo do tempo",
    overallHealth: "Saúde geral",
    analyses: "análises",
    trendAnalysisComingSoon: "Análise de tendências em breve",
    analysisResultsAvailable: "resultados de análise disponíveis",
    basedOn: "Baseado em",
    analysisResultsOver: "resultados de análise ao longo de",
    loadFailed: "Falha ao carregar resultados da análise médica",
    triggerFailed: "Falha ao disparar análise médica",
    triggerSuccess: "Análise médica disparada com sucesso. Os resultados aparecerão em aproximadamente 10 segundos.",
  },
  signupScreen: {
    title: "Complete seu convite",
    fullNameLabel: "Nome completo",
    fullNamePlaceholder: "Seu nome completo",
    emailLabel: "Endereço de email",
    emailPlaceholder: "seu.email@exemplo.com",
    phoneLabel: "Número de telefone",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "Senha",
    passwordPlaceholder: "Digite sua senha",
    confirmPasswordLabel: "Confirmar senha",
    confirmPasswordPlaceholder: "Confirme sua senha",
    completeRegistration: "Completar cadastro",
    preconfiguredMessage: "Seu nome, email e detalhes da organização foram pré-configurados pelo seu administrador.",
  },
  homeScreen: {
    welcome: "Bem-vindo, {{name}}",
    guest: "Convidado",
    addPatient: "Adicionar paciente",
    adminOnlyMessage: "Apenas administradores de organização e super administradores podem adicionar pacientes",
    noPatientsFound: "Nenhum paciente encontrado",
    viewSchedules: "Ver agendas",
    noScheduleWarning: "⚠ Nenhum horário configurado",
  },
  tabs: {
    home: "Início",
    org: "Organização",
    reports: "Relatórios",
    alerts: "Alertas",
  },
  orgScreen: {
    namePlaceholder: "Nome",
    emailPlaceholder: "Email",
    phonePlaceholder: "Telefone",
    save: "SALVAR",
    viewCaregivers: "Ver cuidadores",
    inviteCaregiver: "Convidar cuidador",
    payments: "Pagamentos",
    organizationActions: "Ações da organização",
    organizationLogo: "Logo da organização",
    noLogoSet: "Nenhum logo definido",
  },
  headers: {
    home: "Início",
    patient: "Paciente",
    schedule: "Agenda",
    conversations: "Conversas",
    call: "Chamada",
    profile: "Perfil",
    logout: "Sair",
    alerts: "Alertas",
    organization: "Organização",
    caregivers: "Cuidadores",
    caregiver: "Cuidador",
    caregiverInvited: "Cuidador convidado",
    payments: "Pagamentos",
    reports: "Relatórios",
    sentimentAnalysis: "Análise de sentimento",
    medicalAnalysis: "Análise médica",
    privacyPolicy: "Política de privacidade",
    privacyPractices: "Práticas de Privacidade HIPAA",
    termsOfService: "Termos de serviço",
    mentalHealthReport: "Relatório de saúde mental",
    login: "Entrar",
    register: "Registrar",
  },
  themes: {
    healthcare: {
      name: "Saúde",
      description: "Tema médico profissional com cores azul e verde",
    },
    colorblind: {
      name: "Amigável para daltônicos",
      description: "Tema de alto contraste otimizado para deficiência de visão de cores",
    },
    dark: {
      name: "Modo escuro",
      description: "Tema escuro otimizado para ambientes com pouca luz",
    },
    accessibility: {
      wcagLevel: "Nível WCAG",
      colorblindFriendly: "Amigável para daltônicos",
      highContrast: "Alto contraste",
      darkMode: "Modo escuro",
    },
  },
  privacyPracticesScreen: {
    content: `# Aviso de Práticas de Privacidade
## Serviços de Comunicação de Saúde MyPhoneFriend

**Data de vigência**: 15 de outubro de 2025

---

## SUAS INFORMAÇÕES. SEUS DIREITOS. NOSSAS RESPONSABILIDADES.

**ESTE AVISO DESCREVE COMO AS INFORMAÇÕES MÉDICAS SOBRE VOCÊ PODEM SER USADAS E DIVULGADAS E COMO VOCÊ PODE ACESSAR ESSAS INFORMAÇÕES. POR FAVOR, REVISE-O CUIDADOSAMENTE.**

---

## SEUS DIREITOS

Você tem o direito de:
- Obter uma cópia de suas informações de saúde
- Corrigir suas informações de saúde
- Solicitar comunicação confidencial
- Pedir-nos para limitar as informações que compartilhamos
- Obter uma lista daqueles com quem compartilhamos suas informações
- Obter uma cópia deste aviso de privacidade
- Escolher alguém para agir em seu nome
- Apresentar uma reclamação se acreditar que seus direitos de privacidade foram violados

---

## SUAS ESCOLHAS

Você tem algumas escolhas sobre como usamos e compartilhamos informações quando:
- Respondemos perguntas de sua família e amigos sobre seu cuidado
- Fornecemos informações sobre você em situações de socorro em desastres

**Nunca compartilhamos suas informações para marketing ou venda de seus dados.**

---

# SEUS DIREITOS DETALHADOS

## Obter uma cópia de suas informações de saúde

**Você pode solicitar ver ou obter uma cópia de suas informações de saúde.**

O que você pode solicitar:
- Gravações de chamadas e transcrições
- Resumos de bem-estar e resultados de análise de IA
- Alertas médicos gerados por nosso sistema
- Notificações de emergência
- Informações da conta e preferências

**Como solicitar**:
- Email: privacy@biancawellness.com
- Telefone: +1-604-562-4263

**Nossa resposta**: Dentro de 30 dias

---

## Peça-nos para corrigir suas informações de saúde

**Você pode pedir-nos para corrigir informações de saúde que acredita serem incorretas ou incompletas.**

**Nossa resposta**: Dentro de 60 dias

---

## Solicitar comunicações confidenciais

**Você pode pedir-nos para contatá-lo de uma maneira específica ou em um local específico.**

Exemplos:
- "Por favor, envie-me um email em vez de ligar"
- "Por favor, entre em contato apenas no meu celular"

Acomodaremos todas as solicitações razoáveis.

---

## Peça-nos para limitar o que usamos ou compartilhamos

**Você pode pedir-nos para não usar ou compartilhar certas informações de saúde.**

Devemos concordar se você pagou do próprio bolso integralmente e nos pede para não compartilhar com seu plano de saúde.

---

## Obter uma lista de divulgações

**Você pode solicitar um "relatório de divulgações"** - uma lista das vezes que compartilhamos suas informações de saúde.

Cobre: Últimos 6 anos  
Exclui: Divulgações para tratamento, pagamento e operações (a menos que você solicite)

---

## Apresentar uma reclamação

**Apresentar conosco**:
- Email: privacy@biancawellness.com
- Telefone: +1-604-562-4263

**Apresentar com HHS**:
- Site: https://www.hhs.gov/hipaa/filing-a-complaint
- Telefone: 1-800-368-1019

**Não retaliaremos contra você por apresentar uma reclamação.**

---

# NOSSOS USOS E DIVULGAÇÕES

## Como usamos suas informações de saúde

**Para tratamento**:
- Fornecer resumos de bem-estar de IA aos seus cuidadores
- Gerar alertas de emergência para situações urgentes
- Permitir que cuidadores monitorem seu bem-estar
- Facilitar a comunicação com sua equipe de cuidados

**Para pagamento**:
- Cobrar sua organização de saúde pelos serviços
- Processar faturas por tempo de chamada e análise

**Para operações de saúde**:
- Melhorar nossos algoritmos de detecção de IA
- Garantia de qualidade e melhoria
- Treinar nossos sistemas para servir melhor os pacientes

---

## Com quem compartilhamos

**Sua organização de saúde**:
- Seus cuidadores e coordenadores de cuidados designados
- Administradores da organização para faturamento

**Associados comerciais** (Provedores de serviços):
- Serviços de IA (Azure OpenAI): Para transcrição e análise
- Serviços de voz (Twilio): Para tratamento de chamadas telefônicas
- Hospedagem em nuvem (AWS): Para armazenamento seguro de dados
- Banco de dados (MongoDB Atlas): Para gerenciamento de dados

Todos os associados comerciais assinam acordos de associado comercial e devem proteger suas informações.

**Conforme exigido por lei**:
- Serviços de emergência (911) se emergência detectada
- Autoridades de saúde pública (relatórios de abuso, negligência)
- Aplicação da lei (com ordem legal válida)

**NÃO fazemos**:
- ❌ Vender suas informações de saúde
- ❌ Compartilhar com profissionais de marketing ou anunciantes
- ❌ Usar para marketing sem sua autorização
- ❌ Compartilhar em redes sociais

---

# INFORMAÇÕES DE SAÚDE QUE COLETAMOS

**Durante o uso de nossos serviços**:
- Nome do paciente, número de telefone, data de nascimento
- Gravações de chamadas e transcrições
- Informações relacionadas à saúde das chamadas (sintomas, medicamentos, humor)
- Alertas e incidentes de emergência
- Tendências e padrões de bem-estar
- Notas e observações dos cuidadores
- Resultados de análise médica de IA

---

# SUAS RESPONSABILIDADES

**Se você está usando nosso serviço para ligar para outra pessoa**, você é responsável por:
- Obter os consentimentos necessários para gravação
- Garantir que entendam o serviço
- Seguir as leis aplicáveis de consentimento de gravação

---

# NOTIFICAÇÃO DE VIOLAÇÃO

**Se suas informações de saúde forem acessadas ou divulgadas indevidamente**, nós:
- Investigaremos o incidente
- Notificaremos você dentro de 60 dias se for uma violação reportável
- Explicaremos o que aconteceu e o que estamos fazendo
- Forneceremos informações sobre os passos que você pode tomar

---

# MUDANÇAS NESTE AVISO

- Podemos alterar este aviso e as alterações se aplicarão a todas as informações que temos
- O novo aviso estará disponível no aplicativo e em nosso site
- Você sempre pode solicitar uma cópia atual

---

# INFORMAÇÕES DE CONTATO

**Oficial de privacidade**:
- Email: privacy@biancawellness.com
- Telefone: +1-604-562-4263
- Correio: Escritório de Privacidade MyPhoneFriend, 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

**Horário**: Segunda a Sexta, 9h - 17h PST

---

# APRESENTAR UMA RECLAMAÇÃO

**Conosco**:
- Email: privacy@biancawellness.com
- Telefone: +1-604-562-4263

**Com o governo federal (HHS)**:
- Site: https://www.hhs.gov/hipaa/filing-a-complaint
- Telefone: 1-800-368-1019
- Correio: Escritório de Direitos Civis, Departamento de Saúde e Serviços Humanos dos EUA, 200 Independence Avenue S.W., Washington, D.C. 20201

---

**Data de vigência**: 15 de outubro de 2025  
**Versão**: 1.0

Este Aviso de Práticas de Privacidade está em conformidade com a Regra de Privacidade HIPAA (45 CFR §164.520)

---

## Assistência de idiomas

**Inglês**: Se você precisar de ajuda para entender este aviso, entre em contato com privacy@biancawellness.com

**Español**: Si necesita ayuda, comuníquese con privacy@biancawellness.com`,
  },
  mfa: {
    setupTitle: "Autenticação Multi-Fator",
    setupSubtitle: "Adicione uma camada extra de segurança à sua conta",
    setupInstructions: "Escaneie o código QR com seu aplicativo autenticador e, em seguida, insira o código para verificar.",
    verificationTitle: "Autenticação de Dois Fatores",
    verificationSubtitle: "Digite o código de 6 dígitos do seu aplicativo autenticador",
    tokenLabel: "Código de Verificação",
    tokenPlaceholder: "000000",
    pleaseEnterVerificationCode: "Por favor, insira o código de verificação do seu aplicativo autenticador",
    verifyButton: "Verificar",
    useBackupCode: "Usar Código de Backup",
    verifyAndEnable: "Verificar e Habilitar",
    enable: "Habilitar MFA",
    enableMFA: "Habilitar Autenticação Multi-Fator",
    manageMFA: "Gerenciar Autenticação Multi-Fator",
    disable: "Desabilitar MFA",
    disableTitle: "Desabilitar MFA",
    disableSubtitle: "Digite seu código MFA atual para desabilitar a autenticação multi-fator",
    disableConfirmTitle: "Desabilitar MFA?",
    disableConfirmMessage: "Tem certeza de que deseja desabilitar a autenticação multi-fator? Isso reduzirá a segurança da sua conta.",
    enabled: "Habilitado",
    disabled: "Desabilitado",
    enabledSuccess: "A autenticação multi-fator foi habilitada com sucesso.",
    disabledSuccess: "A autenticação multi-fator foi desabilitada.",
    status: "Status",
    enrolledOn: "Registrado em",
    backupCodesRemaining: "Códigos de backup restantes",
    backupCodesTitle: "Códigos de Backup",
    backupCodesWarning: "Salve esses códigos em um local seguro. Você pode usá-los para acessar sua conta se perder seu dispositivo autenticador.",
    backupCodeLength: "Os códigos de backup têm 8 caracteres",
    regenerateBackupCodes: "Regenerar Códigos de Backup",
    regenerateBackupCodesTitle: "Regenerar Códigos de Backup?",
    regenerateBackupCodesSubtitle: "Digite seu código MFA atual para gerar novos códigos de backup",
    regenerateBackupCodesMessage: "Seus códigos de backup antigos não funcionarão mais. Certifique-se de salvar os novos códigos com segurança.",
    regenerate: "Regenerar",
    backupCodesRegenerated: "Códigos de Backup Regenerados",
    backupCodesRegeneratedMessage: "Seus novos códigos de backup foram gerados. Por favor, salve-os com segurança.",
    secretLabel: "Ou digite este segredo manualmente:",
    invalidTokenLength: "Por favor, insira um código de 6 dígitos",
    verificationFailed: "Código inválido. Por favor, tente novamente.",
    enableFailed: "Falha ao habilitar MFA",
    disableFailed: "Falha ao desabilitar MFA. Por favor, verifique seu código.",
    regenerateFailed: "Falha ao regenerar códigos de backup.",
  },
}

export default pt
