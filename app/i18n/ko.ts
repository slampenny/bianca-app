import { Translations } from "./en"

const ko: Translations = {
  common: {
    ok: "확인!",
    cancel: "취소",
    back: "뒤로",
    logOut: "로그아웃",
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
    patient: "환자:",
    importance: "중요도:",
    expires: "만료:",
  },
  welcomeScreen: {
    postscript:
      "잠깐! — 지금 보시는 것은 아마도 당신의 앱의 모양새가 아닐겁니다. (디자이너분이 이렇게 건내주셨다면 모를까요. 만약에 그렇다면, 이대로 가져갑시다!) ",
    readyForLaunch: "출시 준비가 거의 끝난 나만의 앱!",
    exciting: "(오, 이거 신나는데요!)",
    letsGo: "가보자구요!",
  },
  errorScreen: {
    title: "뭔가 잘못되었습니다!",
    friendlySubtitle:
      "이 화면은 오류가 발생할 때 프로덕션에서 사용자에게 표시됩니다. 이 메시지를 커스터마이징 할 수 있고(해당 파일은 `app/i18n/ko.ts` 에 있습니다) 레이아웃도 마찬가지로 수정할 수 있습니다(`app/screens/error`). 만약 이 오류화면을 완전히 없에버리고 싶다면 `app/app.tsx` 파일에서 <ErrorBoundary> 컴포넌트를 확인하기 바랍니다.",
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
    enterDetails:
      "일급비밀 정보를 해제하기 위해 상세 정보를 입력하세요. 무엇이 기다리고 있는지 절대 모를겁니다. 혹은 알 수 있을지도 모르겠군요. 엄청 복잡한 뭔가는 아닙니다.",
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
    tagLine:
      "전문적인 React Native 엔지니어들로 구성된 Infinite Red 커뮤니티에 접속해서 함께 개발 실력을 향상시켜 보세요!",
    joinUsOnSlackTitle: "Slack 에 참여하세요",
    joinUsOnSlack:
      "전 세계 React Native 엔지니어들과 함께할 수 있는 곳이 있었으면 좋겠죠? Infinite Red Community Slack 에서 대화에 참여하세요! 우리의 성장하는 커뮤니티는 질문을 던지고, 다른 사람들로부터 배우고, 네트워크를 확장할 수 있는 안전한 공간입니다. ",
    joinSlackLink: "Slack 에 참여하기",
    makeIgniteEvenBetterTitle: "Ignite 을 향상시켜요",
    makeIgniteEvenBetter:
      "Ignite 을 더 좋게 만들 아이디어가 있나요? 기쁜 소식이네요. 우리는 항상 최고의 React Native 도구를 구축하는데 도움을 줄 수 있는 분들을 찾고 있습니다. GitHub 에서 Ignite 의 미래를 만들어 가는것에 함께해 주세요.",
    contributeToIgniteLink: "Ignite 에 기여하기",
    theLatestInReactNativeTitle: "React Native 의 최신정보",
    theLatestInReactNative: "React Native 가 제공하는 모든 최신 정보를 알려드립니다.",
    reactNativeRadioLink: "React Native 라디오",
    reactNativeNewsletterLink: "React Native 뉴스레터",
    reactNativeLiveLink: "React Native 라이브 스트리밍",
    chainReactConferenceLink: "Chain React 컨퍼런스",
    hireUsTitle: "다음 프로젝트에 Infinite Red 를 고용하세요",
    hireUs:
      "프로젝트 전체를 수행하든, 실무 교육을 통해 팀의 개발 속도에 박차를 가하든 상관없이, Infinite Red 는 React Native 프로젝트의 모든 분야의 에서 도움을 드릴 수 있습니다.",
    hireUsLink: "메세지 보내기",
  },
  demoShowroomScreen: {
    jumpStart: "프로젝트를 바로 시작할 수 있는 컴포넌트들!",
    lorem2Sentences:
      "별 하나에 추억과, 별 하나에 사랑과, 별 하나에 쓸쓸함과, 별 하나에 동경(憧憬)과, 별 하나에 시와, 별 하나에 어머니, 어머니",
    demoHeaderTxExample: "야호",
    demoViaTxProp: "`tx` Prop 을 통해",
    demoViaSpecifiedTxProp: "`{{prop}}Tx` Prop 을 통해",
  },
  demoDebugScreen: {
    howTo: "사용방법",
    title: "디버그",
    tagLine:
      "축하합니다. 여기 아주 고급스러운 React Native 앱 템플릿이 있습니다. 이 보일러 플레이트를 사용해보세요!",
    reactotron: "Reactotron 으로 보내기",
    reportBugs: "버그 보고하기",
    demoList: "데모 목록",
    demoPodcastList: "데모 팟캐스트 목록",
    androidReactotronHint:
      "만약에 동작하지 않는 경우, Reactotron 데스크탑 앱이 실행중인지 확인 후, 터미널에서 adb reverse tcp:9090 tcp:9090 을 실행한 다음 앱을 다시 실행해보세요.",
    iosReactotronHint:
      "만약에 동작하지 않는 경우, Reactotron 데스크탑 앱이 실행중인지 확인 후 앱을 다시 실행해보세요.",
    macosReactotronHint:
      "만약에 동작하지 않는 경우, Reactotron 데스크탑 앱이 실행중인지 확인 후 앱을 다시 실행해보세요.",
    webReactotronHint:
      "만약에 동작하지 않는 경우, Reactotron 데스크탑 앱이 실행중인지 확인 후 앱을 다시 실행해보세요.",
    windowsReactotronHint:
      "만약에 동작하지 않는 경우, Reactotron 데스크탑 앱이 실행중인지 확인 후 앱을 다시 실행해보세요.",
  },
  demoPodcastListScreen: {
    title: "React Native 라디오 에피소드",
    onlyFavorites: "즐겨찾기만 보기",
    favoriteButton: "즐겨찾기",
    unfavoriteButton: "즐겨찾기 해제",
    accessibility: {
      cardHint:
        "에피소드를 들으려면 두 번 탭하세요. 이 에피소드를 좋아하거나 싫어하려면 두 번 탭하고 길게 누르세요.",
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
    noPatientSelected: "선택된 환자가 없습니다",
    firstConversation: "이전 대화를 찾을 수 없습니다. 이 환자와의 첫 번째 대화가 될 것입니다.",
    noConversationsToDisplay: "표시할 대화가 없습니다",
    noPreviousConversations: "이 환자의 이전 대화를 찾을 수 없습니다",
    errorFetchingConversations: "대화를 가져오는 중 오류가 발생했습니다",
  },
  patientScreen: {
    nameLabel: "이름 *",
    namePlaceholder: "환자 이름을 입력하세요",
    emailLabel: "이메일 *",
    emailPlaceholder: "이메일 주소를 입력하세요",
    phoneLabel: "전화번호 *",
    phonePlaceholder: "전화번호를 입력하세요",
    preferredLanguageLabel: "선호 언어",
    updatePatient: "환자 업데이트",
    createPatient: "환자 생성",
    manageSchedules: "일정 관리",
    manageConversations: "대화 관리",
    viewSentimentAnalysis: "감정 분석 보기",
    manageCaregivers: "간병인 관리",
    confirmDelete: "삭제 확인",
    deletePatient: "환자 삭제",
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
    // Invoice details
    amount: "금액:",
    invoiceNumber: "청구서 번호:",
    issueDate: "발행일:",
    dueDate: "만료일:",
    notes: "메모:",
    // Current charges
    noOrganizationData: "조직 데이터를 사용할 수 없습니다.",
    authorizationTokenNotAvailable: "인증 토큰을 사용할 수 없습니다.",
    errorLoadingCurrentCharges: "현재 요금을 로드하는 중 오류가 발생했습니다.",
    noPendingCharges: "대기 중인 요금 없음",
    allConversationsBilled: "모든 대화가 청구되었습니다. 새로운 요금이 누적되면서 여기에 표시됩니다.",
    totalUnbilledAmount: "총 미청구 금액:",
    period: "기간:",
    lastDays: "최근 {days}일",
    patientsWithCharges: "요금이 있는 환자:",
    patient: "환자",
    patients: "환자들",
    chargesByPatient: "환자별 요금",
    conversation: "대화",
    conversations: "대화들",
    average: "평균:",
    // Billing info
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
    // Access control
    accessRestricted: "액세스 제한됨",
    accessRestrictedMessage: "결제 정보를 보거나 관리할 수 있는 필요한 권한이 없습니다.",
    contactAdministrator: "도움을 받으려면 조직 관리자에게 문의하세요.",
    loadingUserInformation: "사용자 정보 로딩 중...",
    // Payment methods / Stripe
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
  },
  caregiverScreen: {
    namePlaceholder: "이름",
    emailPlaceholder: "이메일",
    phonePlaceholder: "전화번호",
    loadingUnassignedPatients: "할당되지 않은 환자 로딩 중...",
    assigningPatients: "환자 할당 중...",
    patientsAssignedSuccess: "환자가 성공적으로 할당되었습니다!",
    loadingCaregivers: "간병인 로딩 중...",
  },
  caregiversScreen: {
    invited: "초대됨",
    edit: "편집",
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
  },
  homeScreen: {
    welcome: "환영합니다, {{name}}",
    guest: "게스트",
    addPatient: "환자 추가",
    adminOnlyMessage: "조직 관리자와 슈퍼 관리자만 환자를 추가할 수 있습니다",
    noPatientsFound: "환자를 찾을 수 없습니다",
    viewSchedules: "일정 보기",
    noScheduleWarning: "⚠ 일정이 설정되지 않음",
  },
  tabs: {
    home: "홈",
    org: "조직",
    reports: "보고서",
    alerts: "알림",
  },
  common: {
    cancel: "취소",
    close: "닫기",
    error: "오류",
    anErrorOccurred: "오류가 발생했습니다",
    selectImage: "이미지 선택",
    calling: "통화 중...",
    callNow: "지금 통화",
    ending: "종료 중...",
    endCall: "통화 종료",
    loading: "로딩 중...",
  },
  legalLinks: {
    privacyPolicy: "개인정보 보호정책",
    privacyPractices: "HIPAA 개인정보 보호 관행",
    termsOfService: "서비스 약관",
  },
  headers: {
    home: "홈",
    patient: "환자",
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
    medicalAnalysis: "의료 분석",
    fraudAbuseAnalysis: "사기 및 학대 분석",
    privacyPolicy: "개인정보 보호정책",
    privacyPractices: "HIPAA 개인정보 보호 관행",
    termsOfService: "서비스 약관",
    mentalHealthReport: "정신 건강 보고서",
    login: "로그인",
    register: "등록",
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
    noPatientSelected: "선택된 환자가 없습니다",
    selectPatientToView: "감정 분석을 보려면 홈 화면에서 환자를 선택하세요.",
    // Dashboard
    patientSentimentAnalysis: "환자 감정 분석",
    emotionalWellnessInsights: "감정적 웰빙 인사이트 및 트렌드",
    timeRange: "시간 범위:",
    noSentimentDataAvailable: "감정 데이터를 사용할 수 없습니다",
    noSentimentDataMessage: "환자가 대화를 완료하면 여기에 감정 분석이 나타납니다.",
    loadingSentimentAnalysis: "감정 분석 로딩 중...",
    sentimentAnalysisFooter: "감정 분석은 AI 기술을 사용하여 각 대화 후 자동으로 생성됩니다.",
    // Summary Card
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
    // Recent Trends
    recentConversationsTitle: "최근 대화",
    conversationsWithSentiment: "감정 분석이 있는 대화{s}",
    noRecentConversations: "감정 분석이 있는 최근 대화가 없습니다",
    keyEmotions: "주요 감정:",
    moreEmotions: "더 보기",
    patientMood: "환자 기분:",
    concern: "우려",
    confidence: "신뢰도",
    noSentimentAnalysisAvailable: "감정 분석을 사용할 수 없습니다",
    // Trend Chart
    sentimentTrend: "감정 트렌드",
    conversationsAnalyzedNoTrend: "대화{s}가 분석되었지만 아직 트렌드 데이터를 사용할 수 없습니다",
    noSentimentData: "감정 데이터를 사용할 수 없습니다",
    avg: "평균:",
    negative: "부정적",
    positive: "긍정적",
    // Last Call
    lastCallAnalysis: "마지막 통화 분석",
    noRecentCall: "최근 통화 없음",
    noRecentCallMessage: "가장 최근 대화에는 아직 감정 분석이 없습니다.",
    duration: "지속 시간",
    analysisDate: "분석 날짜",
    overallSentiment: "전체 감정",
    scoreRange: "점수 범위: -1.0 (매우 부정적) ~ +1.0 (매우 긍정적)",
    analysisConfidence: "분석 신뢰도:",
    keyEmotionsDetected: "감지된 주요 감정",
    patientMoodAssessment: "환자 기분 평가",
    concernLevel: "우려 수준",
    concern: "우려",
    lowConcernDescription: "환자가 최소한의 우려로 좋은 기분을 보이고 있습니다.",
    mediumConcernDescription: "대화 중 일부 우려 영역이 발견되었습니다.",
    highConcernDescription: "주의가 필요할 수 있는 중요한 우려사항이 식별되었습니다.",
    satisfactionIndicators: "만족도 지표",
    positiveIndicators: "긍정적 지표",
    areasOfConcern: "우려 영역",
    aiSummary: "AI 요약",
    recommendations: "권장사항",
    // Debug Panel
    sentimentAnalysisDebug: "감정 분석 디버그",
    debugSubtitle: "최근 대화의 누락된 감정 분석을 디버그하고 수정합니다",
    debugging: "디버깅 중...",
    debugSentimentAnalysis: "감정 분석 디버그",
    loading: "로딩 중...",
    debugConversationData: "대화 데이터 디버그",
    testing: "테스트 중...",
    testDirectApiCall: "직접 API 호출 테스트",
    forceRefreshCache: "캐시 강제 새로고침",
    currentPatient: "현재 환자:",
    noPatientSelected: "선택된 환자가 없습니다",
    debugResults: "디버그 결과",
    totalConversations: "총 대화 수",
    withoutSentiment: "감정 없음",
    successfullyAnalyzed: "성공적으로 분석됨",
    failedAnalyses: "실패한 분석",
    conversationDetails: "대화 세부사항",
    messages: "메시지",
    sentiment: "감정",
    score: "점수",
    mood: "기분",
    emotions: "감정",
    concernLevel: "우려 수준",
    failed: "실패",
    noAnalysisPerformed: "분석이 수행되지 않음",
    cacheRefreshed: "캐시 새로고침됨",
    cacheRefreshedMessage: "감정 분석 캐시가 무효화되었습니다. UI가 자동으로 새로고침됩니다.",
    debugComplete: "디버그 완료",
    debugFailed: "디버그 실패",
    noPatient: "환자 없음",
    pleaseSelectPatient: "먼저 환자를 선택하세요",
    conversationDebugComplete: "대화 디버그 완료",
    directApiTest: "직접 API 테스트",
  },
  medicalAnalysis: {
    title: "의료 분석",
    error: "오류",
    success: "성공",
    noPatientSelected: "선택된 환자가 없습니다",
    selectPatientToView: "의료 분석을 보려면 환자를 선택하세요",
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
    insufficientDataWarning: "제한된 데이터 사용 가능: {{current}} 통화 분석됨. 더 신뢰할 수 있는 분석을 위해 더 긴 기간에 걸쳐 {{minimum}} 통화 이상을 권장하여 환자 패턴을 더 잘 이해할 수 있습니다.",
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
  },
  fraudAbuseAnalysis: {
    title: "사기 및 학대 분석",
    error: "오류",
    success: "성공",
    noPatientSelected: "선택된 환자 없음",
    selectPatientToView: "사기 및 학대 분석을 보려면 환자를 선택하세요",
    triggering: "트리거 중...",
    triggerAnalysis: "분석 트리거",
    loadingResults: "분석 결과 로딩 중...",
    noResultsAvailable: "분석 결과를 사용할 수 없음",
    triggerToGetStarted: "시작하려면 분석을 트리거하세요",
    analysisWillAppearAfterCalls: "분석 결과는 통화가 완료된 후 여기에 표시됩니다.",
    insufficientDataWarning: "제한된 데이터 사용 가능: {{current}}개의 통화가 분석되었습니다. 더 신뢰할 수 있는 분석을 위해 환자 패턴을 더 잘 이해하기 위해 더 긴 기간에 걸쳐 {{minimum}}개 이상의 통화를 권장합니다.",
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
    selectPatient: "환자 선택:",
    choosePatient: "환자를 선택하세요...",
    sentiment: "감정",
    medicalAnalysis: "의료 분석",
    fraudAbuseAnalysis: "사기 및 학대",
    comingSoon: "곧 출시",
    modalTitle: "환자 선택",
    modalCancel: "취소",
  },
  schedulesScreen: {
    scheduleDetails: "일정 세부사항",
    selectSchedule: "일정 선택:",
    scheduleNumber: "일정",
    noSchedulesAvailable: "사용 가능한 일정이 없습니다. 새로 만들어 주세요.",
    errorLoadingSchedules: "일정을 불러오는 중 오류가 발생했습니다.",
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
    scheduleDetails: "일정 세부사항",
    active: "활성",
  },
  conversationsScreen: {
    title: "대화",
    yesterday: "어제",
    noMessages: "메시지 없음",
    noPatientSelected: "선택된 환자 없음",
    firstConversation: "이전 대화를 찾을 수 없습니다. 이 환자와의 첫 번째 대화가 될 것입니다.",
    noConversationsToDisplay: "표시할 대화가 없습니다",
    noPreviousConversations: "이 환자의 이전 대화를 찾을 수 없습니다",
    errorFetchingConversations: "대화를 가져오는 중 오류가 발생했습니다",
    loadingMoreConversations: "더 많은 대화를 불러오는 중...",
  },
  caregiversScreen: {
    invited: "초대됨",
    edit: "편집",
    noCaregiversFound: "간병인을 찾을 수 없습니다",
    notAuthorized: "권한 없음",
    noPermissionToView: "간병인을 볼 권한이 없습니다",
    addCaregiver: "간병인 추가",
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
- 환자에게 더 나은 서비스를 제공하기 위해 시스템 훈련

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
- 환자 이름, 전화번호, 생년월일
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
}

export default ko
