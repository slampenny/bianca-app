import { LocaleTranslations } from "./en"

const ar: LocaleTranslations = {
  common: {
    ok: "نعم",
    cancel: "حذف",
    close: "إغلاق",
    error: "خطأ",
    anErrorOccurred: "حدث خطأ",
    selectImage: "اختر صورة",
    calling: "جاري الاتصال...",
    callNow: "اتصل الآن",
    ending: "إنهاء...",
    endCall: "إنهاء المكالمة",
    loading: "جاري التحميل...",
    back: "خلف",
    logOut: "تسجيل خروج",
    signInToContinue: "يرجى تسجيل الدخول للمتابعة.",
    continue: "متابعة",
    delete: "حذف",
    done: "تم",
  },
  alertScreen: {
    markAllAsRead: "تحديد الكل كمقروء",
    unreadAlerts: "التنبيهات غير المقروءة",
    allAlerts: "جميع التنبيهات",
    noAlerts: "لا توجد تنبيهات",
    noAlertsTitle: "تم كل شيء!",
    noAlertsSubtitle: "ليس لديك تنبيهات غير مقروءة. عمل رائع في البقاء محدثاً!",
    emptyHeading: "فارغ جداً... حزين جداً",
    refreshing: "جاري التحديث...",
    refresh: "تحديث",
    client: "العميل:",
    importance: "الأهمية:",
    expires: "ينتهي:",
    filteredByClientBanner: "عرض التنبيهات لـ {{name}}",
    clearAlertFilter: "عرض الكل",
    noAlertsForFilteredClientTitle: "لا توجد تنبيهات لهذا العميل",
    noAlertsForFilteredClientSubtitle: "لا توجد تنبيهات مرتبطة بـ {{name}}. أزل التصفية لعرض كل التنبيهات أو اختر عميلاً آخر من الرئيسية.",
  },
  welcomeScreen: {
    postscript: "ربما لا يكون هذا هو الشكل الذي يبدو عليه تطبيقك مالم يمنحك المصمم هذه الشاشات وشحنها في هذه الحالة",
    readyForLaunch: "تطبيقك تقريبا جاهز للتشغيل",
    exciting: "اوه هذا مثير",
    letsGo: "لنذهب",
  },
  errorScreen: {
    title: "هناك خطأ ما",
    friendlySubtitle: "هذه هي الشاشة التي سيشاهدها المستخدمون في عملية الانتاج عند حدوث خطأ. سترغب في تخصيص هذه الرسالة ( الموجودة في 'ts.en/i18n/app') وربما التخطيط ايضاً ('app/screens/ErrorScreen'). إذا كنت تريد إزالة هذا بالكامل، تحقق من 'app/app.tsp' من اجل عنصر <ErrorBoundary>.",
    reset: "اعادة تعيين التطبيق",
    traceTitle: "خطأ من مجموعة %{name}",
  },
  emptyStateComponent: {
    generic: {
      heading: "فارغة جداً....حزين",
      content: "لا توجد بيانات حتى الآن. حاول النقر فوق الزر لتحديث التطبيق او اعادة تحميله.",
      button: "لنحاول هذا مرّة أخرى",
    },
  },
  errors: {
    invalidEmail: "عنوان البريد الالكتروني غير صالح",
  },
  loginScreen: {
    signIn: "تسجيل الدخول",
    register: "تسجيل",
    enterDetails: ".ادخل التفاصيل الخاصة بك ادناه لفتح معلومات سرية للغاية. لن تخمن ابداً ما الذي ننتظره. او ربما ستفعل انها انها ليست علم الصواريخ",
    emailFieldLabel: "البريد الالكتروني",
    passwordFieldLabel: "كلمة السر",
    emailFieldPlaceholder: "ادخل بريدك الالكتروني",
    passwordFieldPlaceholder: "كلمة السر هنا فائقة السر",
    forgotPassword: "نسيت كلمة المرور؟",
    tapToSignIn: "انقر لتسجيل الدخول!",
    hint: "(: تلميح: يمكنك استخدام اي عنوان بريد الكتروني وكلمة السر المفضلة لديك",
    appName: "Bianca",
    tagline: "تواصل فحص الرفاهية",
  },
  demoNavigator: {
    componentsTab: "عناصر",
    debugTab: "تصحيح",
    communityTab: "واصل اجتماعي",
    podcastListTab: "البودكاست",
  },
  demoCommunityScreen: {
    title: "تواصل مع المجتمع",
    tagLine: "قم بالتوصيل لمنتدى Infinite Red الذي يضم تفاعل المهندسين المحلّيين ورفع مستوى تطوير تطبيقك معنا",
    joinUsOnSlackTitle: "انضم الينا على Slack",
    joinUsOnSlack: "هل ترغب في وجود مكان للتواصل مع مهندسي React Native حول العالم؟ الانضمام الى المحادثة في سلاك المجتمع الاحمر اللانهائي! مجتمعناالمتنامي هو مساحةآمنة لطرح الاسئلة والتعلم من الآخرين وتنمية شبكتك.",
    joinSlackLink: "انضم الي مجتمع Slack",
    makeIgniteEvenBetterTitle: "اجعل Ignite افضل",
    makeIgniteEvenBetter: "هل لديك فكرة لجعل Ignite افضل؟ نحن سعداء لسماع ذلك! نحن نبحث دائماً عن الآخرين الذين يرغبون في مساعدتنا في بناء افضل الادوات المحلية التفاعلية المتوفرة هناك. انضم الينا عبر GitHub للانضمام الينا في بناء مستقبل Ignite",
    contributeToIgniteLink: "ساهم في Ignite",
    theLatestInReactNativeTitle: "الاحدث في React Native",
    theLatestInReactNative: "نخن هنا لنبقيك محدثاً على جميع React Native التي تعرضها",
    reactNativeRadioLink: "راديو React Native",
    reactNativeNewsletterLink: "نشرة اخبار React Native",
    reactNativeLiveLink: "مباشر React Native",
    chainReactConferenceLink: "مؤتمر Chain React",
    hireUsTitle: "قم بتوظيف Infinite Red لمشروعك القادم",
    hireUs: "سواء كان الامر يتعلّق بتشغيل مشروع كامل او اعداد الفرق بسرعة من خلال التدريب العلمي لدينا، يمكن ان يساعد Infinite Red اللامتناهي في اي مشروع محلي يتفاعل معه.",
    hireUsLink: "ارسل لنا رسالة",
  },
  demoShowroomScreen: {
    jumpStart: "مكونات او عناصر لبدء مشروعك",
    lorem2Sentences: "عامل الناس بأخلاقك لا بأخلاقهم. عامل الناس بأخلاقك لا بأخلاقهم. عامل الناس بأخلاقك لا بأخلاقهم",
    demoHeaderTxExample: "ياي",
    demoViaTxProp: "عبر `tx` Prop",
    demoViaSpecifiedTxProp: "Prop `{{prop}}Tx` عبر",
  },
  demoDebugScreen: {
    howTo: "كيف",
    title: "التصحيح",
    tagLine: "مبروك، لديك نموذج اصلي متقدم للغاية للتفاعل هنا. الاستفادة من هذه النمذجة",
    reactotron: "Reactotron ارسل إلى",
    reportBugs: "الابلاغ عن اخطاء",
    demoList: "قائمة تجريبية",
    demoPodcastList: "قائمة البودكاست التجريبي",
    androidReactotronHint: `اذا لم ينجح ذللك، فتأكد من تشغيل تطبيق الحاسوب الخاص Reactotron، وقم بتشغيل عكس adb tcp:9090 
tcp:9090 من جهازك الطرفي ، واعد تحميل التطبيق`,
    iosReactotronHint: "اذا لم ينجح ذلك، فتأكد من تشغيل تطبيق الحاسوب الخاص ب Reactotron وأعد تحميل التطبيق",
    macosReactotronHint: "اذا لم ينجح ذلك، فتأكد من تشغيل الحاسوب ب Reactotron وأعد تحميل التطبيق",
    webReactotronHint: "اذا لم ينجح ذلك، فتأكد من تشغيل الحاسوب ب Reactotron وأعد تحميل التطبيق",
    windowsReactotronHint: "اذا لم ينجح ذلك، فتأكد من تشغيل الحاسوب ب Reactotron وأعد تحميل التطبيق",
  },
  demoPodcastListScreen: {
    title: "حلقات إذاعية React Native",
    onlyFavorites: "المفضلة فقط",
    favoriteButton: "المفضل",
    unfavoriteButton: "غير مفضل",
    accessibility: {
      cardHint: "انقر مرّتين للاستماع على الحلقة. انقر مرّتين وانتظر لتفعيل {{action}} هذه الحلقة.",
      switch: "قم بالتبديل لاظهار المفضّلة فقط.",
      favoriteAction: "تبديل المفضلة",
      favoriteIcon: "الحلقة الغير مفضّلة",
      unfavoriteIcon: "الحلقة المفضّلة",
      publishLabel: "نشرت {{date}}",
      durationLabel: "المدّة: {{hours}} ساعات {{minutes}} دقائق {{seconds}} ثواني",
    },
    noFavoritesEmptyState: {
      heading: "هذا يبدو فارغاً بعض الشيء.",
      content: "لم تتم اضافة اي مفضلات حتى الان. اضغط على القلب في إحدى الحلقات لإضافته الى المفضلة.",
    },
  },
  registerScreen: {
    title: "تسجيل",
    nameFieldLabel: "الاسم",
    emailFieldLabel: "البريد الالكتروني",
    phoneFieldLabel: "الهاتف",
    passwordFieldLabel: "كلمة المرور",
    goBack: "رجوع",
    confirmPasswordFieldLabel: "تأكيد كلمة المرور",
    organizationNameFieldLabel: "اسم المنظمة",
    nameFieldPlaceholder: "ادخل اسمك",
    emailFieldPlaceholder: "ادخل بريدك الالكتروني",
    passwordFieldPlaceholder: "ادخل كلمة المرور",
    confirmPasswordFieldPlaceholder: "أكد كلمة المرور",
    phoneFieldPlaceholder: "(xxx)xxx-xxxx",
    organizationNameFieldPlaceholder: "ادخل اسم منظمتك",
    organizationButton: "منظمة",
    individualButton: "فردي",
    individualExplanation: "سجل كفرد للاستخدام الشخصي.",
    organizationExplanation: "سجل كمنظمة للاستخدام الشركاتي أو الجماعي.",
    consentText: "بالتسجيل، أنت توافق على",
    consentAnd: "و",
    termsOfService: "شروط الخدمة",
    privacyPolicy: "سياسة الخصوصية",
    countryFieldLabel: "البلد",
  },
  requestResetScreen: {
    title: "طلب إعادة تعيين كلمة المرور",
    emailFieldLabel: "البريد الالكتروني",
    emailFieldPlaceholder: "ادخل عنوان البريد الالكتروني",
    requestReset: "طلب إعادة التعيين",
    successMessage: "تم إرسال رمز إعادة التعيين إلى بريدك الالكتروني!",
    requestFailed: "فشل الطلب. يرجى التحقق من بريدك الالكتروني والمحاولة مرة أخرى.",
  },
  ssoLinkingScreen: {
    title: "ربط حسابك",
    message: "تم إنشاء هذا الحساب باستخدام {{provider}}. لاستخدام تسجيل الدخول بالبريد الإلكتروني/كلمة المرور، يرجى تعيين كلمة مرور أدناه، أو المتابعة مع {{provider}}.",
    passwordLabel: "كلمة المرور",
    passwordPlaceholder: "أدخل كلمة المرور",
    confirmPasswordLabel: "تأكيد كلمة المرور",
    confirmPasswordPlaceholder: "أكد كلمة المرور",
    setPasswordButton: "تعيين كلمة المرور",
    backToLoginButton: "العودة إلى تسجيل الدخول",
    orDivider: "أو",
    successMessage: "✓ تم تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول باستخدام بريدك الإلكتروني وكلمة المرور.",
    errorNoPassword: "يرجى إدخال كلمة مرور",
    errorNoConfirmPassword: "يرجى تأكيد كلمة المرور",
    errorPasswordMismatch: "كلمات المرور غير متطابقة",
    errorPasswordTooShort: "يجب أن تكون كلمة المرور 8 أحرف على الأقل",
    errorSetPasswordFailed: "فشل تعيين كلمة المرور",
    errorSSOFailed: "فشل تسجيل الدخول SSO. يرجى المحاولة مرة أخرى.",
    providerGoogle: "Google",
    providerMicrosoft: "Microsoft",
    providerSSO: "SSO",
  },
  ssoButtons: {
    orContinueWith: "أو المتابعة مع",
    google: "Google",
    microsoft: "Microsoft",
    continueWithGoogle: "المتابعة مع Google",
    continueWithMicrosoft: "المتابعة مع Microsoft",
    companySSO: "SSO الشركة",
    ssoNotAvailable: "SSO غير متاح",
    signInFailed: "فشل تسجيل الدخول",
    companySSOTitle: "SSO الشركة",
    companySSOMessage: "سيؤدي هذا إلى إعادة التوجيه إلى موفر SSO لشركتك. يرجى الاتصال بمسؤولك للإعداد.",
  },
  emailVerificationScreen: {
    title: "تحقق من بريدك الإلكتروني",
    message: "لقد أرسلنا رابط التحقق إلى عنوان بريدك الإلكتروني. يرجى النقر على الرابط للتحقق من حسابك قبل تسجيل الدخول.",
    emailFieldLabel: "عنوان البريد الإلكتروني",
    emailFieldPlaceholder: "أدخل عنوان بريدك الإلكتروني",
    resendButton: "إعادة إرسال بريد التحقق",
    backToLoginButton: "العودة إلى تسجيل الدخول",
    successMessage: "✓ تم إرسال بريد التحقق! يرجى التحقق من بريدك الوارد.",
    errorNoEmail: "يرجى إدخال عنوان بريدك الإلكتروني",
    errorSendFailed: "فشل إرسال بريد التحقق",
    errorNetwork: "تعذّر الاتصال بالخادم. تحقّق من اتصال الإنترنت وحاول مرة أخرى.",
    errorNoToken: "رمز التحقق مفقود",
    errorVerificationFailed: "فشل التحقق من البريد الإلكتروني",
    verificationFailed: "فشل التحقق من البريد الإلكتروني",
    verifying: "جارٍ التحقق…",
  },
  emailVerifiedScreen: {
    title: "تم التحقق من البريد الإلكتروني!",
    message: "تم التحقق من حساب My Phone Friend بنجاح.",
    redirecting: "إعادة توجيهك إلى التطبيق...",
  },
  phoneVerificationBanner: {
    title: "تحقق من رقم هاتفك",
    message: "يرجى التحقق من رقم هاتفك لتلقي تنبيهات الطوارئ والإشعارات المهمة.",
    verifyButton: "تحقق الآن",
  },
  conversationsScreen: {
    title: "المحادثات",
    yesterday: "أمس",
    noMessages: "لا توجد رسائل",
    noClientSelected: "لم يتم اختيار عميل",
    firstConversation: "لم يتم العثور على محادثات سابقة. ستكون هذه المحادثة الأولى مع هذا العميل.",
    noConversationsToDisplay: "لا توجد محادثات للعرض",
    noPreviousConversations: "لم يتم العثور على محادثات سابقة لهذا العميل",
    errorFetchingConversations: "خطأ في جلب المحادثات",
    loadingMoreConversations: "جارٍ تحميل المزيد من المحادثات…",
  },
  clientScreen: {
    nameLabel: "الاسم *",
    namePlaceholder: "ادخل اسم العميل",
    emailLabel: "البريد الالكتروني *",
    emailPlaceholder: "ادخل عنوان البريد الالكتروني",
    phoneLabel: "الهاتف *",
    phonePlaceholder: "ادخل رقم الهاتف",
    preferredLanguageLabel: "اللغة المفضلة",
    updateClient: "تحديث العميل",
    createClient: "إنشاء عميل",
    manageSchedules: "إدارة الجداول",
    manageConversations: "إدارة المحادثات",
    viewSentimentAnalysis: "عرض تحليل المشاعر",
    manageCaregivers: "إدارة مقدمي الرعاية",
    confirmDelete: "تأكيد الحذف",
    deleteClient: "حذف العميل",
    onboardingCardTitle: "تهيئة المقيم",
    onboardingNotStarted: "لم يبدأ — التالي: اليوم 1 من 4",
    onboardingInProgress: "قيد التنفيذ",
    onboardingNextDay: "التالي: اليوم {{day}} من 4",
    onboardingCallsCompleted: "{{completed}} من 4 مكالمات مكتملة",
    onboardingCapturesLine: "{{count}} إجابات مواضيع مسجلة",
    onboardingComplete: "اكتملت التهيئة — انتهت جميع المكالمات الأربع",
    viewOnboardingDetails: "عرض إجابات التهيئة",
    onboardingButtonCompactComplete: "تهيئة · مكتملة",
    onboardingButtonCompactDay: "تهيئة · اليوم {{day}}",
    onboardingButtonA11yHint: "يفتح إجابات التهيئة وتفاصيل المسار لهذا العميل.",
    onboardingOutboundCallsHint: "المكالمات الصادرة من الصفحة الرئيسية أو الجدول تستخدم محادثة التهيئة للجلسة {{day}} حتى تكتمل تلك الجلسة عبر الهاتف. عدم الرد يعني عدم التقدّم — تبقى المكالمة التالية في نفس الجلسة.",
  },
  clientOnboardingScreen: {
    title: "إجابات التهيئة",
    noClient: "لم يتم اختيار عميل.",
    day: "اليوم",
    filterByDay: "تصفية حسب اليوم",
    allDays: "كل الأيام",
    loading: "جاري التحميل…",
    error: "تعذر تحميل بيانات التهيئة.",
    captureCount: "{{count}} إجابات",
    emptyAllDays: "لا توجد إجابات تهيئة مسجلة بعد.",
    emptyForDay: "لم تُكمل بعد تهيئة اليوم {{day}}.",
    flag: {
      safety: "السلامة",
      memory: "الذاكرة",
      mood: "المزاج",
      distress: "الضيق",
      confusion: "الارتباك",
    },
    signalsForDay: "الإشارات المسجّلة في اليوم {{day}}",
  },
  paymentScreen: {
    paid: "مدفوع",
    pending: "معلق",
    overdue: "متأخر",
    processing: "قيد المعالجة",
    unknown: "غير معروف",
    latestInvoice: "آخر فاتورة",
    paymentMethod: "طريقة الدفع",
    currentChargesSummary: "ملخص الرسوم الحالية",
    basicPlan: "الخطة الأساسية",
    contactSupport: "اتصل بالدعم",
    currentCharges: "الرسوم الحالية",
    paymentMethods: "طرق الدفع",
    billingInfo: "معلومات الفواتير",
    amount: "المبلغ:",
    invoiceNumber: "رقم الفاتورة:",
    issueDate: "تاريخ الإصدار:",
    dueDate: "تاريخ الاستحقاق:",
    notes: "ملاحظات:",
    noOrganizationData: "لا توجد بيانات منظمة متاحة.",
    authorizationTokenNotAvailable: "رمز التفويض غير متاح.",
    errorLoadingCurrentCharges: "خطأ في تحميل الرسوم الحالية.",
    noPendingCharges: "لا توجد رسوم معلقة",
    allConversationsBilled: "تم فوترة جميع المحادثات. ستظهر رسوم جديدة هنا مع تراكمها.",
    totalUnbilledAmount: "إجمالي المبلغ غير المفوتر:",
    period: "الفترة:",
    lastDays: "آخر {days} أيام",
    day: "يوم",
    days: "أيام",
    clientsWithCharges: "العملاء مع الرسوم:",
    clientWord: "عميل",
    clientsWord: "عملاء",
    chargesByClient: "الرسوم حسب العميل",
    conversation: "محادثة",
    conversations: "محادثات",
    average: "المتوسط:",
    noUserData: "لا توجد بيانات مستخدم متاحة.",
    currentPlan: "الخطة الحالية:",
    nextBillingDate: "تاريخ الفوترة التالي:",
    totalBilledAmount: "إجمالي المبلغ المفوتر",
    acrossInvoices: "عبر {count} فاتورة{s}",
    invoiceHistory: "تاريخ الفواتير ({count})",
    hide: "إخفاء",
    show: "إظهار",
    history: "التاريخ",
    noInvoicesYet: "لا توجد فواتير بعد",
    invoicesWillAppear: "ستظهر فواتيرك هنا بمجرد بدء الفوترة.",
    accessRestricted: "الوصول مقيد",
    accessRestrictedMessage: "ليس لديك الصلاحيات اللازمة لعرض أو إدارة معلومات الدفع.",
    contactAdministrator: "يرجى الاتصال بمدير منظمتك للحصول على المساعدة.",
    loadingUserInformation: "جاري تحميل معلومات المستخدم...",
    addPaymentMethod: "إضافة طريقة دفع",
    loadingPaymentSystem: "جاري تحميل نظام الدفع...",
    loadingPaymentMethods: "جاري تحميل طرق الدفع...",
    stripeConfigurationError: "خطأ في تكوين Stripe. يرجى الاتصال بالدعم.",
    unsupportedPlatform: "منصة غير مدعومة. يرجى استخدام متصفح ويب أو تطبيق محمول.",
    errorLoadingPaymentMethods: "خطأ في تحميل طرق الدفع:",
    existingPaymentMethods: "طرق الدفع الموجودة",
    default: "افتراضي",
    setDefault: "تعيين كافتراضي",
    remove: "إزالة",
    addNewCard: "إضافة بطاقة جديدة",
    deletePaymentMethod: "حذف طريقة الدفع",
    deletePaymentMethodConfirm: "هل أنت متأكد من أنك تريد حذف طريقة الدفع هذه؟ لا يمكن التراجع عن هذا الإجراء.",
    paymentMethodAddedSuccess: "تمت إضافة طريقة الدفع بنجاح!",
    paymentMethodSetDefaultSuccess: "تم تعيين طريقة الدفع كافتراضية بنجاح!",
    paymentMethodDeletedSuccess: "تم حذف طريقة الدفع بنجاح!",
    failedToSetDefault: "فشل في تعيين طريقة الدفع الافتراضية",
    failedToDelete: "فشل في حذف طريقة الدفع",
    expires: "تنتهي",
    mobilePaymentUnavailable: "نظام الدفع المحمول غير متاح. يرجى استخدام النسخة الويب.",
    loadingMobilePayment: "جاري تحميل نظام الدفع المحمول...",
    anErrorOccurred: "حدث خطأ",
  },
  orgScreen: {
    namePlaceholder: "الاسم",
    emailPlaceholder: "البريد الالكتروني",
    phonePlaceholder: "الهاتف",
    save: "حفظ",
    viewCaregivers: "عرض مقدمي الرعاية",
    inviteCaregiver: "دعوة مقدم رعاية",
    payments: "المدفوعات",
    organizationActions: "إجراءات المنظمة",
    organizationLogo: "شعار المنظمة",
    noLogoSet: "لم يتم تعيين شعار",
    alertOnAllMissedCallsHelper: "إرسال تنبيهات لكل مكالمة فائتة ومحاولة إعادة",
    alertOnAllMissedCallsLabel: "تنبيه لجميع المكالمات الفائتة",
    callRetrySettings: "إعدادات إعادة محاولة المكالمة",
    clientConsentSettings: "إعدادات موافقة العميل",
    country: "البلد",
    countryHelper: "اختر بلد مؤسستك. يساعد ذلك في تحديد لوائح الخصوصية المعمول بها.",
    enableRetriesHelper: "عند التفعيل، يعيد النظام تلقائيًا محاولة المكالمات الفاشلة",
    enableRetriesLabel: "تفعيل إعادة محاولة المكالمات",
    retryCountHelper: "عدد مرات إعادة المحاولة إذا لم يُردّ (1–5)",
    retryCountLabel: "عدد إعادة محاولات المكالمة",
    retryIntervalMinutesHelper: "وقت الانتظار بين المحاولات (1–60 دقيقة، افتراضي: 15)",
    retryIntervalMinutesLabel: "فترة إعادة المحاولة (دقائق)",
    timezone: "المنطقة الزمنية",
    timezoneHelper: "اختر المنطقة الزمنية لمؤسستك. ستُبنى أوقات الجدول على هذه المنطقة.",
  },
  caregiverScreen: {
    namePlaceholder: "الاسم",
    emailPlaceholder: "البريد الالكتروني",
    phonePlaceholder: "الهاتف",
    loadingUnassignedClients: "جاري تحميل العملاء غير المخصصين...",
    assigningClients: "جاري تعيين العملاء...",
    clientsAssignedSuccess: "تم تعيين العملاء بنجاح!",
    loadingCaregivers: "جاري تحميل مقدمي الرعاية...",
    assignSelected: "تعيين المحدّد",
    assignUnassignedClients: "تعيين العملاء غير المعيّنين",
    assignUnassignedClientsTitle: "تعيين العملاء غير المعيّنين",
    confirmDelete: "تأكيد الحذف",
    deleteCaregiver: "حذف مقدّم الرعاية",
    deselectAll: "إلغاء تحديد الكل",
    emailLabel: "البريد الإلكتروني",
    invite: "دعوة",
    nameLabel: "الاسم",
    noUnassignedClientsFound: "لم يُعثر على عملاء غير معيّنين.",
    phoneLabel: "الهاتف",
    save: "حفظ",
    selectAll: "تحديد الكل",
  },
  caregiversScreen: {
    invited: "مدعو",
    edit: "تحرير",
    resendInvite: "إعادة إرسال الدعوة",
    noCaregiversFound: "لم يتم العثور على مقدمي رعاية",
    notAuthorized: "غير مخول",
    noPermissionToView: "ليس لديك إذن لعرض مقدمي الرعاية. يرجى الاتصال بمديرك.",
    addCaregiver: "إضافة مقدم رعاية",
  },
  signupScreen: {
    title: "أكمل دعوتك",
    fullNameLabel: "الاسم الكامل",
    fullNamePlaceholder: "اسمك الكامل",
    emailLabel: "عنوان البريد الالكتروني",
    emailPlaceholder: "بريدك.الالكتروني@مثال.com",
    phoneLabel: "رقم الهاتف",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "كلمة المرور",
    passwordPlaceholder: "ادخل كلمة المرور",
    confirmPasswordLabel: "تأكيد كلمة المرور",
    confirmPasswordPlaceholder: "أكد كلمة المرور",
    completeRegistration: "إكمال التسجيل",
    preconfiguredMessage: "تم تكوين اسمك وبريدك الإلكتروني وتفاصيل المؤسسة مسبقاً من قبل مديرك.",
  },
  confirmResetScreen: {
    title: "إعادة تعيين كلمة المرور",
    subtitle: "أدخل كلمة المرور الجديدة أدناه. تأكد من أنها آمنة وسهلة التذكر.",
    newPasswordLabel: "كلمة المرور الجديدة",
    newPasswordPlaceholder: "ادخل كلمة المرور الجديدة",
    confirmPasswordLabel: "تأكيد كلمة المرور الجديدة",
    confirmPasswordPlaceholder: "أكد كلمة المرور الجديدة",
    backToLogin: "العودة لتسجيل الدخول",
    codeFieldLabel: "رمز إعادة التعيين",
    codeFieldPlaceholder: "أدخل رمز إعادة التعيين",
    confirmPasswordFieldLabel: "تأكيد كلمة المرور الجديدة",
    confirmPasswordFieldPlaceholder: "أكّد كلمة المرور الجديدة",
    confirmReset: "تأكيد إعادة التعيين",
    newPasswordFieldLabel: "كلمة المرور الجديدة",
    newPasswordFieldPlaceholder: "أدخل كلمة المرور الجديدة",
    redirecting: "جارٍ التوجيه إلى تسجيل الدخول...",
    requestFailed: "فشلت إعادة تعيين كلمة المرور. تحقّق من الرمز وحاول مرة أخرى.",
    resetPasswordButton: "إعادة تعيين كلمة المرور",
    successMessage: "تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.",
    successMessageShort: "تمت إعادة تعيين كلمة المرور بنجاح!",
    successTitle: "تم إعادة تعيين كلمة المرور!",
  },
  homeScreen: {
    welcome: "مرحباً، {{name}}",
    guest: "ضيف",
    addClient: "إضافة عميل",
    adminOnlyMessage: "يمكن فقط لمديري المنظمة والمديرين العامين إضافة المرضى",
    noClientsFound: "لم يتم العثور على مرضى",
    viewSchedules: "عرض الجداول",
    noScheduleWarning: "⚠ لم يتم تعيين جدول",
    glanceAlerts: "التنبيهات",
    glanceHintAlertsTitle: "تنبيهات هذا العميل",
    glanceHintAlertsBody: "عدد التنبيهات في قائمتك المرتبطة بهذا المقيم (مثل تنبيهات العميل أو المحادثة أو الجدول). افتح تبويب التنبيهات لقراءتها أو إدارتها. التنبيهات غير المرتبطة بعميل لا تُحسب هنا.",
    glanceAlertsA11y: "{{count}} تنبيهات مرتبطة بهذا العميل",
    glanceSentimentActionHint: "يفتح تحليل المشاعر لآخر مكالمة في التقارير.",
    glanceHealthActionHint: "يفتح تقرير التحليل الصحي لهذا العميل في التقارير.",
    glanceRiskActionHint: "يفتح تقرير الاحتيال والسلامة لهذا العميل في التقارير.",
    glanceAlertsActionHint: "يفتح قائمة التنبيهات المصفاة لهذا العميل.",
    glanceHealth: "الصحة",
    glanceHealthA11y: "درجة الصحة {{score}} من مئة",
    glanceHintButtonA11y: "حول {{label}}",
    glanceHintHealthBody: "درجة الرفاهية الإجمالية من أحدث تحليل طبي للمحادثات (0–100، الأعلى أفضل). تجمع إشارات مثل أنماط اللغة المعرفية والمزاجية من المكالمات. لا تحلّ محل الحكم السريري أو تقرير الصحة الكامل.",
    glanceHintHealthTitle: "درجة الصحة",
    glanceHintRiskBody: "درجة المخاطر الإجمالية من أحدث تحليل للاحتيال والسلامة (0–100، الأعلى يعني مزيدًا من القلق). تعكس أنماطًا فيما قيل عن المال والسلامة والعزلة ومواضيع مشابهة. راجع تقرير الاحتيال والإساءة للتفاصيل.",
    glanceHintRiskTitle: "درجة المخاطر",
    glanceHintSentimentBody: "ملخّص لنبرة العميل في المكالمات المحلّلة مؤخرًا (حوالي آخر 30 يومًا). صعود أو ثبات أو انخفاض يقارن المكالمات الأحدث بالأقدم قليلًا. ليس تشخيصًا — راجع تقرير المشاعر الكامل للتفاصيل.",
    glanceHintSentimentTitle: "اتجاه المزاج",
    glanceNoData: "—",
    glanceRisk: "المخاطر",
    glanceRiskA11y: "درجة المخاطر {{score}} من مئة",
    glanceSentiment: "المزاج",
    lastAnsweredCall: "آخر مكالمة تم الرد عليها",
    lastCalled: "آخر اتصال",
    neverCalled: "أبدًا",
    noAnsweredCallsYet: "لا توجد مكالمات تم الرد عليها بعد",
    sentimentTrendDeclining: "انخفاض",
    sentimentTrendImproving: "ارتفاع",
    sentimentTrendStable: "مستقر",
  },
  tabs: {
    home: "الرئيسية",
    org: "المنظمة",
    reports: "التقارير",
    alerts: "التنبيهات",
  },
  onboarding: {
    howItWorks: {
      title: "كيف تعمل Bianca",
      next: "التالي",
      getStarted: "ابدأ",
      organization: "أضف عملاءك، وجدول متى يجب على Bianca الاتصال بهم، وراجع المحادثات والتقارير في مكان واحد. تتولى Bianca المكالمات حتى تتمكن من التركيز على الرعاية.",
      caregiver: "أضف الأشخاص الذين تعتني بهم، واختر متى تتصل بهم Bianca، وتابع أحوالهم عبر المحادثات والتقارير. تبقى على اطلاع دون الحاجة إلى حضور كل مكالمة.",
      agingInPlace: "تتصل بك Bianca وفق جدولك للاطمئنان الودي. يمكنك مراجعة صحتك وتقاريرك في أي وقت. كرفيق يكون دائماً بجانبك عندما تحتاجه.",
    },
    registration: {
      title: "بياناتك",
      subtitle: "أكد معلوماتك واقبل الشروط للمتابعة.",
      nameRequired: "الاسم مطلوب.",
      emailRequired: "البريد الإلكتروني مطلوب.",
      termsRequired: "يجب قبول شروط الخدمة وسياسة الخصوصية للمتابعة.",
    },
    aboutYou: {
      agingInPlace: "الشيخوخة في المنزل",
      caregiver: "مقدّم رعاية",
      organization: "مؤسسة",
      subtitle: "يساعدنا هذا على تخصيص تجربتك.",
      title: "أخبرنا قليلًا عنك",
    },
    orgInfo: {
      countryLabel: "البلد",
      orgNameLabel: "اسم المؤسسة",
      orgNamePlaceholder: "أدخل اسم مؤسستك",
      subtitle: "أخبرنا عن مؤسستك.",
      timezoneLabel: "المنطقة الزمنية",
      title: "معلومات المؤسسة",
    },
    termsAndConsent: {
      acceptTerms: "لقد قرأت وأوافق على",
      acceptTermsLabel: "قبول شروط الخدمة وسياسة الخصوصية",
      and: "و",
      no: "لا",
      privacyLink: "سياسة الخصوصية",
      saveAndContinue: "حفظ ومتابعة",
      singleConsentQuestion: "هل أنت في ولاية موافقة أحادية؟ (يحتاج التسجيل إلى موافقة طرف واحد فقط.)",
      termsLink: "شروط الخدمة",
      title: "الشروط والموافقة",
      whyImportant: "لماذا هذا مهم؟",
      whyImportantBody: "تختلف قوانين تسجيل المكالمات حسب الولاية والبلد. في ولايات الموافقة الأحادية، يكفي موافقة شخص واحد. في ولايات الطرفين، يجب أن يوافق الجميع. الإعداد الصحيح يحافظ على امتثالك ومؤسستك.",
      yes: "نعم",
    },
  },
  legalLinks: {
    privacyPolicy: "سياسة الخصوصية",
    termsOfService: "شروط الخدمة",
    privacyPractices: "ممارسات الخصوصية HIPAA",
  },
  headers: {
    home: "الرئيسية",
    client: "العميل",
    schedule: "الجدول الزمني",
    conversations: "المحادثات",
    call: "المكالمة",
    profile: "الملف الشخصي",
    logout: "تسجيل الخروج",
    alerts: "التنبيهات",
    organization: "المنظمة",
    caregivers: "مقدمو الرعاية",
    caregiver: "مقدم الرعاية",
    caregiverInvited: "مقدم رعاية مدعو",
    payments: "المدفوعات",
    reports: "التقارير",
    sentimentAnalysis: "تحليل المشاعر",
    clientOnboarding: "التهيئة",
    medicalAnalysis: "التحليل الطبي",
    fraudAbuseAnalysis: "تحليل الاحتيال والإساءة",
    privacyPolicy: "سياسة الخصوصية",
    privacyPractices: "ممارسات الخصوصية HIPAA",
    termsOfService: "شروط الخدمة",
    mentalHealthReport: "تقرير الصحة النفسية",
    login: "تسجيل الدخول",
    register: "التسجيل",
    privacyRequest: "طلب بياناتي",
  },
  scheduleScreen: {
    heading: "إعداد الجدول الزمني",
    saveSchedule: "حفظ الجدول",
    deleteSchedule: "حذف الجدول",
  },
  scheduleComponent: {
    schedule: "الجدول الزمني",
    startTime: "وقت البداية",
    frequency: "التكرار",
    daily: "يومي",
    weekly: "أسبوعي",
    monthly: "شهري",
    sunday: "الأحد",
    monday: "الإثنين",
    tuesday: "الثلاثاء",
    wednesday: "الأربعاء",
    thursday: "الخميس",
    friday: "الجمعة",
    saturday: "السبت",
    scheduleDetails: "تفاصيل الجدول الزمني",
    active: "نشط",
    everyDayAt: "كل يوم في {{time}}",
    everyDaysAt: "كل {{days}} في {{time}}",
    everyWeekAt: "كل أسبوع في {{time}}",
    everyMonthOn: "كل شهر في اليوم {{day}} في {{time}}",
  },
  sentimentAnalysis: {
    lastCall: "آخر مكالمة",
    last30Days: "آخر 30 يوماً",
    allTime: "كل الوقت",
    noClientSelected: "لم يتم اختيار عميل",
    selectClientToView: "يرجى اختيار عميل من الشاشة الرئيسية لعرض تحليل المشاعر.",
    sessionRequiredTitle: "يلزم تسجيل الدخول",
    sessionRequiredMessage: "قد تكون انتهت جلستك. سجّل الدخول مجدداً لعرض تحليل المشاعر. إذا كانت نافذة تسجيل الدخول مفتوحة بالفعل، أكمل تسجيل الدخول هناك.",
    signInToContinueButton: "تسجيل الدخول",
    accessDeniedTitle: "تعذر تحميل هذا التقرير",
    accessDeniedMessage: "قد لا يكون لديك حق الوصول إلى بيانات المشاعر لهذا العميل أو تغيّرت صلاحياتك. حاول اختيار العميل مرة أخرى من الرئيسية أو اتصل بالمسؤول.",
    clientSentimentAnalysis: "تحليل مشاعر العميل",
    emotionalWellnessInsights: "رؤى حول الرفاهية العاطفية والاتجاهات",
    timeRange: "النطاق الزمني:",
    noSentimentDataAvailable: "لا توجد بيانات مشاعر متاحة",
    noSentimentDataMessage: "سيظهر تحليل المشاعر هنا بمجرد أن يكمل العميل المحادثات.",
    loadingSentimentAnalysis: "جاري تحميل تحليل المشاعر...",
    sentimentAnalysisFooter: "يتم إنشاء تحليل المشاعر تلقائياً بعد كل محادثة باستخدام تقنية الذكاء الاصطناعي.",
    sentimentOverview: "نظرة عامة على المشاعر",
    averageSentiment: "المشاعر المتوسطة",
    trend: "اتجاه",
    recentDistribution: "التوزيع الأخير",
    keyInsights: "الرؤى الرئيسية",
    totalConversations: "إجمالي المحادثات",
    analysisCoverage: "تغطية التحليل",
    recentConversations: "المحادثات الأخيرة",
    analyzed: "تم تحليلها",
    latestAnalysis: "أحدث تحليل",
    conversationsAnalyzed: "محادثات تم تحليلها",
    recentConversationsTitle: "المحادثات الأخيرة",
    conversationsWithSentiment: "محادثة{s} مع تحليل المشاعر",
    noRecentConversations: "لا توجد محادثات حديثة مع تحليل المشاعر",
    keyEmotions: "المشاعر الرئيسية:",
    moreEmotions: "المزيد",
    clientMood: "مزاج العميل:",
    concern: "قلق",
    confidence: "ثقة",
    noSentimentAnalysisAvailable: "لا يتوفر تحليل مشاعر",
    sentimentTrend: "اتجاه المشاعر",
    conversationsAnalyzedNoTrend: "محادثة{s} تم تحليلها، لكن لا توجد بيانات اتجاه متاحة بعد",
    noSentimentData: "لا توجد بيانات مشاعر متاحة",
    avg: "المتوسط:",
    negative: "سلبي",
    positive: "إيجابي",
    lastCallAnalysis: "تحليل آخر مكالمة",
    noRecentCall: "لا توجد مكالمة حديثة",
    noRecentCallMessage: "المحادثة الأحدث لا تحتوي على تحليل مشاعر متاح بعد.",
    duration: "المدة",
    analysisDate: "تاريخ التحليل",
    overallSentiment: "المشاعر العامة",
    scoreRange: "نطاق النقاط: -1.0 (سلبي جداً) إلى +1.0 (إيجابي جداً)",
    analysisConfidence: "ثقة التحليل:",
    keyEmotionsDetected: "المشاعر الرئيسية المكتشفة",
    clientMoodAssessment: "تقييم مزاج العميل",
    concernLevel: "مستوى القلق",
    lowConcernDescription: "يبدو العميل في حالة معنوية جيدة مع قلق محدود.",
    mediumConcernDescription: "تم ملاحظة بعض مناطق القلق أثناء المحادثة.",
    highConcernDescription: "تم تحديد مخاوف كبيرة قد تتطلب انتباهاً.",
    satisfactionIndicators: "مؤشرات الرضا",
    positiveIndicators: "المؤشرات الإيجابية",
    areasOfConcern: "مناطق القلق",
    aiSummary: "ملخص الذكاء الاصطناعي",
    recommendations: "التوصيات",
    sentimentAnalysisDebug: "تصحيح تحليل المشاعر",
    debugSubtitle: "تصحيح وإصلاح تحليل المشاعر المفقود للمحادثات الحديثة",
    debugging: "جاري التصحيح...",
    debugSentimentAnalysis: "تصحيح تحليل المشاعر",
    loading: "جاري التحميل...",
    debugConversationData: "تصحيح بيانات المحادثة",
    testing: "جاري الاختبار...",
    testDirectApiCall: "اختبار استدعاء API المباشر",
    forceRefreshCache: "إجبار تحديث الذاكرة التخزينية",
    currentClient: "العميل الحالي:",
    debugResults: "نتائج التصحيح",
    withoutSentiment: "بدون مشاعر",
    successfullyAnalyzed: "تم تحليلها بنجاح",
    failedAnalyses: "التحليلات الفاشلة",
    conversationDetails: "تفاصيل المحادثة",
    messages: "الرسائل",
    sentiment: "المشاعر",
    score: "النقاط",
    mood: "المزاج",
    emotions: "المشاعر",
    failed: "فشل",
    noAnalysisPerformed: "لم يتم إجراء تحليل",
    cacheRefreshed: "تم تحديث الذاكرة التخزينية",
    cacheRefreshedMessage: "تم إبطال ذاكرة تحليل المشاعر التخزينية. يجب أن تتحدث واجهة المستخدم تلقائياً.",
    debugComplete: "اكتمل التصحيح",
    debugFailed: "فشل التصحيح",
    noClient: "لا يوجد عميل",
    pleaseSelectClient: "يرجى اختيار عميل أولاً",
    conversationDebugComplete: "اكتمل تصحيح المحادثة",
    directApiTest: "اختبار API المباشر",
    conversationId: "معرّف المحادثة",
    insufficientDataForTrend: "بيانات غير كافية لتحليل الاتجاه",
    lowConfidence: "ثقة منخفضة",
    needMoreConversations: "يلزم المزيد من المحادثات لاتجاه موثوق",
    noRecentCallButHaveCalls: "مكالمات حديثة، لا تحليل مشاعر بعد",
    noRecentCallButHaveCallsMessage: "لديك مكالمات حديثة خلال آخر 30 يومًا، لكن لا يوجد تحليل مشاعر بعد. ستُحلّل المكالمات الجديدة تلقائيًا بعد انتهائها. قد تحتاج المكالمات الأقدم إلى إعادة معالجة.",
  },
  medicalAnalysis: {
    title: "التحليل الطبي",
    error: "خطأ",
    success: "نجح",
    noClientSelected: "لم يتم اختيار عميل",
    selectClientToView: "يرجى اختيار عميل لعرض التحليل الطبي",
    triggering: "تشغيل...",
    triggerAnalysis: "تشغيل التحليل",
    loadingResults: "تحميل نتائج التحليل...",
    noResultsAvailable: "لا توجد نتائج تحليل متاحة",
    triggerToGetStarted: "قم بتشغيل تحليل للبدء",
    cognitiveHealth: "الصحة المعرفية",
    mentalHealth: "الصحة النفسية",
    language: "اللغة",
    risk: "المخاطر",
    high: "عالي",
    medium: "متوسط",
    low: "منخفض",
    good: "جيد",
    fair: "عادل",
    poor: "ضعيف",
    warningsInsights: "تحذيرات ورؤى",
    analysisDetails: "تفاصيل التحليل",
    conversations: "المحادثات",
    messages: "الرسائل",
    totalWords: "إجمالي الكلمات",
    trigger: "المشغل",
    trendsOverTime: "الاتجاهات مع مرور الوقت",
    overallHealth: "الصحة العامة",
    analyses: "تحليلات",
    trendAnalysisComingSoon: "تحليل الاتجاهات قريباً",
    analysisResultsAvailable: "نتائج تحليل متاحة",
    basedOn: "بناءً على",
    analysisResultsOver: "نتائج تحليل على",
    loadFailed: "فشل في تحميل نتائج التحليل الطبي",
    triggerFailed: "فشل في تشغيل التحليل الطبي",
    triggerSuccess: "تم تشغيل التحليل الطبي بنجاح. ستظهر النتائج في حوالي 10 ثوانٍ.",
    disclaimer: "هذا التحليل للأغراض الإعلامية فقط ولا يحل محل المشورة الطبية المهنية أو التشخيص أو العلاج. استشر دائماً مقدمي الرعاية الصحية المؤهلين للشواغل الطبية.",
    overview: "نظرة عامة",
    confidence: "ثقة",
    noDataAvailable: "لا توجد بيانات متاحة للتحليل",
    insufficientDataWarning: "بيانات محدودة متاحة: تم تحليل {{current}} مكالمة. للحصول على تحليل أكثر موثوقية، يُنصح بـ {{minimum}} مكالمة أو أكثر على مدى فترة أطول لفهم أنماط العميل بشكل أفضل.",
    analysisWillAppearAfterCalls: "ستظهر نتائج التحليل هنا بعد اكتمال المكالمات.",
    keyIndicators: "المؤشرات الرئيسية",
    fillerWords: "كلمات الحشو",
    vagueReferences: "مراجع غامضة",
    temporalConfusion: "الارتباك الزمني",
    wordFinding: "صعوبات في العثور على الكلمات",
    repetition: "نقاط التكرار",
    informationDensity: "كثافة المعلومات",
    depressionScore: "نقاط الاكتئاب",
    anxietyScore: "نقاط القلق",
    emotionalTone: "النبرة العاطفية",
    negativeRatio: "النسبة السلبية",
    protectiveFactors: "العوامل الوقائية",
    typeTokenRatio: "تنوع المفردات",
    avgWordLength: "متوسط طول الكلمة",
    avgSentenceLength: "متوسط طول الجملة",
    uniqueWords: "كلمات فريدة",
    crisisIndicators: "تم اكتشاف مؤشرات الأزمة - يُنصح بالتقييم المهني الفوري",
    cognitiveInterpretation: {
      normal: "تبدو أنماط التواصل طبيعية دون اكتشاف مخاوف إدراكية كبيرة.",
      mildConcern: "تم اكتشاف بعض التغييرات الطفيفة في أنماط التواصل. راقب التقدم.",
      moderateConcern: "تمت ملاحظة تغييرات معتدلة في أنماط التواصل. فكر في التقييم المهني.",
      significantConcern: "تم اكتشاف تغييرات كبيرة في أنماط التواصل. يُنصح بشدة بالتقييم المهني.",
    },
    psychiatricInterpretation: {
      stable: "تبدو مؤشرات الصحة النفسية مستقرة دون مخاوف كبيرة.",
      mildConcern: "تم اكتشاف بعض مؤشرات الصحة النفسية الطفيفة. استمر في المراقبة.",
      moderateConcern: "تمت ملاحظة مؤشرات معتدلة للصحة النفسية. فكر في الاستشارة المهنية.",
      significantConcern: "تم اكتشاف مؤشرات كبيرة للصحة النفسية. يُنصح بالاستشارة المهنية.",
      crisis: "تم اكتشاف مؤشرات الأزمة. يُنصح بشدة بالتدخل المهني الفوري.",
    },
    vocabularyInterpretation: {
      strong: "يبدو أن تعقيد اللغة واستخدام المفردات قويان ومحافظان عليهما جيداً.",
      average: "تعقيد اللغة واستخدام المفردات ضمن النطاقات الطبيعية.",
      limited: "يبدو أن تعقيد اللغة واستخدام المفردات محدودان. راقب التغييرات.",
    },
  },
  profileScreen: {
    languageSelector: "اللغة / Language",
    selectLanguage: "اختر اللغة",
    theme: "المظهر",
    selectTheme: "اختر المظهر",
    namePlaceholder: "الاسم",
    emailPlaceholder: "البريد الالكتروني",
    phonePlaceholder: "الهاتف",
    yourProfile: "ملفك الشخصي",
    updateProfile: "تحديث الملف الشخصي",
    logout: "تسجيل الخروج",
    profileUpdatedSuccess: "تم تحديث ملفك الشخصي بنجاح!",
    profileUpdateFailed: "فشل في تحديث الملف الشخصي. يرجى المحاولة مرة أخرى.",
    invalidPhoneFormat: "تنسيق الهاتف غير صحيح (10 أرقام أو +1XXXXXXXXXX)",
    completeProfileTitle: "أكمل ملفك الشخصي",
    completeProfileMessage: "يرجى إكمال ملفك الشخصي بإضافة رقم هاتف قبل المتابعة.",
    completeProfileMessageUnverified: "يرجى إضافة رقم هاتفك لإكمال ملفك الشخصي والوصول إلى جميع الميزات.",
    errorUploadingAvatar: "خطأ في تحميل الصورة الرمزية",
    emailVerified: "تم التحقق من البريد الإلكتروني",
    emailNotVerified: "البريد الإلكتروني غير محقق",
    phoneVerified: "تم التحقق من الهاتف",
    phoneNotVerified: "الهاتف غير محقق",
    verifyPhone: "التحقق من الهاتف",
    fontSize: "حجم الخط",
    fontSizeDescription: "اضبط حجم النص لتحسين قابلية القراءة. يتم تطبيق التغييرات فورًا.",
    decreaseFontSize: "تقليل حجم الخط",
    increaseFontSize: "زيادة حجم الخط",
    fontSizeHint: "اضبط حجم الخط من 80% إلى 200%",
    telemetryOptIn: "مشاركة بيانات الاستخدام المجهولة",
    telemetryDescription: "ساعدنا في تحسين التطبيق من خلال مشاركة بيانات الاستخدام المجهولة. لا يتم جمع معلومات شخصية.",
    telemetryEnabled: "تم تفعيل القياس عن بُعد",
    telemetryDisabled: "تم تعطيل القياس عن بُعد",
    emailManagedBySSO: "يُدار البريد الإلكتروني بواسطة مزوّد تسجيل الدخول ولا يمكن تغييره.",
    requestMyData: "طلب بياناتي",
    verificationEmailFailed: "فشل إرسال بريد التحقق. حاول مرة أخرى.",
    verificationEmailSent: "تم إرسال بريد التحقق! يرجى التحقق من صندوق الوارد.",
    verifyEmail: "تحقّق من البريد الإلكتروني",
    verifyPhoneBannerMessage: "يرجى التحقق من رقم هاتفك لتلقي تنبيهات الطوارئ والإشعارات المهمة. يمكنك متابعة استخدام التطبيق برقم غير مُتحقّق.",
  },
  fraudAbuseAnalysis: {
    title: "تحليل الاحتيال والإساءة",
    error: "خطأ",
    success: "نجاح",
    noClientSelected: "لم يتم اختيار عميل",
    selectClientToView: "يرجى اختيار عميل لعرض تحليل الاحتيال والإساءة",
    triggering: "تشغيل...",
    triggerAnalysis: "تشغيل التحليل",
    loadingResults: "جاري تحميل نتائج التحليل...",
    noResultsAvailable: "لا توجد نتائج تحليل متاحة",
    triggerToGetStarted: "قم بتشغيل تحليل للبدء",
    analysisWillAppearAfterCalls: "ستظهر نتائج التحليل هنا بعد اكتمال المكالمات.",
    insufficientDataWarning: "بيانات محدودة متاحة: تم تحليل {{current}} مكالمة(ات). للحصول على تحليل أكثر موثوقية، يُنصح بـ {{minimum}} مكالمة أو أكثر على مدى فترة أطول لفهم أنماط العميل بشكل أفضل.",
    loadFailed: "فشل تحميل نتائج تحليل الاحتيال/الإساءة",
    triggerFailed: "فشل تشغيل تحليل الاحتيال/الإساءة",
    triggerSuccess: "اكتمل تحليل الاحتيال/الإساءة بنجاح.",
    disclaimer: "هذا التحليل للأغراض الإعلامية فقط وليس بديلاً عن التقييم المهني. إذا كنت تشك في الاحتيال أو الإساءة أو الإهمال، اتصل بالسلطات المناسبة على الفور.",
    overview: "نظرة عامة",
    conversations: "المحادثات",
    messages: "الرسائل",
    riskScore: "نقاط المخاطر",
    financialRisk: "المخاطر المالية",
    abuseRisk: "مخاطر الإساءة",
    relationshipRisk: "مخاطر العلاقة",
    warnings: "تحذيرات",
    recommendations: "التوصيات",
    critical: "حرج",
    high: "عالي",
    medium: "متوسط",
    low: "منخفض",
    largeAmountMentions: "إشارات المبالغ الكبيرة",
    transferMethodMentions: "إشارات طرق التحويل",
    scamIndicators: "مؤشرات الاحتيال",
    physicalAbuseScore: "نقاط الإساءة الجسدية",
    emotionalAbuseScore: "نقاط الإساءة العاطفية",
    neglectScore: "نقاط الإهمال",
    newPeopleCount: "عدد الأشخاص الجدد",
    isolationCount: "عدد العزلة",
    suspiciousBehaviorCount: "عدد السلوكيات المشبوهة",
  },
  reportsScreen: {
    selectClient: "اختر العميل:",
    chooseClient: "اختر عميلاً...",
    sentiment: "المشاعر",
    medicalAnalysis: "التحليل الطبي",
    fraudAbuseAnalysis: "الاحتيال والإساءة",
    comingSoon: "قريباً",
    modalTitle: "اختر العميل",
    modalCancel: "إلغاء",
  },
  schedulesScreen: {
    scheduleDetails: "تفاصيل الجدولة",
    selectSchedule: "اختر جدولة:",
    scheduleNumber: "جدولة",
    noSchedulesAvailable: "لا توجد جداول متاحة. يرجى إنشاء واحدة جديدة.",
    errorLoadingSchedules: "خطأ في تحميل الجداول.",
    errorSavingSchedule: "خطأ في حفظ الجدول.",
    invalidScheduleError: "يرجى تعبئة جميع حقول الجدول المطلوبة (التكرار، الوقت، والأيام للجداول الأسبوعية/الشهرية).",
    newSchedule: "جدول جديد",
  },
  themes: {
    healthcare: {
      name: "الرعاية الصحية",
      description: "مظهر طبي احترافي بألوان زرقاء وخضراء",
    },
    colorblind: {
      name: "صديق للمصابين بعمى الألوان",
      description: "مظهر بتباين عالي محسّن لنقص رؤية الألوان",
    },
    dark: {
      name: "الوضع الداكن",
      description: "مظهر داكن محسّن للبيئات قليلة الإضاءة",
    },
    accessibility: {
      wcagLevel: "مستوى WCAG",
      colorblindFriendly: "صديق للمصابين بعمى الألوان",
      highContrast: "تباين عالي",
      darkMode: "الوضع الداكن",
    },
    highcontrast: {
      description: "سمة بأقصى تباين لضعف البصر (WCAG AAA)",
      name: "تباين عالٍ",
    },
  },
  privacyPracticesScreen: {
    content: `# إشعار ممارسات الخصوصية
## خدمات الاتصال الصحي MyPhoneFriend

**تاريخ السريان**: 15 أكتوبر 2025

---

## معلوماتك. حقوقك. مسؤولياتنا.

**يصف هذا الإشعار كيف يمكن استخدام المعلومات الطبية المتعلقة بك وكشفها وكيف يمكنك الوصول إلى هذه المعلومات. يرجى مراجعتها بعناية.**

---

## حقوقك

لديك الحق في:
- الحصول على نسخة من معلوماتك الصحية
- تصحيح معلوماتك الصحية
- طلب اتصال سري
- طلب منا تقييد المعلومات التي نشاركها
- الحصول على قائمة بمن شاركنا معهم معلوماتك
- الحصول على نسخة من إشعار الخصوصية هذا
- اختيار شخص للعمل نيابة عنك
- تقديم شكوى إذا كنت تعتقد أن حقوق الخصوصية الخاصة بك قد انتهكت

---

## خياراتك

لديك بعض الخيارات حول كيفية استخدامنا ومشاركة المعلومات عندما:
- نجيب على أسئلة عائلتك وأصدقائك حول رعايتك
- نقدم معلومات عنك في حالات الإغاثة من الكوارث

**لا نشارك معلوماتك أبدًا لأغراض التسويق أو بيع بياناتك.**

---

# حقوقك التفصيلية

## الحصول على نسخة من معلوماتك الصحية

**يمكنك طلب رؤية أو الحصول على نسخة من معلوماتك الصحية.**

ما يمكنك طلبه:
- تسجيلات المكالمات والنسخ
- ملخصات الرفاهية ونتائج تحليل الذكاء الاصطناعي
- التنبيهات الطبية التي يولدها نظامنا
- إشعارات الطوارئ
- معلومات الحساب والتفضيلات

**كيفية الطلب**:
- البريد الإلكتروني: privacy@biancawellness.com
- الهاتف: +1-604-562-4263

**ردنا**: خلال 30 يومًا

---

## اطلب منا تصحيح معلوماتك الصحية

**يمكنك طلب تصحيح المعلومات الصحية التي تعتقد أنها غير صحيحة أو غير مكتملة.**

**ردنا**: خلال 60 يومًا

---

## طلب اتصالات سرية

**يمكنك طلب الاتصال بك بطريقة محددة أو في موقع محدد.**

أمثلة:
- "يرجى إرسال بريد إلكتروني لي بدلاً من الاتصال"
- "يرجى الاتصال بي على هاتفي المحمول فقط"

سنستوعب جميع الطلبات المعقولة.

---

## اطلب منا تقييد ما نستخدمه أو نشاركه

**يمكنك طلب عدم استخدام أو مشاركة معلومات صحية معينة.**

يجب أن نوافق إذا دفعت من جيبك بالكامل وطلبت منا عدم المشاركة مع خطة صحتك.

---

## الحصول على قائمة بالكشوفات

**يمكنك طلب "محاسبة الكشوفات"** - قائمة بالأوقات التي شاركنا فيها معلوماتك الصحية.

يغطي: السنوات الست الماضية  
يستثني: الكشوفات للعلاج والدفع والعمليات (ما لم تطلب)

---

## تقديم شكوى

**تقديم معنا**:
- البريد الإلكتروني: privacy@biancawellness.com
- الهاتف: +1-604-562-4263

**تقديم مع HHS**:
- الموقع الإلكتروني: https://www.hhs.gov/hipaa/filing-a-complaint
- الهاتف: 1-800-368-1019

**لن ننتقم منك لتقديم شكوى.**

---

# استخداماتنا والكشوفات

## كيف نستخدم معلوماتك الصحية

**للعلاج**:
- توفير ملخصات الرفاهية بالذكاء الاصطناعي لمقدمي الرعاية
- توليد تنبيهات الطوارئ للحالات العاجلة
- تمكين مقدمي الرعاية من مراقبة رفاهيتك
- تسهيل التواصل مع فريق الرعاية الخاص بك

**للدفع**:
- فوترة منظمة الرعاية الصحية الخاصة بك للخدمات
- معالجة الفواتير لوقت المكالمة والتحليل

**لعمليات الرعاية الصحية**:
- تحسين خوارزميات اكتشاف الذكاء الاصطناعي
- ضمان الجودة والتحسين
- تدريب أنظمتنا لخدمة المرضى بشكل أفضل

---

## مع من نشارك

**منظمة الرعاية الصحية الخاصة بك**:
- مقدمي الرعاية ومنسقي الرعاية المعينين لك
- مديري المنظمة للفوترة

**الشركاء التجاريون** (مقدمو الخدمات):
- خدمات الذكاء الاصطناعي (Azure OpenAI): للنسخ والتحليل
- خدمات الصوت (Twilio): لمعالجة المكالمات الهاتفية
- الاستضافة السحابية (AWS): لتخزين البيانات الآمن
- قاعدة البيانات (MongoDB Atlas): لإدارة البيانات

جميع الشركاء التجاريين يوقعون اتفاقيات الشريك التجاري ويجب عليهم حماية معلوماتك.

**كما يتطلب القانون**:
- خدمات الطوارئ (911) إذا تم اكتشاف حالة طوارئ
- سلطات الصحة العامة (الإبلاغ عن الإساءة والإهمال)
- إنفاذ القانون (بأمر قانوني صالح)

**لا نفعل**:
- ❌ بيع معلوماتك الصحية
- ❌ المشاركة مع المسوقين أو المعلنين
- ❌ الاستخدام للتسويق دون تفويضك
- ❌ المشاركة على وسائل التواصل الاجتماعي

---

# المعلومات الصحية التي نجمعها

**أثناء استخدام خدماتنا**:
- اسم العميل ورقم الهاتف وتاريخ الميلاد
- تسجيلات المكالمات والنسخ
- المعلومات المتعلقة بالصحة من المكالمات (الأعراض والأدوية والمزاج)
- تنبيهات الطوارئ والحوادث
- اتجاهات وأنماط الرفاهية
- ملاحظات وملاحظات مقدمي الرعاية
- نتائج التحليل الطبي من الذكاء الاصطناعي

---

# مسؤولياتك

**إذا كنت تستخدم خدمتنا للاتصال بشخص آخر**، فأنت مسؤول عن:
- الحصول على الموافقات اللازمة للتسجيل
- التأكد من فهمهم للخدمة
- اتباع قوانين موافقة التسجيل المعمول بها

---

# إشعار الانتهاك

**إذا تم الوصول إلى معلوماتك الصحية أو الكشف عنها بشكل غير صحيح**، فسنقوم بـ:
- التحقيق في الحادث
- إشعارك خلال 60 يومًا إذا كان انتهاكًا قابلًا للإبلاغ
- شرح ما حدث وما نفعله
- تقديم معلومات حول الخطوات التي يمكنك اتخاذها

---

# التغييرات على هذا الإشعار

- قد نغير هذا الإشعار وستنطبق التغييرات على جميع المعلومات التي لدينا
- سيكون الإشعار الجديد متاحًا في التطبيق وعلى موقعنا الإلكتروني
- يمكنك دائمًا طلب نسخة حالية

---

# معلومات الاتصال

**مسؤول الخصوصية**:
- البريد الإلكتروني: privacy@biancawellness.com
- الهاتف: +1-604-562-4263
- البريد: مكتب خصوصية MyPhoneFriend، 2955 Elbow Place، Port Coquitlam، BC V3B 7T3

**الساعات**: الاثنين-الجمعة، 9 صباحًا - 5 مساءً PST

---

# تقديم شكوى

**معنا**:
- البريد الإلكتروني: privacy@biancawellness.com
- الهاتف: +1-604-562-4263

**مع الحكومة الفيدرالية (HHS)**:
- الموقع الإلكتروني: https://www.hhs.gov/hipaa/filing-a-complaint
- الهاتف: 1-800-368-1019
- البريد: مكتب الحقوق المدنية، وزارة الصحة والخدمات الإنسانية الأمريكية، 200 Independence Avenue S.W.، Washington، D.C. 20201

---

**تاريخ السريان**: 15 أكتوبر 2025  
**الإصدار**: 1.0

يتوافق إشعار ممارسات الخصوصية هذا مع قاعدة خصوصية HIPAA (45 CFR §164.520)

---

## المساعدة اللغوية

**الإنجليزية**: إذا كنت بحاجة إلى مساعدة في فهم هذا الإشعار، اتصل بـ privacy@biancawellness.com

**Español**: Si necesita ayuda, comuníquese con privacy@biancawellness.com`,
  },
  mfa: {
    setupTitle: "المصادقة متعددة العوامل",
    setupSubtitle: "أضف طبقة أمان إضافية لحسابك",
    setupInstructions: "امسح رمز QR باستخدام تطبيق المصادقة الخاص بك، ثم أدخل الرمز للتحقق.",
    verificationTitle: "المصادقة الثنائية",
    verificationSubtitle: "أدخل الرمز المكون من 6 أرقام من تطبيق المصادقة الخاص بك",
    tokenLabel: "رمز التحقق",
    tokenPlaceholder: "000000",
    pleaseEnterVerificationCode: "يرجى إدخال رمز التحقق من تطبيق المصادقة الخاص بك",
    verifyButton: "تحقق",
    useBackupCode: "استخدام رمز النسخ الاحتياطي",
    verifyAndEnable: "تحقق وتمكين",
    enable: "تمكين MFA",
    enableMFA: "تمكين المصادقة متعددة العوامل",
    manageMFA: "إدارة المصادقة متعددة العوامل",
    disable: "تعطيل MFA",
    disableTitle: "تعطيل MFA",
    disableSubtitle: "أدخل رمز MFA الحالي الخاص بك لتعطيل المصادقة متعددة العوامل",
    disableConfirmTitle: "تعطيل MFA؟",
    disableConfirmMessage: "هل أنت متأكد أنك تريد تعطيل المصادقة متعددة العوامل؟ سيؤدي هذا إلى تقليل أمان حسابك.",
    enabled: "ممكن",
    disabled: "معطل",
    enabledSuccess: "تم تمكين المصادقة متعددة العوامل بنجاح.",
    disabledSuccess: "تم تعطيل المصادقة متعددة العوامل.",
    status: "الحالة",
    enrolledOn: "مسجل في",
    backupCodesRemaining: "رموز النسخ الاحتياطي المتبقية",
    backupCodesTitle: "رموز النسخ الاحتياطي",
    backupCodesWarning: "احفظ هذه الرموز في مكان آمن. يمكنك استخدامها للوصول إلى حسابك إذا فقدت جهاز المصادقة الخاص بك.",
    backupCodeLength: "رموز النسخ الاحتياطي مكونة من 8 أحرف",
    regenerateBackupCodes: "إعادة إنشاء رموز النسخ الاحتياطي",
    regenerateBackupCodesTitle: "إعادة إنشاء رموز النسخ الاحتياطي؟",
    regenerateBackupCodesSubtitle: "أدخل رمز MFA الحالي الخاص بك لإنشاء رموز نسخ احتياطي جديدة",
    regenerateBackupCodesMessage: "لن تعمل رموز النسخ الاحتياطي القديمة بعد الآن. تأكد من حفظ الرموز الجديدة بأمان.",
    regenerate: "إعادة إنشاء",
    backupCodesRegenerated: "تم إعادة إنشاء رموز النسخ الاحتياطي",
    backupCodesRegeneratedMessage: "تم إنشاء رموز النسخ الاحتياطي الجديدة الخاصة بك. يرجى حفظها بأمان.",
    secretLabel: "أو أدخل هذا السر يدوياً:",
    invalidTokenLength: "يرجى إدخال رمز مكون من 6 أرقام",
    verificationFailed: "رمز غير صالح. يرجى المحاولة مرة أخرى.",
    enableFailed: "فشل تمكين MFA",
    disableFailed: "فشل تعطيل MFA. يرجى التحقق من الرمز الخاص بك.",
    regenerateFailed: "فشل إعادة إنشاء رموز النسخ الاحتياطي.",
  },
  callScreen: {
    onboardingNextRegular: "بعد انتهاء التهيئة، ستستخدم المتابعات تنسيق الرفاهية المعتاد.",
    onboardingNextWillBe: "حتى اكتمال التهيئة، ستستمر المكالمة الصادرة التالية في التهيئة (الجلسة {{day}}).",
    onboardingProgress: "اكتمل {{completed}} من {{total}} جلسات التهيئة.",
    onboardingThisCall: "هذه المكالمة هي جلسة التهيئة {{day}} من {{total}}. يتقدّم المسار عندما يردّ المقيم وتكتمل الجلسة.",
    onboardingTitle: "تهيئة المقيم",
    title: "مكالمة",
    noClientSelected: "لم يتم اختيار عميل",
    callWith: "مكالمة مع {{name}}",
    callDetails: "تفاصيل المكالمة",
    clientLabel: "العميل:",
    phoneLabel: "الهاتف:",
    statusLabel: "الحالة:",
    liveIndicator: "مباشر",
    aiSpeaking: "الذكاء الاصطناعي يتحدث...",
    userSpeaking: "المستخدم يتحدث...",
  },
  caregiverInvitedScreen: {
    continue: "متابعة",
    message: "تم إرسال دعوة مقدم الرعاية بنجاح.",
    title: "تم إرسال الدعوة!",
    subMessage: "They will receive an email with instructions to complete their registration.",
  },
  emailVerificationFailedPage: {
    helpExpired: "تنتهي صلاحية روابط التحقق بعد 24 ساعة لأسباب أمنية.",
    helpGeneric: "إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع الدعم.",
    loginButton: "الانتقال إلى تسجيل الدخول",
    messageExpired: "انتهت صلاحية رابط التحقق هذا. يرجى طلب بريد تحقق جديد.",
    messageInvalid: "رابط التحقق هذا غير صالح أو تم استخدامه مسبقًا.",
    title: "فشل التحقق",
  },
  logoutScreen: {
    logoutButton: "تسجيل الخروج",
    logoutMessage: "هل أنت متأكد أنك تريد تسجيل الخروج؟",
  },
  phoneVerificationScreen: {
    codeResent: "تمت إعادة إرسال رمز التحقق!",
    codeSent: "تم إرسال رمز التحقق!",
    didntReceiveCode: "لم تستلم الرمز؟",
    errorResendingCode: "فشلت إعادة إرسال رمز التحقق. حاول مرة أخرى.",
    errorSendingCode: "فشل إرسال رمز التحقق. حاول مرة أخرى.",
    errorVerifyingCode: "رمز تحقق غير صالح. حاول مرة أخرى.",
    invalidCode: "يرجى إدخال رمز من 6 أرقام",
    message: "أرسلنا رمز تحقق من 6 أرقام إلى {{phone}}. يرجى إدخاله أدناه.",
    resendAvailableIn: "إعادة الإرسال متاحة خلال",
    resendButton: "إعادة إرسال الرمز",
    sendCodeButton: "إرسال رمز التحقق",
    title: "تحقّق من هاتفك",
    verifyButton: "تحقّق من الهاتف",
  },
  privacyRequestScreen: {
    accessMethodDownload: "تنزيل",
    accessMethodEmail: "البريد الإلكتروني",
    accessMethodInfo: "ستُرسل بياناتك إليك عبر البريد كملف JSON مرفق.",
    accessMethodLabel: "كيف تريد استلام بياناتك؟",
    additionalInformationLabel: "معلومات إضافية (اختياري)",
    complaintDescriptionLabel: "الوصف *",
    complaintDescriptionPlaceholder: "يرجى تقديم تفاصيل شكواك، بما في ذلك ما حدث ومتى.",
    complaintFieldsRequired: "يرجى تعبئة الموضوع والوصف.",
    complaintHistoryTitle: "سجل الشكاوى",
    complaintRequestDescription: "إذا كنت تعتقد أننا لم نتعامل مع معلوماتك الشخصية وفقًا لقوانين الخصوصية، يمكنك تقديم شكوى. سنحقّق ونرد خلال 30 يومًا.",
    complaintRequestTitle: "شكوى خصوصية",
    complaintSubjectLabel: "الموضوع *",
    complaintSubjectPlaceholder: "وصف موجز لشكواك",
    complaintSubmitted: "تم تقديم شكواك. سنحقّق ونرد خلال 30 يومًا.",
    completedOn: "اكتمل في",
    confirmDelete: "حذف",
    correctionFieldLabel: "الحقل المراد تصحيحه",
    correctionFieldPlaceholder: "مثل: البريد الإلكتروني، الهاتف، الاسم",
    correctionFieldsRequired: "يرجى تعبئة اسم الحقل والقيمة المطلوبة.",
    correctionNote: "ملاحظة: يمكن تعديل معظم البيانات مباشرة في التطبيق. استخدم هذا النموذج للبيانات التي لا يمكن تعديلها، مثل السجلات التاريخية أو المولّدة من النظام.",
    correctionReasonLabel: "سبب التصحيح (اختياري)",
    correctionReasonPlaceholder: "لماذا تحتاج هذه المعلومات إلى تصحيح؟",
    correctionRequestDescription: "اطلب تصحيح معلوماتك الشخصية. يرجى تقديم تفاصيل ما يحتاج إلى تصحيح.",
    correctionRequestSubmitted: "تم تقديم طلب التصحيح. سنراجعه ونعالجه خلال 30 يومًا.",
    correctionRequestTitle: "طلب تصحيح البيانات",
    currentValue: "القيمة الحالية",
    currentValueLabel: "القيمة الحالية (اختياري)",
    currentValuePlaceholder: "ما هي القيمة الحالية؟",
    deletionCompleted: "اكتمل حذف البيانات بنجاح.",
    deletionConfirmMessage: "سيؤدي هذا إلى حذف بياناتك نهائيًا. لا يمكن التراجع عن هذا الإجراء. هل أنت متأكد أنك تريد المتابعة؟",
    deletionConfirmTitle: "تأكيد حذف البيانات",
    deletionDataTypeLabel: "ما البيانات التي تريد حذفها؟",
    deletionFailed: "فشل حذف البيانات. قد لا يكون متاحًا في نطاقك القضائي بسبب متطلبات الاحتفاظ القانونية.",
    deletionRequestDescription: "بموجب PIPEDA، يمكنك طلب حذف معلوماتك الشخصية. ملاحظة: HIPAA يتطلب الاحتفاظ 7 سنوات، لذا قد لا يكون الحذف متاحًا في جميع الولايات القضائية.",
    deletionRequestTitle: "طلب حذف البيانات",
    deletionTypeAll: "جميع البيانات",
    deletionTypeCalls: "المكالمات فقط",
    deletionTypeConversations: "المحادثات فقط",
    deletionTypeMedicalAnalysis: "التحليل الطبي فقط",
    field: "الحقل",
    filedOn: "قدّم في",
    informationRequestedLabel: "المعلومات المطلوبة",
    informationRequestedPlaceholder: "جميع معلوماتي الشخصية (أو حدّد ما تحتاجه)",
    reason: "السبب",
    requestDataDescription: "صف المعلومات التي تريد الوصول إليها. اتركه فارغًا لطلب جميع معلوماتك الشخصية.",
    requestDataTitle: "طلب الوصول إلى البيانات",
    requestDeletion: "طلب حذف البيانات",
    requestFailed: "فشل تقديم الطلب. حاول مرة أخرى.",
    requestHistoryTitle: "سجل الطلبات",
    requestSubmitted: "تم تقديم طلب البيانات. ستتلقى بريدًا إلكترونيًا ببياناتك قريبًا.",
    requestTypeAccess: "طلب وصول",
    requestTypeComplaint: "تقديم شكوى",
    requestTypeCorrection: "طلب تصحيح",
    requestedOn: "طُلب في",
    requestedValue: "القيمة المطلوبة",
    requestedValueLabel: "القيمة المطلوبة *",
    requestedValuePlaceholder: "ما الذي يجب أن تكون عليه القيمة المصحّحة؟",
    resolvedOn: "حُلّ في",
    submitRequest: "تقديم الطلب",
    subtitle: "بموجب PIPEDA، لك الحق في الوصول إلى معلوماتك الشخصية وتصحيحها. قدّم طلبًا للوصول إلى بياناتك أو تصحيحها.",
    title: "طلب بياناتي",
    violationTypeAccess: "مشكلة وصول",
    violationTypeLabel: "نوع المشكلة (اختياري)",
    violationTypeOther: "أخرى",
  },
}

export default ar
