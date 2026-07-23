import { LocaleTranslations } from "./en"

const ko: LocaleTranslations = {
  common: {
    ok: "확인!",
    cancel: "취소",
    back: "뒤로",
    logOut: "로그아웃",
    signInToContinue: "계속하려면 로그인하세요.",
    anErrorOccurred: "오류가 발생했습니다",
    callNow: "지금 통화",
    calling: "통화 중...",
    close: "닫기",
    continue: "계속",
    delete: "삭제",
    done: "완료",
    endCall: "통화 종료",
    ending: "종료 중...",
    error: "오류",
    loading: "로딩 중...",
    selectImage: "이미지 선택",
  },
  alertScreen: {
    markAllAsRead: "모두 읽음으로 표시",
    unreadAlerts: "읽지 않은 알림",
    allAlerts: "모든 알림",
    noAlerts: "알림 없음",
    noAlertsTitle: "모두 완료!",
    noAlertsSubtitle: "읽지 않은 알림이 없습니다. 최신 상태를 유지하는 좋은 일을 했습니다!",
    emptyHeading: "너무 비어있어... 너무 슬퍼",
    refreshing: "새로고침 중...",
    refresh: "새로고침",
    client: "클라이언트:",
    importance: "중요도:",
    expires: "만료:",
    filteredByClientBanner: "{{name}} 알림 표시 중",
    clearAlertFilter: "전체 보기",
    noAlertsForFilteredClientTitle: "이 클라이언트에 대한 알림 없음",
    noAlertsForFilteredClientSubtitle: "{{name}}에 연결된 알림이 없습니다. 필터를 해제해 모든 알림을 보거나 홈에서 다른 클라이언트를 선택하세요.",
  },
  welcomeScreen: {
    postscript: "잠깐! — 지금 보시는 것은 아마도 당신의 앱의 모양새가 아닐겁니다. (디자이너분이 이렇게 건내주셨다면 모를까요. 만약에 그렇다면, 이대로 가져갑시다!) ",
    readyForLaunch: "출시 준비가 거의 끝난 나만의 앱!",
    exciting: "(오, 이거 신나는데요!)",
    letsGo: "가보자구요!",
  },
  errorScreen: {
    title: "뭔가 잘못되었습니다!",
    friendlySubtitle: "이 화면은 오류가 발생할 때 프로덕션에서 사용자에게 표시됩니다. 이 메시지를 커스터마이징 할 수 있고(해당 파일은 `app/i18n/ko.ts` 에 있습니다) 레이아웃도 마찬가지로 수정할 수 있습니다(`app/screens/error`). 만약 이 오류화면을 완전히 없에버리고 싶다면 `app/app.tsx` 파일에서 <ErrorBoundary> 컴포넌트를 확인하기 바랍니다.",
    reset: "초기화",
    traceTitle: "%{name} 스택에서의 오류",
  },
  emptyStateComponent: {
    generic: {
      heading: "너무 텅 비어서.. 너무 슬퍼요..",
      content: "데이터가 없습니다. 버튼을 눌러서 리프레쉬 하시거나 앱을 리로드하세요.",
      button: "다시 시도해봅시다",
    },
  },
  errors: {
    invalidEmail: "잘못된 이메일 주소 입니다.",
  },
  loginScreen: {
    signIn: "로그인",
    register: "등록",
    enterDetails: "일급비밀 정보를 해제하기 위해 상세 정보를 입력하세요. 무엇이 기다리고 있는지 절대 모를겁니다. 혹은 알 수 있을지도 모르겠군요. 엄청 복잡한 뭔가는 아닙니다.",
    emailFieldLabel: "이메일",
    passwordFieldLabel: "비밀번호",
    emailFieldPlaceholder: "이메일을 입력하세요",
    passwordFieldPlaceholder: "엄청 비밀스러운 암호를 입력하세요",
    forgotPassword: "비밀번호를 잊으셨나요?",
    tapToSignIn: "눌러서 로그인 하기!",
    hint: "힌트: 가장 좋아하는 암호와 아무런 아무 이메일 주소나 사용할 수 있어요 :)",
    appName: "Bianca",
    tagline: "웰니스 체크 커뮤니케이션",
  },
  demoNavigator: {
    componentsTab: "컴포넌트",
    debugTab: "디버그",
    communityTab: "커뮤니티",
    podcastListTab: "팟캐스트",
  },
  demoCommunityScreen: {
    title: "커뮤니티와 함께해요",
    tagLine: "전문적인 React Native 엔지니어들로 구성된 Infinite Red 커뮤니티에 접속해서 함께 개발 실력을 향상시켜 보세요!",
    joinUsOnSlackTitle: "Slack 에 참여하세요",
    joinUsOnSlack: "전 세계 React Native 엔지니어들과 함께할 수 있는 곳이 있었으면 좋겠죠? Infinite Red Community Slack 에서 대화에 참여하세요! 우리의 성장하는 커뮤니티는 질문을 던지고, 다른 사람들로부터 배우고, 네트워크를 확장할 수 있는 안전한 공간입니다. ",
    joinSlackLink: "Slack 에 참여하기",
    makeIgniteEvenBetterTitle: "Ignite 을 향상시켜요",
    makeIgniteEvenBetter: "Ignite 을 더 좋게 만들 아이디어가 있나요? 기쁜 소식이네요. 우리는 항상 최고의 React Native 도구를 구축하는데 도움을 줄 수 있는 분들을 찾고 있습니다. GitHub 에서 Ignite 의 미래를 만들어 가는것에 함께해 주세요.",
    contributeToIgniteLink: "Ignite 에 기여하기",
    theLatestInReactNativeTitle: "React Native 의 최신정보",
    theLatestInReactNative: "React Native 가 제공하는 모든 최신 정보를 알려드립니다.",
    reactNativeRadioLink: "React Native 라디오",
    reactNativeNewsletterLink: "React Native 뉴스레터",
    reactNativeLiveLink: "React Native 라이브 스트리밍",
    chainReactConferenceLink: "Chain React 컨퍼런스",
    hireUsTitle: "다음 프로젝트에 Infinite Red 를 고용하세요",
    hireUs: "프로젝트 전체를 수행하든, 실무 교육을 통해 팀의 개발 속도에 박차를 가하든 상관없이, Infinite Red 는 React Native 프로젝트의 모든 분야의 에서 도움을 드릴 수 있습니다.",
    hireUsLink: "메세지 보내기",
  },
  demoShowroomScreen: {
    jumpStart: "프로젝트를 바로 시작할 수 있는 컴포넌트들!",
    lorem2Sentences: "별 하나에 추억과, 별 하나에 사랑과, 별 하나에 쓸쓸함과, 별 하나에 동경(憧憬)과, 별 하나에 시와, 별 하나에 어머니, 어머니",
    demoHeaderTxExample: "야호",
    demoViaTxProp: "`tx` Prop 을 통해",
    demoViaSpecifiedTxProp: "`{{prop}}Tx` Prop 을 통해",
  },
  demoDebugScreen: {
    howTo: "사용방법",
    title: "디버그",
    tagLine: "축하합니다. 여기 아주 고급스러운 React Native 앱 템플릿이 있습니다. 이 보일러 플레이트를 사용해보세요!",
    reactotron: "Reactotron 으로 보내기",
    reportBugs: "버그 보고하기",
    demoList: "데모 목록",
    demoPodcastList: "데모 팟캐스트 목록",
    androidReactotronHint: "만약에 동작하지 않는 경우, Reactotron 데스크탑 앱이 실행중인지 확인 후, 터미널에서 adb reverse tcp:9090 tcp:9090 을 실행한 다음 앱을 다시 실행해보세요.",
    iosReactotronHint: "만약에 동작하지 않는 경우, Reactotron 데스크탑 앱이 실행중인지 확인 후 앱을 다시 실행해보세요.",
    macosReactotronHint: "만약에 동작하지 않는 경우, Reactotron 데스크탑 앱이 실행중인지 확인 후 앱을 다시 실행해보세요.",
    webReactotronHint: "만약에 동작하지 않는 경우, Reactotron 데스크탑 앱이 실행중인지 확인 후 앱을 다시 실행해보세요.",
    windowsReactotronHint: "만약에 동작하지 않는 경우, Reactotron 데스크탑 앱이 실행중인지 확인 후 앱을 다시 실행해보세요.",
  },
  demoPodcastListScreen: {
    title: "React Native 라디오 에피소드",
    onlyFavorites: "즐겨찾기만 보기",
    favoriteButton: "즐겨찾기",
    unfavoriteButton: "즐겨찾기 해제",
    accessibility: {
      cardHint: "에피소드를 들으려면 두 번 탭하세요. 이 에피소드를 좋아하거나 싫어하려면 두 번 탭하고 길게 누르세요.",
      switch: "즐겨찾기를 사용하려면 스위치를 사용하세요.",
      favoriteAction: "즐겨찾기 토글",
      favoriteIcon: "좋아하는 에피소드",
      unfavoriteIcon: "즐겨찾기하지 않은 에피소드",
      publishLabel: "{{date}} 에 발행됨",
      durationLabel: "소요시간: {{hours}}시간 {{minutes}}분 {{seconds}}초",
    },
    noFavoritesEmptyState: {
      heading: "조금 텅 비어 있네요.",
      content: "즐겨찾기가 없습니다. 에피소드에 있는 하트를 눌러서 즐겨찾기에 추가하세요.",
    },
  },
  registerScreen: {
    title: "등록",
    nameFieldLabel: "이름",
    emailFieldLabel: "이메일",
    phoneFieldLabel: "전화번호",
    passwordFieldLabel: "비밀번호",
    goBack: "뒤로",
    confirmPasswordFieldLabel: "비밀번호 확인",
    organizationNameFieldLabel: "조직 이름",
    nameFieldPlaceholder: "이름을 입력하세요",
    emailFieldPlaceholder: "이메일 주소를 입력하세요",
    passwordFieldPlaceholder: "비밀번호를 입력하세요",
    confirmPasswordFieldPlaceholder: "비밀번호를 확인하세요",
    phoneFieldPlaceholder: "(xxx)xxx-xxxx",
    organizationNameFieldPlaceholder: "조직 이름을 입력하세요",
    organizationButton: "조직",
    individualButton: "개인",
    individualExplanation: "개인 사용을 위해 개인으로 등록합니다.",
    organizationExplanation: "회사 또는 그룹 사용을 위해 조직으로 등록합니다.",
    consentText: "등록하면 다음에 동의하는 것입니다",
    consentAnd: "및",
    termsOfService: "서비스 약관",
    privacyPolicy: "개인정보 보호정책",
    countryFieldLabel: "국가",
  },
  requestResetScreen: {
    title: "비밀번호 재설정 요청",
    emailFieldLabel: "이메일",
    emailFieldPlaceholder: "이메일 주소를 입력하세요",
    requestReset: "재설정 요청",
    successMessage: "재설정 코드가 이메일로 전송되었습니다!",
    requestFailed: "요청이 실패했습니다. 이메일을 확인하고 다시 시도해 주세요.",
  },
  ssoLinkingScreen: {
    title: "계정 연결",
    message: "이 계정은 {{provider}}로 생성되었습니다. 이메일/비밀번호 로그인을 사용하려면 아래에서 비밀번호를 설정하거나 {{provider}}로 계속하세요.",
    passwordLabel: "비밀번호",
    passwordPlaceholder: "비밀번호를 입력하세요",
    confirmPasswordLabel: "비밀번호 확인",
    confirmPasswordPlaceholder: "비밀번호를 확인하세요",
    setPasswordButton: "비밀번호 설정",
    backToLoginButton: "로그인으로 돌아가기",
    orDivider: "또는",
    successMessage: "✓ 비밀번호가 성공적으로 설정되었습니다! 이제 이메일과 비밀번호로 로그인할 수 있습니다.",
    errorNoPassword: "비밀번호를 입력하세요",
    errorNoConfirmPassword: "비밀번호를 확인하세요",
    errorPasswordMismatch: "비밀번호가 일치하지 않습니다",
    errorPasswordTooShort: "비밀번호는 최소 8자 이상이어야 합니다",
    errorSetPasswordFailed: "비밀번호 설정 실패",
    errorSSOFailed: "SSO 로그인 실패. 다시 시도하세요.",
    providerGoogle: "Google",
    providerMicrosoft: "Microsoft",
    providerSSO: "SSO",
  },
  ssoButtons: {
    orContinueWith: "또는 계속하기",
    google: "Google",
    microsoft: "Microsoft",
    continueWithGoogle: "Google로 계속하기",
    continueWithMicrosoft: "Microsoft로 계속하기",
    companySSO: "회사 SSO",
    ssoNotAvailable: "SSO를 사용할 수 없음",
    signInFailed: "로그인 실패",
    companySSOTitle: "회사 SSO",
    companySSOMessage: "회사의 SSO 공급자로 리디렉션됩니다. 설정을 위해 관리자에게 문의하세요.",
  },
  emailVerificationScreen: {
    title: "이메일을 확인하세요",
    message: "이메일 주소로 확인 링크를 보냈습니다. 로그인하기 전에 링크를 클릭하여 계정을 확인하세요.",
    emailFieldLabel: "이메일 주소",
    emailFieldPlaceholder: "이메일 주소를 입력하세요",
    resendButton: "확인 이메일 재전송",
    backToLoginButton: "로그인으로 돌아가기",
    successMessage: "✓ 확인 이메일을 보냈습니다! 받은 편지함을 확인하세요.",
    errorNoEmail: "이메일 주소를 입력하세요",
    errorSendFailed: "확인 이메일 전송 실패",
    errorNetwork: "서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도하세요.",
    errorNoToken: "인증 토큰이 없습니다",
    errorVerificationFailed: "이메일 인증에 실패했습니다",
    verificationFailed: "이메일 인증에 실패했습니다",
    verifying: "확인 중...",
  },
  emailVerifiedScreen: {
    title: "이메일 확인됨!",
    message: "My Phone Friend 계정이 성공적으로 확인되었습니다.",
    redirecting: "앱으로 리디렉션 중...",
  },
  phoneVerificationBanner: {
    title: "전화번호를 확인하세요",
    message: "긴급 알림 및 중요한 알림을 받으려면 전화번호를 확인해주세요.",
    verifyButton: "지금 확인",
  },
  conversationsScreen: {
    title: "대화",
    yesterday: "어제",
    noMessages: "메시지 없음",
    noClientSelected: "선택된 클라이언트가 없습니다",
    firstConversation: "이전 대화를 찾을 수 없습니다. 이 클라이언트와의 첫 번째 대화가 될 것입니다.",
    noConversationsToDisplay: "표시할 대화가 없습니다",
    noPreviousConversations: "이 클라이언트의 이전 대화를 찾을 수 없습니다",
    errorFetchingConversations: "대화를 가져오는 중 오류가 발생했습니다",
    loadingMoreConversations: "대화 더 불러오는 중...",
  },
  clientScreen: {
    nameLabel: "이름 *",
    namePlaceholder: "클라이언트 이름을 입력하세요",
    emailLabel: "이메일 *",
    emailPlaceholder: "이메일 주소를 입력하세요",
    phoneLabel: "전화번호 *",
    phonePlaceholder: "전화번호를 입력하세요",
    preferredLanguageLabel: "선호 언어",
    updateClient: "클라이언트 업데이트",
    createClient: "클라이언트 생성",
    manageSchedules: "일정 관리",
    manageConversations: "대화 관리",
    viewSentimentAnalysis: "감정 분석 보기",
    manageCaregivers: "간병인 관리",
    confirmDelete: "삭제 확인",
    deleteClient: "클라이언트 삭제",
    onboardingCardTitle: "입소자 온보딩",
    onboardingNotStarted: "시작 전 — 다음: {{total}}일 중 1일차",
    onboardingInProgress: "진행 중",
    onboardingNextDay: "다음: {{total}}일 중 {{day}}일차",
    onboardingCallsCompleted: "{{total}}통화 중 {{completed}}통 완료",
    onboardingCapturesLine: "주제 응답 {{count}}건 기록됨",
    onboardingComplete: "온보딩 완료 — {{total}}통화 모두 종료",
    viewOnboardingDetails: "온보딩 응답 보기",
    onboardingButtonCompactComplete: "온보딩 · 완료",
    onboardingButtonCompactDay: "온보딩 · {{day}}일차",
    onboardingButtonA11yHint: "이 클라이언트의 온보딩 응답과 진행 상세를 엽니다.",
    onboardingOutboundCallsHint: "홈 또는 일정에서 나가는 통화는 전화에서 해당 세션이 완료될 때까지 {{day}}회 온보딩 대화를 사용합니다. 응답이 없으면 진행되지 않으며 다음 통화도 같은 세션을 유지합니다.",
  },
  clientOnboardingScreen: {
    title: "온보딩 응답",
    noClient: "선택된 클라이언트가 없습니다.",
    day: "일차",
    filterByDay: "일차별 필터",
    allDays: "전체 일차",
    loading: "불러오는 중…",
    error: "온보딩 데이터를 불러올 수 없습니다.",
    captureCount: "응답 {{count}}건",
    emptyAllDays: "아직 기록된 온보딩 응답이 없습니다.",
    emptyForDay: "{{day}}일차 온보딩이 아직 완료되지 않았습니다.",
    flag: {
      safety: "안전",
      memory: "기억",
      mood: "기분",
      distress: "고통",
      confusion: "혼란",
    },
    signalsForDay: "{{day}}일에 기록된 신호",
  },
  paymentScreen: {
    paid: "지불됨",
    pending: "대기 중",
    overdue: "연체",
    processing: "처리 중",
    unknown: "알 수 없음",
    latestInvoice: "최신 청구서",
    paymentMethod: "결제 방법",
    currentChargesSummary: "현재 요금 요약",
    basicPlan: "기본 플랜",
    contactSupport: "고객 지원 문의",
    currentCharges: "현재 요금",
    paymentMethods: "결제 방법",
    billingInfo: "청구 정보",
    amount: "금액:",
    invoiceNumber: "청구서 번호:",
    issueDate: "발행일:",
    dueDate: "만료일:",
    notes: "메모:",
    noOrganizationData: "조직 데이터를 사용할 수 없습니다.",
    authorizationTokenNotAvailable: "인증 토큰을 사용할 수 없습니다.",
    errorLoadingCurrentCharges: "현재 요금을 로드하는 중 오류가 발생했습니다.",
    noPendingCharges: "대기 중인 요금 없음",
    allConversationsBilled: "모든 대화가 청구되었습니다. 새로운 요금이 누적되면서 여기에 표시됩니다.",
    totalUnbilledAmount: "총 미청구 금액:",
    period: "기간:",
    lastDays: "최근 {days}일",
    clientsWithCharges: "요금이 있는 클라이언트:",
    clientWord: "클라이언트",
    clientsWord: "클라이언트",
    chargesByClient: "클라이언트별 요금",
    conversation: "대화",
    conversations: "대화들",
    average: "평균:",
    noUserData: "사용자 데이터를 사용할 수 없습니다.",
    currentPlan: "현재 플랜:",
    nextBillingDate: "다음 청구일:",
    totalBilledAmount: "총 청구 금액",
    acrossInvoices: "{count}개 청구서에 걸쳐",
    invoiceHistory: "청구서 기록 ({count})",
    hide: "숨기기",
    show: "보기",
    history: "기록",
    noInvoicesYet: "아직 청구서가 없습니다",
    invoicesWillAppear: "청구가 시작되면 여기에 청구서가 나타납니다.",
    accessRestricted: "액세스 제한됨",
    accessRestrictedMessage: "결제 정보를 보거나 관리할 수 있는 필요한 권한이 없습니다.",
    contactAdministrator: "도움을 받으려면 조직 관리자에게 문의하세요.",
    loadingUserInformation: "사용자 정보 로딩 중...",
    addPaymentMethod: "결제 수단 추가",
    loadingPaymentSystem: "결제 시스템 로딩 중...",
    loadingPaymentMethods: "결제 수단 로딩 중...",
    stripeConfigurationError: "Stripe 구성 오류. 지원팀에 문의하세요.",
    unsupportedPlatform: "지원되지 않는 플랫폼. 웹 브라우저 또는 모바일 앱을 사용하세요.",
    errorLoadingPaymentMethods: "결제 수단 로딩 오류:",
    existingPaymentMethods: "기존 결제 수단",
    default: "기본값",
    setDefault: "기본값으로 설정",
    remove: "제거",
    addNewCard: "새 카드 추가",
    deletePaymentMethod: "결제 수단 삭제",
    deletePaymentMethodConfirm: "이 결제 수단을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.",
    paymentMethodAddedSuccess: "결제 수단이 성공적으로 추가되었습니다!",
    paymentMethodSetDefaultSuccess: "결제 수단이 성공적으로 기본값으로 설정되었습니다!",
    paymentMethodDeletedSuccess: "결제 수단이 성공적으로 삭제되었습니다!",
    failedToSetDefault: "기본 결제 수단 설정 실패",
    failedToDelete: "결제 수단 삭제 실패",
    expires: "만료",
    mobilePaymentUnavailable: "모바일 결제 시스템을 사용할 수 없습니다. 웹 버전을 사용하세요.",
    loadingMobilePayment: "모바일 결제 시스템 로딩 중...",
    anErrorOccurred: "오류가 발생했습니다",
    day: "일",
    days: "일",
  },
  orgScreen: {
    namePlaceholder: "이름",
    emailPlaceholder: "이메일",
    phonePlaceholder: "전화번호",
    save: "저장",
    viewCaregivers: "간병인 보기",
    inviteCaregiver: "간병인 초대",
    payments: "결제",
    organizationActions: "조직 작업",
    organizationLogo: "조직 로고",
    noLogoSet: "로고가 설정되지 않음",
    alertOnAllMissedCallsHelper: "모든 부재 통화 및 재시도 시도에 대해 알림 전송",
    alertOnAllMissedCallsLabel: "모든 부재 통화 알림",
    callRetrySettings: "통화 재시도 설정",
    clientConsentSettings: "클라이언트 동의 설정",
    country: "국가",
    countryHelper: "조직의 국가를 선택하세요. 적용되는 개인정보 규정을 파악하는 데 도움이 됩니다.",
    enableRetriesHelper: "사용 시 시스템이 실패한 통화를 자동으로 재시도합니다",
    enableRetriesLabel: "통화 재시도 사용",
    retryCountHelper: "응답이 없을 때 재시도할 횟수(1-5)",
    retryCountLabel: "통화 재시도 횟수",
    retryIntervalMinutesHelper: "재시도 사이 대기 시간(1-60분, 기본값: 15)",
    retryIntervalMinutesLabel: "재시도 간격(분)",
    timezone: "시간대",
    timezoneHelper: "조직의 시간대를 선택하세요. 일정 시간은 이 시간대를 기준으로 합니다.",
    requireClientConsentLabel: "고객 동의 필요",
    requireClientConsentHelper: "활성화하면 동의 요청이 고객에게 이메일로 자동 전송됩니다.",
  },
  caregiverScreen: {
    namePlaceholder: "이름",
    emailPlaceholder: "이메일",
    phonePlaceholder: "전화번호",
    loadingUnassignedClients: "할당되지 않은 클라이언트 로딩 중...",
    assigningClients: "클라이언트 할당 중...",
    clientsAssignedSuccess: "클라이언트가 성공적으로 할당되었습니다!",
    loadingCaregivers: "간병인 로딩 중...",
    assignSelected: "선택 항목 할당",
    assignUnassignedClients: "미할당 클라이언트 할당",
    assignUnassignedClientsTitle: "미할당 클라이언트 할당",
    confirmDelete: "삭제 확인",
    deleteCaregiver: "간병인 삭제",
    deselectAll: "모두 선택 해제",
    emailLabel: "이메일",
    invite: "초대",
    nameLabel: "이름",
    noUnassignedClientsFound: "미할당 클라이언트가 없습니다.",
    phoneLabel: "전화번호",
    save: "저장",
    selectAll: "모두 선택",
  },
  caregiversScreen: {
    invited: "초대됨",
    edit: "편집",
    resendInvite: "초대 다시 보내기",
    noCaregiversFound: "간병인을 찾을 수 없습니다",
    notAuthorized: "승인되지 않음",
    noPermissionToView: "간병인을 볼 권한이 없습니다. 관리자에게 문의하세요.",
    addCaregiver: "간병인 추가",
  },
  signupScreen: {
    title: "초대 완료하기",
    fullNameLabel: "전체 이름",
    fullNamePlaceholder: "전체 이름을 입력하세요",
    emailLabel: "이메일 주소",
    emailPlaceholder: "your.email@example.com",
    phoneLabel: "전화번호",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "비밀번호",
    passwordPlaceholder: "비밀번호를 입력하세요",
    confirmPasswordLabel: "비밀번호 확인",
    confirmPasswordPlaceholder: "비밀번호를 확인하세요",
    completeRegistration: "등록 완료",
    preconfiguredMessage: "귀하의 이름, 이메일 및 조직 세부 정보는 관리자에 의해 미리 구성되었습니다.",
  },
  confirmResetScreen: {
    title: "비밀번호 재설정",
    subtitle: "아래에 새 비밀번호를 입력하세요. 안전하고 기억하기 쉬운 비밀번호를 만드세요.",
    newPasswordLabel: "새 비밀번호",
    newPasswordPlaceholder: "새 비밀번호를 입력하세요",
    confirmPasswordLabel: "새 비밀번호 확인",
    confirmPasswordPlaceholder: "새 비밀번호를 확인하세요",
    codeFieldLabel: "재설정 코드",
    codeFieldPlaceholder: "코드 입력",
    newPasswordFieldLabel: "새 비밀번호",
    newPasswordFieldPlaceholder: "새 비밀번호 입력",
    confirmPasswordFieldLabel: "새 비밀번호 확인",
    confirmPasswordFieldPlaceholder: "비밀번호 확인",
    confirmReset: "재설정 확인",
    successTitle: "비밀번호가 재설정되었습니다!",
    successMessage: "비밀번호가 업데이트되었습니다. 새 비밀번호로 로그인할 수 있습니다.",
    redirecting: "로그인으로 이동 중...",
    resetPasswordButton: "비밀번호 재설정",
    backToLogin: "로그인으로 돌아가기",
    successMessageShort: "비밀번호 재설정 완료!",
    requestFailed: "재설정에 실패했습니다. 코드를 확인하고 다시 시도하세요.",
  },
  homeScreen: {
    welcome: "환영합니다, {{name}}",
    guest: "게스트",
    addClient: "클라이언트 추가",
    adminOnlyMessage: "조직 관리자와 슈퍼 관리자만 클라이언트를 추가할 수 있습니다",
    noClientsFound: "클라이언트를 찾을 수 없습니다",
    viewSchedules: "일정 보기",
    noScheduleWarning: "⚠ 일정이 설정되지 않음",
    glanceAlerts: "알림",
    glanceHintAlertsTitle: "이 클라이언트 알림",
    glanceHintAlertsBody: "목록에서 이 수급자와 연결된 알림 수입니다(클라이언트, 대화, 일정 알림 등). 알림 탭에서 확인하거나 관리하세요. 연결된 클라이언트가 없는 알림은 여기에 포함되지 않습니다.",
    glanceAlertsA11y: "이 클라이언트와 연결된 알림 {{count}}개",
    glanceSentimentActionHint: "보고서에서 최근 통화의 감정 분석을 엽니다.",
    glanceHealthActionHint: "보고서에서 이 클라이언트의 건강 분석 보고서를 엽니다.",
    glanceRiskActionHint: "보고서에서 이 클라이언트의 사기 및 안전 보고서를 엽니다.",
    glanceAlertsActionHint: "이 클라이언트로 필터된 알림 목록을 엽니다.",
    glanceHealth: "건강",
    glanceHealthA11y: "건강 점수 {{score}}/100",
    glanceHintButtonA11y: "{{label}} 정보",
    glanceHintHealthBody: "최신 의료 대화 분석의 종합 웰니스 점수(0–100, 높을수록 좋음). 통화의 인지·기분 관련 언어 패턴 등을 반영합니다. 임상 판단이나 전체 건강 보고서를 대체하지 않습니다.",
    glanceHintHealthTitle: "건강 점수",
    glanceHintRiskBody: "최신 사기·안전 분석의 종합 위험 점수(0–100, 높을수록 우려 큼). 돈, 안전, 고립 등 주제의 패턴을 반영합니다. 자세한 내용은 사기·학대 보고서를 확인하세요.",
    glanceHintRiskTitle: "위험 점수",
    glanceHintSentimentBody: "최근 분석된 통화(약 30일)에서 클라이언트 어조 요약입니다. 상승·안정·하락은 최근 통화를 조금 이전 통화와 비교합니다. 진단이 아니며 자세한 내용은 전체 감정 분석 보고서를 참고하세요.",
    glanceHintSentimentTitle: "기분 추세",
    glanceNoData: "—",
    glanceRisk: "위험",
    glanceRiskA11y: "위험 점수 {{score}}/100",
    glanceSentiment: "기분",
    lastAnsweredCall: "마지막 응답 통화",
    lastCalled: "마지막 통화",
    neverCalled: "없음",
    noAnsweredCallsYet: "아직 응답한 통화가 없습니다",
    sentimentTrendDeclining: "하락",
    sentimentTrendImproving: "상승",
    sentimentTrendStable: "안정",
  },
  tabs: {
    home: "홈",
    org: "조직",
    reports: "보고서",
    alerts: "알림",
  },
  onboarding: {
    howItWorks: {
      title: "Bianca 사용 방법",
      next: "다음",
      getStarted: "시작하기",
      organization: "클라이언트를 추가하고, Bianca가 그들에게 전화할 시간을 예약하고, 대화와 보고서를 한곳에서 검토하세요. Bianca가 통화를 처리하여 귀하는 돌봄에 집중할 수 있습니다.",
      caregiver: "돌보는 분들을 추가하고, Bianca가 언제 전화할지 선택하고, 대화와 보고서로 그들의 상태를 확인하세요. 매 통화에 참여하지 않아도 상황을 파악할 수 있습니다.",
      agingInPlace: "Bianca가 귀하의 일정에 맞춰 친근한 체크인 전화를 합니다. 언제든 자신의 웰니스와 보고서를 확인할 수 있습니다. 필요할 때 항상 곁에 있는 동반자와 같습니다.",
    },
    registration: {
      title: "귀하의 정보",
      subtitle: "정보를 확인하고 계속하려면 약관에 동의하세요.",
      nameRequired: "이름은 필수입니다.",
      emailRequired: "이메일은 필수입니다.",
      termsRequired: "계속하려면 서비스 약관 및 개인정보 처리방침에 동의해야 합니다.",
    },
    aboutYou: {
      agingInPlace: "재가 노년",
      caregiver: "간병인",
      organization: "조직",
      subtitle: "맞춤 경험을 제공하는 데 도움이 됩니다.",
      title: "간단히 자기소개해 주세요",
    },
    orgInfo: {
      countryLabel: "국가",
      orgNameLabel: "조직 이름",
      orgNamePlaceholder: "조직 이름을 입력하세요",
      subtitle: "조직에 대해 알려주세요.",
      timezoneLabel: "시간대",
      title: "조직 정보",
    },
    termsAndConsent: {
      acceptTerms: "다음을 읽었으며 동의합니다:",
      acceptTermsLabel: "서비스 약관 및 개인정보 처리방침 동의",
      and: "및",
      no: "아니오",
      privacyLink: "개인정보 처리방침",
      saveAndContinue: "저장 후 계속",
      singleConsentQuestion: "단일 동의 주에 계신가요? (녹음에는 한 당사자의 동의만 필요합니다.)",
      termsLink: "서비스 약관",
      title: "약관 및 동의",
      whyImportant: "왜 중요한가요?",
      whyImportantBody: "통화 녹음 법은 주·국가마다 다릅니다. 단일 동의(일방) 주에서는 한 사람만 동의하면 되고, 양방 동의 주에서는 통화 참가자 모두가 동의해야 합니다. 올바르게 설정하면 규정 준수에 도움이 됩니다.",
      yes: "예",
    },
  },
  legalLinks: {
    privacyPolicy: "개인정보 보호정책",
    privacyPractices: "HIPAA 개인정보 보호 관행",
    termsOfService: "서비스 약관",
  },
  headers: {
    home: "홈",
    client: "클라이언트",
    schedule: "일정",
    conversations: "대화",
    call: "통화",
    profile: "프로필",
    logout: "로그아웃",
    alerts: "알림",
    organization: "조직",
    caregivers: "간병인",
    caregiver: "간병인",
    caregiverInvited: "초대된 간병인",
    payments: "결제",
    reports: "보고서",
    sentimentAnalysis: "감정 분석",
    clientOnboarding: "온보딩",
    medicalAnalysis: "의료 분석",
    fraudAbuseAnalysis: "사기 및 학대 분석",
    privacyPolicy: "개인정보 보호정책",
    privacyPractices: "HIPAA 개인정보 보호 관행",
    termsOfService: "서비스 약관",
    mentalHealthReport: "정신 건강 보고서",
    login: "로그인",
    register: "등록",
    privacyRequest: "내 데이터 요청",
  },
  scheduleScreen: {
    heading: "일정 구성",
    saveSchedule: "일정 저장",
    deleteSchedule: "일정 삭제",
  },
  scheduleComponent: {
    schedule: "일정",
    startTime: "시작 시간",
    frequency: "빈도",
    daily: "매일",
    weekly: "매주",
    monthly: "매월",
    sunday: "일요일",
    monday: "월요일",
    tuesday: "화요일",
    wednesday: "수요일",
    thursday: "목요일",
    friday: "금요일",
    saturday: "토요일",
    scheduleDetails: "일정 세부 정보",
    active: "활성",
    everyDayAt: "매일 {{time}}에",
    everyDaysAt: "매주 {{days}} {{time}}에",
    everyWeekAt: "매주 {{time}}에",
    everyMonthOn: "매월 {{day}}일 {{time}}에",
  },
  sentimentAnalysis: {
    lastCall: "마지막 통화",
    last30Days: "최근 30일",
    allTime: "전체 기간",
    noClientSelected: "선택된 클라이언트가 없습니다",
    selectClientToView: "감정 분석을 보려면 홈 화면에서 클라이언트를 선택하세요.",
    sessionRequiredTitle: "로그인이 필요합니다",
    sessionRequiredMessage: "세션이 만료되었을 수 있습니다. 감정 분석을 보려면 다시 로그인하세요. 로그인 창이 이미 열려 있으면 그곳에서 완료하세요.",
    signInToContinueButton: "로그인",
    accessDeniedTitle: "이 보고서를 불러올 수 없습니다",
    accessDeniedMessage: "이 클라이언트의 감정 데이터에 대한 액세스 권한이 없거나 권한이 변경되었을 수 있습니다. 홈에서 클라이언트를 다시 선택하거나 관리자에게 문의하세요.",
    clientSentimentAnalysis: "클라이언트 감정 분석",
    emotionalWellnessInsights: "감정적 웰빙 인사이트 및 트렌드",
    timeRange: "시간 범위:",
    noSentimentDataAvailable: "감정 데이터를 사용할 수 없습니다",
    noSentimentDataMessage: "클라이언트가 대화를 완료하면 여기에 감정 분석이 나타납니다.",
    loadingSentimentAnalysis: "감정 분석 로딩 중...",
    sentimentAnalysisFooter: "감정 분석은 AI 기술을 사용하여 각 대화 후 자동으로 생성됩니다.",
    sentimentOverview: "감정 개요",
    averageSentiment: "평균 감정",
    trend: "트렌드",
    recentDistribution: "최근 분포",
    keyInsights: "주요 인사이트",
    totalConversations: "총 대화 수",
    analysisCoverage: "분석 커버리지",
    recentConversations: "최근 대화",
    analyzed: "분석됨",
    latestAnalysis: "최신 분석",
    conversationsAnalyzed: "대화 분석됨",
    recentConversationsTitle: "최근 대화",
    conversationsWithSentiment: "감정 분석이 있는 대화{s}",
    noRecentConversations: "감정 분석이 있는 최근 대화가 없습니다",
    keyEmotions: "주요 감정:",
    moreEmotions: "더 보기",
    clientMood: "클라이언트 기분:",
    concern: "우려",
    confidence: "신뢰도",
    noSentimentAnalysisAvailable: "감정 분석을 사용할 수 없습니다",
    sentimentTrend: "감정 트렌드",
    conversationsAnalyzedNoTrend: "대화{s}가 분석되었지만 아직 트렌드 데이터를 사용할 수 없습니다",
    noSentimentData: "감정 데이터를 사용할 수 없습니다",
    avg: "평균:",
    negative: "부정적",
    positive: "긍정적",
    lastCallAnalysis: "마지막 통화 분석",
    noRecentCall: "최근 통화 없음",
    noRecentCallMessage: "가장 최근 대화에는 아직 감정 분석이 없습니다.",
    duration: "지속 시간",
    analysisDate: "분석 날짜",
    overallSentiment: "전체 감정",
    scoreRange: "점수 범위: -1.0 (매우 부정적) ~ +1.0 (매우 긍정적)",
    analysisConfidence: "분석 신뢰도:",
    keyEmotionsDetected: "감지된 주요 감정",
    clientMoodAssessment: "클라이언트 기분 평가",
    concernLevel: "우려 수준",
    lowConcernDescription: "클라이언트가 최소한의 우려로 좋은 기분을 보이고 있습니다.",
    mediumConcernDescription: "대화 중 일부 우려 영역이 발견되었습니다.",
    highConcernDescription: "주의가 필요할 수 있는 중요한 우려사항이 식별되었습니다.",
    satisfactionIndicators: "만족도 지표",
    positiveIndicators: "긍정적 지표",
    areasOfConcern: "우려 영역",
    aiSummary: "AI 요약",
    recommendations: "권장사항",
    sentimentAnalysisDebug: "감정 분석 디버그",
    debugSubtitle: "최근 대화의 누락된 감정 분석을 디버그하고 수정합니다",
    debugging: "디버깅 중...",
    debugSentimentAnalysis: "감정 분석 디버그",
    loading: "로딩 중...",
    debugConversationData: "대화 데이터 디버그",
    testing: "테스트 중...",
    testDirectApiCall: "직접 API 호출 테스트",
    forceRefreshCache: "캐시 강제 새로고침",
    currentClient: "현재 클라이언트:",
    debugResults: "디버그 결과",
    withoutSentiment: "감정 없음",
    successfullyAnalyzed: "성공적으로 분석됨",
    failedAnalyses: "실패한 분석",
    conversationDetails: "대화 세부사항",
    messages: "메시지",
    sentiment: "감정",
    score: "점수",
    mood: "기분",
    emotions: "감정",
    failed: "실패",
    noAnalysisPerformed: "분석이 수행되지 않음",
    cacheRefreshed: "캐시 새로고침됨",
    cacheRefreshedMessage: "감정 분석 캐시가 무효화되었습니다. UI가 자동으로 새로고침됩니다.",
    debugComplete: "디버그 완료",
    debugFailed: "디버그 실패",
    noClient: "클라이언트 없음",
    pleaseSelectClient: "먼저 클라이언트를 선택하세요",
    conversationDebugComplete: "대화 디버그 완료",
    directApiTest: "직접 API 테스트",
    conversationId: "대화 ID",
    insufficientDataForTrend: "추세 분석에 데이터가 부족합니다",
    lowConfidence: "낮은 신뢰도",
    needMoreConversations: "신뢰할 만한 추세를 위해 더 많은 대화가 필요합니다",
    noRecentCallButHaveCalls: "최근 통화 있음, 감정 분석 없음",
    noRecentCallButHaveCallsMessage: "최근 30일 내 통화가 있지만 감정 분석이 아직 없습니다. 새 통화는 종료 후 자동 분석됩니다. 이전 통화는 재처리가 필요할 수 있습니다.",
  },
  medicalAnalysis: {
    title: "의료 분석",
    error: "오류",
    success: "성공",
    noClientSelected: "선택된 클라이언트가 없습니다",
    selectClientToView: "의료 분석을 보려면 클라이언트를 선택하세요",
    triggering: "트리거 중...",
    triggerAnalysis: "분석 트리거",
    loadingResults: "분석 결과 로딩 중...",
    noResultsAvailable: "사용 가능한 분석 결과가 없습니다",
    triggerToGetStarted: "시작하려면 분석을 트리거하세요",
    cognitiveHealth: "인지 건강",
    mentalHealth: "정신 건강",
    language: "언어",
    risk: "위험",
    high: "높음",
    medium: "보통",
    low: "낮음",
    good: "좋음",
    fair: "보통",
    poor: "나쁨",
    warningsInsights: "경고 및 통찰",
    analysisDetails: "분석 세부 정보",
    conversations: "대화",
    messages: "메시지",
    totalWords: "총 단어 수",
    trigger: "트리거",
    trendsOverTime: "시간 경과에 따른 트렌드",
    overallHealth: "전체 건강",
    analyses: "분석",
    trendAnalysisComingSoon: "트렌드 분석 곧 제공 예정",
    analysisResultsAvailable: "분석 결과 사용 가능",
    basedOn: "기반",
    analysisResultsOver: "분석 결과",
    loadFailed: "의료 분석 결과 로드 실패",
    triggerFailed: "의료 분석 트리거 실패",
    triggerSuccess: "의료 분석이 성공적으로 트리거되었습니다. 결과는 약 10초 후에 나타납니다.",
    disclaimer: "이 분석은 정보 제공 목적으로만 사용되며 전문 의료 조언, 진단 또는 치료를 대체하지 않습니다. 의료 문제에 대해서는 항상 자격을 갖춘 의료 제공자와 상담하세요.",
    overview: "개요",
    confidence: "신뢰도",
    noDataAvailable: "분석에 사용할 수 있는 데이터가 없습니다",
    insufficientDataWarning: "제한된 데이터 사용 가능: {{current}} 통화 분석됨. 더 신뢰할 수 있는 분석을 위해 더 긴 기간에 걸쳐 {{minimum}} 통화 이상을 권장하여 클라이언트 패턴을 더 잘 이해할 수 있습니다.",
    analysisWillAppearAfterCalls: "통화가 완료된 후 분석 결과가 여기에 표시됩니다.",
    keyIndicators: "주요 지표",
    fillerWords: "채움 단어",
    vagueReferences: "모호한 참조",
    temporalConfusion: "시간적 혼란",
    wordFinding: "단어 찾기 어려움",
    repetition: "반복 점수",
    informationDensity: "정보 밀도",
    depressionScore: "우울증 점수",
    anxietyScore: "불안 점수",
    emotionalTone: "감정적 톤",
    negativeRatio: "부정적 비율",
    protectiveFactors: "보호 요인",
    typeTokenRatio: "어휘 다양성",
    avgWordLength: "평균 단어 길이",
    avgSentenceLength: "평균 문장 길이",
    uniqueWords: "고유 단어",
    crisisIndicators: "위기 지표 감지됨 - 즉시 전문 평가 권장",
    cognitiveInterpretation: {
      normal: "의사소통 패턴이 정상으로 보이며 중요한 인지적 우려가 감지되지 않았습니다.",
      mildConcern: "의사소통 패턴에 약간의 경미한 변화가 감지되었습니다. 진행 상황을 모니터링하세요.",
      moderateConcern: "의사소통 패턴에 중간 정도의 변화가 관찰되었습니다. 전문 평가를 고려하세요.",
      significantConcern: "의사소통 패턴에 중요한 변화가 감지되었습니다. 전문 평가를 강력히 권장합니다.",
    },
    psychiatricInterpretation: {
      stable: "정신 건강 지표가 안정적으로 보이며 중요한 우려가 없습니다.",
      mildConcern: "일부 경미한 정신 건강 지표가 감지되었습니다. 모니터링을 계속하세요.",
      moderateConcern: "중간 정도의 정신 건강 지표가 관찰되었습니다. 전문 상담을 고려하세요.",
      significantConcern: "중요한 정신 건강 지표가 감지되었습니다. 전문 상담을 권장합니다.",
      crisis: "위기 지표가 감지되었습니다. 즉시 전문 개입을 강력히 권장합니다.",
    },
    vocabularyInterpretation: {
      strong: "언어 복잡성과 어휘 사용이 강하고 잘 유지되는 것으로 보입니다.",
      average: "언어 복잡성과 어휘 사용이 정상 범위 내에 있습니다.",
      limited: "언어 복잡성과 어휘 사용이 제한적인 것으로 보입니다. 변화를 모니터링하세요.",
    },
  },
  profileScreen: {
    languageSelector: "언어 / Language",
    selectLanguage: "언어 선택",
    theme: "테마",
    selectTheme: "테마 선택",
    namePlaceholder: "이름",
    emailPlaceholder: "이메일",
    phonePlaceholder: "전화번호",
    yourProfile: "프로필",
    updateProfile: "프로필 업데이트",
    logout: "로그아웃",
    profileUpdatedSuccess: "프로필이 성공적으로 업데이트되었습니다!",
    profileUpdateFailed: "프로필 업데이트에 실패했습니다. 다시 시도해 주세요.",
    invalidPhoneFormat: "잘못된 전화번호 형식 (10자리 또는 +1XXXXXXXXXX)",
    completeProfileTitle: "프로필 완성",
    completeProfileMessage: "계속하기 전에 전화번호를 추가하여 프로필을 완성하세요.",
    completeProfileMessageUnverified: "프로필을 완성하고 모든 기능에 액세스하려면 전화번호를 추가하세요.",
    errorUploadingAvatar: "아바타 업로드 오류",
    emailVerified: "이메일 확인됨",
    emailNotVerified: "이메일 미확인",
    phoneVerified: "전화 확인됨",
    phoneNotVerified: "전화 미확인",
    verifyPhone: "전화 확인",
    fontSize: "글꼴 크기",
    fontSizeDescription: "가독성을 높이기 위해 텍스트 크기를 조정합니다. 변경 사항이 즉시 적용됩니다.",
    decreaseFontSize: "글꼴 크기 줄이기",
    increaseFontSize: "글꼴 크기 늘리기",
    fontSizeHint: "글꼴 크기를 80%에서 200%로 조정",
    telemetryOptIn: "익명 사용 데이터 공유",
    telemetryDescription: "익명 사용 데이터를 공유하여 앱 개선에 도움을 주세요. 개인 정보는 수집되지 않습니다.",
    telemetryEnabled: "원격 측정 활성화됨",
    telemetryDisabled: "원격 측정 비활성화됨",
    emailManagedBySSO: "이메일은 로그인 제공업체에서 관리하며 변경할 수 없습니다.",
    requestMyData: "내 데이터 요청",
    verificationEmailFailed: "인증 이메일 전송에 실패했습니다. 다시 시도하세요.",
    verificationEmailSent: "인증 이메일이 전송되었습니다! 받은편지함을 확인하세요.",
    verifyEmail: "이메일 인증",
    verifyPhoneBannerMessage: "긴급 알림 및 중요 알림을 받으려면 전화번호를 인증하세요. 미인증 번호로도 앱을 계속 사용할 수 있습니다.",
  },
  fraudAbuseAnalysis: {
    title: "사기 및 학대 분석",
    error: "오류",
    success: "성공",
    noClientSelected: "선택된 클라이언트 없음",
    selectClientToView: "사기 및 학대 분석을 보려면 클라이언트를 선택하세요",
    triggering: "트리거 중...",
    triggerAnalysis: "분석 트리거",
    loadingResults: "분석 결과 로딩 중...",
    noResultsAvailable: "분석 결과를 사용할 수 없음",
    triggerToGetStarted: "시작하려면 분석을 트리거하세요",
    analysisWillAppearAfterCalls: "분석 결과는 통화가 완료된 후 여기에 표시됩니다.",
    insufficientDataWarning: "제한된 데이터 사용 가능: {{current}}개의 통화가 분석되었습니다. 더 신뢰할 수 있는 분석을 위해 클라이언트 패턴을 더 잘 이해하기 위해 더 긴 기간에 걸쳐 {{minimum}}개 이상의 통화를 권장합니다.",
    loadFailed: "사기/학대 분석 결과 로드 실패",
    triggerFailed: "사기/학대 분석 트리거 실패",
    triggerSuccess: "사기/학대 분석이 성공적으로 완료되었습니다.",
    disclaimer: "이 분석은 정보 제공 목적으로만 사용되며 전문적인 평가를 대체하지 않습니다. 사기, 학대 또는 방치를 의심하는 경우 즉시 적절한 당국에 연락하세요.",
    overview: "개요",
    conversations: "대화",
    messages: "메시지",
    riskScore: "위험 점수",
    financialRisk: "재정적 위험",
    abuseRisk: "학대 위험",
    relationshipRisk: "관계 위험",
    warnings: "경고",
    recommendations: "권장 사항",
    critical: "심각",
    high: "높음",
    medium: "중간",
    low: "낮음",
    largeAmountMentions: "대액 언급",
    transferMethodMentions: "이체 방법 언급",
    scamIndicators: "사기 지표",
    physicalAbuseScore: "신체 학대 점수",
    emotionalAbuseScore: "정서적 학대 점수",
    neglectScore: "방치 점수",
    newPeopleCount: "새로운 사람 수",
    isolationCount: "고립 수",
    suspiciousBehaviorCount: "의심스러운 행동 수",
  },
  reportsScreen: {
    selectClient: "클라이언트 선택:",
    chooseClient: "클라이언트를 선택하세요...",
    sentiment: "감정",
    medicalAnalysis: "의료 분석",
    fraudAbuseAnalysis: "사기 및 학대",
    comingSoon: "곧 출시",
    modalTitle: "클라이언트 선택",
    modalCancel: "취소",
  },
  schedulesScreen: {
    scheduleDetails: "일정 세부사항",
    selectSchedule: "일정 선택:",
    scheduleNumber: "일정",
    noSchedulesAvailable: "사용 가능한 일정이 없습니다. 새로 만들어 주세요.",
    errorLoadingSchedules: "일정을 불러오는 중 오류가 발생했습니다.",
    errorSavingSchedule: "일정 저장 중 오류가 발생했습니다.",
    invalidScheduleError: "필수 일정 항목(빈도, 시간, 주간/월간 일정의 요일)을 모두 입력하세요.",
    newSchedule: "새 일정",
  },
  privacyPracticesScreen: {
    content: `# 개인정보 보호 실무 공지
## MyPhoneFriend 헬스케어 커뮤니케이션 서비스

**시행일**: 2025년 10월 15일

---

## 귀하의 정보. 귀하의 권리. 우리의 책임.

**이 공지는 귀하에 대한 의료 정보가 어떻게 사용되고 공개될 수 있는지, 그리고 이 정보에 접근하는 방법을 설명합니다. 신중하게 검토해 주세요.**

---

## 귀하의 권리

귀하는 다음의 권리가 있습니다:
- 건강 정보의 사본을 받을 수 있음
- 건강 정보를 수정할 수 있음
- 기밀 통신을 요청할 수 있음
- 공유하는 정보를 제한하도록 요청할 수 있음
- 정보를 공유한 대상의 목록을 받을 수 있음
- 이 개인정보 보호 공지의 사본을 받을 수 있음
- 귀하를 대신하여 행동할 사람을 선택할 수 있음
- 개인정보 보호 권리가 침해되었다고 믿는 경우 불만을 제기할 수 있음

---

## 귀하의 선택

다음과 같은 경우 정보 사용 및 공유 방식에 대한 선택권이 있습니다:
- 가족과 친구들의 귀하의 치료에 대한 질문에 답변
- 재해 구호 상황에서 귀하에 대한 정보 제공

**우리는 마케팅이나 데이터 판매를 위해 귀하의 정보를 공유하지 않습니다.**

---

# 귀하의 상세 권리

## 건강 정보의 사본 받기

**귀하의 건강 정보를 보거나 사본을 받을 수 있습니다.**

요청할 수 있는 내용:
- 통화 녹음 및 전사
- 웰니스 요약 및 AI 분석 결과
- 시스템에서 생성한 의료 알림
- 비상 알림
- 계정 정보 및 기본 설정

**요청 방법**:
- 이메일: privacy@biancawellness.com
- 전화: +1-604-562-4263

**우리의 응답**: 30일 이내

---

## 건강 정보 수정 요청

**부정확하거나 불완전하다고 생각하는 건강 정보의 수정을 요청할 수 있습니다.**

**우리의 응답**: 60일 이내

---

## 기밀 통신 요청

**특정 방식이나 위치로 연락하도록 요청할 수 있습니다.**

예:
- "전화 대신 이메일로 연락해 주세요"
- "휴대전화로만 연락해 주세요"

합리적인 요청은 모두 수용합니다.

---

## 사용 또는 공유 제한 요청

**특정 건강 정보를 사용하거나 공유하지 않도록 요청할 수 있습니다.**

전액 자비로 지불하고 건강 보험과 공유하지 않도록 요청한 경우 우리는 동의해야 합니다.

---

## 공개 목록 받기

**"공개 회계"를 요청할 수 있습니다** - 건강 정보를 공유한 횟수의 목록.

포함: 지난 6년  
제외: 치료, 지불 및 운영을 위한 공개(요청하지 않는 한)

---

## 불만 제기

**우리에게 제기**:
- 이메일: privacy@biancawellness.com
- 전화: +1-604-562-4263

**HHS에 제기**:
- 웹사이트: https://www.hhs.gov/hipaa/filing-a-complaint
- 전화: 1-800-368-1019

**불만을 제기한 것에 대해 보복하지 않습니다.**

---

# 우리의 사용 및 공개

## 건강 정보 사용 방법

**치료를 위해**:
- 간병인에게 AI 웰니스 요약 제공
- 긴급 상황에 대한 비상 알림 생성
- 간병인이 귀하의 웰빙을 모니터링할 수 있도록 함
- 간병 팀과의 커뮤니케이션 촉진

**지불을 위해**:
- 의료 기관에 서비스 청구
- 통화 시간 및 분석에 대한 청구서 처리

**의료 운영을 위해**:
- AI 감지 알고리즘 개선
- 품질 보증 및 개선
- 클라이언트에게 더 나은 서비스를 제공하기 위해 시스템 훈련

---

## 공유하는 대상

**귀하의 의료 기관**:
- 지정된 간병인 및 간병 코디네이터
- 청구를 위한 조직 관리자

**비즈니스 어소시에이트** (서비스 제공자):
- AI 서비스 (Azure OpenAI): 전사 및 분석을 위해
- 음성 서비스 (Twilio): 전화 통화 처리를 위해
- 클라우드 호스팅 (AWS): 안전한 데이터 저장을 위해
- 데이터베이스 (MongoDB Atlas): 데이터 관리를 위해

모든 비즈니스 어소시에이트는 비즈니스 어소시에이트 계약에 서명하고 귀하의 정보를 보호해야 합니다.

**법률에 따라 요구되는 경우**:
- 비상이 감지된 경우 비상 서비스 (911)
- 공중 보건 당국 (학대, 방치 신고)
- 법 집행 기관 (유효한 법적 명령이 있는 경우)

**우리는 하지 않습니다**:
- ❌ 건강 정보를 판매
- ❌ 마케터나 광고주와 공유
- ❌ 승인 없이 마케팅에 사용
- ❌ 소셜 미디어에서 공유

---

# 수집하는 건강 정보

**서비스 사용 중**:
- 클라이언트 이름, 전화번호, 생년월일
- 통화 녹음 및 전사
- 통화에서 얻은 건강 관련 정보 (증상, 약물, 기분)
- 비상 알림 및 사건
- 웰니스 추세 및 패턴
- 간병인 메모 및 관찰
- AI의 의료 분석 결과

---

# 귀하의 책임

**우리 서비스를 사용하여 다른 사람에게 전화를 거는 경우**, 귀하는 다음에 대한 책임이 있습니다:
- 녹음에 필요한 동의 획득
- 서비스를 이해하도록 보장
- 적용 가능한 녹음 동의 법률 준수

---

# 위반 알림

**건강 정보가 부적절하게 액세스되거나 공개된 경우**, 우리는:
- 사건을 조사합니다
- 보고 가능한 위반인 경우 60일 이내에 알림
- 무슨 일이 일어났는지, 무엇을 하고 있는지 설명
- 취할 수 있는 조치에 대한 정보 제공

---

# 이 공지의 변경

- 이 공지를 변경할 수 있으며 변경 사항은 우리가 보유한 모든 정보에 적용됩니다
- 새로운 공지는 앱과 웹사이트에서 사용할 수 있습니다
- 언제든지 현재 사본을 요청할 수 있습니다

---

# 연락처 정보

**개인정보 보호 책임자**:
- 이메일: privacy@biancawellness.com
- 전화: +1-604-562-4263
- 우편: MyPhoneFriend 개인정보 보호 사무소, 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

**영업 시간**: 월요일-금요일, 오전 9시-오후 5시 PST

---

# 불만 제기

**우리에게**:
- 이메일: privacy@biancawellness.com
- 전화: +1-604-562-4263

**연방 정부 (HHS)에**:
- 웹사이트: https://www.hhs.gov/hipaa/filing-a-complaint
- 전화: 1-800-368-1019
- 우편: 미국 보건복지부 시민권국, 200 Independence Avenue S.W., Washington, D.C. 20201

---

**시행일**: 2025년 10월 15일  
**버전**: 1.0

이 개인정보 보호 실무 공지는 HIPAA 개인정보 보호 규칙 (45 CFR §164.520)을 준수합니다

---

## 언어 지원

**영어**: 이 공지를 이해하는 데 도움이 필요한 경우 privacy@biancawellness.com으로 문의하세요

**Español**: Si necesita ayuda, comuníquese con privacy@biancawellness.com`,
  },
  mfa: {
    setupTitle: "다중 인증",
    setupSubtitle: "계정에 보안 계층 추가",
    setupInstructions: "인증 앱으로 QR 코드를 스캔한 다음 코드를 입력하여 확인하세요.",
    verificationTitle: "2단계 인증",
    verificationSubtitle: "인증 앱에서 6자리 코드를 입력하세요",
    tokenLabel: "인증 코드",
    tokenPlaceholder: "000000",
    pleaseEnterVerificationCode: "인증 앱에서 인증 코드를 입력하세요",
    verifyButton: "확인",
    useBackupCode: "백업 코드 사용",
    verifyAndEnable: "확인 및 활성화",
    enable: "MFA 활성화",
    enableMFA: "다중 인증 활성화",
    manageMFA: "다중 인증 관리",
    disable: "MFA 비활성화",
    disableTitle: "MFA 비활성화",
    disableSubtitle: "다중 인증을 비활성화하려면 현재 MFA 코드를 입력하세요",
    disableConfirmTitle: "MFA를 비활성화하시겠습니까?",
    disableConfirmMessage: "다중 인증을 비활성화하시겠습니까? 이렇게 하면 계정 보안이 낮아집니다.",
    enabled: "활성화됨",
    disabled: "비활성화됨",
    enabledSuccess: "다중 인증이 성공적으로 활성화되었습니다.",
    disabledSuccess: "다중 인증이 비활성화되었습니다.",
    status: "상태",
    enrolledOn: "등록일",
    backupCodesRemaining: "남은 백업 코드",
    backupCodesTitle: "백업 코드",
    backupCodesWarning: "이 코드를 안전한 곳에 저장하세요. 인증 장치를 분실한 경우 이를 사용하여 계정에 액세스할 수 있습니다.",
    backupCodeLength: "백업 코드는 8자입니다",
    regenerateBackupCodes: "백업 코드 재생성",
    regenerateBackupCodesTitle: "백업 코드를 재생성하시겠습니까?",
    regenerateBackupCodesSubtitle: "새 백업 코드를 생성하려면 현재 MFA 코드를 입력하세요",
    regenerateBackupCodesMessage: "이전 백업 코드는 더 이상 작동하지 않습니다. 새 코드를 안전하게 저장하세요.",
    regenerate: "재생성",
    backupCodesRegenerated: "백업 코드 재생성됨",
    backupCodesRegeneratedMessage: "새 백업 코드가 생성되었습니다. 안전하게 저장하세요.",
    secretLabel: "또는 이 시크릿을 수동으로 입력:",
    invalidTokenLength: "6자리 코드를 입력하세요",
    verificationFailed: "코드가 유효하지 않습니다. 다시 시도하세요.",
    enableFailed: "MFA 활성화 실패",
    disableFailed: "MFA 비활성화 실패. 코드를 확인하세요.",
    regenerateFailed: "백업 코드 재생성 실패.",
  },
  callScreen: {
    onboardingNextRegular: "온보딩이 끝나면 체크인은 일반 웰니스 형식을 사용합니다.",
    onboardingNextWillBe: "온보딩이 완료될 때까지 다음 발신 통화는 온보딩({{day}}회 세션)을 계속합니다.",
    onboardingProgress: "온보딩 세션 {{completed}}/{{total}} 완료.",
    onboardingThisCall: "이 통화는 {{total}}회 중 {{day}}회 온보딩 세션입니다. 거주자가 응답하고 세션이 완료되면 여정이 진행됩니다.",
    onboardingTitle: "거주자 온보딩",
    title: "통화",
    noClientSelected: "선택된 클라이언트 없음",
    callWith: "{{name}}님과 통화",
    callDetails: "통화 세부정보",
    clientLabel: "클라이언트:",
    phoneLabel: "전화:",
    statusLabel: "상태:",
    liveIndicator: "실시간",
    aiSpeaking: "AI 응답 중...",
    userSpeaking: "사용자 말하는 중...",
  },
  emailVerificationFailedPage: {
    helpExpired: "보안을 위해 인증 링크는 24시간 후 만료됩니다.",
    helpGeneric: "오류라고 생각되면 지원팀에 문의하세요.",
    loginButton: "로그인으로 이동",
    messageExpired: "이 인증 링크가 만료되었습니다. 새 인증 이메일을 요청하세요.",
    messageInvalid: "이 인증 링크가 유효하지 않거나 이미 사용되었습니다.",
    title: "인증 실패",
  },
  logoutScreen: {
    logoutButton: "로그아웃",
    logoutMessage: "정말 로그아웃하시겠습니까?",
  },
  phoneVerificationScreen: {
    codeResent: "인증 코드가 다시 전송되었습니다!",
    codeSent: "인증 코드가 전송되었습니다!",
    didntReceiveCode: "코드를 받지 못하셨나요?",
    errorResendingCode: "인증 코드 재전송에 실패했습니다. 다시 시도하세요.",
    errorSendingCode: "인증 코드 전송에 실패했습니다. 다시 시도하세요.",
    errorVerifyingCode: "유효하지 않은 인증 코드입니다. 다시 시도하세요.",
    invalidCode: "6자리 코드를 입력하세요",
    message: "{{phone}}(으)로 6자리 인증 코드를 보냈습니다. 아래에 입력하세요.",
    resendAvailableIn: "다시 보내기 가능",
    resendButton: "코드 다시 보내기",
    sendCodeButton: "인증 코드 보내기",
    title: "전화번호 인증",
    verifyButton: "전화 인증",
  },
  privacyRequestScreen: {
    accessMethodDownload: "다운로드",
    accessMethodEmail: "이메일",
    accessMethodInfo: "데이터는 JSON 첨부 파일로 이메일 전송됩니다.",
    accessMethodLabel: "데이터 수령 방법",
    additionalInformationLabel: "추가 정보(선택)",
    complaintDescriptionLabel: "설명 *",
    complaintDescriptionPlaceholder: "불만 내용, 발생한 일과 시기를 자세히 적어 주세요.",
    complaintFieldsRequired: "제목과 설명을 입력하세요.",
    complaintHistoryTitle: "불만 기록",
    complaintRequestDescription: "개인정보가 개인정보 보호법에 맞게 처리되지 않았다고 생각되면 불만을 제기할 수 있습니다. 30일 이내 조사 후 답변드립니다.",
    complaintRequestTitle: "개인정보 불만",
    complaintSubjectLabel: "제목 *",
    complaintSubjectPlaceholder: "불만에 대한 간단한 설명",
    complaintSubmitted: "불만이 제출되었습니다. 30일 이내 조사 후 답변드립니다.",
    completedOn: "완료일",
    confirmDelete: "삭제",
    correctionFieldLabel: "정정할 필드",
    correctionFieldPlaceholder: "예: 이메일, 전화번호, 이름",
    correctionFieldsRequired: "필드 이름과 요청 값을 입력하세요.",
    correctionNote: "참고: 대부분의 데이터는 앱에서 직접 수정할 수 있습니다. 편집할 수 없는 기록·시스템 생성 데이터에는 이 양식을 사용하세요.",
    correctionReasonLabel: "정정 사유(선택)",
    correctionReasonPlaceholder: "이 정보를 정정해야 하는 이유는?",
    correctionRequestDescription: "개인정보 정정을 요청하세요. 수정이 필요한 내용을 알려주세요.",
    correctionRequestSubmitted: "정정 요청이 제출되었습니다. 30일 이내 검토·처리합니다.",
    correctionRequestTitle: "데이터 정정 요청",
    currentValue: "현재 값",
    currentValueLabel: "현재 값(선택)",
    currentValuePlaceholder: "현재 값은 무엇인가요?",
    deletionCompleted: "데이터 삭제가 완료되었습니다.",
    deletionConfirmMessage: "데이터가 영구 삭제됩니다. 이 작업은 취소할 수 없습니다. 계속하시겠습니까?",
    deletionConfirmTitle: "데이터 삭제 확인",
    deletionDataTypeLabel: "삭제할 데이터",
    deletionFailed: "데이터 삭제에 실패했습니다. 법적 보관 요건으로 관할권에서 사용할 수 없을 수 있습니다.",
    deletionRequestDescription: "PIPEDA에 따라 개인정보 삭제를 요청할 수 있습니다. 참고: HIPAA는 7년 보관을 요구하므로 모든 관할권에서 삭제가 가능하지 않을 수 있습니다.",
    deletionRequestTitle: "데이터 삭제 요청",
    deletionTypeAll: "모든 데이터",
    deletionTypeCalls: "통화만",
    deletionTypeConversations: "대화만",
    deletionTypeMedicalAnalysis: "의료 분석만",
    field: "필드",
    filedOn: "제기일",
    informationRequestedLabel: "요청 정보",
    informationRequestedPlaceholder: "모든 개인정보(또는 필요한 항목 지정)",
    reason: "사유",
    requestDataDescription: "접근하려는 정보를 설명하세요. 비워 두면 모든 개인정보를 요청합니다.",
    requestDataTitle: "데이터 접근 요청",
    requestDeletion: "데이터 삭제 요청",
    requestFailed: "요청 제출에 실패했습니다. 다시 시도하세요.",
    requestHistoryTitle: "요청 기록",
    requestSubmitted: "데이터 요청이 제출되었습니다. 곧 이메일로 데이터를 받게 됩니다.",
    requestTypeAccess: "접근 요청",
    requestTypeComplaint: "불만 제기",
    requestTypeCorrection: "정정 요청",
    requestedOn: "요청일",
    requestedValue: "요청 값",
    requestedValueLabel: "요청 값 *",
    requestedValuePlaceholder: "수정될 값은 무엇인가요?",
    resolvedOn: "해결일",
    submitRequest: "요청 제출",
    subtitle: "PIPEDA에 따라 개인정보에 접근하고 정정할 권리가 있습니다. 데이터 접근 또는 정정을 요청하세요.",
    title: "내 데이터 요청",
    violationTypeAccess: "접근 문제",
    violationTypeLabel: "문제 유형(선택)",
    violationTypeOther: "기타",
  },
  themes: {
    accessibility: {
      colorblindFriendly: "색각 이상 친화",
      darkMode: "다크 모드",
      highContrast: "고대비",
      wcagLevel: "WCAG 수준",
    },
    colorblind: {
      description: "색각 이상에 최적화된 고대비 테마",
      name: "색각 이상 친화",
    },
    dark: {
      description: "저조도 환경에 최적화된 다크 테마",
      name: "다크 모드",
    },
    healthcare: {
      description: "파란색과 녹색의 전문 의료 테마",
      name: "헬스케어",
    },
    highcontrast: {
      description: "시각 장애를 위한 최대 대비 테마(WCAG AAA)",
      name: "고대비",
    },
  },
  caregiverInvitedScreen: {
    title: "초대가 전송되었습니다!",
    message: "돌봄 제공자 초대가 성공적으로 전송되었습니다.",
    continue: "계속",
    subMessage: "They will receive an email with instructions to complete their registration.",
  },
}

export default ko
