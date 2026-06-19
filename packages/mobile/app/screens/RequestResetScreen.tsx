import React, { useState } from "react"
import { View, StyleSheet, Pressable } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { Text, TextField, Button, AuthScreenLayout } from "app/components"
import { useForgotPasswordMutation } from "../services/api/authApi"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"

export const RequestResetScreen = (props: StackScreenProps<LoginStackParamList, "RequestReset">) => {
  const { navigation } = props
  const [requestReset, { isLoading }] = useForgotPasswordMutation()
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const { colors, isLoading: themeLoading } = useTheme()

  const validateEmail = (text: string) => {
    setEmail(text)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(text)) {
      setEmailError(translate("errors.invalidEmail"))
    } else {
      setEmailError("")
    }
  }

  const handleRequestReset = async () => {
    if (emailError || !email) return
    try {
      await requestReset({ email }).unwrap()
      setSuccessMessage(translate("requestResetScreen.successMessage"))
    } catch {
      setEmailError(translate("requestResetScreen.requestFailed"))
    }
  }

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  return (
    <AuthScreenLayout testID="request-reset-screen">
      <Text style={styles.headerTitle} tx="requestResetScreen.title" />

      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

      <TextField
        placeholderTx="requestResetScreen.emailFieldPlaceholder"
        labelTx="requestResetScreen.emailFieldLabel"
        value={email}
        onChangeText={validateEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        containerStyle={styles.fieldContainer}
      />
      {emailError ? <Text style={styles.fieldErrorText}>{emailError}</Text> : null}

      <Button
        onPress={handleRequestReset}
        disabled={isLoading || !!emailError || !email}
        tx="requestResetScreen.requestReset"
        style={[styles.registerButton, (!email || !!emailError) && styles.buttonDisabled]}
      />

      <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
        <Text style={styles.linkButtonText} tx="registerScreen.goBack" />
      </Pressable>
    </AuthScreenLayout>
  )
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    buttonDisabled: { opacity: 0.6 },
    fieldContainer: { marginBottom: 10, width: "100%" },
    fieldErrorText: {
      color: colors.palette.biancaError,
      fontSize: 12,
      marginBottom: 8,
      textAlign: "center",
    },
    headerTitle: {
      color: colors.palette.biancaHeader,
      fontSize: 22,
      fontWeight: "700",
      marginBottom: 20,
      textAlign: "center",
    },
    linkButton: { marginBottom: 10, marginTop: 15 },
    linkButtonText: {
      color: colors.palette.primary500,
      fontSize: 16,
      textAlign: "center",
    },
    registerButton: {
      marginTop: 10,
      width: "100%",
    },
    successText: {
      backgroundColor: colors.palette.biancaSuccessBackground,
      borderRadius: 8,
      color: colors.palette.biancaSuccess,
      marginBottom: 20,
      padding: 10,
      textAlign: "center",
    },
  })
