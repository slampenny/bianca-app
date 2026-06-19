import React, { useState, useEffect, useRef } from "react"
import { View, StyleSheet } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { Text, Button, TextField, AuthScreenLayout } from "app/components"
import { LoadingButton } from "app/components/LoadingButton"
import { spacing } from "app/theme"
import { useResendVerificationEmailMutation } from "app/services/api/authApi"
import { useTheme } from "app/theme/ThemeContext"
import { useSelector } from "react-redux"
import { getAuthEmail } from "app/store/authSlice"
import { translate } from "app/i18n"
import { logger } from "../utils/logger"
import { TIMEOUTS } from "../constants"

const createStyles = (colors: any) =>
  StyleSheet.create({
    title: {
      color: colors.palette.neutral800 || colors.palette.biancaHeader,
      fontSize: 24,
      fontWeight: "700",
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isResendingRef = useRef(false)

  useEffect(() => {
    if (!email && routeEmail) {
      setEmail(routeEmail)
    } else if (!email && authEmail) {
      setEmail(authEmail)
    }
  }, [routeEmail, authEmail, email])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  const handleResendEmail = async () => {
    if (isResendingRef.current || isLoading) {
      logger.debug("Resend already in progress, ignoring duplicate click")
      return
    }

    setErrorMessage("")
    setEmailSent(false)

    if (!email.trim()) {
      setErrorMessage(translate("emailVerificationScreen.errorNoEmail"))
      return
    }

    isResendingRef.current = true

    try {
      logger.debug("Attempting to resend verification email to:", email.trim())
      const result = await resendVerificationEmail({ email: email.trim() }).unwrap()
      logger.debug("Resend verification email success:", result)
      setEmailSent(true)
      setErrorMessage("")

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        setEmailSent(false)
        timeoutRef.current = null
      }, TIMEOUTS.SUCCESS_MESSAGE_DISPLAY)
    } catch (error: unknown) {
      const err = error as { status?: number; data?: { message?: string }; error?: unknown; message?: string }
      logger.error("Resend verification email error:", error)
      const errorMsg =
        err?.data?.message || err?.message || translate("emailVerificationScreen.errorSendFailed")
      setErrorMessage(errorMsg)
      setEmailSent(false)
    } finally {
      isResendingRef.current = false
    }
  }

  const handleBackToLogin = () => {
    ;(navigation.navigate as (name: string) => void)("Login")
  }

  return (
    <AuthScreenLayout testID="email-verification-required-screen">
      <Text preset="heading" tx="emailVerificationScreen.title" style={styles.title} />

      <Text preset="default" tx="emailVerificationScreen.message" style={styles.message} />

      <View style={styles.fieldContainer}>
        <TextField
          value={email}
          labelTx="emailVerificationScreen.emailFieldLabel"
          placeholderTx="emailVerificationScreen.emailFieldPlaceholder"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={false}
          accessibilityLabel="email-input"
          testID="email-input"
        />
      </View>

      {errorMessage ? (
        <View style={styles.errorContainer}>
          <Text preset="default" text={errorMessage} style={styles.errorText} testID="error-message" />
        </View>
      ) : null}

      {emailSent ? (
        <Text
          preset="default"
          tx="emailVerificationScreen.successMessage"
          style={styles.successMessage}
          testID="email-resend-success-message"
        />
      ) : null}

      <View style={styles.buttonContainer}>
        <LoadingButton
          title={translate("emailVerificationScreen.resendButton")}
          onPress={handleResendEmail}
          loading={isLoading}
          disabled={!email.trim() || isLoading}
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
    </AuthScreenLayout>
  )
}
