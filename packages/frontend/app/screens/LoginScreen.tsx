import React, { FC } from "react"
import { StackNavigationProp } from "@react-navigation/stack"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { Header, Screen } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { LoginForm } from "../components/LoginForm"

type LoginScreenNavigationProp = StackNavigationProp<LoginStackParamList, "Login">

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp
}

export const LoginScreen: FC<LoginScreenProps> = ({ navigation }) => {
  const { colors, isLoading: themeLoading } = useTheme()

  const handleRegisterPress = () => {
    navigation.navigate("OnboardingAboutYou")
  }

  const handleForgotPasswordPress = () => {
    navigation.navigate("RequestReset")
  }

  // Handle SSO account linking navigation
  const handleSSOAccountLinking = (email: string, provider: string) => {
    (navigation.navigate as (name: string, params?: object) => void)("SSOAccountLinking", { email, ssoProvider: provider || 'google' })
  }

  // Handle email verification navigation
  const handleEmailVerificationRequired = (email: string) => {
    (navigation.navigate as (name: string, params?: object) => void)("EmailVerificationRequired", { email })
  }

  // Handle MFA verification navigation
  const handleMFARequired = (email: string, password: string, tempToken: string) => {
    (navigation.navigate as (name: string, params?: object) => void)("MFAVerification", { email, password, tempToken })
  }

  if (themeLoading) {
    return (
      <Screen style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} testID="login-form" accessibilityLabel="login-screen">
        <Header titleTx="loginScreen.signIn" />
      </Screen>
    )
  }

  return (
    <Screen style={{ backgroundColor: colors.palette.biancaBackground, flex: 1 }} testID="login-form" accessibilityLabel="login-screen">
      <Header titleTx="loginScreen.signIn" />
      <LoginForm
        onRegisterPress={handleRegisterPress}
        onForgotPasswordPress={handleForgotPasswordPress}
        onSSOAccountLinking={handleSSOAccountLinking}
        onEmailVerificationRequired={handleEmailVerificationRequired}
        onMFARequired={handleMFARequired}
        showRegisterButton={true}
        showForgotPasswordButton={true}
        showSSOButtons={true}
        compact={false}
      />
    </Screen>
  )
}
