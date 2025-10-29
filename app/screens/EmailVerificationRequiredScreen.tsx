import React, { useState } from "react"
import { View, ViewStyle, Alert, StyleSheet } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { Screen, Text, Button } from "app/components"
import { spacing } from "app/theme"
import { useResendVerificationEmailMutation } from "app/services/api/authApi"
import { useTheme } from "app/theme/ThemeContext"

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.neutral100,
    padding: spacing.lg,
    justifyContent: "center",
  },
  title: {
    color: colors.palette.neutral800,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: spacing.md,
  },
  message: {
    color: colors.palette.neutral600,
    fontSize: 16,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  input: {
    backgroundColor: colors.palette.neutral100,
    borderColor: colors.palette.neutral300,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
    fontSize: 16,
    color: colors.palette.neutral800,
  },
  successMessage: {
    color: colors.palette.success500,
    fontSize: 16,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
})

export const EmailVerificationRequiredScreen = () => {
  const navigation = useNavigation()
  const [resendVerificationEmail, { isLoading }] = useResendVerificationEmailMutation()
  const [email, setEmail] = useState("")
  const [emailSent, setEmailSent] = useState(false)
  const { colors, isLoading: themeLoading } = useTheme()

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

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
      style={styles.container}
      contentContainerStyle={styles.container}
    >
      <View style={styles.container}>
        <Text preset="heading" text="Check Your Email" style={styles.title} />
        
        <Text 
          preset="default"
          text="We've sent a verification link to your email address. Please click the link to verify your account before logging in."
          style={styles.message}
        />
        
        <View style={styles.container}>
          <Text preset="formLabel" text="Email Address" style={styles.title} />
          <Text 
            preset="default"
            text={email || "Enter your email address"}
            style={styles.message}
          />
        </View>

        {emailSent && (
          <View style={styles.container}>
            <Text preset="default" text="✓ Verification email sent!" style={styles.successMessage} />
          </View>
        )}

        <View style={styles.container}>
          <Button
            text="Resend Verification Email"
            onPress={handleResendEmail}
            disabled={isLoading}
            style={styles.container}
            accessibilityLabel="resend-verification-button"
          />
          
          <Button
            text="Back to Login"
            onPress={handleBackToLogin}
            preset="default"
            style={styles.container}
            accessibilityLabel="back-to-login-button"
          />
        </View>
      </View>
    </Screen>
  )
}
