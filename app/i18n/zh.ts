import { Translations } from "./en"

const zh: Translations = {
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
    patient: "患者：",
    importance: "重要性：",
    expires: "过期：",
  },
  legalLinks: {
    privacyPolicy: "隐私政策",
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
  },
  emailVerifiedScreen: {
    title: "电子邮件已验证！",
    message: "您的 My Phone Friend 帐户已成功验证。",
    redirecting: "正在重定向到应用程序...",
  },
  conversationsScreen: {
    title: "对话",
    yesterday: "昨天",
    noMessages: "无消息",
    noPatientSelected: "未选择患者",
    firstConversation: "未找到之前的对话。这将是与此患者的第一次对话。",
    noConversationsToDisplay: "无对话可显示",
    noPreviousConversations: "未找到此患者的之前对话",
    errorFetchingConversations: "获取对话时出错",
    loadingMoreConversations: "加载更多对话...",
  },
  patientScreen: {
    nameLabel: "姓名 *",
    namePlaceholder: "输入患者姓名",
    emailLabel: "电子邮件 *",
    emailPlaceholder: "输入电子邮件地址",
    phoneLabel: "电话 *",
    phonePlaceholder: "输入电话号码",
    preferredLanguageLabel: "首选语言",
    updatePatient: "更新患者",
    createPatient: "创建患者",
    manageSchedules: "管理日程",
    manageConversations: "管理对话",
    viewSentimentAnalysis: "查看情感分析",
    manageCaregivers: "管理护理人员",
    confirmDelete: "确认删除",
    deletePatient: "删除患者",
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
    patients: "患者",
    patient: "患者",
    chargesByPatient: "按患者收费",
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
    contactAdministrator: "联系你的管理员获取访问权限。",
    amount: "金额：",
    invoiceNumber: "发票号：",
    issueDate: "签发日期：",
    dueDate: "到期日期：",
    notes: "备注：",
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
  },
  reportsScreen: {
    selectPatient: "选择患者：",
    choosePatient: "选择一个患者...",
    sentiment: "情感",
    medicalAnalysis: "医学分析",
    comingSoon: "即将推出",
    modalTitle: "选择患者",
    modalCancel: "取消",
  },
  schedulesScreen: {
    scheduleDetails: "日程详情",
    selectSchedule: "选择一个日程：",
    scheduleNumber: "日程",
    noSchedulesAvailable: "无可用日程。请创建新的。",
    errorLoadingSchedules: "加载日程时出错。",
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
  },
  conversationsScreen: {
    title: "对话",
    yesterday: "昨天",
    noMessages: "无消息",
    noPatientSelected: "未选择患者",
    firstConversation: "未找到之前的对话。这将是与此患者的第一次对话。",
    noConversationsToDisplay: "无对话可显示",
    noPreviousConversations: "未找到此患者的之前对话",
    errorFetchingConversations: "获取对话时出错",
    loadingMoreConversations: "加载更多对话...",
  },
  caregiverScreen: {
    namePlaceholder: "姓名",
    emailPlaceholder: "电子邮件",
    phonePlaceholder: "电话",
    loadingUnassignedPatients: "加载未分配的患者...",
    assigningPatients: "分配患者中...",
    patientsAssignedSuccess: "患者已成功分配！",
    loadingCaregivers: "加载护理人员...",
  },
  caregiversScreen: {
    invited: "已邀请",
    edit: "编辑",
    noCaregiversFound: "未找到护理人员",
    notAuthorized: "未授权",
    noPermissionToView: "你没有权限查看护理人员",
    addCaregiver: "添加护理人员",
  },
  sentimentAnalysis: {
    lastCall: "上次通话",
    last30Days: "最近30天",
    allTime: "全部时间",
    noPatientSelected: "未选择患者",
    selectPatientToView: "请从主屏幕选择一个患者以查看其情感分析。",
    patientSentimentAnalysis: "患者情感分析",
    emotionalWellnessInsights: "情感健康洞察和趋势",
    timeRange: "时间范围：",
    noSentimentDataAvailable: "无情感数据可用",
    noSentimentDataMessage: "患者完成对话后，情感分析将显示在这里。",
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
    patientMood: "患者情绪",
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
    patientMoodAssessment: "患者情绪评估",
    concernLevel: "关注级别",
    satisfactionIndicators: "满意度指标",
    positiveIndicators: "积极指标",
    areasOfConcern: "关注领域",
    aiSummary: "AI摘要",
    recommendations: "建议",
    lowConcernDescription: "低关注级别 - 患者似乎很好。",
    mediumConcernDescription: "中等关注级别 - 建议跟进。",
    highConcernDescription: "高关注级别 - 需要立即关注。",
    debugComplete: "调试完成",
    debugFailed: "调试失败",
    noPatient: "无患者",
    pleaseSelectPatient: "请先选择一个患者",
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
    currentPatient: "当前患者",
    noPatientSelected: "未选择患者",
    debugResults: "调试结果",
    totalConversations: "总对话数",
    withoutSentiment: "无情感",
    successfullyAnalyzed: "成功分析",
    failedAnalyses: "失败分析",
    conversationDetails: "对话详情",
    messages: "消息",
    sentiment: "情感",
    score: "分数",
    mood: "情绪",
    emotions: "情感",
    concernLevel: "关注级别",
    failed: "失败",
    noAnalysisPerformed: "未执行分析",
  },
  headers: {
    home: "首页",
    patient: "患者",
    schedule: "日程",
    conversations: "对话",
    call: "通话",
    alerts: "提醒",
    logout: "退出登录",
  },
  medicalAnalysis: {
    title: "医学分析",
    error: "错误",
    success: "成功",
    noPatientSelected: "未选择患者",
    selectPatientToView: "请选择一个患者以查看医学分析",
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
    addPatient: "添加患者",
    adminOnlyMessage: "只有组织管理员和超级管理员可以添加患者",
    noPatientsFound: "未找到患者",
    viewSchedules: "查看日程",
  },
  tabs: {
    home: "首页",
    org: "组织",
    reports: "报告",
    alerts: "提醒",
  },
  headers: {
    home: "首页",
    patient: "患者",
    schedule: "日程",
    conversations: "对话",
    call: "通话",
    profile: "个人资料",
    logout: "退出登录",
    alerts: "提醒",
    organization: "组织",
    caregivers: "护理员",
    caregiver: "护理员",
    caregiverInvited: "护理员已邀请",
    payments: "付款",
    reports: "报告",
    sentimentAnalysis: "情感分析",
    medicalAnalysis: "医学分析",
    privacyPolicy: "隐私政策",
    termsOfService: "服务条款",
    mentalHealthReport: "心理健康报告",
    login: "登录",
    register: "注册",
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
- 电子邮件：privacy@myphonefriend.com
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
- 电子邮件：privacy@myphonefriend.com
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
- 培训我们的系统以更好地为患者服务

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
- 患者姓名、电话号码、出生日期
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
- 电子邮件：privacy@myphonefriend.com
- 电话：+1-604-562-4263
- 邮件：MyPhoneFriend隐私办公室，2955 Elbow Place，Port Coquitlam，BC V3B 7T3

**工作时间**：周一至周五，上午9点至下午5点（太平洋标准时间）

---

# 提出投诉

**向我们提出**：
- 电子邮件：privacy@myphonefriend.com
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

**英语**：如果您需要帮助理解本通知，请联系privacy@myphonefriend.com

**Español**：Si necesita ayuda，comuníquese con privacy@myphonefriend.com`,
  },
}

export default zh
