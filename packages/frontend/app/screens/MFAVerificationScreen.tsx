import React, { useState, useRef } from "react"
import { View, StyleSheet, ScrollView, TextInput, Keyboard } from "react-native"
import { useDispatch } from "react-redux"
import { useLoginMutation } from "../services/api/authApi"
import { setAuthTokens, setCurrentUser } from "../store/authSlice"
import { setCaregiver } from "../store/caregiverSlice"
import { setOrg } from "../store/orgSlice"
import { Button, Text, TextField } from "../components"
import { useTheme } from "../theme/ThemeContext"
import { translate } from "../i18n"
import type { ThemeColors } from "../types"
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native"
import { LoginStackParamList } from "../navigators/navigationTypes"
import { logger } from "../utils/logger"

type MFAVerificationScreenRouteProp = RouteProp<LoginStackParamList, "MFAVerification">

export function MFAVerificationScreen() {
  const navigation = useNavigation()
  const route = useRoute<MFAVerificationScreenRouteProp>()
  const dispatch = useDispatch()
  const { colors } = useTheme()
  const [loginAPI] = useLoginMutation()
  
  const { email, password, tempToken } = route.params
  const [mfaToken, setMfaToken] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const mfaTokenInput = useRef<TextInput>(null)

  const styles = createStyles(colors)

  const handleVerify = async () => {
    if (mfaToken.length !== 6) {
      setErrorMessage(translate("mfa.invalidTokenLength") || "Please enter a 6-digit code")
      return
    }

    setIsLoading(true)
    setErrorMessage("")

    try {
      const result = await loginAPI({ 
        email, 
        password, 
        mfaToken: mfaToken.trim() 
      }).unwrap()

      // Check if this is still an MFA response (shouldn't happen, but handle it)
      if ('requireMFA' in result && result.requireMFA) {
        setErrorMessage(translate("mfa.verificationFailed") || "Invalid code. Please try again.")
        setIsLoading(false)
        return
      }

      // Success - set tokens and user data
      if ('tokens' in result) {
        dispatch(setAuthTokens(result.tokens))
        dispatch(setCurrentUser(result.caregiver))
        dispatch(setCaregiver(result.caregiver))
        if (result.org) {
          dispatch(setOrg(result.org))
        }
        // Navigate to home
        navigation.reset({
          index: 0,
          routes: [{ name: "MainTabs" as never }],
        })
      }
    } catch (error: unknown) {
      logger.error('MFA verification error:', error)
      const errorData = error?.data
      const errorMessage = errorData?.message || translate("mfa.verificationFailed") || "Invalid code. Please try again."
      setErrorMessage(errorMessage)
      setMfaToken("") // Clear token on error
      mfaTokenInput.current?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackupCode = () => {
    // For backup codes, we can use the same flow but the token will be 8 characters
    // The backend handles both 6-digit TOTP and 8-character backup codes
    if (mfaToken.length === 8) {
      handleVerify()
    } else {
      setErrorMessage(translate("mfa.backupCodeLength") || "Backup codes are 8 characters long")
    }
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title} preset="heading">
          {translate("mfa.verificationTitle") || "Two-Factor Authentication"}
        </Text>
        <Text style={styles.subtitle}>
          {translate("mfa.verificationSubtitle") || "Enter the 6-digit code from your authenticator app"}
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          ref={mfaTokenInput}
          label={translate("mfa.tokenLabel") || "Verification Code"}
          placeholder={translate("mfa.tokenPlaceholder") || "000000"}
          value={mfaToken}
          onChangeText={(text) => {
            // Only allow digits
            const digitsOnly = text.replace(/[^0-9]/g, "")
            setMfaToken(digitsOnly.slice(0, 8)) // Allow up to 8 for backup codes
            setErrorMessage("")
          }}
          keyboardType="number-pad"
          maxLength={8}
          autoFocus
          editable={!isLoading}
          testID="mfa-token-input"
          accessibilityLabel="mfa-token-input"
        />

        {errorMessage ? (
          <View style={styles.errorContainer} testID="mfa-error" accessibilityLabel="mfa-error">
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <Button
          text={translate("mfa.verifyButton") || "Verify"}
          onPress={handleVerify}
          preset="primary"
          disabled={mfaToken.length < 6 || isLoading}
          loading={isLoading}
          testID="mfa-verify-button"
          accessibilityLabel="mfa-verify-button"
          style={styles.verifyButton}
        />

        <Button
          text={translate("mfa.useBackupCode") || "Use Backup Code"}
          onPress={handleBackupCode}
          preset="default"
          disabled={mfaToken.length !== 8 || isLoading}
          testID="mfa-backup-code-button"
          accessibilityLabel="mfa-backup-code-button"
          style={styles.backupButton}
        />

        <Button
          text={translate("common.cancel") || "Cancel"}
          onPress={() => navigation.goBack()}
          preset="default"
          disabled={isLoading}
          testID="mfa-cancel-button"
          accessibilityLabel="mfa-cancel-button"
          style={styles.cancelButton}
        />
      </View>
    </ScrollView>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      padding: 20,
      paddingTop: 40,
    },
    header: {
      marginBottom: 30,
    },
    title: {
      marginBottom: 10,
      color: colors.text,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textDim,
      lineHeight: 22,
    },
    form: {
      gap: 20,
    },
    errorContainer: {
      backgroundColor: colors.palette.angry100,
      padding: 12,
      borderRadius: 8,
      marginTop: -10,
    },
    errorText: {
      color: colors.palette.angry500,
      fontSize: 14,
    },
    verifyButton: {
      marginTop: 10,
    },
    backupButton: {
      marginTop: 10,
    },
    cancelButton: {
      marginTop: 10,
    },
  })

