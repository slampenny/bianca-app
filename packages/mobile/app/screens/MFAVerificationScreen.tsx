import React, { useState, useRef } from "react"
import { View, StyleSheet, TextInput } from "react-native"
import { useDispatch } from "react-redux"
import { useLoginMutation } from "../services/api/authApi"
import { setAuthTokens, setCurrentUser, setLovedOneSetupComplete } from "../store/authSlice"
import { setCaregiver } from "../store/caregiverSlice"
import { setOrg } from "../store/orgSlice"
import { Button, Text, TextField, AuthScreenLayout } from "../components"
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
        mfaToken: mfaToken.trim(),
      }).unwrap()

      if ("requireMFA" in result && result.requireMFA) {
        setErrorMessage(translate("mfa.verificationFailed") || "Invalid code. Please try again.")
        setIsLoading(false)
        return
      }

      if ("tokens" in result) {
        dispatch(setAuthTokens(result.tokens))
        dispatch(setCurrentUser(result.caregiver))
        dispatch(setCaregiver(result.caregiver))
        if (result.org) dispatch(setOrg(result.org))
        if (result.caregiver.clients?.length) {
          dispatch(setLovedOneSetupComplete())
        }
        navigation.reset({
          index: 0,
          routes: [{ name: "MainTabs" as never }],
        })
      }
    } catch (error: unknown) {
      logger.error("MFA verification error:", error)
      const errorData = (error as { data?: { message?: string } })?.data
      setErrorMessage(errorData?.message || translate("mfa.verificationFailed") || "Invalid code. Please try again.")
      setMfaToken("")
      mfaTokenInput.current?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthScreenLayout testID="mfa-verification-screen">
      <Text style={styles.title}>{translate("mfa.verificationTitle") || "Two-Factor Authentication"}</Text>
      <Text style={styles.subtitle}>
        {translate("mfa.verificationSubtitle") || "Enter the 6-digit code from your authenticator app"}
      </Text>

      <TextField
        ref={mfaTokenInput}
        label={translate("mfa.tokenLabel") || "Verification Code"}
        placeholder={translate("mfa.tokenPlaceholder") || "000000"}
        value={mfaToken}
        onChangeText={(text) => {
          const digitsOnly = text.replace(/[^0-9]/g, "")
          setMfaToken(digitsOnly.slice(0, 8))
          setErrorMessage("")
        }}
        keyboardType="number-pad"
        maxLength={8}
        autoFocus
        editable={!isLoading}
        testID="mfa-token-input"
        accessibilityLabel="mfa-token-input"
        containerStyle={styles.field}
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
        style={styles.verifyButton}
      />

      <Button
        text={translate("common.cancel") || "Cancel"}
        onPress={() => navigation.goBack()}
        preset="default"
        disabled={isLoading}
        testID="mfa-cancel-button"
        style={styles.cancelButton}
      />
    </AuthScreenLayout>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    title: {
      fontSize: 24,
      fontWeight: "700",
      marginBottom: 10,
      color: colors.palette.biancaHeader ?? colors.text,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      color: colors.textDim,
      lineHeight: 22,
      textAlign: "center",
      marginBottom: 24,
    },
    field: { width: "100%", marginBottom: 8 },
    errorContainer: {
      backgroundColor: colors.palette.angry100,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      width: "100%",
    },
    errorText: {
      color: colors.palette.angry500,
      fontSize: 14,
    },
    verifyButton: { marginTop: 8, width: "100%" },
    cancelButton: { marginTop: 12, width: "100%" },
  })
