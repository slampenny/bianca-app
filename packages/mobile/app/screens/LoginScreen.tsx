import React, { FC } from "react"
import { StackScreenProps } from "@react-navigation/stack"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { AuthScreenLayout } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { LoginForm } from "../components/LoginForm"

type LoginScreenProps = StackScreenProps<LoginStackParamList, "Login">

export const LoginScreen: FC<LoginScreenProps> = ({ navigation }) => {
  const { isLoading: themeLoading } = useTheme()

  const handleRegisterPress = () => {
    navigation.navigate("OnboardingAboutYou")
  }

  const handleForgotPasswordPress = () => {
    navigation.navigate("RequestReset")
  }

  const handleSSOAccountLinking = (email: string, provider: string) => {
    ;(navigation.navigate as (name: string, params?: object) => void)("SSOAccountLinking", {
      email,
      ssoProvider: provider || "google",
    })
  }

  const handleEmailVerificationRequired = (email: string) => {
    ;(navigation.navigate as (name: string, params?: object) => void)("EmailVerificationRequired", { email })
  }

  const handleMFARequired = (email: string, password: string, tempToken: string) => {
    ;(navigation.navigate as (name: string, params?: object) => void)("MFAVerification", {
      email,
      password,
      tempToken,
    })
  }

  if (themeLoading) {
    return (
      <AuthScreenLayout testID="login-form" accessibilityLabel="login-screen">
        <LoginForm showRegisterButton={false} showForgotPasswordButton={false} showSSOButtons={false} compact />
      </AuthScreenLayout>
    )
  }

  return (
    <AuthScreenLayout testID="login-form" accessibilityLabel="login-screen" compactCard>
      <LoginForm
        onRegisterPress={handleRegisterPress}
        onForgotPasswordPress={handleForgotPasswordPress}
        onSSOAccountLinking={handleSSOAccountLinking}
        onEmailVerificationRequired={handleEmailVerificationRequired}
        onMFARequired={handleMFARequired}
        showRegisterButton={true}
        showForgotPasswordButton={true}
        showSSOButtons={false}
        compact={false}
      />
    </AuthScreenLayout>
  )
}
