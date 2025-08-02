import { NavigationContainerProps } from "@react-navigation/native"

export type AppStackParamList = {
  Login: undefined
  MainTabs: undefined
  Profile: undefined
  Privacy: undefined
  Terms: undefined
}

export type DrawerParamList = {
  Home: undefined
  Profile: undefined
  Alert: undefined
  Org: undefined
  Payment: undefined
  Logout: undefined
}

export type HomeStackParamList = {
  Home: undefined
  Patient: undefined
  Schedule: undefined
  Conversations: undefined
  Privacy: undefined
  Terms: undefined
}

export type ProfileStackParamList = {
  Profile: undefined
  Privacy: undefined
  Terms: undefined
}

export type AlertStackParamList = {
  Alert: undefined
}

export type OrgStackParamList = {
  Org: undefined
  Caregivers: undefined
  Caregiver: undefined
  CaregiverInvited: {
    caregiver: {
      id: string
      name: string
      email: string
    }
  }
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
  ConfirmReset: undefined
  Privacy: undefined
  Terms: undefined
}

export interface NavigationProps extends Partial<NavigationContainerProps> {
  linking?: any
  initialState?: any
  onStateChange?: any
}
