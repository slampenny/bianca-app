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
  Patient: undefined
  Schedule: { isNewPatient?: boolean } | undefined
  Conversations: undefined
  Call: undefined
  SentimentAnalysis: {
    patientId?: string
    patientName?: string
  } | undefined
  MedicalAnalysis: {
    patientId?: string
    patientName?: string
  } | undefined
  Privacy: undefined
  PrivacyPractices: undefined
  Terms: undefined
}

export type ProfileStackParamList = {
  Profile: undefined
  Privacy: undefined
  PrivacyPractices: undefined
  Terms: undefined
  MFASetup: undefined
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
  Register: undefined
  RequestReset: undefined
  ConfirmReset: { token?: string }
  Privacy: undefined
  PrivacyPractices: undefined
  Terms: undefined
  EmailVerified: undefined
  EmailVerificationRequired: { email?: string } | undefined
  VerifyEmail: { token?: string; query?: { token?: string } } | undefined
  SSOAccountLinking: { email: string; ssoProvider?: string } | undefined
  Signup: { token?: string }
  MFAVerification: { email: string; password: string; tempToken: string }
}

export interface NavigationProps extends Partial<NavigationContainerProps> {
  linking?: any
  initialState?: any
  onStateChange?: any
}
