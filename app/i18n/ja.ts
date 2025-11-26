import { Translations } from "./en"

const ja: Translations = {
  common: {
    ok: "OK",
    cancel: "キャンセル",
    close: "閉じる",
    error: "エラー",
    anErrorOccurred: "エラーが発生しました",
    back: "戻る",
    logOut: "ログアウト",
    selectImage: "画像を選択",
    calling: "通話中...",
    callNow: "今すぐ通話",
    ending: "終了中...",
    endCall: "通話終了",
    loading: "読み込み中...",
  },
  alertScreen: {
    markAllAsRead: "すべて既読にする",
    unreadAlerts: "未読アラート",
    allAlerts: "すべてのアラート",
    noAlerts: "アラートなし",
    noAlertsTitle: "すべて完了！",
    noAlertsSubtitle: "未読のアラートはありません。最新の状態を保つ良い仕事をしました！",
    emptyHeading: "空っぽ...悲しい",
    refreshing: "更新中...",
    refresh: "更新",
    patient: "患者：",
    importance: "重要度：",
    expires: "期限：",
  },
  legalLinks: {
    privacyPolicy: "プライバシーポリシー",
    privacyPractices: "HIPAAプライバシー慣行",
    termsOfService: "利用規約",
  },
  welcomeScreen: {
    postscript: "psst — これはおそらくあなたのアプリの見た目ではありません。（デザイナーがこれらの画面をくれた場合を除いて、その場合は本番にデプロイしてください！）",
    readyForLaunch: "あなたのアプリ、ほぼ起動準備完了！",
    exciting: "（おお、これは興奮します！）",
    letsGo: "始めましょう！",
  },
  errorScreen: {
    title: "何かが間違っています！",
    friendlySubtitle: "エラーが発生しました。デザインもカスタマイズしたいでしょう（`app/screens/ErrorScreen`）。これを完全に削除したい場合は、`app/app.tsx`の<ErrorBoundary>コンポーネントを確認してください。",
    reset: "アプリをリセット",
    traceTitle: "エラースタック %{name}",
  },
  emptyStateComponent: {
    generic: {
      heading: "空っぽ...悲しい",
      content: "まだデータが見つかりません。ボタンをクリックして更新またはアプリを再読み込みしてみてください。",
      button: "もう一度試してみましょう",
    },
  },
  errors: {
    invalidEmail: "無効なメールアドレスです。",
  },
  loginScreen: {
    signIn: "サインイン",
    register: "登録",
    enterDetails: "秘密の情報をアンロックするために、以下に詳細を入力してください。私たちが何を用意しているか、あなたは決して推測できないでしょう。または、そうかもしれません；ここではロケット科学ではありません。",
    emailFieldLabel: "メール",
    passwordFieldLabel: "パスワード",
    emailFieldPlaceholder: "メールアドレスを入力してください",
    passwordFieldPlaceholder: "ここに超秘密パスワード",
    forgotPassword: "パスワードを忘れましたか？",
    hint: "ヒント：任意のメールアドレスとお気に入りのパスワードを使用できます :)",
    appName: "Bianca",
    tagline: "ウェルネスチェックコミュニケーション",
  },
  logoutScreen: {
    logoutButton: "ログアウト",
    logoutMessage: "本当によろしいですか？",
  },
  registerScreen: {
    title: "登録",
    nameFieldLabel: "名前",
    emailFieldLabel: "メール",
    phoneFieldLabel: "電話",
    passwordFieldLabel: "パスワード",
    goBack: "戻る",
    confirmPasswordFieldLabel: "パスワード確認",
    organizationNameFieldLabel: "組織名",
    nameFieldPlaceholder: "名前を入力してください",
    emailFieldPlaceholder: "メールアドレスを入力してください",
    passwordFieldPlaceholder: "パスワードを入力してください",
    confirmPasswordFieldPlaceholder: "パスワードを確認してください",
    organizationNameFieldPlaceholder: "組織名を入力してください",
    organizationButton: "組織",
    individualButton: "個人",
    individualExplanation: "個人利用のために個人として登録します。",
    organizationExplanation: "会社またはグループ利用のために組織として登録します。",
    consentText: "登録することで、以下に同意します",
    consentAnd: "と",
    termsOfService: "利用規約",
    privacyPolicy: "プライバシーポリシー",
    signUp: "登録",
    signIn: "サインイン",
    alreadyHaveAccount: "すでにアカウントをお持ちですか？",
    dontHaveAccount: "アカウントをお持ちでないですか？",
    termsAndConditions: "利用規約",
    agreeToTerms: "登録することで、以下に同意します",
    and: "と",
  },
  requestResetScreen: {
    title: "パスワードリセットをリクエスト",
    emailFieldLabel: "メール",
    emailFieldPlaceholder: "メールアドレスを入力してください",
    requestReset: "リセットをリクエスト",
    successMessage: "リセットコードがメールに送信されました！",
    requestFailed: "リクエストが失敗しました。メールを確認して再試行してください。",
  },
  ssoLinkingScreen: {
    title: "アカウントをリンク",
    message: "このアカウントは {{provider}} で作成されました。メール/パスワードでログインするには、以下でパスワードを設定するか、{{provider}} で続行してください。",
    passwordLabel: "パスワード",
    passwordPlaceholder: "パスワードを入力してください",
    confirmPasswordLabel: "パスワードを確認",
    confirmPasswordPlaceholder: "パスワードを確認してください",
    setPasswordButton: "パスワードを設定",
    backToLoginButton: "ログインに戻る",
    orDivider: "または",
    successMessage: "✓ パスワードが正常に設定されました！メールとパスワードでログインできるようになりました。",
    errorNoPassword: "パスワードを入力してください",
    errorNoConfirmPassword: "パスワードを確認してください",
    errorPasswordMismatch: "パスワードが一致しません",
    errorPasswordTooShort: "パスワードは8文字以上である必要があります",
    errorSetPasswordFailed: "パスワードの設定に失敗しました",
    errorSSOFailed: "SSOログインに失敗しました。もう一度お試しください。",
    providerGoogle: "Google",
    providerMicrosoft: "Microsoft",
    providerSSO: "SSO",
  },
  ssoButtons: {
    orContinueWith: "または続行",
    google: "Google",
    microsoft: "Microsoft",
    continueWithGoogle: "Googleで続行",
    continueWithMicrosoft: "Microsoftで続行",
    companySSO: "企業SSO",
    ssoNotAvailable: "SSOは利用できません",
    signInFailed: "サインインに失敗しました",
    companySSOTitle: "企業SSO",
    companySSOMessage: "これは企業のSSOプロバイダーにリダイレクトされます。設定については管理者にお問い合わせください。",
  },
  emailVerificationScreen: {
    title: "メールを確認してください",
    message: "確認リンクをメールアドレスに送信しました。ログインする前に、リンクをクリックしてアカウントを確認してください。",
    emailFieldLabel: "メールアドレス",
    emailFieldPlaceholder: "メールアドレスを入力してください",
    resendButton: "確認メールを再送信",
    backToLoginButton: "ログインに戻る",
    successMessage: "✓ 確認メールを送信しました！受信箱を確認してください。",
    errorNoEmail: "メールアドレスを入力してください",
    errorSendFailed: "確認メールの送信に失敗しました",
  },
  emailVerifiedScreen: {
    title: "メール認証済み！",
    message: "My Phone Friendアカウントが正常に認証されました。",
    redirecting: "アプリにリダイレクトしています...",
  },
  phoneVerificationBanner: {
    title: "電話番号を確認してください",
    message: "緊急アラートと重要な通知を受信するには、電話番号を確認してください。",
    verifyButton: "今すぐ確認",
  },
  conversationsScreen: {
    title: "会話",
    yesterday: "昨日",
    noMessages: "メッセージなし",
    noPatientSelected: "患者が選択されていません",
    firstConversation: "以前の会話が見つかりません。これがこの患者との最初の会話になります。",
    noConversationsToDisplay: "表示する会話がありません",
    noPreviousConversations: "この患者の以前の会話が見つかりません",
    errorFetchingConversations: "会話の取得中にエラーが発生しました",
    loadingMoreConversations: "さらに会話を読み込み中...",
  },
  patientScreen: {
    nameLabel: "名前 *",
    namePlaceholder: "患者の名前を入力してください",
    emailLabel: "メール *",
    emailPlaceholder: "メールアドレスを入力してください",
    phoneLabel: "電話 *",
    phonePlaceholder: "電話番号を入力してください",
    preferredLanguageLabel: "優先言語",
    updatePatient: "患者を更新",
    createPatient: "患者を作成",
    manageSchedules: "スケジュールを管理",
    manageConversations: "会話を管理",
    viewSentimentAnalysis: "感情分析を表示",
    manageCaregivers: "介護者を管理",
    confirmDelete: "削除を確認",
    deletePatient: "患者を削除",
  },
  paymentScreen: {
    paid: "支払済み",
    pending: "保留中",
    overdue: "期限切れ",
    processing: "処理中",
    unknown: "不明",
    latestInvoice: "最新の請求書",
    paymentMethod: "支払い方法",
    currentChargesSummary: "現在の料金サマリー",
    basicPlan: "ベーシックプラン",
    contactSupport: "サポートに連絡",
    currentCharges: "現在の料金",
    paymentMethods: "支払い方法",
    billingInfo: "請求情報",
    noOrganizationData: "組織データが利用できません",
    authorizationTokenNotAvailable: "認証トークンが利用できません",
    errorLoadingCurrentCharges: "現在の料金の読み込み中にエラーが発生しました",
    noPendingCharges: "保留中の料金はありません",
    allConversationsBilled: "すべての会話が請求されました",
    totalUnbilledAmount: "未請求総額",
    period: "期間",
    lastDays: "過去 {days} 日",
    patients: "患者",
    patient: "患者",
    chargesByPatient: "患者別料金",
    average: "平均",
    noUserData: "ユーザーデータが利用できません",
    currentPlan: "現在のプラン",
    nextBillingDate: "次回請求日",
    totalBilledAmount: "請求総額",
    acrossInvoices: "{count} 件の請求書で",
    invoiceHistory: "請求書履歴 ({count})",
    hide: "非表示",
    show: "表示",
    history: "履歴",
    noInvoicesYet: "まだ請求書がありません",
    invoicesWillAppear: "請求書が生成されるとここに表示されます",
    loadingUserInformation: "ユーザー情報を読み込み中...",
    accessRestricted: "アクセス制限",
    accessRestrictedMessage: "支払い情報にアクセスする権限がありません。",
    // Payment methods / Stripe
    addPaymentMethod: "支払い方法を追加",
    loadingPaymentSystem: "支払いシステムを読み込み中...",
    loadingPaymentMethods: "支払い方法を読み込み中...",
    stripeConfigurationError: "Stripe設定エラー。サポートにお問い合わせください。",
    unsupportedPlatform: "サポートされていないプラットフォーム。ウェブブラウザまたはモバイルアプリを使用してください。",
    errorLoadingPaymentMethods: "支払い方法の読み込みエラー：",
    existingPaymentMethods: "既存の支払い方法",
    default: "デフォルト",
    setDefault: "デフォルトに設定",
    remove: "削除",
    addNewCard: "新しいカードを追加",
    deletePaymentMethod: "支払い方法を削除",
    deletePaymentMethodConfirm: "この支払い方法を削除してもよろしいですか？この操作は元に戻せません。",
    paymentMethodAddedSuccess: "支払い方法が正常に追加されました！",
    paymentMethodSetDefaultSuccess: "支払い方法が正常にデフォルトに設定されました！",
    paymentMethodDeletedSuccess: "支払い方法が正常に削除されました！",
    failedToSetDefault: "デフォルトの支払い方法の設定に失敗しました",
    failedToDelete: "支払い方法の削除に失敗しました",
    expires: "有効期限",
    mobilePaymentUnavailable: "モバイル支払いシステムが利用できません。ウェブ版を使用してください。",
    loadingMobilePayment: "モバイル支払いシステムを読み込み中...",
    anErrorOccurred: "エラーが発生しました",
    contactAdministrator: "アクセスについては管理者にお問い合わせください。",
    amount: "金額：",
    invoiceNumber: "請求書番号：",
    issueDate: "発行日：",
    dueDate: "支払期限：",
    notes: "備考：",
  },
  profileScreen: {
    languageSelector: "言語 / Language",
    selectLanguage: "言語を選択",
    theme: "テーマ",
    selectTheme: "テーマを選択",
    namePlaceholder: "名前",
    emailPlaceholder: "メール",
    phonePlaceholder: "電話",
    yourProfile: "あなたのプロフィール",
    updateProfile: "プロフィールを更新",
    logout: "ログアウト",
    profileUpdatedSuccess: "プロフィールが正常に更新されました！",
    profileUpdateFailed: "プロフィールの更新に失敗しました。再試行してください。",
    invalidPhoneFormat: "無効な電話番号形式（10桁または+1XXXXXXXXXX）",
    completeProfileTitle: "プロフィールを完成させる",
    completeProfileMessage: "続行する前に、電話番号を追加してプロフィールを完成させてください。",
    completeProfileMessageUnverified: "プロフィールを完成させ、すべての機能にアクセスするには、電話番号を追加してください。",
    errorUploadingAvatar: "アバターのアップロードエラー",
    emailVerified: "メール確認済み",
    emailNotVerified: "メール未確認",
    phoneVerified: "電話確認済み",
    phoneNotVerified: "電話未確認",
    verifyPhone: "電話を確認",
    fontSize: "フォントサイズ",
    fontSizeDescription: "読みやすさを向上させるためにテキストサイズを調整します。変更はすぐに適用されます。",
    decreaseFontSize: "フォントサイズを減らす",
    increaseFontSize: "フォントサイズを増やす",
    fontSizeHint: "フォントサイズを80%から200%に調整",
    telemetryOptIn: "匿名の使用データを共有",
    telemetryDescription: "匿名の使用データを共有してアプリの改善にご協力ください。個人情報は収集されません。",
    telemetryEnabled: "テレメトリが有効",
    telemetryDisabled: "テレメトリが無効",
  },
  fraudAbuseAnalysis: {
    title: "詐欺と虐待の分析",
    error: "エラー",
    success: "成功",
    noPatientSelected: "患者が選択されていません",
    selectPatientToView: "詐欺と虐待の分析を表示するには患者を選択してください",
    triggering: "トリガー中...",
    triggerAnalysis: "分析をトリガー",
    loadingResults: "分析結果を読み込み中...",
    noResultsAvailable: "分析結果が利用できません",
    triggerToGetStarted: "開始するには分析をトリガーしてください",
    analysisWillAppearAfterCalls: "分析結果は通話完了後にここに表示されます。",
    insufficientDataWarning: "利用可能なデータが限られています：{{current}} 件の通話を分析しました。より信頼性の高い分析のためには、患者のパターンをよりよく理解するために、より長い期間にわたって {{minimum}} 件以上の通話を推奨します。",
    loadFailed: "詐欺/虐待分析結果の読み込みに失敗しました",
    triggerFailed: "詐欺/虐待分析のトリガーに失敗しました",
    triggerSuccess: "詐欺/虐待分析が正常に完了しました。",
    disclaimer: "この分析は情報提供のみを目的としており、専門的な評価の代替ではありません。詐欺、虐待、または怠慢を疑う場合は、すぐに適切な当局に連絡してください。",
    overview: "概要",
    conversations: "会話",
    messages: "メッセージ",
    riskScore: "リスクスコア",
    financialRisk: "財務リスク",
    abuseRisk: "虐待リスク",
    relationshipRisk: "関係リスク",
    warnings: "警告",
    recommendations: "推奨事項",
    critical: "重大",
    high: "高",
    medium: "中",
    low: "低",
    largeAmountMentions: "大額の言及",
    transferMethodMentions: "送金方法の言及",
    scamIndicators: "詐欺指標",
    physicalAbuseScore: "身体的虐待スコア",
    emotionalAbuseScore: "感情的虐待スコア",
    neglectScore: "怠慢スコア",
    newPeopleCount: "新しい人の数",
    isolationCount: "孤立の数",
    suspiciousBehaviorCount: "疑わしい行動の数",
  },
  reportsScreen: {
    selectPatient: "患者を選択：",
    choosePatient: "患者を選択...",
    sentiment: "感情",
    medicalAnalysis: "医学的分析",
    fraudAbuseAnalysis: "詐欺と虐待",
    comingSoon: "近日公開",
    modalTitle: "患者を選択",
    modalCancel: "キャンセル",
  },
  schedulesScreen: {
    scheduleDetails: "スケジュール詳細",
    selectSchedule: "スケジュールを選択：",
    scheduleNumber: "スケジュール",
    noSchedulesAvailable: "利用可能なスケジュールがありません。新しいものを作成してください。",
    errorLoadingSchedules: "スケジュールの読み込み中にエラーが発生しました。",
  },
  scheduleComponent: {
    schedule: "スケジュール",
    startTime: "開始時間",
    frequency: "頻度",
    daily: "毎日",
    weekly: "毎週",
    monthly: "毎月",
    sunday: "日曜日",
    monday: "月曜日",
    tuesday: "火曜日",
    wednesday: "水曜日",
    thursday: "木曜日",
    friday: "金曜日",
    saturday: "土曜日",
    scheduleDetails: "スケジュール詳細",
    active: "アクティブ",
  },
  conversationsScreen: {
    title: "会話",
    yesterday: "昨日",
    noMessages: "メッセージなし",
    noPatientSelected: "患者が選択されていません",
    firstConversation: "以前の会話が見つかりません。これがこの患者との最初の会話になります。",
    noConversationsToDisplay: "表示する会話がありません",
    noPreviousConversations: "この患者の以前の会話が見つかりません",
    errorFetchingConversations: "会話の取得中にエラーが発生しました",
    loadingMoreConversations: "さらに会話を読み込み中...",
  },
  caregiverScreen: {
    namePlaceholder: "名前",
    emailPlaceholder: "メール",
    phonePlaceholder: "電話",
    loadingUnassignedPatients: "未割り当ての患者を読み込み中...",
    assigningPatients: "患者を割り当て中...",
    patientsAssignedSuccess: "患者の割り当てが完了しました！",
    loadingCaregivers: "介護者を読み込み中...",
  },
  caregiversScreen: {
    invited: "招待済み",
    edit: "編集",
    noCaregiversFound: "介護者が見つかりません",
    notAuthorized: "認証されていません",
    noPermissionToView: "介護者を表示する権限がありません",
    addCaregiver: "介護者を追加",
  },
  sentimentAnalysis: {
    lastCall: "最後の通話",
    last30Days: "過去30日",
    allTime: "全期間",
    noPatientSelected: "患者が選択されていません",
    selectPatientToView: "感情分析を表示するには、ホーム画面から患者を選択してください。",
    patientSentimentAnalysis: "患者感情分析",
    emotionalWellnessInsights: "感情的健康の洞察とトレンド",
    timeRange: "時間範囲：",
    noSentimentDataAvailable: "感情データが利用できません",
    noSentimentDataMessage: "患者が会話を完了すると、感情分析がここに表示されます。",
    loadingSentimentAnalysis: "感情分析を読み込み中...",
    sentimentAnalysisFooter: "感情分析は、AI技術を使用して各会話後に自動的に生成されます。",
    sentimentOverview: "感情概要",
    averageSentiment: "平均感情",
    trend: "トレンド",
    recentDistribution: "最近の分布",
    keyInsights: "主要な洞察",
    totalConversations: "総会話数",
    analysisCoverage: "分析カバレッジ",
    recentConversations: "最近の会話",
    analyzed: "分析済み",
    latestAnalysis: "最新の分析",
    conversationsAnalyzed: "会話が分析されました",
    recentConversationsTitle: "最近の会話",
    conversationsWithSentiment: "感情付き会話{0}",
    keyEmotions: "主要な感情",
    moreEmotions: "より多くの感情",
    patientMood: "患者の気分",
    concern: "懸念",
    confidence: "信頼",
    noSentimentAnalysisAvailable: "感情分析が利用できません",
    sentimentTrend: "感情トレンド",
    conversationsAnalyzedNoTrend: "会話{0}が分析されました{0}明確なトレンドなし",
    noSentimentData: "感情データなし",
    avg: "平均",
    negative: "ネガティブ",
    positive: "ポジティブ",
    lastCallAnalysis: "最後の通話分析",
    noRecentCall: "最近の通話なし",
    noRecentCallMessage: "分析する最近の通話がありません。通話が完了するとここに表示されます。",
    duration: "期間",
    analysisDate: "分析日",
    overallSentiment: "全体的な感情",
    scoreRange: "スコア範囲",
    analysisConfidence: "分析信頼度",
    keyEmotionsDetected: "検出された主要な感情",
    patientMoodAssessment: "患者気分評価",
    concernLevel: "懸念レベル",
    satisfactionIndicators: "満足度指標",
    positiveIndicators: "ポジティブ指標",
    areasOfConcern: "懸念領域",
    aiSummary: "AIサマリー",
    recommendations: "推奨事項",
    lowConcernDescription: "低懸念レベル - 患者は元気そうです。",
    mediumConcernDescription: "中懸念レベル - フォローアップが推奨されます。",
    highConcernDescription: "高懸念レベル - 即座の注意が必要です。",
    debugComplete: "デバッグ完了",
    debugFailed: "デバッグ失敗",
    noPatient: "患者なし",
    pleaseSelectPatient: "まず患者を選択してください",
    conversationDebugComplete: "会話デバッグ完了",
    sentimentAnalysisDebug: "感情分析デバッグ",
    debugSubtitle: "感情分析デバッグツール",
    debugging: "デバッグ中...",
    debugSentimentAnalysis: "感情分析をデバッグ",
    loading: "読み込み中...",
    debugConversationData: "会話データをデバッグ",
    testing: "テスト中...",
    testDirectApiCall: "直接API呼び出しをテスト",
    forceRefreshCache: "キャッシュを強制更新",
    cacheRefreshed: "キャッシュが更新されました",
    cacheRefreshedMessage: "キャッシュが正常に更新されました",
    currentPatient: "現在の患者",
    noPatientSelected: "患者が選択されていません",
    debugResults: "デバッグ結果",
    totalConversations: "総会話数",
    withoutSentiment: "感情なし",
    successfullyAnalyzed: "正常に分析されました",
    failedAnalyses: "失敗した分析",
    conversationDetails: "会話詳細",
    messages: "メッセージ",
    sentiment: "感情",
    score: "スコア",
    mood: "気分",
    emotions: "感情",
    concernLevel: "懸念レベル",
    failed: "失敗",
    noAnalysisPerformed: "分析が実行されませんでした",
  },
  headers: {
    home: "ホーム",
    patient: "患者",
    schedule: "スケジュール",
    conversations: "会話",
    call: "通話",
    alerts: "アラート",
    logout: "ログアウト",
    reports: "レポート",
    sentimentAnalysis: "感情分析",
    medicalAnalysis: "医学的分析",
    fraudAbuseAnalysis: "詐欺と虐待の分析",
    mentalHealthReport: "メンタルヘルスレポート",
  },
  medicalAnalysis: {
    title: "医学的分析",
    error: "エラー",
    success: "成功",
    noPatientSelected: "患者が選択されていません",
    selectPatientToView: "医学的分析を表示するには患者を選択してください",
    triggering: "トリガー中...",
    triggerAnalysis: "分析をトリガー",
    loadingResults: "分析結果を読み込み中...",
    noResultsAvailable: "分析結果が利用できません",
    triggerToGetStarted: "開始するには分析をトリガーしてください",
    cognitiveHealth: "認知健康",
    mentalHealth: "メンタルヘルス",
    language: "言語",
    risk: "リスク",
    high: "高",
    medium: "中",
    low: "低",
    good: "良い",
    fair: "普通",
    poor: "悪い",
    warningsInsights: "警告と洞察",
    analysisDetails: "分析詳細",
    conversations: "会話",
    messages: "メッセージ",
    totalWords: "総単語数",
    trigger: "トリガー",
    trendsOverTime: "時間経過のトレンド",
    overallHealth: "全体的な健康",
    analyses: "分析",
    trendAnalysisComingSoon: "トレンド分析近日公開",
    analysisResultsAvailable: "分析結果が利用可能",
    basedOn: "基づく",
    analysisResultsOver: "分析結果超過",
    loadFailed: "医学的分析結果の読み込みに失敗しました",
    triggerFailed: "医学的分析のトリガーに失敗しました",
    triggerSuccess: "医学的分析が正常にトリガーされました。結果は約10秒で表示されます。",
    disclaimer: "この分析は情報提供のみを目的としており、専門的な医療アドバイス、診断、または治療の代替となるものではありません。医療上の懸念については、常に資格のある医療提供者に相談してください。",
    overview: "概要",
    confidence: "信頼",
    noDataAvailable: "分析に利用できるデータがありません",
    insufficientDataWarning: "利用可能なデータが限られています：{{current}} 件の通話を分析しました。より信頼性の高い分析のために、患者のパターンをよりよく理解するために、より長い期間にわたって {{minimum}} 件以上の通話を推奨します。",
    analysisWillAppearAfterCalls: "通話が完了すると、分析結果がここに表示されます。",
    keyIndicators: "主要指標",
    fillerWords: "フィラー語",
    vagueReferences: "曖昧な参照",
    temporalConfusion: "時間的混乱",
    wordFinding: "言葉を見つける困難",
    repetition: "反復スコア",
    informationDensity: "情報密度",
    depressionScore: "うつ病スコア",
    anxietyScore: "不安スコア",
    emotionalTone: "感情的なトーン",
    negativeRatio: "負の比率",
    protectiveFactors: "保護因子",
    typeTokenRatio: "語彙の多様性",
    avgWordLength: "平均単語長",
    avgSentenceLength: "平均文長",
    uniqueWords: "ユニークな単語",
    crisisIndicators: "危機指標が検出されました - 即座の専門評価が推奨されます",
    cognitiveInterpretation: {
      normal: "コミュニケーションパターンは正常に見え、重大な認知的懸念は検出されませんでした。",
      mildConcern: "コミュニケーションパターンにいくつかの軽微な変化が検出されました。進行を監視してください。",
      moderateConcern: "コミュニケーションパターンに中程度の変化が観察されました。専門評価を検討してください。",
      significantConcern: "コミュニケーションパターンに重大な変化が検出されました。専門評価を強く推奨します。",
    },
    psychiatricInterpretation: {
      stable: "精神的健康指標は安定しており、重大な懸念は見られません。",
      mildConcern: "いくつかの軽微な精神的健康指標が検出されました。監視を続けてください。",
      moderateConcern: "中程度の精神的健康指標が観察されました。専門相談を検討してください。",
      significantConcern: "重大な精神的健康指標が検出されました。専門相談が推奨されます。",
      crisis: "危機指標が検出されました。即座の専門的介入を強く推奨します。",
    },
    vocabularyInterpretation: {
      strong: "言語の複雑さと語彙の使用は強く、よく維持されているようです。",
      average: "言語の複雑さと語彙の使用は正常範囲内です。",
      limited: "言語の複雑さと語彙の使用は限られているようです。変化を監視してください。",
    },
  },
  signupScreen: {
    title: "招待を完了する",
    fullNameLabel: "フルネーム",
    fullNamePlaceholder: "あなたのフルネーム",
    emailLabel: "メールアドレス",
    emailPlaceholder: "your.email@example.com",
    phoneLabel: "電話番号",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "パスワード",
    passwordPlaceholder: "パスワードを入力してください",
    confirmPasswordLabel: "パスワード確認",
    confirmPasswordPlaceholder: "パスワードを確認してください",
    completeRegistration: "登録完了",
    preconfiguredMessage: "あなたの名前、メール、組織の詳細は管理者によって事前設定されています。",
  },
  homeScreen: {
    welcome: "ようこそ、{{name}}",
    guest: "ゲスト",
    addPatient: "患者を追加",
    adminOnlyMessage: "組織管理者とスーパー管理者のみが患者を追加できます",
    noPatientsFound: "患者が見つかりません",
    viewSchedules: "スケジュールを表示",
    noScheduleWarning: "⚠ スケジュールが設定されていません",
  },
  tabs: {
    home: "ホーム",
    org: "組織",
    reports: "レポート",
    alerts: "アラート",
  },
  orgScreen: {
    namePlaceholder: "名前",
    emailPlaceholder: "メール",
    phonePlaceholder: "電話",
    save: "保存",
    viewCaregivers: "介護者を表示",
    inviteCaregiver: "介護者を招待",
    payments: "支払い",
    organizationActions: "組織のアクション",
    organizationLogo: "組織のロゴ",
    noLogoSet: "ロゴが設定されていません",
  },
  headers: {
    home: "ホーム",
    patient: "患者",
    schedule: "スケジュール",
    conversations: "会話",
    call: "通話",
    profile: "プロフィール",
    logout: "ログアウト",
    alerts: "アラート",
    organization: "組織",
    caregivers: "介護者",
    caregiver: "介護者",
    caregiverInvited: "介護者招待済み",
    payments: "支払い",
    reports: "レポート",
    sentimentAnalysis: "感情分析",
    medicalAnalysis: "医学的分析",
    privacyPolicy: "プライバシーポリシー",
    privacyPractices: "HIPAAプライバシー慣行",
    termsOfService: "利用規約",
    mentalHealthReport: "メンタルヘルスレポート",
    login: "ログイン",
    register: "登録",
  },
  themes: {
    healthcare: {
      name: "ヘルスケア",
      description: "青と緑の色を使ったプロフェッショナルな医療テーマ",
    },
    colorblind: {
      name: "色覚障害者向け",
      description: "色覚障害に最適化された高コントラストテーマ",
    },
    dark: {
      name: "ダークモード",
      description: "低照度環境に最適化されたダークテーマ",
    },
    accessibility: {
      wcagLevel: "WCAGレベル",
      colorblindFriendly: "色覚障害者向け",
      highContrast: "高コントラスト",
      darkMode: "ダークモード",
    },
  },
  privacyPracticesScreen: {
    content: `# プライバシー実践に関する通知
## MyPhoneFriend ヘルスケア通信サービス

**有効日**: 2025年10月15日

---

## あなたの情報。あなたの権利。私たちの責任。

**この通知は、あなたに関する医療情報がどのように使用され、開示される可能性があるか、およびこの情報にアクセスする方法を説明しています。よくお読みください。**

---

## あなたの権利

あなたには以下の権利があります：
- 健康情報のコピーを取得する
- 健康情報を訂正する
- 機密通信を要求する
- 共有する情報を制限するよう求める
- 情報を共有した相手のリストを取得する
- このプライバシー通知のコピーを取得する
- あなたに代わって行動する人を選択する
- プライバシー権が侵害されたと信じる場合、苦情を申し立てる

---

## あなたの選択

以下の場合に、情報の使用と共有方法について選択肢があります：
- 家族や友人からのあなたのケアに関する質問に答える
- 災害救援状況であなたに関する情報を提供する

**私たちは、マーケティングやデータの販売のためにあなたの情報を共有することは決してありません。**

---

# あなたの詳細な権利

## 健康情報のコピーを取得する

**あなたの健康情報を閲覧またはコピーを取得するよう要求できます。**

要求できる内容：
- 通話録音と文字起こし
- ウェルネス要約とAI分析結果
- システムが生成した医療アラート
- 緊急通知
- アカウント情報と設定

**要求方法**：
- メール: privacy@biancawellness.com
- 電話: +1-604-562-4263

**私たちの回答**: 30日以内

---

## 健康情報の訂正を求める

**不正確または不完全だと思う健康情報の訂正を求めることができます。**

**私たちの回答**: 60日以内

---

## 機密通信を要求する

**特定の方法または場所で連絡するよう求めることができます。**

例：
- "電話ではなくメールで連絡してください"
- "携帯電話のみで連絡してください"

合理的な要求にはすべて対応します。

---

## 使用または共有を制限するよう求める

**特定の健康情報を使用または共有しないよう求めることができます。**

全額自己負担で支払い、健康保険と共有しないよう求めた場合、私たちは同意する必要があります。

---

## 開示のリストを取得する

**「開示の会計」を要求できます** - 健康情報を共有した回数のリスト。

対象: 過去6年間  
除外: 治療、支払い、運営のための開示（要求しない限り）

---

## 苦情を申し立てる

**私たちに申し立てる**：
- メール: privacy@biancawellness.com
- 電話: +1-604-562-4263

**HHSに申し立てる**：
- ウェブサイト: https://www.hhs.gov/hipaa/filing-a-complaint
- 電話: 1-800-368-1019

**苦情を申し立てたことに対して報復することはありません。**

---

# 私たちの使用と開示

## 健康情報の使用方法

**治療のために**：
- ケア提供者にAIウェルネス要約を提供
- 緊急事態の緊急アラートを生成
- ケア提供者があなたの健康状態を監視できるようにする
- ケアチームとのコミュニケーションを促進

**支払いのために**：
- 医療機関にサービスを請求
- 通話時間と分析の請求書を処理

**医療運営のために**：
- AI検出アルゴリズムを改善
- 品質保証と改善
- 患者により良いサービスを提供するためにシステムを訓練

---

## 共有する相手

**あなたの医療機関**：
- 割り当てられたケア提供者とケアコーディネーター
- 請求のための組織管理者

**ビジネスアソシエイト**（サービスプロバイダー）：
- AIサービス（Azure OpenAI）: 文字起こしと分析のため
- 音声サービス（Twilio）: 電話通話処理のため
- クラウドホスティング（AWS）: 安全なデータストレージのため
- データベース（MongoDB Atlas）: データ管理のため

すべてのビジネスアソシエイトはビジネスアソシエイト契約に署名し、あなたの情報を保護する必要があります。

**法律で要求される場合**：
- 緊急事態が検出された場合の緊急サービス（911）
- 公衆衛生当局（虐待、ネグレクトの報告）
- 法執行機関（有効な法的命令がある場合）

**私たちはしません**：
- ❌ 健康情報を販売する
- ❌ マーケターや広告主と共有する
- ❌ 承認なしにマーケティングに使用する
- ❌ ソーシャルメディアで共有する

---

# 収集する健康情報

**サービスの使用中**：
- 患者名、電話番号、生年月日
- 通話録音と文字起こし
- 通話からの健康関連情報（症状、薬物、気分）
- 緊急アラートとインシデント
- ウェルネスの傾向とパターン
- ケア提供者のメモと観察
- AIからの医療分析結果

---

# あなたの責任

**私たちのサービスを使用して他の人に電話をかける場合**、あなたは以下に責任があります：
- 録音に必要な同意を取得する
- サービスを理解していることを確認する
- 適用される録音同意法に従う

---

# 違反通知

**健康情報が不適切にアクセスまたは開示された場合**、私たちは：
- インシデントを調査します
- 報告可能な違反の場合、60日以内に通知します
- 何が起こったか、何をしているかを説明します
- 取ることができる手順に関する情報を提供します

---

# この通知の変更

- この通知を変更でき、変更は私たちが持つすべての情報に適用されます
- 新しい通知はアプリとウェブサイトで利用可能になります
- いつでも現在のコピーを要求できます

---

# 連絡先情報

**プライバシー責任者**：
- メール: privacy@biancawellness.com
- 電話: +1-604-562-4263
- 郵送: MyPhoneFriendプライバシーオフィス、2955 Elbow Place、Port Coquitlam、BC V3B 7T3

**営業時間**: 月曜日-金曜日、午前9時-午後5時 PST

---

# 苦情を申し立てる

**私たちに**：
- メール: privacy@biancawellness.com
- 電話: +1-604-562-4263

**連邦政府（HHS）に**：
- ウェブサイト: https://www.hhs.gov/hipaa/filing-a-complaint
- 電話: 1-800-368-1019
- 郵送: 米国保健社会福祉省市民権局、200 Independence Avenue S.W.、Washington、D.C. 20201

---

**有効日**: 2025年10月15日  
**バージョン**: 1.0

このプライバシー実践に関する通知は、HIPAAプライバシールール（45 CFR §164.520）に準拠しています

---

## 言語支援

**英語**: この通知を理解するのに助けが必要な場合は、privacy@biancawellness.comにお問い合わせください

**Español**: Si necesita ayuda, comuníquese con privacy@biancawellness.com`,
  },
  mfa: {
    setupTitle: "多要素認証",
    setupSubtitle: "アカウントにセキュリティの追加レイヤーを追加",
    setupInstructions: "認証アプリでQRコードをスキャンし、コードを入力して確認してください。",
    verificationTitle: "二要素認証",
    verificationSubtitle: "認証アプリから6桁のコードを入力してください",
    tokenLabel: "確認コード",
    tokenPlaceholder: "000000",
    pleaseEnterVerificationCode: "認証アプリから確認コードを入力してください",
    verifyButton: "確認",
    useBackupCode: "バックアップコードを使用",
    verifyAndEnable: "確認して有効化",
    enable: "MFAを有効化",
    enableMFA: "多要素認証を有効化",
    manageMFA: "多要素認証を管理",
    disable: "MFAを無効化",
    disableTitle: "MFAを無効化",
    disableSubtitle: "多要素認証を無効化するには、現在のMFAコードを入力してください",
    disableConfirmTitle: "MFAを無効化しますか？",
    disableConfirmMessage: "多要素認証を無効化してもよろしいですか？これにより、アカウントのセキュリティが低下します。",
    enabled: "有効",
    disabled: "無効",
    enabledSuccess: "多要素認証が正常に有効化されました。",
    disabledSuccess: "多要素認証が無効化されました。",
    status: "ステータス",
    enrolledOn: "登録日",
    backupCodesRemaining: "残りのバックアップコード",
    backupCodesTitle: "バックアップコード",
    backupCodesWarning: "これらのコードを安全な場所に保存してください。認証デバイスを紛失した場合、これらを使用してアカウントにアクセスできます。",
    backupCodeLength: "バックアップコードは8文字です",
    regenerateBackupCodes: "バックアップコードを再生成",
    regenerateBackupCodesTitle: "バックアップコードを再生成しますか？",
    regenerateBackupCodesSubtitle: "新しいバックアップコードを生成するには、現在のMFAコードを入力してください",
    regenerateBackupCodesMessage: "古いバックアップコードは機能しなくなります。新しいコードを安全に保存してください。",
    regenerate: "再生成",
    backupCodesRegenerated: "バックアップコードが再生成されました",
    backupCodesRegeneratedMessage: "新しいバックアップコードが生成されました。安全に保存してください。",
    secretLabel: "または、このシークレットを手動で入力：",
    invalidTokenLength: "6桁のコードを入力してください",
    verificationFailed: "コードが無効です。もう一度お試しください。",
    enableFailed: "MFAの有効化に失敗しました",
    disableFailed: "MFAの無効化に失敗しました。コードを確認してください。",
    regenerateFailed: "バックアップコードの再生成に失敗しました。",
  },
}

export default ja
