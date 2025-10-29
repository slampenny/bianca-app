import React, { useState } from "react"
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { Text, TextField, Button } from "app/components"
import { useForgotPasswordMutation } from "../services/api/authApi"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"

export const RequestResetScreen = (props: StackScreenProps<LoginStackParamList, "Register">) => {
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
    if (emailError || !email) {
      return
    }

    try {
      await requestReset({ email }).unwrap()
      setSuccessMessage(translate("requestResetScreen.successMessage"))
    } catch (err) {
      setEmailError(translate("requestResetScreen.requestFailed"))
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.palette.biancaBackground,
        overflowY: "scroll",
        msOverflowStyle: "scrollbar",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div style={{ padding: "20px" }}>
        <View style={styles.formContainer}>
          <Text style={styles.headerTitle} tx="requestResetScreen.title" />

          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

          <View style={styles.fieldContainer}>
            <TextField
              placeholderTx="requestResetScreen.emailFieldPlaceholder"
              labelTx="requestResetScreen.emailFieldLabel"
              value={email}
              onChangeText={validateEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {emailError ? <Text style={styles.fieldErrorText}>{emailError}</Text> : null}
          </View>

          <Button
            onPress={handleRequestReset}
            disabled={isLoading || !!emailError || !email}
            tx="requestResetScreen.requestReset"
            style={[styles.registerButton, (!email || !!emailError) && styles.buttonDisabled]}
          />

          <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={styles.linkButtonText} tx="registerScreen.goBack" />
          </Pressable>
        </View>
      </div>
    </div>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  buttonDisabled: {
    opacity: 0.6,
  },
  fieldContainer: {
    marginBottom: 10,
  },
  fieldErrorText: {
    color: colors.palette.biancaError,
    fontSize: 12,
    marginBottom: 8,
    marginTop: 2,
    textAlign: "center",
  },
  formContainer: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 6,
    elevation: 2,
    marginBottom: 20,
    marginTop: 40,
    padding: 20,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  linkButton: {
    marginBottom: 10,
    marginTop: 15,
  },
  linkButtonText: {
    color: colors.palette.biancaButtonSelected,
    fontSize: 16,
    textAlign: "center",
  },
  registerButton: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 4,
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 12,
    width: "100%",
  },
  successText: {
    backgroundColor: colors.palette.biancaSuccessBackground,
    borderRadius: 4,
    color: colors.palette.biancaSuccess,
    marginBottom: 20,
    padding: 10,
    textAlign: "center",
  },
})
