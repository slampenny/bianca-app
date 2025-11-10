import React, { useState, useRef } from "react"
import { View, StyleSheet, ScrollView, TextInput, Image, Alert } from "react-native"
import { useDispatch } from "react-redux"
import { useGetMFAStatusQuery, useEnableMFAMutation, useVerifyAndEnableMFAMutation, useDisableMFAMutation, useRegenerateBackupCodesMutation } from "../services/api/mfaApi"
import { Button, Text, TextField } from "../components"
import { useTheme } from "../theme/ThemeContext"
import { translate } from "../i18n"
import type { ThemeColors } from "../types"
import { useNavigation } from "@react-navigation/native"

type SetupStep = 'status' | 'enable' | 'verify' | 'enabled' | 'disable'

export function MFASetupScreen() {
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const { colors } = useTheme()
  
  const { data: mfaStatus, refetch: refetchStatus } = useGetMFAStatusQuery()
  const [enableMFA, { isLoading: isEnabling }] = useEnableMFAMutation()
  const [verifyAndEnableMFA, { isLoading: isVerifying }] = useVerifyAndEnableMFAMutation()
  const [disableMFA, { isLoading: isDisabling }] = useDisableMFAMutation()
  const [regenerateBackupCodes, { isLoading: isRegenerating }] = useRegenerateBackupCodesMutation()

  const [step, setStep] = useState<SetupStep>('status')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationToken, setVerificationToken] = useState("")
  const [disableToken, setDisableToken] = useState("")
  const [verificationError, setVerificationError] = useState("")
  const verificationInput = useRef<TextInput>(null)
  const disableInput = useRef<TextInput>(null)

  const styles = createStyles(colors)

  const handleEnableMFA = async () => {
    try {
      const result = await enableMFA().unwrap()
      setQrCode(result.qrCode)
      setSecret(result.secret)
      setBackupCodes(result.backupCodes)
      setStep('verify')
    } catch (error: unknown) {
      Alert.alert(
        translate("common.error") || "Error",
        error?.data?.message || translate("mfa.enableFailed") || "Failed to enable MFA"
      )
    }
  }

  const handleVerifyAndEnable = async () => {
    // Clear any previous error
    setVerificationError("")
    
    if (verificationToken.length !== 6) {
      setVerificationError(translate("mfa.pleaseEnterVerificationCode") || "Please enter the verification code from your authenticator app")
      verificationInput.current?.focus()
      return
    }

    try {
      await verifyAndEnableMFA({ token: verificationToken.trim() }).unwrap()
      setStep('enabled')
      setVerificationError("")
      refetchStatus()
      Alert.alert(
        translate("mfa.enabled") || "MFA Enabled",
        translate("mfa.enabledSuccess") || "Multi-factor authentication has been successfully enabled."
      )
    } catch (error: unknown) {
      Alert.alert(
        translate("common.error") || "Error",
        error?.data?.message || translate("mfa.verificationFailed") || "Invalid code. Please try again."
      )
      setVerificationToken("")
      verificationInput.current?.focus()
    }
  }

  const handleDisableMFA = async () => {
    if (disableToken.length !== 6) {
      Alert.alert(
        translate("common.error") || "Error",
        translate("mfa.invalidTokenLength") || "Please enter a 6-digit code"
      )
      return
    }

    Alert.alert(
      translate("mfa.disableConfirmTitle") || "Disable MFA?",
      translate("mfa.disableConfirmMessage") || "Are you sure you want to disable multi-factor authentication? This will reduce the security of your account.",
      [
        { text: translate("common.cancel") || "Cancel", style: "cancel" },
        {
          text: translate("mfa.disable") || "Disable",
          style: "destructive",
          onPress: async () => {
            try {
              await disableMFA({ token: disableToken.trim() }).unwrap()
              setStep('status')
              refetchStatus()
              Alert.alert(
                translate("mfa.disabled") || "MFA Disabled",
                translate("mfa.disabledSuccess") || "Multi-factor authentication has been disabled."
              )
            } catch (error: unknown) {
              Alert.alert(
                translate("common.error") || "Error",
                error?.data?.message || translate("mfa.disableFailed") || "Failed to disable MFA. Please check your code."
              )
              setDisableToken("")
              disableInput.current?.focus()
            }
          }
        }
      ]
    )
  }

  const handleRegenerateBackupCodes = async () => {
    if (verificationToken.length !== 6) {
      Alert.alert(
        translate("common.error") || "Error",
        translate("mfa.invalidTokenLength") || "Please enter a 6-digit code"
      )
      return
    }

    Alert.alert(
      translate("mfa.regenerateBackupCodesTitle") || "Regenerate Backup Codes?",
      translate("mfa.regenerateBackupCodesMessage") || "Your old backup codes will no longer work. Make sure to save the new codes securely.",
      [
        { text: translate("common.cancel") || "Cancel", style: "cancel" },
        {
          text: translate("mfa.regenerate") || "Regenerate",
          onPress: async () => {
            try {
              const result = await regenerateBackupCodes({ token: verificationToken.trim() }).unwrap()
              setBackupCodes(result.backupCodes)
              setStep('enabled')
              Alert.alert(
                translate("mfa.backupCodesRegenerated") || "Backup Codes Regenerated",
                translate("mfa.backupCodesRegeneratedMessage") || "Your new backup codes have been generated. Please save them securely."
              )
            } catch (error: unknown) {
              Alert.alert(
                translate("common.error") || "Error",
                error?.data?.message || translate("mfa.regenerateFailed") || "Failed to regenerate backup codes."
              )
            }
          }
        }
      ]
    )
  }

  // Determine current step based on MFA status
  // Only update step if we're not in the middle of a setup flow (verify, disable, regenerate)
  React.useEffect(() => {
    if (mfaStatus) {
      // Don't override step if we're in the middle of setup/verification flow
      if (step === 'verify' || step === 'disable' || step === 'regenerate') {
        return
      }
      
      if (mfaStatus.mfaEnabled) {
        setStep('enabled')
      } else {
        setStep('status')
      }
    }
  }, [mfaStatus, step])

  if (step === 'status') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} testID="mfa-setup-screen" accessibilityLabel="mfa-setup-screen">
        <View style={styles.header}>
          <Text style={styles.title} preset="heading">
            {translate("mfa.setupTitle") || "Multi-Factor Authentication"}
          </Text>
          <Text style={styles.subtitle}>
            {translate("mfa.setupSubtitle") || "Add an extra layer of security to your account"}
          </Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>
            {translate("mfa.status") || "Status"}
          </Text>
          <Text style={styles.statusValue}>
            {translate("mfa.disabled") || "Disabled"}
          </Text>
        </View>

        <Button
          text={translate("mfa.enable") || "Enable MFA"}
          onPress={handleEnableMFA}
          preset="primary"
          loading={isEnabling}
          testID="mfa-enable-button"
          accessibilityLabel="mfa-enable-button"
          style={styles.enableButton}
        />

        <Button
          text={translate("common.back") || "Back"}
          onPress={() => navigation.goBack()}
          preset="default"
          testID="mfa-back-button"
          accessibilityLabel="mfa-back-button"
        />
      </ScrollView>
    )
  }

  if (step === 'verify') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} testID="mfa-setup-screen" accessibilityLabel="mfa-setup-screen">
        <View style={styles.header}>
          <Text style={styles.title} preset="heading">
            {translate("mfa.setupTitle") || "Setup MFA"}
          </Text>
          <Text style={styles.subtitle}>
            {translate("mfa.setupInstructions") || "Scan the QR code with your authenticator app, then enter the code to verify."}
          </Text>
        </View>

        {qrCode && (
          <View style={styles.qrContainer}>
            <Image source={{ uri: qrCode }} style={styles.qrCode} />
            {secret && (
              <View style={styles.secretContainer}>
                <Text style={styles.secretLabel}>
                  {translate("mfa.secretLabel") || "Or enter this secret manually:"}
                </Text>
                <Text style={styles.secretValue} selectable>
                  {secret}
                </Text>
              </View>
            )}
          </View>
        )}

        {backupCodes.length > 0 && (
          <View style={styles.backupCodesContainer}>
            <Text style={styles.backupCodesTitle}>
              {translate("mfa.backupCodesTitle") || "Backup Codes"}
            </Text>
            <Text style={styles.backupCodesWarning}>
              {translate("mfa.backupCodesWarning") || "Save these codes in a secure location. You can use them to access your account if you lose your authenticator device."}
            </Text>
            <View style={styles.backupCodesList}>
              {backupCodes.map((code, index) => (
                <Text key={index} style={styles.backupCode} selectable>
                  {code}
                </Text>
              ))}
            </View>
          </View>
        )}

        <TextField
          ref={verificationInput}
          label={translate("mfa.tokenLabel") || "Verification Code"}
          placeholder={translate("mfa.tokenPlaceholder") || "000000"}
          value={verificationToken}
          onChangeText={(text) => {
            const digitsOnly = text.replace(/[^0-9]/g, "")
            setVerificationToken(digitsOnly.slice(0, 6))
            // Clear error when user starts typing
            if (verificationError) {
              setVerificationError("")
            }
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          testID="mfa-verify-token-input"
          accessibilityLabel="mfa-verify-token-input"
          status={verificationError ? "error" : undefined}
          helper={verificationError || undefined}
        />

        <Button
          text={translate("mfa.verifyAndEnable") || "Verify and Enable"}
          onPress={handleVerifyAndEnable}
          preset="primary"
          loading={isVerifying}
          testID="mfa-verify-enable-button"
          accessibilityLabel="mfa-verify-enable-button"
          style={styles.verifyButton}
        />

        <Button
          text={translate("common.cancel") || "Cancel"}
          onPress={() => {
            setStep('status')
            setQrCode(null)
            setSecret(null)
            setBackupCodes([])
            setVerificationToken("")
            setVerificationError("")
          }}
          preset="default"
          disabled={isVerifying}
          testID="mfa-cancel-setup-button"
          accessibilityLabel="mfa-cancel-setup-button"
        />
      </ScrollView>
    )
  }

  if (step === 'enabled') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} testID="mfa-setup-screen" accessibilityLabel="mfa-setup-screen">
        <View style={styles.header}>
          <Text style={styles.title} preset="heading">
            {translate("mfa.setupTitle") || "Multi-Factor Authentication"}
          </Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>
            {translate("mfa.status") || "Status"}
          </Text>
          <Text style={[styles.statusValue, styles.statusEnabled]}>
            {translate("mfa.enabled") || "Enabled"}
          </Text>
          {mfaStatus?.mfaEnrolledAt && (
            <Text style={styles.enrolledDate}>
              {translate("mfa.enrolledOn") || "Enrolled on"}: {new Date(mfaStatus.mfaEnrolledAt).toLocaleDateString()}
            </Text>
          )}
          {mfaStatus && (
            <Text style={styles.backupCodesRemaining}>
              {translate("mfa.backupCodesRemaining") || "Backup codes remaining"}: {mfaStatus.backupCodesRemaining}
            </Text>
          )}
        </View>

        <Button
          text={translate("mfa.regenerateBackupCodes") || "Regenerate Backup Codes"}
          onPress={() => {
            setStep('regenerate')
            setVerificationToken("")
          }}
          preset="default"
          disabled={isRegenerating}
          testID="mfa-regenerate-backup-codes-button"
          accessibilityLabel="mfa-regenerate-backup-codes-button"
          style={styles.regenerateButton}
        />

        <Button
          text={translate("mfa.disable") || "Disable MFA"}
          onPress={() => {
            setStep('disable')
            setDisableToken("")
          }}
          preset="danger"
          disabled={isDisabling}
          testID="mfa-disable-button"
          accessibilityLabel="mfa-disable-button"
          style={styles.disableButton}
        />

        <Button
          text={translate("common.back") || "Back"}
          onPress={() => navigation.goBack()}
          preset="default"
          testID="mfa-back-button"
          accessibilityLabel="mfa-back-button"
        />
      </ScrollView>
    )
  }

  if (step === 'disable') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} testID="mfa-setup-screen" accessibilityLabel="mfa-setup-screen">
        <View style={styles.header}>
          <Text style={styles.title} preset="heading">
            {translate("mfa.disableTitle") || "Disable MFA"}
          </Text>
          <Text style={styles.subtitle}>
            {translate("mfa.disableSubtitle") || "Enter your current MFA code to disable multi-factor authentication"}
          </Text>
        </View>

        <TextField
          ref={disableInput}
          label={translate("mfa.tokenLabel") || "Verification Code"}
          placeholder={translate("mfa.tokenPlaceholder") || "000000"}
          value={disableToken}
          onChangeText={(text) => {
            const digitsOnly = text.replace(/[^0-9]/g, "")
            setDisableToken(digitsOnly.slice(0, 6))
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          testID="mfa-disable-token-input"
          accessibilityLabel="mfa-disable-token-input"
        />

        <Button
          text={translate("mfa.disable") || "Disable MFA"}
          onPress={handleDisableMFA}
          preset="danger"
          disabled={disableToken.length !== 6}
          loading={isDisabling}
          testID="mfa-disable-confirm-button"
          accessibilityLabel="mfa-disable-confirm-button"
          style={styles.disableConfirmButton}
        />

        <Button
          text={translate("common.cancel") || "Cancel"}
          onPress={() => {
            setStep('enabled')
            setDisableToken("")
          }}
          preset="default"
          disabled={isDisabling}
          testID="mfa-cancel-disable-button"
          accessibilityLabel="mfa-cancel-disable-button"
        />
      </ScrollView>
    )
  }

  // Regenerate backup codes step
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} testID="mfa-setup-screen" accessibilityLabel="mfa-setup-screen">
      <View style={styles.header}>
        <Text style={styles.title} preset="heading">
          {translate("mfa.regenerateBackupCodesTitle") || "Regenerate Backup Codes"}
        </Text>
        <Text style={styles.subtitle}>
          {translate("mfa.regenerateBackupCodesSubtitle") || "Enter your current MFA code to generate new backup codes"}
        </Text>
      </View>

      <TextField
        ref={verificationInput}
        label={translate("mfa.tokenLabel") || "Verification Code"}
        placeholder={translate("mfa.tokenPlaceholder") || "000000"}
        value={verificationToken}
        onChangeText={(text) => {
          const digitsOnly = text.replace(/[^0-9]/g, "")
          setVerificationToken(digitsOnly.slice(0, 6))
        }}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        testID="mfa-regenerate-token-input"
        accessibilityLabel="mfa-regenerate-token-input"
      />

      {backupCodes.length > 0 && (
        <View style={styles.backupCodesContainer}>
          <Text style={styles.backupCodesTitle}>
            {translate("mfa.backupCodesTitle") || "New Backup Codes"}
          </Text>
          <Text style={styles.backupCodesWarning}>
            {translate("mfa.backupCodesWarning") || "Save these codes in a secure location. Your old backup codes are no longer valid."}
          </Text>
          <View style={styles.backupCodesList}>
            {backupCodes.map((code, index) => (
              <Text key={index} style={styles.backupCode} selectable>
                {code}
              </Text>
            ))}
          </View>
        </View>
      )}

      <Button
        text={translate("mfa.regenerate") || "Regenerate"}
        onPress={handleRegenerateBackupCodes}
        preset="primary"
        disabled={verificationToken.length !== 6 || backupCodes.length > 0}
        loading={isRegenerating}
        testID="mfa-regenerate-confirm-button"
        accessibilityLabel="mfa-regenerate-confirm-button"
        style={styles.regenerateConfirmButton}
      />

      <Button
        text={translate("common.back") || "Back"}
        onPress={() => {
          setStep('enabled')
          setVerificationToken("")
          setBackupCodes([])
        }}
        preset="default"
        disabled={isRegenerating}
        testID="mfa-cancel-regenerate-button"
        accessibilityLabel="mfa-cancel-regenerate-button"
      />
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
    statusCard: {
      backgroundColor: colors.palette.neutral100,
      padding: 20,
      borderRadius: 12,
      marginBottom: 20,
    },
    statusLabel: {
      fontSize: 14,
      color: colors.textDim,
      marginBottom: 5,
    },
    statusValue: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.text,
    },
    statusEnabled: {
      color: colors.palette.accent500,
    },
    enrolledDate: {
      fontSize: 14,
      color: colors.textDim,
      marginTop: 10,
    },
    backupCodesRemaining: {
      fontSize: 14,
      color: colors.textDim,
      marginTop: 5,
    },
    qrContainer: {
      alignItems: "center",
      marginBottom: 30,
    },
    qrCode: {
      width: 250,
      height: 250,
      marginBottom: 20,
    },
    secretContainer: {
      width: "100%",
      padding: 15,
      backgroundColor: colors.palette.neutral100,
      borderRadius: 8,
    },
    secretLabel: {
      fontSize: 14,
      color: colors.textDim,
      marginBottom: 8,
    },
    secretValue: {
      fontSize: 16,
      fontFamily: "monospace",
      color: colors.text,
    },
    backupCodesContainer: {
      marginBottom: 20,
      padding: 15,
      backgroundColor: colors.palette.neutral100,
      borderRadius: 8,
    },
    backupCodesTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.text,
      marginBottom: 8,
    },
    backupCodesWarning: {
      fontSize: 14,
      color: colors.textDim,
      marginBottom: 15,
      lineHeight: 20,
    },
    backupCodesList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    backupCode: {
      fontSize: 14,
      fontFamily: "monospace",
      color: colors.text,
      backgroundColor: colors.background,
      padding: 8,
      borderRadius: 4,
      minWidth: 80,
      textAlign: "center",
    },
    enableButton: {
      marginTop: 10,
    },
    verifyButton: {
      marginTop: 10,
    },
    regenerateButton: {
      marginTop: 10,
    },
    regenerateConfirmButton: {
      marginTop: 10,
    },
    disableButton: {
      marginTop: 10,
    },
    disableConfirmButton: {
      marginTop: 10,
    },
    errorMessage: {
      color: colors.palette.error500 || colors.error,
      fontSize: 14,
      marginTop: 8,
      marginBottom: 8,
      textAlign: "center",
    },
  })

