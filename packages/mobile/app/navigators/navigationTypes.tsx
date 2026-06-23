import type { NavigationContainerProps, NavigatorScreenParams } from "@react-navigation/native"

export type AppStackParamList = {
  Login: undefined
  MainTabs: undefined
  Profile: undefined
  Privacy: undefined
  PrivacyPractices: undefined
  Terms: undefined
  EmailVerified: undefined
  EmailVerificationRequired: { email?: string } | undefined
  VerifyPhone: undefined
  ClientConsent: { token?: string } | undefined
}

export type AlertStackParamList = {
  AlertList: { filterClientId?: string; filterClientName?: string } | undefined
}

/** Params for medical / fraud report screens (Home stack and Reports stack). */
export type ClientReportParams = {
  clientId?: string
  clientName?: string
}

/** Sentiment screen: same on Home stack (`SentimentAnalysis`) and Reports stack (`SentimentReport`). */
export type SentimentAnalysisScreenParams = ClientReportParams & {
  /** When set (e.g. from home glance), selects Last call / 30 days / All time. */
  timeRange?: "lastCall" | "month" | "lifetime"
}

export type ReportsStackParamList = {
  ReportsList: undefined
  SentimentReport: SentimentAnalysisScreenParams | undefined
  MedicalAnalysis: ClientReportParams | undefined
  FraudAbuseAnalysis: ClientReportParams | undefined
  HealthReport: undefined
  FamilyWeeklyDigests: { clientId?: string; clientName?: string } | undefined
  FamilyWeeklyDigestDetail: { digestId: string; clientId: string }
}

export type DrawerParamList = {
  Home: undefined
  Profile: undefined
  Alert: NavigatorScreenParams<AlertStackParamList>
  Settings: undefined
  Insights: NavigatorScreenParams<ReportsStackParamList>
  Logout: undefined
}

export type SettingsStackParamList = {
  SettingsHome: undefined
  Profile: undefined
  Privacy: undefined
  Terms: undefined
  PrivacyRequest: undefined
  Logout: undefined
  MFASetup: undefined
}

export type HomeStackParamList = {
  HomeDetail: undefined
  Client: undefined
  Schedule: { isNewClient?: boolean } | undefined
  Conversations: undefined
  Call: undefined
  ClientOnboarding: undefined
  SentimentAnalysis: SentimentAnalysisScreenParams | undefined
  MedicalAnalysis: ClientReportParams | undefined
  FraudAbuseAnalysis: ClientReportParams | undefined
  Privacy: undefined
  PrivacyPractices: undefined
  Terms: undefined
  PrivacyRequest: undefined
}

export type ProfileStackParamList = {
  Profile: undefined
  Privacy: undefined
  PrivacyPractices: undefined
  Terms: undefined
  MFASetup: undefined
  PrivacyRequest: undefined
}

export type OrgStackParamList = {
  Organization: undefined
  VoiceOnboarding: undefined
  Caregivers: undefined
  Caregiver: undefined
  CaregiverInvited: {
    caregiver: {
      id: string
      name: string
      email: string
    }
  }
  Payment: undefined
}

export type PaymentStackParamList = {
  Payment: undefined
}

export type LogoutStackParamList = {
  Logout: undefined
}

export type LoginStackParamList = {
  Login: undefined
  Register: { persona?: import("../services/api/api.types").OnboardingPersona; orgName?: string; orgCountry?: string; orgTimezone?: string } | undefined
  OnboardingAboutYou: undefined
  OnboardingHowBiancaWorks: { persona: import("../services/api/api.types").OnboardingPersona }
  OnboardingOrgInfo: { persona: import("../services/api/api.types").OnboardingPersona }
  RequestReset: undefined
  ConfirmReset: { token?: string }
  Privacy: undefined
  PrivacyPractices: undefined
  Terms: undefined
  EmailVerified: undefined
  EmailVerificationRequired: { email?: string } | undefined
  VerifyEmail: { token?: string; query?: { token?: string } } | undefined
  VerifyPhone: undefined
  SSOAccountLinking: { email: string; ssoProvider?: string } | undefined
  Signup: { token?: string }
  FamilyInviteWelcome: undefined
  MFAVerification: { email: string; password: string; tempToken: string }
  ClientConsent: { token?: string } | undefined
}

export type OnboardingStackParamList = {
  OnboardingAboutYou: undefined
  OnboardingHowBiancaWorks: { persona: import("../services/api/api.types").OnboardingPersona }
  OnboardingOrgInfo: { persona: import("../services/api/api.types").OnboardingPersona }
  OnboardingRegistration: { persona: import("../services/api/api.types").OnboardingPersona }
  OnboardingAddLovedOne: undefined
  OnboardingSchedule: { clientId: string }
  OnboardingTermsAndConsent: { persona?: import("../services/api/api.types").OnboardingPersona }
  Terms: undefined
  Privacy: undefined
}

export interface NavigationProps extends Partial<NavigationContainerProps> {
  linking?: any
  initialState?: any
  onStateChange?: any
}
