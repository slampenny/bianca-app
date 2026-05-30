import { LocaleTranslations } from "./en"

const zh: LocaleTranslations = {
  common: {
    ok: "确定",
    cancel: "取消",
    close: "关闭",
    error: "错误",
    anErrorOccurred: "发生错误",
    back: "返回",
    logOut: "退出登录",
    selectImage: "选择图片",
    calling: "正在通话...",
    callNow: "立即通话",
    ending: "结束中...",
    endCall: "结束通话",
    loading: "加载中...",
    signInToContinue: "请登录后继续。",
    continue: "继续",
    delete: "删除",
    done: "完成",
  },
  alertScreen: {
    markAllAsRead: "全部标记为已读",
    unreadAlerts: "未读提醒",
    allAlerts: "所有提醒",
    noAlerts: "无提醒",
    noAlertsTitle: "全部完成！",
    noAlertsSubtitle: "您没有未读提醒。保持最新状态做得很好！",
    emptyHeading: "空空如也...好难过",
    refreshing: "刷新中...",
    refresh: "刷新",
    client: "客户：",
    importance: "重要性：",
    expires: "过期：",
    filteredByClientBanner: "正在显示 {{name}} 的提醒",
    clearAlertFilter: "显示全部",
    noAlertsForFilteredClientTitle: "此客户没有提醒",
    noAlertsForFilteredClientSubtitle: "没有与 {{name}} 关联的提醒。清除筛选可查看全部提醒，或在首页选择其他客户。",
  },
  legalLinks: {
    privacyPolicy: "隐私政策",
    privacyPractices: "HIPAA隐私实践",
    termsOfService: "服务条款",
  },
  welcomeScreen: {
    postscript: "psst — 这大概不是你的应用的样子。（除非你的设计师给了你这些屏幕，那样的话，就发布吧！）",
    readyForLaunch: "你的应用，几乎准备好发布了！",
    exciting: "（哦，这很令人兴奋！）",
    letsGo: "让我们开始吧！",
  },
  errorScreen: {
    title: "出错了！",
    friendlySubtitle: "发生了错误。你可能还想自定义设计（`app/screens/ErrorScreen`）。如果你想完全删除这个，请查看 `app/app.tsx` 中的 <ErrorBoundary> 组件。",
    reset: "重启应用",
    traceTitle: "错误堆栈 %{name}",
  },
  emptyStateComponent: {
    generic: {
      heading: "空空如也...好难过",
      content: "还没有找到数据。尝试点击按钮刷新或重新加载应用。",
      button: "让我们再试一次",
    },
  },
  errors: {
    invalidEmail: "无效的电子邮件地址。",
  },
  loginScreen: {
    signIn: "登录",
    register: "注册",
    enterDetails: "在下面输入你的详细信息以解锁秘密信息。你永远猜不到我们为你准备了什么。或者也许你会；这里不是火箭科学。",
    emailFieldLabel: "电子邮件",
    passwordFieldLabel: "密码",
    emailFieldPlaceholder: "输入你的电子邮件地址",
    passwordFieldPlaceholder: "超级秘密密码在这里",
    forgotPassword: "忘记密码？",
    hint: "提示：你可以使用任何电子邮件地址和你最喜欢的密码 :)",
    appName: "Bianca",
    tagline: "健康检查沟通",
  },
  logoutScreen: {
    logoutButton: "退出登录",
    logoutMessage: "你确定吗？",
  },
  registerScreen: {
    title: "注册",
    nameFieldLabel: "姓名",
    emailFieldLabel: "电子邮件",
    phoneFieldLabel: "电话",
    passwordFieldLabel: "密码",
    goBack: "返回",
    confirmPasswordFieldLabel: "确认密码",
    organizationNameFieldLabel: "组织名称",
    nameFieldPlaceholder: "输入你的姓名",
    emailFieldPlaceholder: "输入你的电子邮件地址",
    passwordFieldPlaceholder: "输入你的密码",
    confirmPasswordFieldPlaceholder: "确认你的密码",
    organizationNameFieldPlaceholder: "输入你的组织名称",
    organizationButton: "组织",
    individualButton: "个人",
    individualExplanation: "注册为个人用户供个人使用。",
    organizationExplanation: "注册为组织用户供公司或团体使用。",
    consentText: "通过注册，你同意我们的",
    consentAnd: "和",
    termsOfService: "服务条款",
    privacyPolicy: "隐私政策",
    signUp: "注册",
    signIn: "登录",
    alreadyHaveAccount: "已有账户？",
    dontHaveAccount: "没有账户？",
    termsAndConditions: "条款和条件",
    agreeToTerms: "通过注册，你同意我们的",
    and: "和",
    countryFieldLabel: "国家/地区",
    phoneFieldPlaceholder: "(xxx)xxx-xxxx",
  },
  requestResetScreen: {
    title: "请求重置密码",
    emailFieldLabel: "电子邮件",
    emailFieldPlaceholder: "输入你的电子邮件地址",
    requestReset: "请求重置",
    successMessage: "重置代码已发送到你的电子邮件！",
    requestFailed: "请求失败。请检查你的电子邮件并重试。",
  },
  ssoLinkingScreen: {
    title: "关联您的账户",
    message: "此账户是使用 {{provider}} 创建的。要使用电子邮件/密码登录，请在下面设置密码，或继续使用 {{provider}}。",
    passwordLabel: "密码",
    passwordPlaceholder: "输入您的密码",
    confirmPasswordLabel: "确认密码",
    confirmPasswordPlaceholder: "确认您的密码",
    setPasswordButton: "设置密码",
    backToLoginButton: "返回登录",
    orDivider: "或",
    successMessage: "✓ 密码设置成功！您现在可以使用您的电子邮件和密码登录。",
    errorNoPassword: "请输入密码",
    errorNoConfirmPassword: "请确认您的密码",
    errorPasswordMismatch: "密码不匹配",
    errorPasswordTooShort: "密码必须至少包含 8 个字符",
    errorSetPasswordFailed: "设置密码失败",
    errorSSOFailed: "SSO 登录失败。请重试。",
    providerGoogle: "Google",
    providerMicrosoft: "Microsoft",
    providerSSO: "SSO",
  },
  ssoButtons: {
    orContinueWith: "或继续使用",
    google: "Google",
    microsoft: "Microsoft",
    continueWithGoogle: "使用 Google 继续",
    continueWithMicrosoft: "使用 Microsoft 继续",
    companySSO: "企业 SSO",
    ssoNotAvailable: "SSO 不可用",
    signInFailed: "登录失败",
    companySSOTitle: "企业 SSO",
    companySSOMessage: "这将重定向到您企业的 SSO 提供商。请联系您的管理员进行设置。",
  },
  emailVerificationScreen: {
    title: "检查您的电子邮件",
    message: "我们已向您的电子邮件地址发送了验证链接。请点击链接以在登录前验证您的账户。",
    emailFieldLabel: "电子邮件地址",
    emailFieldPlaceholder: "输入您的电子邮件地址",
    resendButton: "重新发送验证电子邮件",
    backToLoginButton: "返回登录",
    successMessage: "✓ 验证电子邮件已发送！请检查您的收件箱。",
    errorNoEmail: "请输入您的电子邮件地址",
    errorSendFailed: "发送验证电子邮件失败",
    errorNetwork: "无法连接到服务器。请检查您的网络连接后重试。",
    errorNoToken: "缺少验证令牌",
    errorVerificationFailed: "电子邮件验证失败",
    verificationFailed: "电子邮件验证失败",
    verifying: "正在验证…",
  },
  emailVerifiedScreen: {
    title: "电子邮件已验证！",
    message: "您的 My Phone Friend 帐户已成功验证。",
    redirecting: "正在重定向到应用程序...",
  },
  phoneVerificationBanner: {
    title: "验证您的电话号码",
    message: "请验证您的电话号码以接收紧急警报和重要通知。",
    verifyButton: "立即验证",
  },
  conversationsScreen: {
    title: "对话",
    yesterday: "昨天",
    noMessages: "无消息",
    noClientSelected: "未选择客户",
    firstConversation: "未找到之前的对话。这将是与此客户的第一次对话。",
    noConversationsToDisplay: "无对话可显示",
    noPreviousConversations: "未找到此客户的之前对话",
    errorFetchingConversations: "获取对话时出错",
    loadingMoreConversations: "加载更多对话...",
  },
  clientScreen: {
    nameLabel: "姓名 *",
    namePlaceholder: "输入客户姓名",
    emailLabel: "电子邮件 *",
    emailPlaceholder: "输入电子邮件地址",
    phoneLabel: "电话 *",
    phonePlaceholder: "输入电话号码",
    preferredLanguageLabel: "首选语言",
    updateClient: "更新客户",
    createClient: "创建客户",
    manageSchedules: "管理日程",
    manageConversations: "管理对话",
    viewSentimentAnalysis: "查看情感分析",
    manageCaregivers: "管理护理人员",
    confirmDelete: "确认删除",
    deleteClient: "删除客户",
    onboardingCardTitle: "住户入职引导",
    onboardingNotStarted: "尚未开始 — 下一步：第1天（共4天）",
    onboardingInProgress: "进行中",
    onboardingNextDay: "下一步：第{{day}}天（共4天）",
    onboardingCallsCompleted: "已完成 {{completed}} / 4 次通话",
    onboardingCapturesLine: "已记录 {{count}} 条主题回答",
    onboardingComplete: "入职引导已完成 — 4次通话均已结束",
    viewOnboardingDetails: "查看入职引导回答",
    onboardingButtonCompactComplete: "入职引导 · 已完成",
    onboardingButtonCompactDay: "入职引导 · 第{{day}}天",
    onboardingButtonA11yHint: "打开此客户的入职引导回答与进度详情。",
    onboardingOutboundCallsHint: "来自首页或日程的外呼将使用第 {{day}} 次入门引导对话，直到该会话在电话中完成。无人接听则不会推进——下次通话仍停留在同一会话。",
  },
  clientOnboardingScreen: {
    title: "入职引导回答",
    noClient: "未选择客户。",
    day: "天",
    filterByDay: "按天筛选",
    allDays: "全部",
    loading: "加载中…",
    error: "无法加载入职引导数据。",
    captureCount: "{{count}} 条回答",
    emptyAllDays: "尚未记录任何入职引导回答。",
    emptyForDay: "第 {{day}} 天的入职引导尚未完成。",
    flag: {
      safety: "安全",
      memory: "记忆",
      mood: "情绪",
      distress: "痛苦",
      confusion: "困惑",
    },
    signalsForDay: "第 {{day}} 天记录的信号",
  },
  paymentScreen: {
    paid: "已支付",
    pending: "待处理",
    overdue: "逾期",
    processing: "处理中",
    unknown: "未知",
    latestInvoice: "最新发票",
    paymentMethod: "支付方式",
    currentChargesSummary: "当前费用摘要",
    basicPlan: "基础计划",
    contactSupport: "联系支持",
    currentCharges: "当前费用",
    paymentMethods: "支付方式",
    billingInfo: "账单信息",
    noOrganizationData: "无组织数据可用",
    authorizationTokenNotAvailable: "授权令牌不可用",
    errorLoadingCurrentCharges: "加载当前费用时出错",
    noPendingCharges: "无待处理费用",
    allConversationsBilled: "所有对话已计费",
    totalUnbilledAmount: "总未计费金额",
    period: "期间",
    lastDays: "最近 {days} 天",
    clientsWord: "客户",
    clientWord: "客户",
    chargesByClient: "按客户收费",
    average: "平均",
    noUserData: "无用户数据可用",
    currentPlan: "当前计划",
    nextBillingDate: "下次计费日期",
    totalBilledAmount: "总计费金额",
    acrossInvoices: "在 {count} 张发票中",
    invoiceHistory: "发票历史 ({count})",
    hide: "隐藏",
    show: "显示",
    history: "历史",
    noInvoicesYet: "暂无发票",
    invoicesWillAppear: "发票生成后将显示在这里",
    loadingUserInformation: "加载用户信息...",
    accessRestricted: "访问受限",
    accessRestrictedMessage: "你没有权限访问支付信息。",
    addPaymentMethod: "添加支付方式",
    loadingPaymentSystem: "正在加载支付系统...",
    loadingPaymentMethods: "正在加载支付方式...",
    stripeConfigurationError: "Stripe配置错误。请联系支持。",
    unsupportedPlatform: "不支持的平台。请使用网络浏览器或移动应用程序。",
    errorLoadingPaymentMethods: "加载支付方式时出错：",
    existingPaymentMethods: "现有支付方式",
    default: "默认",
    setDefault: "设为默认",
    remove: "删除",
    addNewCard: "添加新卡",
    deletePaymentMethod: "删除支付方式",
    deletePaymentMethodConfirm: "您确定要删除此支付方式吗？此操作无法撤销。",
    paymentMethodAddedSuccess: "支付方式添加成功！",
    paymentMethodSetDefaultSuccess: "支付方式设置为默认成功！",
    paymentMethodDeletedSuccess: "支付方式删除成功！",
    failedToSetDefault: "设置默认支付方式失败",
    failedToDelete: "删除支付方式失败",
    expires: "到期",
    mobilePaymentUnavailable: "移动支付系统不可用。请使用网页版本。",
    loadingMobilePayment: "正在加载移动支付系统...",
    anErrorOccurred: "发生错误",
    contactAdministrator: "联系你的管理员获取访问权限。",
    amount: "金额：",
    invoiceNumber: "发票号：",
    issueDate: "签发日期：",
    dueDate: "到期日期：",
    notes: "备注：",
    clientsWithCharges: "有费用的客户：",
    conversation: "次对话",
    conversations: "次对话",
    day: "天",
    days: "天",
  },
  profileScreen: {
    languageSelector: "语言 / Language",
    selectLanguage: "选择语言",
    theme: "主题",
    selectTheme: "选择主题",
    namePlaceholder: "姓名",
    emailPlaceholder: "电子邮件",
    phonePlaceholder: "电话",
    yourProfile: "你的个人资料",
    updateProfile: "更新个人资料",
    logout: "退出登录",
    profileUpdatedSuccess: "你的个人资料已成功更新！",
    profileUpdateFailed: "更新个人资料失败。请重试。",
    invalidPhoneFormat: "无效的电话格式（10位数字或+1XXXXXXXXXX）",
    completeProfileTitle: "完成您的个人资料",
    completeProfileMessage: "请先添加电话号码以完成您的个人资料，然后再继续。",
    completeProfileMessageUnverified: "请添加您的电话号码以完成您的个人资料并访问所有功能。",
    errorUploadingAvatar: "上传头像时出错",
    emailVerified: "电子邮件已验证",
    emailNotVerified: "电子邮件未验证",
    phoneVerified: "电话已验证",
    phoneNotVerified: "电话未验证",
    verifyPhone: "验证电话",
    fontSize: "字体大小",
    fontSizeDescription: "调整文本大小以提高可读性。更改立即生效。",
    decreaseFontSize: "减小字体大小",
    increaseFontSize: "增大字体大小",
    fontSizeHint: "将字体大小从80%调整到200%",
    telemetryOptIn: "共享匿名使用数据",
    telemetryDescription: "通过共享匿名使用数据帮助我们改进应用程序。不收集个人信息。",
    telemetryEnabled: "遥测已启用",
    telemetryDisabled: "遥测已禁用",
    emailManagedBySSO: "电子邮件由您的登录提供商管理，无法更改。",
    requestMyData: "申请我的数据",
    verificationEmailFailed: "发送验证电子邮件失败。请重试。",
    verificationEmailSent: "验证电子邮件已发送！请查收收件箱。",
    verifyEmail: "验证电子邮件",
    verifyPhoneBannerMessage: "请验证您的电话号码以接收紧急警报和重要通知。您也可在未验证电话号码的情况下继续使用应用。",
  },
  fraudAbuseAnalysis: {
    title: "欺诈与滥用分析",
    error: "错误",
    success: "成功",
    noClientSelected: "未选择客户",
    selectClientToView: "请选择客户以查看欺诈和滥用分析",
    triggering: "触发中...",
    triggerAnalysis: "触发分析",
    loadingResults: "正在加载分析结果...",
    noResultsAvailable: "无分析结果可用",
    triggerToGetStarted: "触发分析以开始",
    analysisWillAppearAfterCalls: "分析结果将在通话完成后显示在这里。",
    insufficientDataWarning: "可用数据有限：已分析 {{current}} 个通话。为了更可靠的分析，建议在更长的时间内进行 {{minimum}} 个或更多通话，以更好地了解客户模式。",
    loadFailed: "加载欺诈/滥用分析结果失败",
    triggerFailed: "触发欺诈/滥用分析失败",
    triggerSuccess: "欺诈/滥用分析成功完成。",
    disclaimer: "此分析仅供参考，不能替代专业评估。如果您怀疑存在欺诈、滥用或忽视，请立即联系相关当局。",
    overview: "概览",
    conversations: "对话",
    messages: "消息",
    riskScore: "风险评分",
    financialRisk: "财务风险",
    abuseRisk: "滥用风险",
    relationshipRisk: "关系风险",
    warnings: "警告",
    recommendations: "建议",
    critical: "严重",
    high: "高",
    medium: "中",
    low: "低",
    largeAmountMentions: "大额提及",
    transferMethodMentions: "转账方式提及",
    scamIndicators: "诈骗指标",
    physicalAbuseScore: "身体虐待评分",
    emotionalAbuseScore: "情感虐待评分",
    neglectScore: "忽视评分",
    newPeopleCount: "新人员数量",
    isolationCount: "隔离数量",
    suspiciousBehaviorCount: "可疑行为数量",
  },
  reportsScreen: {
    selectClient: "选择客户：",
    chooseClient: "选择一个客户...",
    sentiment: "情感",
    medicalAnalysis: "医学分析",
    fraudAbuseAnalysis: "欺诈与滥用",
    comingSoon: "即将推出",
    modalTitle: "选择客户",
    modalCancel: "取消",
  },
  schedulesScreen: {
    scheduleDetails: "日程详情",
    selectSchedule: "选择一个日程：",
    scheduleNumber: "日程",
    noSchedulesAvailable: "无可用日程。请创建新的。",
    errorLoadingSchedules: "加载日程时出错。",
    errorSavingSchedule: "保存日程时出错。",
    invalidScheduleError: "请填写所有必填日程字段（频率、时间，以及每周/每月日程的日期）。",
    newSchedule: "新建日程",
  },
  scheduleComponent: {
    schedule: "日程",
    startTime: "开始时间",
    frequency: "频率",
    daily: "每日",
    weekly: "每周",
    monthly: "每月",
    sunday: "星期日",
    monday: "星期一",
    tuesday: "星期二",
    wednesday: "星期三",
    thursday: "星期四",
    friday: "星期五",
    saturday: "星期六",
    scheduleDetails: "日程详情",
    active: "活跃",
    everyDayAt: "每天 {{time}}",
    everyDaysAt: "每 {{days}} {{time}}",
    everyMonthOn: "每月 {{day}} 日 {{time}}",
    everyWeekAt: "每周 {{time}}",
  },
  caregiverScreen: {
    nameLabel: "姓名",
    namePlaceholder: "姓名",
    emailLabel: "电子邮件",
    emailPlaceholder: "电子邮件",
    phoneLabel: "电话",
    phonePlaceholder: "电话",
    loadingUnassignedClients: "加载未分配的客户...",
    assigningClients: "分配客户中...",
    clientsAssignedSuccess: "客户已成功分配！",
    loadingCaregivers: "加载护理人员...",
    save: "保存",
    invite: "邀请",
    confirmDelete: "确认删除",
    deleteCaregiver: "删除护理人员",
    assignUnassignedClients: "分配未分配的客户",
    assignUnassignedClientsTitle: "分配未分配的客户",
    selectAll: "全选",
    deselectAll: "取消全选",
    assignSelected: "分配所选",
    noUnassignedClientsFound: "没有未分配的客户。",
  },
  caregiversScreen: {
    invited: "已邀请",
    edit: "编辑",
    resendInvite: "重新发送邀请",
    noCaregiversFound: "未找到护理人员",
    notAuthorized: "未授权",
    noPermissionToView: "你没有权限查看护理人员",
    addCaregiver: "添加护理人员",
  },
  sentimentAnalysis: {
    lastCall: "上次通话",
    last30Days: "最近30天",
    allTime: "全部时间",
    noClientSelected: "未选择客户",
    selectClientToView: "请从主屏幕选择一个客户以查看其情感分析。",
    sessionRequiredTitle: "需要登录",
    sessionRequiredMessage: "您的会话可能已过期。请重新登录以查看情感分析。如果登录窗口已打开，请在其中完成登录。",
    signInToContinueButton: "登录",
    accessDeniedTitle: "无法加载此报告",
    accessDeniedMessage: "您可能没有权限查看该客户的情感数据，或权限已变更。请从首页重新选择客户，或联系管理员。",
    clientSentimentAnalysis: "客户情感分析",
    emotionalWellnessInsights: "情感健康洞察和趋势",
    timeRange: "时间范围：",
    noSentimentDataAvailable: "无情感数据可用",
    noSentimentDataMessage: "客户完成对话后，情感分析将显示在这里。",
    loadingSentimentAnalysis: "加载情感分析...",
    sentimentAnalysisFooter: "情感分析在每次对话后使用AI技术自动生成。",
    sentimentOverview: "情感概览",
    averageSentiment: "平均情感",
    trend: "趋势",
    recentDistribution: "最近分布",
    keyInsights: "关键洞察",
    totalConversations: "总对话数",
    analysisCoverage: "分析覆盖",
    recentConversations: "最近对话",
    analyzed: "已分析",
    latestAnalysis: "最新分析",
    conversationsAnalyzed: "对话已分析",
    recentConversationsTitle: "最近对话",
    conversationsWithSentiment: "带情感的对话{0}",
    keyEmotions: "关键情感",
    moreEmotions: "更多情感",
    clientMood: "客户情绪",
    concern: "关注",
    confidence: "信心",
    noSentimentAnalysisAvailable: "无情感分析可用",
    sentimentTrend: "情感趋势",
    conversationsAnalyzedNoTrend: "对话{0}已分析{0}无明确趋势",
    noSentimentData: "无情感数据",
    avg: "平均",
    negative: "负面",
    positive: "正面",
    lastCallAnalysis: "上次通话分析",
    noRecentCall: "无最近通话",
    noRecentCallMessage: "无最近通话可分析。通话完成后将显示在这里。",
    duration: "持续时间",
    analysisDate: "分析日期",
    overallSentiment: "整体情感",
    scoreRange: "分数范围",
    analysisConfidence: "分析信心",
    keyEmotionsDetected: "检测到的关键情感",
    clientMoodAssessment: "客户情绪评估",
    concernLevel: "关注级别",
    satisfactionIndicators: "满意度指标",
    positiveIndicators: "积极指标",
    areasOfConcern: "关注领域",
    aiSummary: "AI摘要",
    recommendations: "建议",
    lowConcernDescription: "低关注级别 - 客户似乎很好。",
    mediumConcernDescription: "中等关注级别 - 建议跟进。",
    highConcernDescription: "高关注级别 - 需要立即关注。",
    debugComplete: "调试完成",
    debugFailed: "调试失败",
    noClient: "无客户",
    pleaseSelectClient: "请先选择一个客户",
    conversationDebugComplete: "对话调试完成",
    sentimentAnalysisDebug: "情感分析调试",
    debugSubtitle: "情感分析调试工具",
    debugging: "调试中...",
    debugSentimentAnalysis: "调试情感分析",
    loading: "加载中...",
    debugConversationData: "调试对话数据",
    testing: "测试中...",
    testDirectApiCall: "测试直接API调用",
    forceRefreshCache: "强制刷新缓存",
    cacheRefreshed: "缓存已刷新",
    cacheRefreshedMessage: "缓存已成功刷新",
    currentClient: "当前客户",
    debugResults: "调试结果",
    withoutSentiment: "无情感",
    successfullyAnalyzed: "成功分析",
    failedAnalyses: "失败分析",
    conversationDetails: "对话详情",
    messages: "消息",
    sentiment: "情感",
    score: "分数",
    mood: "情绪",
    emotions: "情感",
    failed: "失败",
    noAnalysisPerformed: "未执行分析",
    conversationId: "对话 ID",
    directApiTest: "直接 API 测试",
    insufficientDataForTrend: "趋势分析数据不足",
    lowConfidence: "置信度低",
    needMoreConversations: "需要更多对话以获得可靠趋势",
    noRecentCallButHaveCalls: "有近期通话，尚无情绪分析",
    noRecentCallButHaveCallsMessage: "您在过去 30 天内有近期通话，但尚无情绪分析。新通话结束后将自动分析。较早的通话可能需要重新处理。",
    noRecentConversations: "没有近期带情绪分析的对话",
  },
  headers: {
    home: "首页",
    client: "客户",
    schedule: "日程",
    conversations: "对话",
    call: "通话",
    alerts: "提醒",
    logout: "退出登录",
    reports: "报告",
    sentimentAnalysis: "情感分析",
    clientOnboarding: "入职引导",
    medicalAnalysis: "医学分析",
    fraudAbuseAnalysis: "欺诈与滥用分析",
    mentalHealthReport: "心理健康报告",
    caregiver: "护理员",
    caregiverInvited: "已邀请护理员",
    caregivers: "护理员",
    login: "登录",
    organization: "机构",
    payments: "付款",
    privacyPolicy: "隐私政策",
    privacyPractices: "HIPAA 隐私实践",
    privacyRequest: "申请我的数据",
    profile: "个人资料",
    register: "注册",
    termsOfService: "服务条款",
  },
  medicalAnalysis: {
    title: "医学分析",
    error: "错误",
    success: "成功",
    noClientSelected: "未选择客户",
    selectClientToView: "请选择一个客户以查看医学分析",
    triggering: "触发中...",
    triggerAnalysis: "触发分析",
    loadingResults: "加载分析结果...",
    noResultsAvailable: "无分析结果可用",
    triggerToGetStarted: "触发分析以开始",
    cognitiveHealth: "认知健康",
    mentalHealth: "心理健康",
    language: "语言",
    risk: "风险",
    high: "高",
    medium: "中",
    low: "低",
    good: "好",
    fair: "一般",
    poor: "差",
    warningsInsights: "警告和洞察",
    analysisDetails: "分析详情",
    conversations: "对话",
    messages: "消息",
    totalWords: "总词数",
    trigger: "触发",
    trendsOverTime: "随时间趋势",
    overallHealth: "整体健康",
    analyses: "分析",
    trendAnalysisComingSoon: "趋势分析即将推出",
    analysisResultsAvailable: "分析结果可用",
    basedOn: "基于",
    analysisResultsOver: "分析结果超过",
    loadFailed: "加载医学分析结果失败",
    triggerFailed: "触发医学分析失败",
    triggerSuccess: "医学分析成功触发。结果将在大约10秒内显示。",
    disclaimer: "此分析仅供参考，不能替代专业医疗建议、诊断或治疗。如有医疗问题，请始终咨询合格的医疗保健提供者。",
    overview: "概览",
    confidence: "信心",
    noDataAvailable: "没有可用于分析的数据",
    insufficientDataWarning: "可用数据有限：已分析 {{current}} 次通话。为了更可靠的分析，建议在更长的时间内进行 {{minimum}} 次或更多次通话，以更好地了解客户模式。",
    analysisWillAppearAfterCalls: "通话完成后，分析结果将显示在此处。",
    keyIndicators: "关键指标",
    fillerWords: "填充词",
    vagueReferences: "模糊引用",
    temporalConfusion: "时间混淆",
    wordFinding: "找词困难",
    repetition: "重复得分",
    informationDensity: "信息密度",
    depressionScore: "抑郁得分",
    anxietyScore: "焦虑得分",
    emotionalTone: "情绪基调",
    negativeRatio: "负面比率",
    protectiveFactors: "保护因素",
    typeTokenRatio: "词汇多样性",
    avgWordLength: "平均词长",
    avgSentenceLength: "平均句长",
    uniqueWords: "独特词汇",
    crisisIndicators: "检测到危机指标 - 建议立即进行专业评估",
    cognitiveInterpretation: {
      normal: "沟通模式似乎正常，未检测到明显的认知问题。",
      mildConcern: "检测到沟通模式的一些轻微变化。监测进展情况。",
      moderateConcern: "观察到沟通模式的中度变化。考虑进行专业评估。",
      significantConcern: "检测到沟通模式的显著变化。强烈建议进行专业评估。",
    },
    psychiatricInterpretation: {
      stable: "心理健康指标似乎稳定，没有明显问题。",
      mildConcern: "检测到一些轻微的心理健康指标。继续监测。",
      moderateConcern: "观察到中度的心理健康指标。考虑进行专业咨询。",
      significantConcern: "检测到显著的心理健康指标。建议进行专业咨询。",
      crisis: "检测到危机指标。强烈建议立即进行专业干预。",
    },
    vocabularyInterpretation: {
      strong: "语言复杂性和词汇使用似乎很强且维护良好。",
      average: "语言复杂性和词汇使用在正常范围内。",
      limited: "语言复杂性和词汇使用似乎有限。监测变化。",
    },
  },
  signupScreen: {
    title: "完成您的邀请",
    fullNameLabel: "全名",
    fullNamePlaceholder: "您的全名",
    emailLabel: "电子邮件地址",
    emailPlaceholder: "your.email@example.com",
    phoneLabel: "电话号码",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "密码",
    passwordPlaceholder: "输入您的密码",
    confirmPasswordLabel: "确认密码",
    confirmPasswordPlaceholder: "确认您的密码",
    completeRegistration: "完成注册",
    preconfiguredMessage: "您的姓名、电子邮件和组织详细信息已由您的管理员预先配置。",
  },
  homeScreen: {
    welcome: "欢迎，{{name}}",
    guest: "访客",
    addClient: "添加客户",
    adminOnlyMessage: "只有组织管理员和超级管理员可以添加客户",
    noClientsFound: "未找到客户",
    viewSchedules: "查看日程",
    noScheduleWarning: "⚠ 未设置日程",
    glanceAlerts: "提醒",
    glanceHintAlertsTitle: "此客户的提醒",
    glanceHintAlertsBody: "您的提醒列表中有多少条与此住户关联（例如客户、对话或日程提醒）。请打开「提醒」标签查看或处理。未关联客户的提醒不计入此处。",
    glanceAlertsA11y: "此客户关联 {{count}} 条提醒",
    glanceSentimentActionHint: "在报告中打开最近一次通话的情绪分析。",
    glanceHealthActionHint: "在报告中打开此客户的健康分析报告。",
    glanceRiskActionHint: "在报告中打开此客户的欺诈与安全报告。",
    glanceAlertsActionHint: "打开仅显示此客户的提醒列表。",
    glanceHealth: "健康",
    glanceHealthA11y: "健康评分 {{score}}，满分 100",
    glanceHintButtonA11y: "关于{{label}}",
    glanceHintHealthBody: "来自最新医疗对话分析的综合健康评分（0–100，分数越高越好）。结合通话中的认知及情绪相关语言模式等信号。不能替代临床判断或完整健康报告。",
    glanceHintHealthTitle: "健康评分",
    glanceHintRiskBody: "来自最新欺诈与安全分析的综合风险评分（0–100，分数越高表示越需关注）。反映有关金钱、安全、孤立等话题的表达模式。详情请查看欺诈与滥用报告。",
    glanceHintRiskTitle: "风险评分",
    glanceHintSentimentBody: "近期已分析通话（约最近 30 天）中客户语气概况。上升、稳定或下降是将较新通话与稍早通话对比，并非诊断——详情请查看完整情绪分析报告。",
    glanceHintSentimentTitle: "情绪趋势",
    glanceNoData: "—",
    glanceRisk: "风险",
    glanceRiskA11y: "风险评分 {{score}}，满分 100",
    glanceSentiment: "情绪",
    lastAnsweredCall: "上次接听通话",
    lastCalled: "上次呼叫",
    neverCalled: "从未",
    noAnsweredCallsYet: "尚无已接听通话",
    sentimentTrendDeclining: "下降",
    sentimentTrendImproving: "上升",
    sentimentTrendStable: "稳定",
  },
  tabs: {
    home: "首页",
    org: "组织",
    reports: "报告",
    alerts: "提醒",
  },
  onboarding: {
    howItWorks: {
      title: "Bianca 如何运作",
      next: "下一步",
      getStarted: "开始使用",
      organization: "添加您的客户，安排 Bianca 何时给他们打电话，并在一处查看对话和报告。Bianca 负责处理通话，让您专注于护理。",
      caregiver: "添加您照顾的人，选择 Bianca 何时给他们打电话，通过对话和报告了解他们的近况。您无需参与每次通话也能掌握情况。",
      agingInPlace: "Bianca 按您的日程致电进行友好问候。您可随时查看自己的健康和报告。就像有一位在您需要时总在身边的伙伴。",
    },
    registration: {
      title: "您的资料",
      subtitle: "确认您的信息并接受条款以继续。",
      nameRequired: "姓名为必填项。",
      emailRequired: "电子邮箱为必填项。",
      termsRequired: "您必须接受服务条款和隐私政策才能继续。",
    },
    aboutYou: {
      agingInPlace: "居家养老",
      caregiver: "护理员",
      organization: "机构",
      subtitle: "这有助于我们为您定制体验。",
      title: "请简单介绍一下您",
    },
    orgInfo: {
      countryLabel: "国家/地区",
      orgNameLabel: "机构名称",
      orgNamePlaceholder: "输入您的机构名称",
      subtitle: "请介绍一下您的机构。",
      timezoneLabel: "时区",
      title: "机构信息",
    },
    termsAndConsent: {
      acceptTerms: "我已阅读并接受",
      acceptTermsLabel: "接受服务条款和隐私政策",
      and: "和",
      no: "否",
      privacyLink: "隐私政策",
      saveAndContinue: "保存并继续",
      singleConsentQuestion: "您所在地区是否为单方同意州/地区？（仅需一方同意即可录音。）",
      termsLink: "服务条款",
      title: "条款与同意",
      whyImportant: "为什么这很重要？",
      whyImportantBody: "通话录音法律因州和国家而异。在单方同意地区，只需一人同意录音；在双方同意地区，通话各方均须同意。正确设置有助于您和机构合规。",
      yes: "是",
    },
  },
  themes: {
    healthcare: {
      name: "医疗保健",
      description: "专业的医疗主题，采用蓝色和绿色",
    },
    colorblind: {
      name: "色盲友好",
      description: "专为色觉缺陷优化的高对比度主题",
    },
    dark: {
      name: "深色模式",
      description: "专为低光环境优化的深色主题",
    },
    accessibility: {
      wcagLevel: "WCAG级别",
      colorblindFriendly: "色盲友好",
      highContrast: "高对比度",
      darkMode: "深色模式",
    },
    highcontrast: {
      description: "为视力障碍提供最大对比度的主题（WCAG AAA）",
      name: "高对比度",
    },
  },
  privacyPracticesScreen: {
    content: `# 隐私实践通知
## MyPhoneFriend 医疗通信服务

**生效日期**：2025年10月15日

---

## 您的信息。您的权利。我们的责任。

**本通知描述了您的医疗信息可能如何被使用和披露，以及您如何获取此信息。请仔细阅读。**

---

## 您的权利

您有权：
- 获取您的健康信息副本
- 更正您的健康信息
- 要求保密通信
- 要求我们限制我们共享的信息
- 获取我们已共享您信息的对象列表
- 获取此隐私通知的副本
- 选择某人代表您行事
- 如果您认为您的隐私权受到侵犯，可以提出投诉

---

## 您的选择

在我们执行以下操作时，您对信息的使用和共享方式有一些选择：
- 回答您的家人和朋友关于您护理的问题
- 在灾难救援情况下提供关于您的信息

**我们绝不会为营销或出售您的数据而共享您的信息。**

---

# 您的详细权利

## 获取您的健康信息副本

**您可以要求查看或获取您的健康信息副本。**

您可以请求的内容：
- 通话录音和转录
- 健康摘要和AI分析结果
- 我们系统生成的医疗警报
- 紧急通知
- 账户信息和偏好设置

**如何请求**：
- 电子邮件：privacy@biancawellness.com
- 电话：+1-604-562-4263

**我们的回复**：30天内

---

## 要求我们更正您的健康信息

**您可以要求我们更正您认为不正确或不完整的健康信息。**

**我们的回复**：60天内

---

## 要求保密通信

**您可以要求我们以特定方式或地点与您联系。**

示例：
- "请通过电子邮件联系我，而不是打电话"
- "请仅通过我的手机联系我"

我们将满足所有合理的要求。

---

## 要求我们限制我们使用或共享的内容

**您可以要求我们不要使用或共享某些健康信息。**

如果您全额自付费用并要求我们不要与您的健康计划共享，我们必须同意。

---

## 获取披露列表

**您可以要求"披露账目"** - 我们共享您健康信息的次数列表。

涵盖：过去6年  
排除：用于治疗、付款和运营的披露（除非您要求）

---

## 提出投诉

**向我们提出**：
- 电子邮件：privacy@biancawellness.com
- 电话：+1-604-562-4263

**向HHS提出**：
- 网站：https://www.hhs.gov/hipaa/filing-a-complaint
- 电话：1-800-368-1019

**我们不会因您提出投诉而进行报复。**

---

# 我们的使用和披露

## 我们如何使用您的健康信息

**用于治疗**：
- 向您的护理人员提供AI健康摘要
- 为紧急情况生成紧急警报
- 使护理人员能够监控您的健康状况
- 促进与您的护理团队的沟通

**用于付款**：
- 向您的医疗组织开具服务账单
- 处理通话时间和分析发票

**用于医疗运营**：
- 改进我们的AI检测算法
- 质量保证和改进
- 培训我们的系统以更好地为客户服务

---

## 我们与谁共享

**您的医疗组织**：
- 您指定的护理人员和护理协调员
- 负责计费的组织管理员

**业务伙伴**（服务提供商）：
- AI服务（Azure OpenAI）：用于转录和分析
- 语音服务（Twilio）：用于电话处理
- 云托管（AWS）：用于安全数据存储
- 数据库（MongoDB Atlas）：用于数据管理

所有业务伙伴都签署了业务伙伴协议，必须保护您的信息。

**法律要求**：
- 如果检测到紧急情况，紧急服务（911）
- 公共卫生当局（虐待、忽视报告）
- 执法部门（具有有效法律命令）

**我们不**：
- ❌ 出售您的健康信息
- ❌ 与营销人员或广告商共享
- ❌ 未经您授权用于营销
- ❌ 在社交媒体上共享

---

# 我们收集的健康信息

**在使用我们的服务期间**：
- 客户姓名、电话号码、出生日期
- 通话录音和转录
- 通话中的健康相关信息（症状、药物、情绪）
- 紧急警报和事件
- 健康趋势和模式
- 护理人员笔记和观察
- AI的医疗分析结果

---

# 您的责任

**如果您使用我们的服务致电另一个人**，您有责任：
- 获得录音的必要同意
- 确保他们理解服务
- 遵守适用的录音同意法律

---

# 违规通知

**如果您的健康信息被不当访问或披露**，我们将：
- 调查事件
- 如果是可报告的违规行为，在60天内通知您
- 解释发生了什么以及我们正在做什么
- 提供您可以采取的步骤信息

---

# 本通知的变更

- 我们可能会更改本通知，变更将适用于我们拥有的所有信息
- 新通知将在应用程序和我们的网站上提供
- 您可以随时请求当前副本

---

# 联系信息

**隐私官**：
- 电子邮件：privacy@biancawellness.com
- 电话：+1-604-562-4263
- 邮件：MyPhoneFriend隐私办公室，2955 Elbow Place，Port Coquitlam，BC V3B 7T3

**工作时间**：周一至周五，上午9点至下午5点（太平洋标准时间）

---

# 提出投诉

**向我们提出**：
- 电子邮件：privacy@biancawellness.com
- 电话：+1-604-562-4263

**向联邦政府（HHS）提出**：
- 网站：https://www.hhs.gov/hipaa/filing-a-complaint
- 电话：1-800-368-1019
- 邮件：美国卫生与公众服务部民权办公室，200 Independence Avenue S.W.，Washington，D.C. 20201

---

**生效日期**：2025年10月15日  
**版本**：1.0

本隐私实践通知符合HIPAA隐私规则（45 CFR §164.520）

---

## 语言协助

**英语**：如果您需要帮助理解本通知，请联系privacy@biancawellness.com

**Español**：Si necesita ayuda，comuníquese con privacy@biancawellness.com`,
  },
  mfa: {
    setupTitle: "多因素身份验证",
    setupSubtitle: "为您的账户添加额外的安全层",
    setupInstructions: "使用您的身份验证器应用扫描二维码，然后输入代码进行验证。",
    verificationTitle: "双因素身份验证",
    verificationSubtitle: "输入来自您的身份验证器应用的6位数字代码",
    tokenLabel: "验证代码",
    tokenPlaceholder: "000000",
    pleaseEnterVerificationCode: "请输入来自您的身份验证器应用的验证代码",
    verifyButton: "验证",
    useBackupCode: "使用备份代码",
    verifyAndEnable: "验证并启用",
    enable: "启用MFA",
    enableMFA: "启用多因素身份验证",
    manageMFA: "管理多因素身份验证",
    disable: "禁用MFA",
    disableTitle: "禁用MFA",
    disableSubtitle: "输入您当前的MFA代码以禁用多因素身份验证",
    disableConfirmTitle: "禁用MFA？",
    disableConfirmMessage: "您确定要禁用多因素身份验证吗？这将降低您账户的安全性。",
    enabled: "已启用",
    disabled: "已禁用",
    enabledSuccess: "多因素身份验证已成功启用。",
    disabledSuccess: "多因素身份验证已禁用。",
    status: "状态",
    enrolledOn: "注册于",
    backupCodesRemaining: "剩余备份代码",
    backupCodesTitle: "备份代码",
    backupCodesWarning: "请将这些代码保存在安全的位置。如果您丢失了身份验证器设备，可以使用它们访问您的账户。",
    backupCodeLength: "备份代码为8个字符",
    regenerateBackupCodes: "重新生成备份代码",
    regenerateBackupCodesTitle: "重新生成备份代码？",
    regenerateBackupCodesSubtitle: "输入您当前的MFA代码以生成新的备份代码",
    regenerateBackupCodesMessage: "您的旧备份代码将不再有效。请确保安全保存新代码。",
    regenerate: "重新生成",
    backupCodesRegenerated: "备份代码已重新生成",
    backupCodesRegeneratedMessage: "您的新备份代码已生成。请安全保存它们。",
    secretLabel: "或手动输入此密钥：",
    invalidTokenLength: "请输入6位数字代码",
    verificationFailed: "代码无效。请重试。",
    enableFailed: "启用MFA失败",
    disableFailed: "禁用MFA失败。请检查您的代码。",
    regenerateFailed: "重新生成备份代码失败。",
  },
  callScreen: {
    onboardingNextRegular: "入门引导结束后，健康检查将使用常规健康随访格式。",
    onboardingNextWillBe: "在完成入门引导之前，下一次外呼将继续入门引导（第 {{day}} 次会话）。",
    onboardingProgress: "已完成 {{completed}}/{{total}} 次入门引导会话。",
    onboardingThisCall: "本次通话为第 {{day}}/{{total}} 次入门引导会话。住户接听并完成会话后，流程才会推进。",
    onboardingTitle: "住户入门引导",
    title: "通话",
    noClientSelected: "未选择客户",
    callWith: "与 {{name}} 通话",
    callDetails: "通话详情",
    clientLabel: "客户：",
    phoneLabel: "电话：",
    statusLabel: "状态：",
    liveIndicator: "实时",
    aiSpeaking: "AI 正在说话...",
    userSpeaking: "用户正在说话...",
  },
  caregiverInvitedScreen: {
    continue: "继续",
    message: "护理人员邀请已成功发送。",
    title: "邀请已发送！",
    subMessage: "They will receive an email with instructions to complete their registration.",
  },
  confirmResetScreen: {
    backToLogin: "返回登录",
    codeFieldLabel: "重置代码",
    codeFieldPlaceholder: "输入您的重置代码",
    confirmPasswordFieldLabel: "确认新密码",
    confirmPasswordFieldPlaceholder: "确认您的新密码",
    confirmPasswordLabel: "确认新密码",
    confirmPasswordPlaceholder: "确认您的新密码",
    confirmReset: "确认重置",
    newPasswordFieldLabel: "新密码",
    newPasswordFieldPlaceholder: "输入您的新密码",
    newPasswordLabel: "新密码",
    newPasswordPlaceholder: "输入您的新密码",
    redirecting: "正在跳转到登录...",
    requestFailed: "密码重置失败。请检查您的代码后重试。",
    resetPasswordButton: "重置密码",
    subtitle: "请在下方输入新密码。请确保密码安全且便于您记忆。",
    successMessage: "您的密码已更新。您现在可以使用新密码登录。",
    successMessageShort: "您的密码已成功重置！",
    successTitle: "密码重置成功！",
    title: "重置您的密码",
  },
  emailVerificationFailedPage: {
    helpExpired: "出于安全考虑，验证链接在 24 小时后失效。",
    helpGeneric: "如您认为这是错误，请联系支持团队。",
    loginButton: "前往登录",
    messageExpired: "此验证链接已过期。请申请新的验证电子邮件。",
    messageInvalid: "此验证链接无效或已被使用。",
    title: "验证失败",
  },
  orgScreen: {
    alertOnAllMissedCallsHelper: "对每次未接来电及重试尝试发送提醒",
    alertOnAllMissedCallsLabel: "所有未接来电均提醒",
    callRetrySettings: "通话重试设置",
    clientConsentSettings: "客户同意设置",
    country: "国家/地区",
    countryHelper: "选择您机构所在国家/地区，有助于确定适用的隐私法规。",
    emailPlaceholder: "电子邮件",
    enableRetriesHelper: "启用后，系统将自动重试失败的通话",
    enableRetriesLabel: "启用通话重试",
    inviteCaregiver: "邀请护理员",
    namePlaceholder: "机构名称",
    noLogoSet: "未设置徽标",
    organizationActions: "机构操作",
    organizationLogo: "机构徽标",
    payments: "付款",
    phonePlaceholder: "电话",
    retryCountHelper: "未接听时的重试次数（1–5）",
    retryCountLabel: "通话重试次数",
    retryIntervalMinutesHelper: "重试间隔等待时间（1–60 分钟，默认：15）",
    retryIntervalMinutesLabel: "重试间隔（分钟）",
    save: "保存",
    timezone: "时区",
    timezoneHelper: "选择您机构的时区。日程时间将基于此设置。",
    viewCaregivers: "查看护理员",
  },
  phoneVerificationScreen: {
    codeResent: "验证码已重新发送！",
    codeSent: "验证码已发送！",
    didntReceiveCode: "没有收到验证码？",
    errorResendingCode: "重新发送验证码失败。请重试。",
    errorSendingCode: "发送验证码失败。请重试。",
    errorVerifyingCode: "验证码无效。请重试。",
    invalidCode: "请输入 6 位验证码",
    message: "我们已向 {{phone}} 发送 6 位验证码。请在下方输入。",
    resendAvailableIn: "可重新发送于",
    resendButton: "重新发送验证码",
    sendCodeButton: "发送验证码",
    title: "验证您的电话",
    verifyButton: "验证电话",
  },
  privacyRequestScreen: {
    accessMethodDownload: "下载",
    accessMethodEmail: "电子邮件",
    accessMethodInfo: "您的数据将以 JSON 附件形式通过电子邮件发送给您。",
    accessMethodLabel: "您希望如何接收数据？",
    additionalInformationLabel: "补充信息（可选）",
    complaintDescriptionLabel: "说明 *",
    complaintDescriptionPlaceholder: "请详细说明您的投诉，包括发生的情况和时间。",
    complaintFieldsRequired: "请填写主题和说明。",
    complaintHistoryTitle: "投诉记录",
    complaintRequestDescription: "如您认为我们未按隐私法律处理您的个人信息，可提出投诉。我们将在 30 天内调查并回复。",
    complaintRequestTitle: "隐私投诉",
    complaintSubjectLabel: "主题 *",
    complaintSubjectPlaceholder: "简要描述您的投诉",
    complaintSubmitted: "您的投诉已提交。我们将在 30 天内调查并回复。",
    completedOn: "完成于",
    confirmDelete: "删除",
    correctionFieldLabel: "需更正的字段",
    correctionFieldPlaceholder: "例如：电子邮件、电话、姓名",
    correctionFieldsRequired: "请填写字段名称和请求的值。",
    correctionNote: "说明：大多数数据可在应用中直接编辑。对于无法编辑的数据（如历史日志或系统生成记录），请使用此表单。",
    correctionReasonLabel: "更正原因（可选）",
    correctionReasonPlaceholder: "为什么需要更正此信息？",
    correctionRequestDescription: "申请更正您的个人信息。请说明需要更正的内容。",
    correctionRequestSubmitted: "您的更正请求已提交。我们将在 30 天内审核并处理。",
    correctionRequestTitle: "数据更正请求",
    currentValue: "当前值",
    currentValueLabel: "当前值（可选）",
    currentValuePlaceholder: "当前值是什么？",
    deletionCompleted: "数据删除已成功完成。",
    deletionConfirmMessage: "这将永久删除您的数据。此操作无法撤销。确定要继续吗？",
    deletionConfirmTitle: "确认删除数据",
    deletionDataTypeLabel: "您希望删除哪些数据？",
    deletionFailed: "数据删除失败。由于法律保留要求，您所在司法管辖区可能无法提供此功能。",
    deletionRequestDescription: "根据 PIPEDA，您可以申请删除个人信息。说明：HIPAA 要求保留 7 年，因此并非所有司法管辖区均可删除。",
    deletionRequestTitle: "申请删除数据",
    deletionTypeAll: "全部数据",
    deletionTypeCalls: "仅通话",
    deletionTypeConversations: "仅对话",
    deletionTypeMedicalAnalysis: "仅医疗分析",
    field: "字段",
    filedOn: "提交于",
    informationRequestedLabel: "请求的信息",
    informationRequestedPlaceholder: "我的全部个人信息（或指定所需内容）",
    reason: "原因",
    requestDataDescription: "请说明您希望访问的信息。留空则请求您的全部个人信息。",
    requestDataTitle: "数据访问请求",
    requestDeletion: "申请删除数据",
    requestFailed: "提交请求失败。请重试。",
    requestHistoryTitle: "请求记录",
    requestSubmitted: "您的数据请求已提交。您将很快收到包含数据的电子邮件。",
    requestTypeAccess: "访问请求",
    requestTypeComplaint: "提出投诉",
    requestTypeCorrection: "更正请求",
    requestedOn: "请求于",
    requestedValue: "请求的值",
    requestedValueLabel: "请求的值 *",
    requestedValuePlaceholder: "更正后的值应是什么？",
    resolvedOn: "解决于",
    submitRequest: "提交请求",
    subtitle: "根据 PIPEDA，您有权访问和更正个人信息。请提交访问或更正数据的请求。",
    title: "申请我的数据",
    violationTypeAccess: "访问问题",
    violationTypeLabel: "问题类型（可选）",
    violationTypeOther: "其他",
  },
  scheduleScreen: {
    deleteSchedule: "删除日程",
    heading: "日程配置",
    saveSchedule: "保存日程",
  },
}

export default zh
