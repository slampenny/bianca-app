import { LocaleTranslations } from "./en"

const hu: LocaleTranslations = {
  common: {
    ok: "OK",
    cancel: "Mégse",
    close: "Bezárás",
    error: "Hiba",
    anErrorOccurred: "Hiba történt",
    back: "Vissza",
    logOut: "Kijelentkezés",
    selectImage: "Kép kiválasztása",
    calling: "Hívás...",
    callNow: "Hívás most",
    ending: "Befejezés...",
    endCall: "Hívás befejezése",
    loading: "Betöltés...",
    done: "Kész",
    delete: "Törlés",
    continue: "Folytatás",
    signInToContinue: "A folytatáshoz jelentkezzen be.",
  },
  alertScreen: {
    markAllAsRead: "Összes olvasottnak jelölése",
    unreadAlerts: "Olvasatlan értesítések",
    allAlerts: "Összes értesítés",
    noAlerts: "Nincs értesítés",
    noAlertsTitle: "Minden rendben!",
    noAlertsSubtitle: "Nincs olvasatlan értesítése. Remek munka, naprakészen tartja magát!",
    emptyHeading: "Olyan üres... olyan szomorú",
    refreshing: "Frissítés...",
    refresh: "Frissítés",
    client: "Ügyfél:",
    importance: "Fontosság:",
    expires: "Lejár:",
    filteredByClientBanner: "Értesítések: {{name}}",
    clearAlertFilter: "Összes megjelenítése",
    noAlertsForFilteredClientTitle: "Nincs értesítés ehhez az ügyfélhez",
    noAlertsForFilteredClientSubtitle:
      "Nincs {{name}} névhez kapcsolódó értesítés. Törölje a szűrőt az összes értesítés megtekintéséhez, vagy válasszon másik ügyfelet a Kezdőlapról.",
  },
  legalLinks: {
    privacyPolicy: "Adatvédelmi szabályzat",
    privacyPractices: "HIPAA adatvédelmi gyakorlatok",
    termsOfService: "Felhasználási feltételek",
  },
  welcomeScreen: {
    postscript: "psszt — Valószínűleg nem így néz ki az alkalmazása. (Hacsak a tervező nem ezeket a képernyőket adta — akkor tegye élesbe!)",
    readyForLaunch: "Az alkalmazása majdnem készen áll az indulásra!",
    exciting: "(ó, ez izgalmas!)",
    letsGo: "Gyerünk!",
  },
  errorScreen: {
    title: "Valami hiba történt!",
    friendlySubtitle: "Hiba történt. Érdemes lehet testre szabni a megjelenést is (`app/screens/ErrorScreen`). Ha teljesen el szeretné távolítani, nézze meg az `app/app.tsx` fájlt az <ErrorBoundary> komponensért.",
    reset: "ALKALMAZÁS ÚJRAINDÍTÁSA",
    traceTitle: "Hiba stack: %{name}",
  },
  emptyStateComponent: {
    generic: {
      heading: "Olyan üres... olyan szomorú",
      content: "Még nincs adat. Próbálja meg a gombra kattintva frissíteni, vagy töltse újra az alkalmazást.",
      button: "Próbáljuk meg újra",
    },
  },
  errors: {
    invalidEmail: "Érvénytelen e-mail-cím.",
  },
  loginScreen: {
    signIn: "Bejelentkezés",
    register: "Regisztráció",
    enterDetails: "Adja meg az adatait alább a titkos információk feloldásához. Soha nem találná ki, mit tartogatunk Önnek. Vagy talán mégis — nem rakétatudomány.",
    emailFieldLabel: "E-mail",
    passwordFieldLabel: "Jelszó",
    emailFieldPlaceholder: "Adja meg az e-mail-címét",
    passwordFieldPlaceholder: "Szuper titkos jelszó ide",
    forgotPassword: "Elfelejtette a jelszavát?",
    hint: "Tipp: bármilyen e-mail-címet és kedvenc jelszavát használhatja :)",
    appName: "Bianca",
    tagline: "Jólétellenőrző kommunikáció",
  },
  logoutScreen: {
    logoutButton: "Kijelentkezés",
    logoutMessage: "Biztos benne?",
  },
  registerScreen: {
    title: "Regisztráció",
    nameFieldLabel: "Név",
    emailFieldLabel: "E-mail",
    phoneFieldLabel: "Telefon",
    passwordFieldLabel: "Jelszó",
    goBack: "Vissza",
    confirmPasswordFieldLabel: "Jelszó megerősítése",
    organizationNameFieldLabel: "Szervezet neve",
    nameFieldPlaceholder: "Adja meg a nevét",
    emailFieldPlaceholder: "Adja meg az e-mail-címét",
    passwordFieldPlaceholder: "Adja meg a jelszavát",
    confirmPasswordFieldPlaceholder: "Erősítse meg a jelszavát",
    phoneFieldPlaceholder: "(xxx)xxx-xxxx",
    organizationNameFieldPlaceholder: "Adja meg a szervezet nevét",
    organizationButton: "Szervezet",
    individualButton: "Magánszemély",
    individualExplanation: "Regisztráljon magánszemélyként személyes használatra.",
    organizationExplanation: "Regisztráljon szervezetként vállalati vagy csoportos használatra.",
    consentText: "A regisztrációval elfogadja a",
    consentAnd: "és a",
    termsOfService: "Felhasználási feltételeket",
    privacyPolicy: "Adatvédelmi szabályzatot",
    countryFieldLabel: "Ország",
  },
  signupScreen: {
    title: "Meghívó befejezése",
    fullNameLabel: "Teljes név",
    fullNamePlaceholder: "Az Ön teljes neve",
    emailLabel: "E-mail-cím",
    emailPlaceholder: "az.on.email@pelda.com",
    phoneLabel: "Telefonszám",
    phonePlaceholder: "(555) 123-4567",
    passwordLabel: "Jelszó",
    passwordPlaceholder: "Adja meg a jelszavát",
    confirmPasswordLabel: "Jelszó megerősítése",
    confirmPasswordPlaceholder: "Erősítse meg a jelszavát",
    completeRegistration: "Regisztráció befejezése",
    preconfiguredMessage: "A nevét, e-mail-címét és szervezeti adatait az adminisztrátor előre beállította.",
  },
  homeScreen: {
    welcome: "Üdvözöljük, {{name}}",
    guest: "Vendég",
    addClient: "Ügyfél hozzáadása",
    adminOnlyMessage: "Csak szervezeti adminisztrátorok és szuperadminisztrátorok adhatnak hozzá ügyfeleket",
    noClientsFound: "Nem található ügyfél",
    viewSchedules: "Ütemezések megtekintése",
    noScheduleWarning: "⚠ Nincs beállított ütemezés",
    lastCalled: "Utolsó hívás",
    lastAnsweredCall: "Utolsó fogadott hívás",
    neverCalled: "Soha",
    noAnsweredCallsYet: "Még nincs fogadott hívás",
    glanceNoData: "—",
    glanceSentiment: "Hangulat",
    glanceHealth: "Egészség",
    glanceRisk: "Kockázat",
    sentimentTrendImproving: "Emelkedő",
    sentimentTrendStable: "Stabil",
    sentimentTrendDeclining: "Csökkenő",
    glanceHintButtonA11y: "A(z) {{label}} névjegye",
    glanceHintSentimentTitle: "Hangulati trend",
    glanceHintSentimentBody:
      "Összefoglaló arról, hogyan hangzott az ügyfél hangvétele a legutóbbi elemzett hívásokban (kb. az elmúlt 30 nap). Az emelkedő, stabil vagy csökkenő az újabb hívásokat a kissé régebbiekhez hasonlítja. Nem diagnózis — a teljes hangulatelemzéshez nyissa meg a jelentést.",
    glanceHintHealthTitle: "Egészségpontszám",
    glanceHintHealthBody:
      "Összesített jóléti pontszám a legutóbbi orvosi beszélgetéselemzésből (0–100, magasabb jobb). A hívásokból származó kognitív és hangulati mintákat egyesíti. Nem helyettesíti a klinikai ítéletet vagy a teljes egészségügyi jelentést.",
    glanceHintRiskTitle: "Kockázati pontszám",
    glanceHintRiskBody:
      "Összesített kockázati pontszám a legutóbbi csalás- és biztonsági elemzésből (0–100, magasabb több aggodalom). Pénzügyi, biztonsági, elszigeteltségi témákat tükröz. A részletekért nyissa meg a csalás- és visszaélési jelentést.",
    glanceHealthA11y: "Egészségpontszám {{score}} százból",
    glanceRiskA11y: "Kockázati pontszám {{score}} százból",
    glanceAlerts: "Figyelmeztetések",
    glanceHintAlertsTitle: "Figyelmeztetések ehhez az ügyfélhez",
    glanceHintAlertsBody:
      "Hány figyelmeztetés kapcsolódik ehhez a lakóhoz a listájában (pl. ügyfél-, beszélgetés- vagy időpont-figyelmeztetések). Nyissa meg az Értesítések lapot az olvasáshoz vagy kezeléshez. Az ügyfélhez nem kapcsolódó figyelmeztetések itt nem számítanak.",
    glanceAlertsA11y: "{{count}} figyelmeztetés kapcsolódik ehhez az ügyfélhez",
    glanceSentimentActionHint: "Megnyitja az utolsó hívás hangulatelemzését a Jelentések alatt.",
    glanceHealthActionHint: "Megnyitja az ügyfél egészségügyi elemzési jelentését a Jelentések alatt.",
    glanceRiskActionHint: "Megnyitja az ügyfél csalás- és biztonsági jelentését a Jelentések alatt.",
    glanceAlertsActionHint: "Megnyitja a figyelmeztetéslistát, szűrve erre az ügyfélre.",
  },
  tabs: {
    home: "Kezdőlap",
    org: "Szervezet",
    reports: "Jelentések",
    alerts: "Értesítések",
  },
  onboarding: {
    howItWorks: {
      title: "Így működik a Bianca",
      next: "Tovább",
      getStarted: "Kezdés",
      organization: "Adja hozzá ügyfeleit, ütemezze, mikor hívja őket a Bianca, és tekintse meg a beszélgetéseket és jelentéseket egy helyen. A Bianca elvégzi a hívásokat, hogy Ön az ellátásra koncentrálhasson.",
      caregiver: "Adja hozzá azokat, akiket ellát, válassza ki, mikor hívja őket a Bianca, és a beszélgetésekből és jelentésekből tudja meg, hogy vannak. Naprakész marad anélkül, hogy minden hívásnál jelen lenne.",
      agingInPlace: "A Bianca az Ön ütemezése szerint hívja barátságos ellenőrző hívásokra. Jólétét és jelentéseit bármikor megtekintheti. Mint egy társ, aki mindig ott van, amikor szüksége van rá.",
    },
    aboutYou: {
      title: "Meséljen egy kicsit magáról",
      subtitle: "Ez segít személyre szabni az élményt.",
      organization: "Szervezet",
      caregiver: "Gondozó",
      agingInPlace: "Önálló otthonában élő idős",
    },
    orgInfo: {
      title: "Szervezeti adatok",
      subtitle: "Meséljen a szervezetéről.",
      orgNameLabel: "Szervezet neve",
      orgNamePlaceholder: "Adja meg a szervezet nevét",
      countryLabel: "Ország",
      timezoneLabel: "Időzóna",
    },
    registration: {
      title: "Az Ön adatai",
      subtitle: "Erősítse meg adatait és fogadja el a feltételeket a folytatáshoz.",
      nameRequired: "A név megadása kötelező.",
      emailRequired: "Az e-mail megadása kötelező.",
      termsRequired: "A folytatáshoz el kell fogadnia a Felhasználási feltételeket és az Adatvédelmi szabályzatot.",
    },
    termsAndConsent: {
      title: "Feltételek és hozzájárulás",
      acceptTerms: "Elolvastam és elfogadom a",
      termsLink: "Felhasználási feltételeket",
      and: "és a",
      privacyLink: "Adatvédelmi szabályzatot",
      acceptTermsLabel: "Felhasználási feltételek és adatvédelmi szabályzat elfogadása",
      singleConsentQuestion: "Egyoldalú hozzájárulású államban él? (A felvételhez csak egy fél hozzájárulása kell.)",
      whyImportant: "Miért fontos ez?",
      whyImportantBody:
        "A hívásfelvételi törvények államonként és országonként eltérnek. Egyoldalú államokban elég egy fél hozzájárulása; kétoldalú államokban minden résztvevőnek bele kell egyeznie. A helyes beállítás megőrzi a megfelelőséget.",
      yes: "Igen",
      no: "Nem",
      saveAndContinue: "Mentés és folytatás",
    },
  },
  headers: {
    home: "Kezdőlap",
    client: "Ügyfél",
    schedule: "Ütemezés",
    conversations: "Beszélgetések",
    call: "Hívás",
    profile: "Profil",
    logout: "Kijelentkezés",
    alerts: "Értesítések",
    organization: "Szervezet",
    caregivers: "Gondozók",
    caregiver: "Gondozó",
    caregiverInvited: "Gondozó meghívva",
    payments: "Fizetések",
    reports: "Jelentések",
    sentimentAnalysis: "Hangulatelemzés",
    clientOnboarding: "Bevezetés",
    medicalAnalysis: "Orvosi elemzés",
    fraudAbuseAnalysis: "Csalás- és visszaéléselemzés",
    privacyPolicy: "Adatvédelmi szabályzat",
    termsOfService: "Felhasználási feltételek",
    mentalHealthReport: "Mentálhigiénés jelentés",
    privacyPractices: "HIPAA adatvédelmi gyakorlatok",
    privacyRequest: "Adataim kérése",
    login: "Bejelentkezés",
    register: "Regisztráció",
  },
  requestResetScreen: {
    title: "Jelszó-visszaállítás kérése",
    emailFieldLabel: "E-mail",
    emailFieldPlaceholder: "Adja meg az e-mail-címét",
    requestReset: "Visszaállítás kérése",
    successMessage: "Visszaállító kód elküldve az e-mail-címére!",
    requestFailed: "A kérés sikertelen. Ellenőrizze az e-mail-címét, és próbálja újra.",
  },
  ssoLinkingScreen: {
    title: "Fiók összekapcsolása",
    message: "Ezt a fiókot {{provider}} segítségével hozták létre. E-mail/jelszó bejelentkezéshez állítson be jelszót alább, vagy folytassa {{provider}} használatával.",
    passwordLabel: "Jelszó",
    passwordPlaceholder: "Adja meg a jelszavát",
    confirmPasswordLabel: "Jelszó megerősítése",
    confirmPasswordPlaceholder: "Erősítse meg a jelszavát",
    setPasswordButton: "Jelszó beállítása",
    backToLoginButton: "Vissza a bejelentkezéshez",
    orDivider: "Vagy",
    successMessage: "✓ A jelszó sikeresen beállítva! Most már e-mail-címével és jelszavával jelentkezhet be.",
    errorNoPassword: "Kérjük, adjon meg jelszót",
    errorNoConfirmPassword: "Kérjük, erősítse meg a jelszavát",
    errorPasswordMismatch: "A jelszavak nem egyeznek",
    errorPasswordTooShort: "A jelszónak legalább 8 karakter hosszúnak kell lennie",
    errorSetPasswordFailed: "Nem sikerült beállítani a jelszót",
    errorSSOFailed: "Az SSO bejelentkezés sikertelen. Kérjük, próbálja újra.",
    providerGoogle: "Google",
    providerMicrosoft: "Microsoft",
    providerSSO: "SSO",
  },
  ssoButtons: {
    orContinueWith: "Vagy folytatás ezzel",
    google: "Google",
    microsoft: "Microsoft",
    continueWithGoogle: "Folytatás Google-lal",
    continueWithMicrosoft: "Folytatás Microsofttal",
    companySSO: "Vállalati SSO",
    ssoNotAvailable: "Az SSO nem érhető el",
    signInFailed: "A bejelentkezés sikertelen",
    companySSOTitle: "Vállalati SSO",
    companySSOMessage: "Ez a vállalata SSO-szolgáltatójához irányítana át. A beállításhoz forduljon az adminisztrátorához.",
  },
  emailVerificationScreen: {
    title: "Ellenőrizze az e-mailjét",
    message: "Ellenőrző linket küldtünk az e-mail-címére. Kattintson a linkre a fiók ellenőrzéséhez, mielőtt bejelentkezne.",
    emailFieldLabel: "E-mail-cím",
    emailFieldPlaceholder: "Adja meg az e-mail-címét",
    resendButton: "Ellenőrző e-mail újraküldése",
    backToLoginButton: "Vissza a bejelentkezéshez",
    successMessage: "✓ Ellenőrző e-mail elküldve! Kérjük, ellenőrizze a postaládáját.",
    verifying: "Ellenőrzés…",
    errorNoEmail: "Kérjük, adja meg az e-mail-címét",
    errorSendFailed: "Nem sikerült elküldeni az ellenőrző e-mailt",
    errorNoToken: "Hiányzik az ellenőrző token",
    errorVerificationFailed: "Az e-mail ellenőrzése sikertelen",
    errorNetwork: "Nem sikerült csatlakozni a szerverhez. Ellenőrizze az internetkapcsolatot, és próbálja újra.",
    verificationFailed: "Az e-mail ellenőrzése sikertelen",
  },
  emailVerificationFailedPage: {
    title: "Az ellenőrzés sikertelen",
    messageExpired: "Ez az ellenőrző link lejárt. Kérjen új ellenőrző e-mailt.",
    messageInvalid: "Ez az ellenőrző link érvénytelen, vagy már felhasználták.",
    helpExpired: "Az ellenőrző linkek biztonsági okokból 24 óra után lejárnak.",
    helpGeneric: "Ha úgy gondolja, hogy ez hiba, forduljon az ügyfélszolgálathoz.",
    loginButton: "Ugrás a bejelentkezéshez",
  },
  emailVerifiedScreen: {
    title: "E-mail ellenőrizve!",
    message: "A My Phone Friend fiókja sikeresen ellenőrizve lett.",
    redirecting: "Átirányítás az alkalmazásba...",
  },
  phoneVerificationBanner: {
    title: "Erősítse meg telefonszámát",
    message: "Kérjük, erősítse meg telefonszámát, hogy vészhelyzeti értesítéseket és fontos közleményeket kapjon.",
    verifyButton: "Megerősítés most",
  },
  phoneVerificationScreen: {
    title: "Erősítse meg telefonszámát",
    message: "6 számjegyű ellenőrző kódot küldtünk a {{phone}} számra. Adja meg alább.",
    codeSent: "Ellenőrző kód elküldve!",
    codeResent: "Ellenőrző kód újraküldve!",
    sendCodeButton: "Ellenőrző kód küldése",
    verifyButton: "Telefon ellenőrzése",
    resendButton: "Kód újraküldése",
    didntReceiveCode: "Nem kapta meg a kódot?",
    resendAvailableIn: "Újraküldés elérhető",
    invalidCode: "Kérjük, adjon meg 6 számjegyű kódot",
    errorSendingCode: "Nem sikerült elküldeni az ellenőrző kódot. Kérjük, próbálja újra.",
    errorResendingCode: "Nem sikerült újraküldeni az ellenőrző kódot. Kérjük, próbálja újra.",
    errorVerifyingCode: "Érvénytelen ellenőrző kód. Kérjük, próbálja újra.",
  },
  conversationsScreen: {
    title: "Beszélgetések",
    yesterday: "Tegnap",
    noMessages: "Nincs üzenet",
    noClientSelected: "Nincs kiválasztott ügyfél",
    firstConversation: "Nem található korábbi beszélgetés. Ez lesz az első beszélgetés ezzel az ügyféllel.",
    noConversationsToDisplay: "Nincs megjeleníthető beszélgetés",
    noPreviousConversations: "Nem található korábbi beszélgetés ehhez az ügyfélhez",
    errorFetchingConversations: "Hiba a beszélgetések betöltésekor",
    loadingMoreConversations: "További beszélgetések betöltése...",
  },
  clientScreen: {
    nameLabel: "Név *",
    namePlaceholder: "Adja meg az ügyfél nevét",
    emailLabel: "E-mail *",
    emailPlaceholder: "Adja meg az e-mail-címet",
    phoneLabel: "Telefon *",
    phonePlaceholder: "Adja meg a telefonszámot",
    preferredLanguageLabel: "Előnyben részesített nyelv",
    updateClient: "ÜGYFÉL FRISSÍTÉSE",
    createClient: "ÜGYFÉL LÉTREHOZÁSA",
    manageSchedules: "ÜTEMEZÉSEK KEZELÉSE",
    manageConversations: "BESZÉLGETÉSEK KEZELÉSE",
    viewSentimentAnalysis: "HANGULATELEMZÉS MEGTEKINTÉSE",
    manageCaregivers: "GONDOZÓK KEZELÉSE",
    confirmDelete: "TÖRLÉS MEGERŐSÍTÉSE",
    deleteClient: "ÜGYFÉL TÖRLÉSE",
    onboardingCardTitle: "Lakó bevezetése",
    onboardingNotStarted: "Még nem kezdődött el — következő: 1. nap a {{total}}-ből",
    onboardingInProgress: "Folyamatban",
    onboardingNextDay: "Következő: {{day}}. nap a {{total}}-ből",
    onboardingCallsCompleted: "{{completed}} a {{total}} hívásból befejezve",
    onboardingCapturesLine: "{{count}} témaválasz rögzítve",
    onboardingComplete: "Bevezetés befejezve — mind a 4 hívás lezárult",
    viewOnboardingDetails: "BEVEZETÉSI VÁLASZOK MEGTEKINTÉSE",
    onboardingButtonCompactComplete: "Bevezetés · Befejezve",
    onboardingButtonCompactDay: "Bevezetés · {{day}}. nap",
    onboardingButtonA11yHint: "Megnyitja az ügyfél bevezetési válaszait és folyamatát.",
    onboardingOutboundCallsHint:
      "A Kezdőlapról vagy az ütemezésből indított kimenő hívások a bevezetési beszélgetést használják a {{day}}. munkamenethez, amíg az telefonon be nem fejeződik. Ha nincs válasz, nincs előrehaladás — a következő hívás ugyanazon a munkameneten marad.",
  },
  callScreen: {
    title: "Hívás",
    noClientSelected: "Nincs kiválasztott ügyfél",
    callWith: "Hívás vele: {{name}}",
    callDetails: "Hívás részletei",
    clientLabel: "Ügyfél:",
    phoneLabel: "Telefon:",
    statusLabel: "Állapot:",
    liveIndicator: "Élő",
    aiSpeaking: "MI beszél...",
    userSpeaking: "Felhasználó beszél...",
    onboardingTitle: "Lakó bevezetése",
    onboardingThisCall:
      "Ez a hívás a bevezetés {{day}}. munkamenete a {{total}}-ből. A folyamat akkor halad, ha a lakó felveszi és a munkamenet befejeződik.",
    onboardingProgress: "{{completed}} a {{total}} bevezetési munkamenetből befejezve.",
    onboardingNextRegular: "A bevezetés után az ellenőrzések a szokásos jóléti formátumot használják.",
    onboardingNextWillBe: "Amíg a bevezetés nincs kész, a következő kimenő hívás folytatja a bevezetést ({{day}}. munkamenet).",
  },
  clientOnboardingScreen: {
    title: "Bevezetési válaszok",
    noClient: "Nincs kiválasztott ügyfél.",
    day: "Nap",
    filterByDay: "Szűrés nap szerint",
    allDays: "Minden nap",
    loading: "Betöltés…",
    error: "Nem sikerült betölteni a bevezetési adatokat.",
    captureCount: "{{count}} rögzítés",
    emptyAllDays: "Még nincsenek rögzített bevezetési válaszok.",
    emptyForDay: "A {{day}}. nap bevezetése még nem történt meg.",
    signalsForDay: "A {{day}}. napon rögzített jelek",
    flag: {
      safety: "Biztonság",
      memory: "Memória",
      mood: "Hangulat",
      distress: "Szenvedés",
      confusion: "Zavarodottság",
    },
  },
  paymentScreen: {
    paid: "Fizetve",
    pending: "Függőben",
    overdue: "Lejárt",
    processing: "Feldolgozás alatt",
    unknown: "Ismeretlen",
    latestInvoice: "Legutóbbi számla",
    paymentMethod: "Fizetési mód",
    currentChargesSummary: "Aktuális díjak összefoglalója",
    basicPlan: "Alapcsomag",
    contactSupport: "Ügyfélszolgálat",
    currentCharges: "Aktuális díjak",
    paymentMethods: "Fizetési módok",
    billingInfo: "Számlázási adatok",
    noOrganizationData: "Nincs elérhető szervezeti adat",
    authorizationTokenNotAvailable: "Az engedélyezési token nem érhető el",
    errorLoadingCurrentCharges: "Hiba az aktuális díjak betöltésekor",
    noPendingCharges: "Nincs függőben lévő díj",
    allConversationsBilled: "Minden beszélgetés számlázva lett",
    totalUnbilledAmount: "Összes nem számlázott összeg",
    period: "Időszak",
    lastDays: "Utolsó {days} nap",
    day: "nap",
    days: "nap",
    clientsWithCharges: "Díjjal rendelkező ügyfelek:",
    conversation: "beszélgetés",
    conversations: "beszélgetés",
    clientsWord: "ügyfél",
    clientWord: "ügyfél",
    chargesByClient: "Díjak ügyfél szerint",
    average: "Átlag",
    noUserData: "Nincs elérhető felhasználói adat",
    currentPlan: "Aktuális csomag",
    nextBillingDate: "Következő számlázási dátum",
    totalBilledAmount: "Összes számlázott összeg",
    acrossInvoices: "{count} számlán",
    invoiceHistory: "Számlaelőzmények ({count})",
    hide: "Elrejtés",
    show: "Megjelenítés",
    history: "Előzmények",
    noInvoicesYet: "Még nincsenek számlák",
    invoicesWillAppear: "A számlák itt jelennek meg, amint elkészülnek",
    loadingUserInformation: "Felhasználói adatok betöltése...",
    accessRestricted: "Hozzáférés korlátozva",
    accessRestrictedMessage: "Nincs jogosultsága a fizetési adatok megtekintéséhez.",
    contactAdministrator: "A hozzáférésért forduljon az adminisztrátorához.",
    // Payment methods / Stripe
    addPaymentMethod: "Fizetési mód hozzáadása",
    loadingPaymentSystem: "Fizetési rendszer betöltése...",
    loadingPaymentMethods: "Fizetési módok betöltése...",
    stripeConfigurationError: "Stripe konfigurációs hiba. Kérjük, forduljon az ügyfélszolgálathoz.",
    unsupportedPlatform: "Nem támogatott platform. Kérjük, használjon webböngészőt vagy mobilalkalmazást.",
    errorLoadingPaymentMethods: "Hiba a fizetési módok betöltésekor:",
    existingPaymentMethods: "Meglévő fizetési módok",
    default: "Alapértelmezett",
    setDefault: "Beállítás alapértelmezettként",
    remove: "Eltávolítás",
    addNewCard: "Új kártya hozzáadása",
    deletePaymentMethod: "Fizetési mód törlése",
    deletePaymentMethodConfirm: "Biztosan törli ezt a fizetési módot? Ez a művelet nem vonható vissza.",
    paymentMethodAddedSuccess: "A fizetési mód sikeresen hozzáadva!",
    paymentMethodSetDefaultSuccess: "A fizetési mód sikeresen alapértelmezetté lett állítva!",
    paymentMethodDeletedSuccess: "A fizetési mód sikeresen törölve!",
    failedToSetDefault: "Nem sikerült alapértelmezett fizetési módot beállítani",
    failedToDelete: "Nem sikerült törölni a fizetési módot",
    expires: "Lejár",
    mobilePaymentUnavailable: "A mobil fizetési rendszer nem érhető el. Kérjük, használja a webes verziót.",
    loadingMobilePayment: "Mobil fizetési rendszer betöltése...",
    anErrorOccurred: "Hiba történt",
    amount: "Összeg:",
    invoiceNumber: "Számlaszám:",
    issueDate: "Kiállítás dátuma:",
    dueDate: "Fizetési határidő:",
    notes: "Megjegyzések:",
  },
  orgScreen: {
    namePlaceholder: "Szervezet neve",
    emailPlaceholder: "E-mail",
    phonePlaceholder: "Telefon",
    save: "MENTÉS",
    viewCaregivers: "Gondozók megtekintése",
    inviteCaregiver: "Gondozó meghívása",
    payments: "Fizetések",
    organizationActions: "Szervezeti műveletek",
    organizationLogo: "Szervezeti logó",
    noLogoSet: "Nincs beállított logó",
    country: "Ország",
    countryHelper: "Válassza ki szervezete országát. Ez segít meghatározni az alkalmazandó adatvédelmi szabályokat.",
    timezone: "Időzóna",
    timezoneHelper: "Válassza ki szervezete időzónáját. Az ütemezési időpontok ehhez az időzónához igazodnak.",
    callRetrySettings: "Hívás újrapróbálás beállításai",
    enableRetriesLabel: "Hívás újrapróbálás engedélyezése",
    enableRetriesHelper: "Bekapcsolva a rendszer automatikusan újrapróbálja a sikertelen hívásokat",
    retryCountLabel: "Hívás újrapróbálások száma",
    retryCountHelper: "Hányszor próbálja újra a hívást, ha nem veszik fel (1–5)",
    retryIntervalMinutesLabel: "Újrapróbálás közötti várakozás (perc)",
    retryIntervalMinutesHelper: "Várakozás az újrapróbálások között (1–60 perc, alapértelmezett: 15)",
    alertOnAllMissedCallsLabel: "Riasztás minden nem fogadott hívásra",
    alertOnAllMissedCallsHelper: "Riasztás küldése minden nem fogadott hívásra és újrapróbálásra",
    clientConsentSettings: "Ügyfél hozzájárulás beállításai",
    requireClientConsentLabel: "Ügyfél hozzájárulás kötelező",
    requireClientConsentHelper:
      "Bekapcsolva a hozzájárulási kérelmek automatikusan e-mailben mennek az ügyfeleknek.",
  },
  caregiverScreen: {
    nameLabel: "Név",
    namePlaceholder: "Név",
    emailLabel: "E-mail",
    emailPlaceholder: "E-mail",
    phoneLabel: "Telefon",
    phonePlaceholder: "Telefon",
    loadingUnassignedClients: "Hozzá nem rendelt ügyfelek betöltése…",
    assigningClients: "Ügyfelek hozzárendelése…",
    clientsAssignedSuccess: "Az ügyfelek sikeresen hozzárendelve!",
    loadingCaregivers: "Gondozók betöltése…",
    save: "MENTÉS",
    invite: "MEGHÍVÁS",
    confirmDelete: "TÖRLÉS MEGERŐSÍTÉSE",
    deleteCaregiver: "GONDOZÓ TÖRLÉSE",
    assignUnassignedClients: "Hozzá nem rendelt ügyfelek hozzárendelése",
    assignUnassignedClientsTitle: "Hozzá nem rendelt ügyfelek hozzárendelése",
    selectAll: "Összes kijelölése",
    deselectAll: "Kijelölés törlése",
    assignSelected: "Kijelöltek hozzárendelése",
    noUnassignedClientsFound: "Nem található hozzá nem rendelt ügyfél.",
  },
  caregiversScreen: {
    invited: "Meghívva",
    edit: "Szerkesztés",
    resendInvite: "Meghívó újraküldése",
    noCaregiversFound: "Nem található gondozó",
    notAuthorized: "Nincs jogosultság",
    noPermissionToView: "Nincs jogosultsága a gondozók megtekintéséhez. Forduljon az adminisztrátorához.",
    addCaregiver: "Gondozó hozzáadása",
  },
  profileScreen: {
    languageSelector: "Nyelv / Language",
    selectLanguage: "Nyelv kiválasztása",
    theme: "Téma",
    selectTheme: "Téma kiválasztása",
    namePlaceholder: "Név",
    emailPlaceholder: "E-mail",
    phonePlaceholder: "Telefon",
    yourProfile: "Az Ön profilja",
    updateProfile: "PROFIL FRISSÍTÉSE",
    logout: "KIJELENTKEZÉS",
    profileUpdatedSuccess: "A profilja sikeresen frissítve!",
    profileUpdateFailed: "Nem sikerült frissíteni a profilt. Kérjük, próbálja újra.",
    invalidPhoneFormat: "Érvénytelen telefonszám-formátum (10 számjegy vagy +1XXXXXXXXXX)",
    completeProfileTitle: "Töltse ki a profilját",
    completeProfileMessage: "Kérjük, töltse ki a profilját telefonszám hozzáadásával a folytatás előtt.",
    completeProfileMessageUnverified: "Kérjük, adja meg telefonszámát a profilja kitöltéséhez és az összes funkció eléréséhez.",
    errorUploadingAvatar: "Hiba az avatar feltöltésekor",
    emailVerified: "E-mail ellenőrizve",
    emailNotVerified: "E-mail nincs ellenőrizve",
    phoneVerified: "Telefon ellenőrizve",
    phoneNotVerified: "Telefon nincs ellenőrizve",
    verifyPhone: "Telefon ellenőrzése",
    fontSize: "Betűméret",
    fontSizeDescription: "Állítsa be a szövegméretet a jobb olvashatóság érdekében. A módosítások azonnal érvénybe lépnek.",
    decreaseFontSize: "Betűméret csökkentése",
    increaseFontSize: "Betűméret növelése",
    fontSizeHint: "Betűméret beállítása 80% és 200% között",
    telemetryOptIn: "Névtelen használati adatok megosztása",
    telemetryDescription: "Segítsen fejleszteni az alkalmazást névtelen használati adatok megosztásával. Személyes adatokat nem gyűjtünk.",
    telemetryEnabled: "Telemetria engedélyezve",
    telemetryDisabled: "Telemetria letiltva",
    emailManagedBySSO: "Az e-mailt a bejelentkezési szolgáltató kezeli, nem módosítható.",
    requestMyData: "Adataim kérése",
    verifyPhoneBannerMessage:
      "Kérjük, erősítse meg telefonszámát vészhelyzeti értesítésekhez. Az alkalmazást ellenőrizetlen telefonnal is használhatja.",
    verifyEmail: "E-mail ellenőrzése",
    verificationEmailSent: "Ellenőrző e-mail elküldve! Kérjük, ellenőrizze a postaládáját.",
    verificationEmailFailed: "Nem sikerült elküldeni az ellenőrző e-mailt. Kérjük, próbálja újra.",
  },
  fraudAbuseAnalysis: {
    title: "Csalás- és visszaéléselemzés",
    error: "Hiba",
    success: "Siker",
    noClientSelected: "Nincs kiválasztott ügyfél",
    selectClientToView: "Kérjük, válasszon ügyfelet a csalás- és visszaéléselemzés megtekintéséhez",
    triggering: "Indítás...",
    triggerAnalysis: "Elemzés indítása",
    loadingResults: "Elemzési eredmények betöltése...",
    noResultsAvailable: "Nincs elérhető elemzési eredmény",
    triggerToGetStarted: "Indítson elemzést a kezdéshez",
    analysisWillAppearAfterCalls: "Az elemzési eredmények itt jelennek meg a hívások befejezése után.",
    insufficientDataWarning: "Korlátozott adatok állnak rendelkezésre: {{current}} hívás elemezve. Megbízhatóbb elemzéshez {{minimum}} vagy több hívás ajánlott hosszabb időszakon át az ügyfél mintáinak jobb megértéséhez.",
    loadFailed: "Nem sikerült betölteni a csalás-/visszaéléselemzés eredményeit",
    triggerFailed: "Nem sikerült elindítani a csalás-/visszaéléselemzést",
    triggerSuccess: "A csalás-/visszaéléselemzés sikeresen befejeződött.",
    disclaimer: "Ez az elemzés csak tájékoztató jellegű, és nem helyettesíti a szakmai értékelést. Ha csalást, visszaélést vagy elhanyagolást gyanít, azonnal forduljon a illetékes hatóságokhoz.",
    overview: "Áttekintés",
    conversations: "Beszélgetések",
    messages: "Üzenetek",
    riskScore: "Kockázati pontszám",
    financialRisk: "Pénzügyi kockázat",
    abuseRisk: "Visszaélési kockázat",
    relationshipRisk: "Kapcsolati kockázat",
    warnings: "Figyelmeztetések",
    recommendations: "Ajánlások",
    critical: "Kritikus",
    high: "Magas",
    medium: "Közepes",
    low: "Alacsony",
    largeAmountMentions: "Nagy összegű említések",
    transferMethodMentions: "Átutalási mód említések",
    scamIndicators: "Csalás jelei",
    physicalAbuseScore: "Fizikai visszaélés pontszám",
    emotionalAbuseScore: "Érzelmi visszaélés pontszám",
    neglectScore: "Elhanyagolás pontszám",
    newPeopleCount: "Új személyek száma",
    isolationCount: "Elszigetelés száma",
    suspiciousBehaviorCount: "Gyanús viselkedések száma",
  },
  reportsScreen: {
    selectClient: "Ügyfél kiválasztása:",
    chooseClient: "Válasszon ügyfelet...",
    sentiment: "Hangulat",
    medicalAnalysis: "Orvosi elemzés",
    fraudAbuseAnalysis: "Csalás és visszaélés",
    comingSoon: "Hamarosan",
    modalTitle: "Ügyfél kiválasztása",
    modalCancel: "Mégse",
  },
  schedulesScreen: {
    scheduleDetails: "Ütemezés részletei",
    selectSchedule: "Válasszon ütemezést:",
    scheduleNumber: "Ütemezés",
    noSchedulesAvailable: "Nincs elérhető ütemezés. Kérjük, hozzon létre egy újat.",
    errorLoadingSchedules: "Hiba az ütemezések betöltésekor.",
    newSchedule: "Új ütemezés",
    invalidScheduleError:
      "Kérjük, töltse ki az összes kötelező ütemezési mezőt (gyakoriság, idő, és napok heti/havi ütemezésnél).",
    errorSavingSchedule: "Hiba az ütemezés mentésekor.",
  },
  scheduleScreen: {
    heading: "Ütemezés beállítása",
    saveSchedule: "Ütemezés mentése",
    deleteSchedule: "Ütemezés törlése",
  },
  scheduleComponent: {
    schedule: "Ütemezés",
    startTime: "Kezdési idő",
    frequency: "Gyakoriság",
    daily: "Naponta",
    weekly: "Hetente",
    monthly: "Havonta",
    sunday: "Vasárnap",
    monday: "Hétfő",
    tuesday: "Kedd",
    wednesday: "Szerda",
    thursday: "Csütörtök",
    friday: "Péntek",
    saturday: "Szombat",
    scheduleDetails: "Ütemezés részletei",
    active: "Aktív",
    everyDayAt: "Minden nap {{time}}-kor",
    everyDaysAt: "Minden {{days}} {{time}}-kor",
    everyWeekAt: "Minden héten {{time}}-kor",
    everyMonthOn: "Minden hónapban a {{day}}. napon {{time}}-kor",
  },
  sentimentAnalysis: {
    lastCall: "Utolsó hívás",
    last30Days: "Utolsó 30 nap",
    allTime: "Teljes időszak",
    noClientSelected: "Nincs kiválasztott ügyfél",
    selectClientToView: "Kérjük, válasszon ügyfelet a Kezdőlapról a hangulatelemzés megtekintéséhez.",
    sessionRequiredTitle: "Bejelentkezés szükséges",
    sessionRequiredMessage:
      "Lehet, hogy lejárt a munkamenete. Jelentkezzen be újra a hangulatelemzés megtekintéséhez. Ha a bejelentkezési ablak már nyitva van, fejezze be ott a bejelentkezést.",
    signInToContinueButton: "Bejelentkezés",
    accessDeniedTitle: "A jelentés nem tölthető be",
    accessDeniedMessage:
      "Lehet, hogy nincs hozzáférése ennek az ügyfélnek a hangulatadataihoz, vagy megváltoztak a jogosultságai. Válassza ki újra az ügyfelet a Kezdőlapról, vagy forduljon egy adminisztrátorhoz.",
    clientSentimentAnalysis: "Ügyfél hangulatelemzés",
    emotionalWellnessInsights: "Érzelmi jólét és trendek betekintései",
    timeRange: "Időtartam:",
    noSentimentDataAvailable: "Nincs elérhető hangulatadat",
    noSentimentDataMessage: "A hangulatelemzés itt jelenik meg, amint az ügyfél befejezett beszélgetéseket folytatott.",
    loadingSentimentAnalysis: "Hangulatelemzés betöltése...",
    sentimentAnalysisFooter: "A hangulatelemzés minden beszélgetés után automatikusan generálódik mesterséges intelligencia technológiával.",
    sentimentOverview: "Hangulat áttekintése",
    averageSentiment: "Átlagos hangulat",
    trend: "Trend",
    recentDistribution: "Legutóbbi eloszlás",
    keyInsights: "Főbb megállapítások",
    totalConversations: "Összes beszélgetés",
    analysisCoverage: "Elemzési lefedettség",
    recentConversations: "Legutóbbi beszélgetések",
    analyzed: "elemezve",
    latestAnalysis: "Legutóbbi elemzés",
    conversationsAnalyzed: "Elemzett beszélgetések",
    recentConversationsTitle: "Legutóbbi beszélgetések",
    conversationsWithSentiment: "Beszélgetés{0} hangulattal",
    keyEmotions: "Főbb érzelmek",
    moreEmotions: "további érzelem",
    clientMood: "Ügyfél hangulata",
    concern: "Aggodalom",
    confidence: "Megbízhatóság",
    noSentimentAnalysisAvailable: "Nincs elérhető hangulatelemzés",
    sentimentTrend: "Hangulattrend",
    conversationsAnalyzedNoTrend: "Beszélgetés{0} elemezve{0} egyértelmű trend nélkül",
    noSentimentData: "Nincs hangulatadat",
    avg: "Átlag",
    negative: "Negatív",
    positive: "Pozitív",
    lastCallAnalysis: "Utolsó hívás elemzése",
    noRecentCall: "Nincs legutóbbi hívás",
    noRecentCallMessage: "Nincs elemzendő legutóbbi hívás. A hívások itt jelennek meg, amint befejeződnek.",
    duration: "Időtartam",
    analysisDate: "Elemzés dátuma",
    overallSentiment: "Összesített hangulat",
    scoreRange: "Ponttartomány",
    analysisConfidence: "Elemzés megbízhatósága",
    keyEmotionsDetected: "Észlelt főbb érzelmek",
    clientMoodAssessment: "Ügyfél hangulatértékelése",
    concernLevel: "Aggodalom szintje",
    satisfactionIndicators: "Elégedettségi mutatók",
    positiveIndicators: "Pozitív mutatók",
    areasOfConcern: "Aggodalomra adó okok",
    aiSummary: "MI összefoglaló",
    recommendations: "Ajánlások",
    lowConcernDescription: "Alacsony aggodalom szint — az ügyfél jól tűnik.",
    mediumConcernDescription: "Közepes aggodalom szint — utánkövetés ajánlott.",
    highConcernDescription: "Magas aggodalom szint — azonnali figyelem szükséges.",
    debugComplete: "Hibakeresés befejezve",
    debugFailed: "Hibakeresés sikertelen",
    noClient: "Nincs ügyfél",
    pleaseSelectClient: "Kérjük, először válasszon ügyfelet",
    conversationDebugComplete: "Beszélgetés hibakeresés befejezve",
    sentimentAnalysisDebug: "Hangulatelemzés hibakeresés",
    debugSubtitle: "Hibakereső eszközök a hangulatelemzéshez",
    debugging: "Hibakeresés...",
    debugSentimentAnalysis: "Hangulatelemzés hibakeresése",
    loading: "Betöltés...",
    debugConversationData: "Beszélgetési adatok hibakeresése",
    testing: "Tesztelés...",
    testDirectApiCall: "Közvetlen API-hívás tesztelése",
    forceRefreshCache: "Gyorsítótár kényszerített frissítése",
    cacheRefreshed: "Gyorsítótár frissítve",
    cacheRefreshedMessage: "A gyorsítótár sikeresen frissült",
    currentClient: "Aktuális ügyfél",
    debugResults: "Hibakeresési eredmények",
    withoutSentiment: "Hangulat nélkül",
    successfullyAnalyzed: "Sikeresen elemezve",
    failedAnalyses: "Sikertelen elemzések",
    conversationDetails: "Beszélgetés részletei",
    messages: "Üzenetek",
    sentiment: "Hangulat",
    score: "Pontszám",
    mood: "Hangulat",
    emotions: "Érzelmek",
    failed: "Sikertelen",
    noAnalysisPerformed: "Nem történt elemzés",
    noRecentConversations: "Nincs legutóbbi beszélgetés hangulatelemzéssel",
    insufficientDataForTrend: "Nincs elég adat a trendelemzéshez",
    needMoreConversations: "Több beszélgetés kell megbízható trendhez",
    lowConfidence: "Alacsony bizalom",
    noRecentCallButHaveCalls: "Legutóbbi hívások, még nincs hangulatelemzés",
    noRecentCallButHaveCallsMessage:
      "Vannak hívásai az elmúlt 30 napban, de egyikhez sincs még hangulatelemzés. Az új hívások automatikusan elemzésre kerülnek befejezés után. A régebbiek újrafeldolgozást igényelhetnek.",
    conversationId: "Beszélgetés azonosító",
    directApiTest: "Közvetlen API-teszt",
  },
  medicalAnalysis: {
    title: "Orvosi elemzés",
    error: "Hiba",
    success: "Siker",
    noClientSelected: "Nincs kiválasztott ügyfél",
    selectClientToView: "Kérjük, válasszon ügyfelet az orvosi elemzés megtekintéséhez",
    triggering: "Indítás...",
    triggerAnalysis: "Elemzés indítása",
    loadingResults: "Elemzési eredmények betöltése...",
    noResultsAvailable: "Nincs elérhető elemzési eredmény",
    triggerToGetStarted: "Indítson elemzést a kezdéshez",
    cognitiveHealth: "Kognitív egészség",
    mentalHealth: "Mentálhigiéné",
    language: "Nyelv",
    risk: "Kockázat",
    high: "Magas",
    medium: "Közepes",
    low: "Alacsony",
    good: "Jó",
    fair: "Közepes",
    poor: "Gyenge",
    warningsInsights: "Figyelmeztetések és megállapítások",
    analysisDetails: "Elemzés részletei",
    conversations: "Beszélgetések",
    messages: "Üzenetek",
    totalWords: "Összes szó",
    trigger: "Indítás",
    trendsOverTime: "Trendek időben",
    overallHealth: "Általános egészség",
    analyses: "Elemzések",
    trendAnalysisComingSoon: "Trendelemzés hamarosan",
    analysisResultsAvailable: "Elemzési eredmények elérhetők",
    basedOn: "Alapja",
    analysisResultsOver: "Elemzési eredmények",
    loadFailed: "Nem sikerült betölteni az orvosi elemzés eredményeit",
    triggerFailed: "Nem sikerült elindítani az orvosi elemzést",
    triggerSuccess: "Az orvosi elemzés sikeresen elindítva. Az eredmények körülbelül 10 másodperc múlva megjelennek.",
    disclaimer: "Ez az elemzés csak tájékoztató jellegű, és nem helyettesíti a szakorvosi tanácsadást, diagnózist vagy kezelést. Orvosi kérdésekben mindig forduljon képzett egészségügyi szakemberekhez.",
    overview: "Áttekintés",
    confidence: "Megbízhatóság",
    noDataAvailable: "Nincs elérhető adat az elemzéshez",
    insufficientDataWarning: "Korlátozott adatok állnak rendelkezésre: {{current}} hívás elemezve. Megbízhatóbb elemzéshez {{minimum}} vagy több hívás ajánlott hosszabb időszakon át az ügyfél mintáinak jobb megértéséhez.",
    analysisWillAppearAfterCalls: "Az elemzési eredmények itt jelennek meg a hívások befejezése után.",
    keyIndicators: "Főbb mutatók",
    fillerWords: "Töltőszavak",
    vagueReferences: "Homályos utalások",
    temporalConfusion: "Időbeli zavarodottság",
    wordFinding: "Szókeresési nehézségek",
    repetition: "Ismétlés pontszám",
    informationDensity: "Információsűrűség",
    depressionScore: "Depresszió pontszám",
    anxietyScore: "Szorongás pontszám",
    emotionalTone: "Érzelmi tónus",
    negativeRatio: "Negatív arány",
    protectiveFactors: "Védő tényezők",
    typeTokenRatio: "Szókincs diverzitás",
    avgWordLength: "Átlagos szóhossz",
    avgSentenceLength: "Átlagos mondathossz",
    uniqueWords: "Egyedi szavak",
    crisisIndicators: "Válság jelei észlelve — azonnali szakmai értékelés ajánlott",
    cognitiveInterpretation: {
      normal: "A kommunikációs minták normálisnak tűnnek, jelentős kognitív aggodalom nélkül.",
      mildConcern: "Enyhe változások észlelhetők a kommunikációs mintákban. Figyelje a progressziót.",
      moderateConcern: "Mérsékelt változások figyelhetők meg a kommunikációs mintákban. Fontolja meg a szakmai értékelést.",
      significantConcern: "Jelentős változások észlelhetők a kommunikációs mintákban. Szakmai értékelés erősen ajánlott.",
    },
    psychiatricInterpretation: {
      stable: "A mentálhigiénés mutatók stabilnak tűnnek, jelentős aggodalom nélkül.",
      mildConcern: "Enyhe mentálhigiénés mutatók észlelhetők. Folytassa a megfigyelést.",
      moderateConcern: "Mérsékelt mentálhigiénés mutatók figyelhetők meg. Fontolja meg a szakmai tanácsadást.",
      significantConcern: "Jelentős mentálhigiénés mutatók észlelhetők. Szakmai tanácsadás ajánlott.",
      crisis: "Válság jelei észlelve. Azonnali szakmai beavatkozás erősen ajánlott.",
    },
    vocabularyInterpretation: {
      strong: "A nyelvi összetettség és szókincs használat erősnek és jól megőrzöttnek tűnik.",
      average: "A nyelvi összetettség és szókincs használat a normál tartományban van.",
      limited: "A nyelvi összetettség és szókincs használat korlátozottnak tűnik. Figyelje a változásokat.",
    },
  },
  caregiverInvitedScreen: {
    title: "Meghívó elküldve!",
    message: "Meghívót küldtünk ide: {{name}} ({{email}}).",
    subMessage: "E-mailben kapják az regisztráció befejezéséhez szükséges útmutatást.",
    continue: "Folytatás",
  },
  confirmResetScreen: {
    title: "Jelszó-visszaállítás megerősítése",
    subtitle: "Adja meg az új jelszavát alább. Legyen biztonságos, és könnyen megjegyezhető.",
    newPasswordLabel: "Új jelszó",
    newPasswordPlaceholder: "Adja meg az új jelszavát",
    confirmPasswordLabel: "Új jelszó megerősítése",
    confirmPasswordPlaceholder: "Erősítse meg az új jelszavát",
    successTitle: "A jelszó sikeresen visszaállítva!",
    successMessageShort: "A jelszó sikeresen visszaállítva!",
    successMessage:
      "A jelszava frissítve lett. Most már bejelentkezhet az új jelszavával.",
    redirecting: "Átirányítás a bejelentkezéshez...",
    resetPasswordButton: "Jelszó visszaállítása",
    backToLogin: "Vissza a bejelentkezéshez",
    codeFieldLabel: "Visszaállító kód",
    codeFieldPlaceholder: "Adja meg a visszaállító kódot",
    newPasswordFieldLabel: "Új jelszó",
    newPasswordFieldPlaceholder: "Adja meg az új jelszavát",
    confirmPasswordFieldLabel: "Új jelszó megerősítése",
    confirmPasswordFieldPlaceholder: "Erősítse meg az új jelszavát",
    confirmReset: "Visszaállítás megerősítése",
    successMessage: "A jelszó sikeresen visszaállítva!",
    requestFailed: "A visszaállítás sikertelen. Ellenőrizze a kódot, és próbálja újra.",
  },
  themes: {
    healthcare: {
      name: "Egészségügy",
      description: "Professzionális orvosi téma kék és zöld színekkel",
    },
    colorblind: {
      name: "Színvak-barát",
      description: "Magas kontrasztú téma színlátási zavarokhoz optimalizálva",
    },
    dark: {
      name: "Sötét mód",
      description: "Sötét téma gyenge fényviszonyokhoz optimalizálva",
    },
    highcontrast: {
      name: "Magas kontraszt",
      description: "Maximális kontrasztú téma látáskárosodáshoz (WCAG AAA)",
    },
    accessibility: {
      wcagLevel: "WCAG szint",
      colorblindFriendly: "Színvak-barát",
      highContrast: "Magas kontraszt",
      darkMode: "Sötét mód",
    },
  },
  privacyPracticesScreen: {
    content: `# Adatvédelmi gyakorlatok tájékoztatója
## MyPhoneFriend Healthcare Communication Services

**Hatálybalépés dátuma**: 2025. október 15.

---

## AZ ÖN ADATAI. AZ ÖN JOGAI. A MI FELELŐSSÉGÜNK.

**EZ A TÁJÉKOZTATÓ LEÍRJA, HOGYAN HASZNÁLHATJUK ÉS ADHATJUK KI AZ ÖNRŐL SZÓLÓ EGÉSZSÉGÜGYI INFORMÁCIÓKAT, ÉS HOGY FÉRHET HOZZÁJUK. KÉRJÜK, OLVASSA EL FIGYELMESEN.**

---

## AZ ÖN JOGAI

Ön jogosult:
- Másolatot kérni egészségügyi adatairól
- Helyesbíteni egészségügyi adatait
- Bizalmas kommunikációt kérni
- Kérni, hogy korlátozzuk a megosztott információkat
- Listát kérni arról, kivel osztottuk meg adatait
- Másolatot kérni erről az adatvédelmi tájékoztatóról
- Megbízottat választani, aki az Ön nevében jár el
- Panaszt tenni, ha úgy véli, hogy megsértették adatvédelmi jogait

---

## AZ ÖN LEHETŐSÉGEI

Bizonyos esetekben választási lehetősége van arról, hogyan használjuk és osztjuk meg az információkat, például amikor:
- Családtagok és barátok kérdéseire válaszolunk az Ön ellátásáról
- Információt adunk Önről katasztrófahelyzetekben

**Soha nem osztjuk meg adatait marketing célra vagy adatértékesítésre.**

---

# AZ ÖN RÉSZLETES JOGAI

## Egészségügyi adatok másolatának kérése

**Kérheti egészségügyi adatainak megtekintését vagy másolatát.**

Mit kérhet:
- Hívásfelvételek és átiratok
- Egészségügyi összefoglalók és MI-elemzési eredmények
- Rendszerünk által generált orvosi figyelmeztetések
- Vészhelyzeti értesítések
- Fiókadatok és beállítások

**Hogyan kérheti**:
- E-mail: privacy@biancawellness.com
- Telefon: +1-604-562-4263

**Válaszidőnk**: 30 napon belül

---

## Egészségügyi adatok helyesbítésének kérése

**Kérheti egészségügyi adatainak helyesbítését, ha azokat hibásnak vagy hiányosnak tartja.**

**Válaszidőnk**: 60 napon belül

---

## Bizalmas kommunikáció kérése

**Kérheti, hogy meghatározott módon vagy helyen keressük Önt.**

Példák:
- „Kérjük, e-mailt küldjenek hívás helyett”
- „Kérjük, csak a mobiltelefonomon keressenek”

Minden ésszerű kérést teljesítünk.

---

## Kérés az információk használatának vagy megosztásának korlátozására

**Kérheti, hogy bizonyos egészségügyi információkat ne használjunk fel vagy osszunk meg.**

Egyet kell értenünk, ha teljes egészében saját költségén fizetett, és kéri, hogy ne osszuk meg az egészségbiztosítójával.

---

## Közlések listájának kérése

**Kérhet „közlések nyilvántartását”** — az egészségügyi adatai megosztásának időpontjainak listáját.

Lefedi: az elmúlt 6 évet  
Kihagyja: ellátás, fizetés és működés céljából történő közléseket (kivéve, ha külön kéri)

---

## Panasz benyújtása

**Nálunk**:
- E-mail: privacy@biancawellness.com
- Telefon: +1-604-562-4263

**A HHS-nél**:
- Weboldal: https://www.hhs.gov/hipaa/filing-a-complaint
- Telefon: 1-800-368-1019

**Nem büntetjük meg panasz benyújtásáért.**

---

# HASZNÁLATUNK ÉS KÖZLÉSEINK

## Hogyan használjuk egészségügyi adatait

**Ellátás céljából**:
- MI-alapú egészségügyi összefoglalók biztosítása gondozóinak
- Vészhelyzeti figyelmeztetések generálása sürgős helyzetekben
- Lehetővé teszi gondozóknak jólétének nyomon követését
- Kommunikáció megkönnyítése az ellátó csapatával

**Fizetés céljából**:
- Egészségügyi szervezetének számlázása a szolgáltatásokért
- Hívásidő és elemzés számláinak feldolgozása

**Egészségügyi működés céljából**:
- MI-felismerő algoritmusaink fejlesztése
- Minőségbiztosítás és -fejlesztés
- Rendszereink képzése az ügyfelek jobb kiszolgálásához

---

## Kivel osztjuk meg

**Az Ön egészségügyi szervezete**:
- Kijelölt gondozói és ellátáskoordinátorai
- Szervezeti adminisztrátorok számlázási célokra

**Üzleti partnerek** (szolgáltatók):
- MI-szolgáltatások (Azure OpenAI): átiratokhoz és elemzéshez
- Hangszolgáltatások (Twilio): telefonhívások kezeléséhez
- Felhőtárhely (AWS): biztonságos adattároláshoz
- Adatbázis (MongoDB Atlas): adatkezeléshez

Minden üzleti partner aláír üzleti partneri megállapodást, és köteles védeni az Ön adatait.

**Törvényi előírás szerint**:
- Vészhelyzeti szolgálatok (911), ha vészhelyzetet észlelünk
- Egészségügyi hatóságok (visszaélés-, elhanyagolás-bejelentés)
- Bűnüldöző szervek (érvényes bírósági végzéssel)

**NEM tesszük**:
- ❌ Eladjuk egészségügyi adatait
- ❌ Megosztjuk marketingesekkel vagy hirdetőkkel
- ❌ Használjuk fel marketing célra az Ön engedélye nélkül
- ❌ Osztjuk meg közösségi médiában

---

# GYŰJTÖTT EGÉSZSÉGÜGYI INFORMÁCIÓK

**Szolgáltatásaink használata során**:
- Ügyfél neve, telefonszáma, születési dátuma
- Hívásfelvételek és átiratok
- Hívásokból származó egészségügyi információk (tünetek, gyógyszerek, hangulat)
- Vészhelyzeti figyelmeztetések és incidensek
- Egészségügyi trendek és minták
- Gondozói jegyzetek és megfigyelések
- MI orvosi elemzési eredmények

---

# AZ ÖN FELELŐSSÉGEI

**Ha szolgáltatásunkat más személy hívására használja**, Ön felelős:
- A felvételhez szükséges hozzájárulások beszerzéséért
- Annak biztosításáért, hogy megértse a szolgáltatást
- Az alkalmazandó felvételi hozzájárulási törvények betartásáért

---

# ADATSÉRTÉSI ÉRTESÍTÉS

**Ha egészségügyi adataihoz jogosulatlanul férnek hozzá, vagy azokat kiszivárogtatják**, mi:
- Kivizsgáljuk az incidenset
- 60 napon belül értesítjük Önt, ha bejelentési kötelezettség alá esik
- Elmagyarázzuk, mi történt és mit teszünk
- Tájékoztatjuk a teendőkről

---

# A TÁJÉKOZTATÓ MÓDOSÍTÁSAI

- Módosíthatjuk ezt a tájékoztatót, és a változások minden birtokolt adatra vonatkoznak
- Az új tájékoztató elérhető lesz az alkalmazásban és weboldalunkon
- Bármikor kérhet aktuális másolatot

---

# ELÉRHETŐSÉGEK

**Adatvédelmi tisztviselő**:
- E-mail: privacy@biancawellness.com
- Telefon: +1-604-562-4263
- Posta: MyPhoneFriend Privacy Office, 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

**Nyitvatartás**: hétfő–péntek, 9–17 óra (PST)

---

# PANASZ BENYÚJTÁSA

**Nálunk**:
- E-mail: privacy@biancawellness.com
- Telefon: +1-604-562-4263

**A szövetségi kormánynál (HHS)**:
- Weboldal: https://www.hhs.gov/hipaa/filing-a-complaint
- Telefon: 1-800-368-1019
- Posta: Office for Civil Rights, U.S. Department of Health and Human Services, 200 Independence Avenue S.W., Washington, D.C. 20201

---

**Hatálybalépés dátuma**: 2025. október 15.  
**Verzió**: 1.0

Ez az adatvédelmi gyakorlatok tájékoztatója megfelel a HIPAA adatvédelmi szabályának (45 CFR §164.520)

---

## Nyelvi támogatás

**English**: If you need help understanding this notice, contact privacy@biancawellness.com

**Español**: Si necesita ayuda, comuníquese con privacy@biancawellness.com`,
  },
  privacyRequestScreen: {
    title: "Adataim kérése",
    subtitle:
      "A PIPEDA szerint joga van hozzáférni és helyesbíteni személyes adatait. Küldjön kérést hozzáférésre vagy helyesbítésre.",
    requestDataTitle: "Adathozzáférési kérelem",
    requestDataDescription:
      "Írja le, milyen adatokhoz szeretne hozzáférni. Hagyja üresen az összes személyes adat kéréséhez.",
    correctionRequestTitle: "Adathelyesbítési kérelem",
    correctionRequestDescription: "Kérjen helyesbítést személyes adataiban. Adja meg, mit kell javítani.",
    correctionNote:
      "Megjegyzés: A legtöbb adat közvetlenül szerkeszthető az alkalmazásban. Ezt az űrlapot olyan adatokhoz használja, amelyek nem szerkeszthetők (pl. naplók, rendszer által generált rekordok).",
    informationRequestedLabel: "Kért információ",
    informationRequestedPlaceholder: "Minden személyes adatom (vagy pontosítsa, mire van szüksége)",
    additionalInformationLabel: "További információ (opcionális)",
    accessMethodLabel: "Hogyan szeretné megkapni az adatait?",
    accessMethodEmail: "E-mail",
    accessMethodDownload: "Letöltés",
    accessMethodInfo: "Az adatait JSON mellékletként e-mailben küldjük.",
    submitRequest: "Kérelem beküldése",
    requestSubmitted: "Az adatkérése be lett küldve. Hamarosan e-mailben megkapja az adatait.",
    correctionRequestSubmitted: "A helyesbítési kérelem be lett küldve. 30 napon belül feldolgozzuk.",
    requestFailed: "Nem sikerült beküldeni a kérelmet. Kérjük, próbálja újra.",
    correctionFieldsRequired: "Kérjük, töltse ki a mező nevét és a kért értéket.",
    requestHistoryTitle: "Kérelem előzmények",
    requestTypeAccess: "Hozzáférési kérelem",
    requestTypeCorrection: "Helyesbítési kérelem",
    requestedOn: "Kérve",
    completedOn: "Befejezve",
    correctionFieldLabel: "Helyesbítendő mező",
    correctionFieldPlaceholder: "pl. E-mail-cím, telefonszám, név",
    currentValueLabel: "Jelenlegi érték (opcionális)",
    currentValuePlaceholder: "Mi a jelenlegi érték?",
    requestedValueLabel: "Kért érték *",
    requestedValuePlaceholder: "Mi legyen a helyes érték?",
    correctionReasonLabel: "Helyesbítés oka (opcionális)",
    correctionReasonPlaceholder: "Miért kell helyesbíteni ezt az információt?",
    field: "Mező",
    currentValue: "Jelenlegi érték",
    requestedValue: "Kért érték",
    reason: "Ok",
    requestTypeComplaint: "Panasz benyújtása",
    complaintRequestTitle: "Adatvédelmi panasz",
    complaintRequestDescription:
      "Ha úgy gondolja, hogy személyes adatait nem az adatvédelmi törvényeknek megfelelően kezeltük, panaszt nyújthat be. 30 napon belül kivizsgáljuk és válaszolunk.",
    complaintSubjectLabel: "Tárgy *",
    complaintSubjectPlaceholder: "A panasz rövid leírása",
    complaintDescriptionLabel: "Leírás *",
    complaintDescriptionPlaceholder: "Adja meg a panasz részleteit, beleértve mi történt és mikor.",
    violationTypeLabel: "Probléma típusa (opcionális)",
    violationTypeOther: "Egyéb",
    violationTypeAccess: "Hozzáférési probléma",
    complaintFieldsRequired: "Kérjük, töltse ki a tárgyat és a leírást.",
    complaintSubmitted: "A panasz be lett küldve. 30 napon belül kivizsgáljuk és válaszolunk.",
    complaintHistoryTitle: "Panasz előzmények",
    filedOn: "Benyújtva",
    resolvedOn: "Megoldva",
    deletionRequestTitle: "Adattörlés kérése",
    deletionRequestDescription:
      "A PIPEDA szerint kérheti személyes adatai törlését. Megjegyzés: A HIPAA 7 éves megőrzést ír elő, ezért nem minden joghatóságban érhető el a törlés.",
    deletionDataTypeLabel: "Milyen adatokat szeretne törölni?",
    deletionTypeAll: "Minden adat",
    deletionTypeCalls: "Csak hívások",
    deletionTypeConversations: "Csak beszélgetések",
    deletionTypeMedicalAnalysis: "Csak orvosi elemzés",
    requestDeletion: "Adattörlés kérése",
    deletionConfirmTitle: "Adattörlés megerősítése",
    deletionConfirmMessage:
      "Ez véglegesen törli az adatait. A művelet nem vonható vissza. Biztosan folytatja?",
    confirmDelete: "Törlés",
    deletionCompleted: "Az adattörlés sikeresen befejeződött.",
    deletionFailed:
      "Nem sikerült törölni az adatokat. Lehet, hogy joghatósága miatt nem érhető el jogi megőrzési követelmények miatt.",
  },
  mfa: {
    setupTitle: "Többfaktoros hitelesítés",
    setupSubtitle: "Adjon hozzá extra biztonsági réteget fiókjához",
    setupInstructions: "Olvassa be a QR-kódot hitelesítő alkalmazásával, majd adja meg az ellenőrző kódot.",
    verificationTitle: "Kétfaktoros hitelesítés",
    verificationSubtitle: "Adja meg a 6 számjegyű kódot a hitelesítő alkalmazásából",
    tokenLabel: "Ellenőrző kód",
    tokenPlaceholder: "000000",
    pleaseEnterVerificationCode: "Kérjük, adja meg az ellenőrző kódot a hitelesítő alkalmazásából",
    verifyButton: "Ellenőrzés",
    useBackupCode: "Tartalék kód használata",
    verifyAndEnable: "Ellenőrzés és engedélyezés",
    enable: "MFA engedélyezése",
    enableMFA: "Többfaktoros hitelesítés engedélyezése",
    manageMFA: "Többfaktoros hitelesítés kezelése",
    disable: "MFA letiltása",
    disableTitle: "MFA letiltása",
    disableSubtitle: "Adja meg aktuális MFA-kódját a többfaktoros hitelesítés letiltásához",
    disableConfirmTitle: "MFA letiltása?",
    disableConfirmMessage: "Biztosan le szeretné tiltani a többfaktoros hitelesítést? Ez csökkenti fiókja biztonságát.",
    enabled: "Engedélyezve",
    disabled: "Letiltva",
    enabledSuccess: "A többfaktoros hitelesítés sikeresen engedélyezve.",
    disabledSuccess: "A többfaktoros hitelesítés letiltva.",
    status: "Állapot",
    enrolledOn: "Regisztrálva",
    backupCodesRemaining: "Fennmaradó tartalék kódok",
    backupCodesTitle: "Tartalék kódok",
    backupCodesWarning: "Mentse el ezeket a kódokat biztonságos helyre. Ha elveszíti hitelesítő eszközét, ezekkel férhet hozzá fiókjához.",
    backupCodeLength: "A tartalék kódok 8 karakter hosszúak",
    regenerateBackupCodes: "Tartalék kódok újragenerálása",
    regenerateBackupCodesTitle: "Tartalék kódok újragenerálása?",
    regenerateBackupCodesSubtitle: "Adja meg aktuális MFA-kódját új tartalék kódok generálásához",
    regenerateBackupCodesMessage: "A régi tartalék kódok már nem működnek. Győződjön meg róla, hogy biztonságosan elmenti az új kódokat.",
    regenerate: "Újragenerálás",
    backupCodesRegenerated: "Tartalék kódok újragenerálva",
    backupCodesRegeneratedMessage: "Az új tartalék kódok elkészültek. Kérjük, mentse el őket biztonságosan.",
    secretLabel: "Vagy adja meg kézzel ezt a titkot:",
    invalidTokenLength: "Kérjük, adjon meg 6 számjegyű kódot",
    verificationFailed: "Érvénytelen kód. Kérjük, próbálja újra.",
    enableFailed: "Az MFA engedélyezése sikertelen",
    disableFailed: "Az MFA letiltása sikertelen. Kérjük, ellenőrizze a kódját.",
    regenerateFailed: "Nem sikerült újragenerálni a tartalék kódokat.",
  },
}

export default hu
