import { NavigationContainerProps } from "@react-navigation/native"

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

export type DrawerParamList = {
  Home: undefined
  Profile: undefined
  Alert: undefined
  Org: undefined
  Reports: undefined
  Logout: undefined
}

export type HomeStackParamList = {
  HomeDetail: undefined
  Client: undefined
  Schedule: { isNewClient?: boolean } | undefined
  Conversations: undefined
  Call: undefined
  SentimentAnalysis: {
    clientId?: string
    clientName?: string
  } | undefined
  MedicalAnalysis: {
    clientId?: string
    clientName?: string
  } | undefined
  FraudAbuseAnalysis: {
    clientId?: string
    clientName?: string
  } | undefined
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

export type AlertStackParamList = {
  Alert: undefined
}

export type OrgStackParamList = {
  Organization: undefined
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
  MFAVerification: { email: string; password: string; tempToken: string }
  ClientConsent: { token?: string } | undefined
}

export type OnboardingStackParamList = {
  OnboardingAboutYou: undefined
  OnboardingHowBiancaWorks: { persona: import("../services/api/api.types").OnboardingPersona }
  OnboardingOrgInfo: { persona: import("../services/api/api.types").OnboardingPersona }
  OnboardingRegistration: { persona: import("../services/api/api.types").OnboardingPersona }
  OnboardingTermsAndConsent: { persona?: import("../services/api/api.types").OnboardingPersona }
  Terms: undefined
  Privacy: undefined
}

export interface NavigationProps extends Partial<NavigationContainerProps> {
  linking?: any
  initialState?: any
  onStateChange?: any
}
