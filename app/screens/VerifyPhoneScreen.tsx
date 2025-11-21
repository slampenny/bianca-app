import React, { useEffect, useState, useRef } from "react"
import { View, StyleSheet, Platform } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSelector, useDispatch } from "react-redux"
import { Screen, Text, Button, TextField } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { spacing } from "app/theme"
import { translate } from "app/i18n"
import type { ThemeColors } from "../types"
import { navigationRef } from "app/navigators/navigationUtilities"
import {
  useSendPhoneVerificationCodeMutation,
  useVerifyPhoneCodeMutation,
  useResendPhoneVerificationCodeMutation,
} from "app/services/api/authApi"
import { getCurrentUser, setCurrentUser } from "app/store/authSlice"
import { useGetCaregiverQuery } from "app/services/api/caregiverApi"
import { logger } from "../utils/logger"

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.biancaBackground || colors.palette.neutral100,
    padding: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 500,
    alignItems: "center",
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
  errorMessage: {
    color: colors.palette.biancaError || colors.palette.error500 || "#ef4444",
    fontSize: 16,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  successMessage: {
    color: colors.palette.biancaSuccess || colors.palette.success500 || "#10b981",
    fontSize: 16,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  codeInput: {
    width: "100%",
    marginBottom: spacing.lg,
  },
  codeInputField: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 8,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  buttonContainer: {
    marginTop: spacing.lg,
    width: "100%",
    gap: spacing.md,
  },
  resendContainer: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  resendText: {
    color: colors.palette.neutral600,
    fontSize: 14,
    textAlign: "center",
  },
  countdownText: {
    color: colors.palette.primary500 || colors.tint,
    fontSize: 14,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  maskedPhone: {
    fontWeight: "600",
    color: colors.palette.neutral800,
  },
})

export const VerifyPhoneScreen = () => {
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const { colors, isLoading: themeLoading } = useTheme()
  const currentUser = useSelector(getCurrentUser)
  const [code, setCode] = useState("")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [successMessage, setSuccessMessage] = useState<string>("")
  const [codeSent, setCodeSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const resendTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [sendCode, { isLoading: isSending }] = useSendPhoneVerificationCodeMutation()
  const [verifyCode, { isLoading: isVerifying }] = useVerifyPhoneCodeMutation()
  const [resendCode, { isLoading: isResending }] = useResendPhoneVerificationCodeMutation()
  
  // Refetch current user after verification to update isPhoneVerified status
  const { data: updatedUser, refetch: refetchUser } = useGetCaregiverQuery(
    { id: currentUser?.id || '' },
    { skip: !currentUser?.id }
  )

  // Mask phone number for display
  const maskPhone = (phone: string) => {
    if (!phone) return ""
    // Format: +1234567890 -> +1 (234) ***-7890
    const match = phone.match(/^(\+\d{1,2})(\d{3})(\d{3})(\d{4})$/)
    if (match) {
      return `${match[1]} (${match[2]}) ***-${match[4]}`
    }
    return phone
  }

  const maskedPhone = currentUser?.phone ? maskPhone(currentUser.phone) : ""

  // Send code on mount if not already sent
  useEffect(() => {
    if (!codeSent && currentUser?.phone) {
      handleSendCode()
    }
  }, [])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      resendTimerRef.current = setTimeout(() => {
        setResendCooldown(resendCooldown - 1)
      }, 1000)
    } else if (resendTimerRef.current) {
      clearTimeout(resendTimerRef.current)
      resendTimerRef.current = null
    }

    return () => {
      if (resendTimerRef.current) {
        clearTimeout(resendTimerRef.current)
      }
    }
  }, [resendCooldown])

  const handleSendCode = async () => {
    try {
      setErrorMessage("")
      setSuccessMessage("")
      const result = await sendCode({ phoneNumber: currentUser?.phone }).unwrap()
      setCodeSent(true)
      setResendCooldown(60) // 60 second cooldown
      setSuccessMessage(translate("phoneVerificationScreen.codeSent") || "Verification code sent!")
      logger.info("Phone verification code sent")
    } catch (error: any) {
      logger.error("Error sending phone verification code:", error)
      setErrorMessage(
        error?.data?.message ||
        error?.message ||
        translate("phoneVerificationScreen.errorSendingCode") ||
        "Failed to send verification code. Please try again."
      )
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return

    try {
      setErrorMessage("")
      setSuccessMessage("")
      const result = await resendCode().unwrap()
      setResendCooldown(60) // 60 second cooldown
      setSuccessMessage(translate("phoneVerificationScreen.codeResent") || "Verification code resent!")
      logger.info("Phone verification code resent")
    } catch (error: any) {
      logger.error("Error resending phone verification code:", error)
      setErrorMessage(
        error?.data?.message ||
        error?.message ||
        translate("phoneVerificationScreen.errorResendingCode") ||
        "Failed to resend verification code. Please try again."
      )
    }
  }

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      setErrorMessage(translate("phoneVerificationScreen.invalidCode") || "Please enter a 6-digit code")
      return
    }

    try {
      setErrorMessage("")
      setSuccessMessage("")
      const result = await verifyCode({ code }).unwrap()
      
      // Refetch the current user to get updated isPhoneVerified status
      if (currentUser?.id) {
        try {
          const { data: updatedUser } = await refetchUser()
          if (updatedUser) {
            // Update Redux with the updated user object
            dispatch(setCurrentUser(updatedUser))
          }
        } catch (refetchError) {
          logger.warn("Failed to refetch user after phone verification:", refetchError)
          // Continue anyway - the backend is updated, just Redux might be stale
        }
      }
      
      // Success - navigate to success screen or back
      if (navigationRef.isReady()) {
        navigationRef.navigate("MainTabs")
      } else {
        navigation.goBack()
      }
    } catch (error: any) {
      logger.error("Error verifying phone code:", error)
      setErrorMessage(
        error?.data?.message ||
        error?.message ||
        translate("phoneVerificationScreen.errorVerifyingCode") ||
        "Invalid verification code. Please try again."
      )
      setCode("") // Clear code on error
    }
  }

  const handleCodeChange = (text: string) => {
    // Only allow digits and limit to 6 characters
    const digitsOnly = text.replace(/\D/g, "").slice(0, 6)
    setCode(digitsOnly)
    setErrorMessage("") // Clear error when user types
  }

  if (themeLoading || !colors) {
    return null
  }

  const styles = createStyles(colors)

  return (
    <Screen preset="fixed" style={styles.container} contentContainerStyle={styles.container}>
      <View style={styles.contentWrapper}>
        <Text preset="heading" text="📱" style={[styles.title, { fontSize: 64 }]} />
        <Text
          preset="heading"
          tx="phoneVerificationScreen.title"
          style={styles.title}
        />
        <Text
          preset="default"
          tx="phoneVerificationScreen.message"
          txOptions={{ phone: maskedPhone }}
          style={styles.message}
        />

        {successMessage ? (
          <Text preset="default" text={successMessage} style={styles.successMessage} />
        ) : null}

        {errorMessage ? (
          <Text preset="default" text={errorMessage} style={styles.errorMessage} />
        ) : null}

        {codeSent && (
          <>
            <TextField
              value={code}
              onChangeText={handleCodeChange}
              placeholder="000000"
              placeholderTextColor={colors.palette.neutral400}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              style={styles.codeInputField}
              containerStyle={styles.codeInput}
              testID="phone-verification-code-input"
              accessibilityLabel="Enter 6-digit verification code"
            />

            <View style={styles.buttonContainer}>
              <Button
                tx="phoneVerificationScreen.verifyButton"
                onPress={handleVerifyCode}
                preset="default"
                disabled={!code || code.length !== 6 || isVerifying}
                loading={isVerifying}
                testID="verify-phone-code-button"
              accessibilityLabel="Verify phone code button"
              />
            </View>

            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>
                {translate("phoneVerificationScreen.didntReceiveCode") || "Didn't receive the code?"}
              </Text>
              {resendCooldown > 0 ? (
                <Text style={styles.countdownText}>
                  {translate("phoneVerificationScreen.resendAvailableIn") || "Resend available in"} {resendCooldown}s
                </Text>
              ) : (
                <Button
                  tx="phoneVerificationScreen.resendButton"
                  onPress={handleResendCode}
                  preset="link"
                  disabled={isResending}
                  loading={isResending}
                  testID="resend-phone-code-button"
                  accessibilityLabel="Resend phone verification code button"
                />
              )}
            </View>
          </>
        )}

        {!codeSent && (
          <View style={styles.buttonContainer}>
            <Button
              tx="phoneVerificationScreen.sendCodeButton"
              onPress={handleSendCode}
              preset="default"
              disabled={isSending}
              loading={isSending}
              testID="send-phone-code-button"
              accessibilityLabel="Send phone verification code button"
            />
          </View>
        )}
      </View>
    </Screen>
  )
}

