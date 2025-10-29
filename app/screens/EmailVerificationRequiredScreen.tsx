import React, { useState } from "react"
import { View, ViewStyle, Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { Screen, Text, Button } from "app/components"
import { colors, spacing } from "app/theme"
import { useResendVerificationEmailMutation } from "app/services/api/authApi"

export const EmailVerificationRequiredScreen = () => {
  const navigation = useNavigation()
  const [resendVerificationEmail, { isLoading }] = useResendVerificationEmailMutation()
  const [email, setEmail] = useState("")
  const [emailSent, setEmailSent] = useState(false)
  const { colors, isLoading: themeLoading } = useTheme()

  const handleResendEmail = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address")
      return
    }

    try {
      await resendVerificationEmail({ email: email.trim() }).unwrap()
      setEmailSent(true)
      Alert.alert("Success", "Verification email sent successfully!")
    } catch (error: any) {
      console.error("Resend verification email error:", error)
      const errorMessage = error?.data?.message || error?.message || "Failed to send verification email"
      Alert.alert("Error", errorMessage)
    }
  }

  const handleBackToLogin = () => {
    navigation.navigate("Login" as never)
  }

  return (
    <Screen 
      preset="fixed" 
      style={$container}
      contentContainerStyle={$contentContainer}
    >
      <View style={$card}>
        <Text preset="heading" text="Check Your Email" style={$title} />
        
        <Text 
          preset="default"
          text="We've sent a verification link to your email address. Please click the link to verify your account before logging in."
          style={$message}
        />
        
        <View style={$emailSection}>
          <Text preset="formLabel" text="Email Address" style={$emailLabel} />
          <Text 
            preset="default"
            text={email || "Enter your email address"}
            style={$emailText}
          />
        </View>

        {emailSent && (
          <View style={$successSection}>
            <Text preset="default" text="✓ Verification email sent!" style={$successText} />
          </View>
        )}

        <View style={$buttonContainer}>
          <Button
            text="Resend Verification Email"
            onPress={handleResendEmail}
            disabled={isLoading}
            style={$resendButton}
            accessibilityLabel="resend-verification-button"
          />
          
          <Button
            text="Back to Login"
            onPress={handleBackToLogin}
            preset="default"
            style={$backButton}
            accessibilityLabel="back-to-login-button"
          />
        </View>
      </View>
    </Screen>
  )
}

const $container: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  backgroundColor: colors.background,
}

const $contentContainer: ViewStyle = {
  paddingHorizontal: spacing.lg,
}

const $card: ViewStyle = {
  backgroundColor: colors.palette.neutral100,
  borderRadius: 12,
  padding: spacing.xl,
  alignItems: "center",
  shadowColor: colors.palette.neutral900,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
}

const $title: ViewStyle = {
  marginBottom: spacing.md,
  textAlign: "center",
  color: colors.palette.neutral900,
}

const $message: ViewStyle = {
  marginBottom: spacing.lg,
  textAlign: "center",
  color: colors.palette.neutral700,
  lineHeight: 20,
}

const $emailSection: ViewStyle = {
  width: "100%",
  marginBottom: spacing.lg,
}

const $emailLabel: ViewStyle = {
  marginBottom: spacing.xs,
  color: colors.palette.neutral800,
}

const $emailText: ViewStyle = {
  padding: spacing.sm,
  backgroundColor: colors.palette.neutral200,
  borderRadius: 8,
  color: colors.palette.neutral600,
  fontStyle: "italic",
}

const $successSection: ViewStyle = {
  marginBottom: spacing.lg,
}

const $successText: ViewStyle = {
  color: colors.palette.success500,
  textAlign: "center",
  fontWeight: "600",
}

const $buttonContainer: ViewStyle = {
  width: "100%",
  gap: spacing.md,
}

const $resendButton: ViewStyle = {
  backgroundColor: colors.palette.primary500,
}

const $backButton: ViewStyle = {
  backgroundColor: colors.palette.neutral300,
}
