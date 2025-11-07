import React, { useState, useEffect } from "react"
import { View, ViewStyle, StyleSheet } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { Screen, Text, Button, TextField } from "app/components"
import { LoadingButton } from "app/components/LoadingButton"
import { spacing } from "app/theme"
import { useResendVerificationEmailMutation } from "app/services/api/authApi"
import { useTheme } from "app/theme/ThemeContext"
import { useSelector } from "react-redux"
import { getAuthEmail } from "app/store/authSlice"
import { translate } from "app/i18n"

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.biancaBackground || colors.palette.neutral100,
    padding: spacing.lg,
    justifyContent: "center",
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
  },
  title: {
    color: colors.palette.neutral800 || colors.palette.biancaHeader,
    fontSize: 28,
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
  label: {
    color: colors.palette.neutral800,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  successMessage: {
    color: colors.palette.success500 || colors.palette.biancaSuccess,
    fontSize: 16,
    textAlign: "center",
    marginBottom: spacing.lg,
    backgroundColor: colors.palette.biancaSuccessBackground || "#d1fae5",
    padding: spacing.md,
    borderRadius: 8,
  },
  errorContainer: {
    backgroundColor: colors.palette.biancaErrorBackground || "#fee2e2",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.palette.biancaError || "#dc2626",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  errorText: {
    color: colors.palette.biancaError || "#dc2626",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "left",
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
})

export const EmailVerificationRequiredScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const [resendVerificationEmail, { isLoading }] = useResendVerificationEmailMutation()
  const authEmail = useSelector(getAuthEmail)
  const routeEmail = (route.params as any)?.email
  const [email, setEmail] = useState(routeEmail || authEmail || "")
  const [emailSent, setEmailSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const { colors, isLoading: themeLoading } = useTheme()

  useEffect(() => {
    // Set email from route params or Redux if not already set
    if (!email && routeEmail) {
      setEmail(routeEmail)
    } else if (!email && authEmail) {
      setEmail(authEmail)
    }
  }, [routeEmail, authEmail, email])

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  const handleResendEmail = async () => {
    // Clear previous error and success messages
    setErrorMessage("")
    setEmailSent(false)

    if (!email.trim()) {
      setErrorMessage(translate("emailVerificationScreen.errorNoEmail"))
      return
    }

    try {
      console.log("Attempting to resend verification email to:", email.trim())
      const result = await resendVerificationEmail({ email: email.trim() }).unwrap()
      console.log("Resend verification email success:", result)
      setEmailSent(true)
      setErrorMessage("") // Clear any previous errors on success
      setTimeout(() => setEmailSent(false), 5000) // Hide success message after 5 seconds
    } catch (error: any) {
      console.error("Resend verification email error:", error)
      console.error("Error details:", {
        status: error?.status,
        data: error?.data,
        error: error?.error,
        message: error?.message
      })
      // Extract specific error message from API response
      const errorMsg = error?.data?.message || error?.message || translate("emailVerificationScreen.errorSendFailed")
      setErrorMessage(errorMsg)
      setEmailSent(false) // Clear success state if error occurs
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
      <View style={styles.contentWrapper}>
        <Text preset="heading" tx="emailVerificationScreen.title" style={styles.title} />
        
        <Text 
          preset="default"
          tx="emailVerificationScreen.message"
          style={styles.message}
        />
        
        <View style={styles.fieldContainer}>
          <TextField
            value={email}
            onChangeText={setEmail}
            labelTx="emailVerificationScreen.emailFieldLabel"
            placeholderTx="emailVerificationScreen.emailFieldPlaceholder"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={true}
            accessibilityLabel="email-input"
            testID="email-input"
          />
        </View>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text preset="default" text={errorMessage} style={styles.errorText} testID="error-message" />
          </View>
        ) : null}

        {emailSent && (
          <Text preset="default" tx="emailVerificationScreen.successMessage" style={styles.successMessage} />
        )}

        <View style={styles.buttonContainer}>
          <LoadingButton
            title={translate("emailVerificationScreen.resendButton")}
            onPress={handleResendEmail}
            loading={isLoading}
            disabled={!email.trim()}
            testID="resend-verification-button"
          />
          
          <Button
            tx="emailVerificationScreen.backToLoginButton"
            onPress={handleBackToLogin}
            preset="default"
            accessibilityLabel="back-to-login-button"
            testID="back-to-login-button"
          />
        </View>
      </View>
    </Screen>
  )
}
