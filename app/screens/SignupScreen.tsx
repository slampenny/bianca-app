import React, { useState, useEffect, useRef } from "react"
import { View, ViewStyle, StyleSheet } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { useRoute } from "@react-navigation/native"
import { useRegisterWithInviteMutation } from "../services/api/authApi"
import { useDispatch } from "react-redux"
import { setInviteToken } from "app/store/authSlice"
import { Button, Text, TextField, Screen, Header, PhoneInputWeb } from "app/components"
import { LegalLinks } from "app/components/LegalLinks"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { useTheme } from "app/theme/ThemeContext"
import { logger } from "../utils/logger"

type SignupScreenRouteProp = StackScreenProps<LoginStackParamList, "Signup">

export const SignupScreen = (props: SignupScreenRouteProp) => {
  const { navigation } = props
  const route = useRoute()
  const token = (route.params as any)?.token
  const dispatch = useDispatch()
  const { colors, isLoading: themeLoading } = useTheme()

  const [registerWithInvite, { isLoading }] = useRegisterWithInviteMutation()

  // Form state - name, email, phone will be prefilled from invite
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Error states
  const [passwordError, setPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")
  const [generalError, setGeneralError] = useState("")
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check if we have an invite token and persist it
  useEffect(() => {
    if (token) {
      // Store the invite token in Redux so it persists across navigation
      dispatch(setInviteToken(token))
      logger.debug("Signup with invite token:", token)
    } else {
      setGeneralError("Invalid or expired invite token")
      // Navigate to login after a short delay to show the error
      timeoutRef.current = setTimeout(() => {
        navigation.navigate("Login")
        timeoutRef.current = null
      }, 2000)
      
      // Cleanup on unmount
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    }

    // TODO: Decode token to prefill user information
    // For now, we'll let the backend handle token validation
  }, [token, navigation, dispatch])

  // Handle backend error messages for different token states
  useEffect(() => {
    // Check if we have specific error messages from the backend
    if (generalError.includes("Invalid or expired invite token") || 
        generalError.includes("Invite token has expired")) {
      // Don't navigate immediately, let the error be visible
      return
    }
  }, [generalError])

  const validateForm = () => {
    let isValid = true
    
    // Reset errors
    setPasswordError("")
    setConfirmPasswordError("")
    setGeneralError("")

    // Validate password
    if (!password) {
      setPasswordError("Password is required")
      isValid = false
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      isValid = false
    }

    // Validate confirm password
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password")
      isValid = false
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match")
      isValid = false
    }

    return isValid
  }

  const handleSignup = async () => {
    if (!validateForm()) return
    if (!token) return

    try {
      const result = await registerWithInvite({
        token,
        password,
        name,
        email,
        phone,
      }).unwrap()

      logger.debug("Signup successful:", result)
      
      // Navigate to main app since user is now registered and logged in
      navigation.navigate("MainTabs" as any)
      
    } catch (error: unknown) {
      logger.error("Signup error:", error)
      
      if (error?.data?.message) {
        setGeneralError(error.data.message)
      } else if (error?.message) {
        setGeneralError(error.message)
      } else {
        setGeneralError("An error occurred during signup. Please try again.")
      }
      
      // For specific token errors, don't navigate away
      const errorMessage = error?.data?.message || error?.message || ""
      if (errorMessage.includes("Invalid or expired invite token") || 
          errorMessage.includes("Invite token has expired")) {
        return // Stay on the page to show the error
      }
    }
  }

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  return (
    <Screen style={styles.container} testID="signup-screen" accessibilityLabel="signup-screen">
      <Header titleTx="signupScreen.title" />
      
      {generalError ? (
        <Text testID="signup-error" style={styles.error}>{generalError}</Text>
      ) : null}

      <TextField
        testID="register-name"
        accessibilityLabel="signup-name-input"
        value={name}
        onChangeText={setName}
        labelTx="signupScreen.fullNameLabel"
        placeholderTx="signupScreen.fullNamePlaceholder"
        containerStyle={styles.inputContainer}
        inputWrapperStyle={styles.inputWrapper}
        style={styles.input}
      />

      <TextField
        testID="register-email"
        accessibilityLabel="signup-email-input"
        value={email}
        onChangeText={setEmail}
        labelTx="signupScreen.emailLabel"
        placeholderTx="signupScreen.emailPlaceholder"
        keyboardType="email-address"
        autoCapitalize="none"
        editable={false}
        containerStyle={styles.inputContainer}
        inputWrapperStyle={styles.inputWrapper}
        style={styles.input}
      />

      <PhoneInputWeb
        testID="register-phone"
        accessibilityLabel="signup-phone-input"
        value={phone}
        onChangeText={setPhone}
        labelTx="signupScreen.phoneLabel"
        placeholderTx="signupScreen.phonePlaceholder"
        editable={false}
        containerStyle={styles.inputContainer}
        inputWrapperStyle={styles.inputWrapper}
        style={styles.input}
      />

      <TextField
        testID="register-password"
        accessibilityLabel="signup-password-input"
        value={password}
        onChangeText={(text) => {
          setPassword(text)
          setPasswordError("")
        }}
        labelTx="signupScreen.passwordLabel"
        placeholderTx="signupScreen.passwordPlaceholder"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={styles.inputContainer}
        inputWrapperStyle={styles.inputWrapper}
        style={styles.input}
      />
      {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}

      <TextField
        testID="register-confirm-password"
        accessibilityLabel="signup-confirm-password-input"
        value={confirmPassword}
        onChangeText={(text) => {
          setConfirmPassword(text)
          setConfirmPasswordError("")
        }}
        labelTx="signupScreen.confirmPasswordLabel"
        placeholderTx="signupScreen.confirmPasswordPlaceholder"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={styles.inputContainer}
        inputWrapperStyle={styles.inputWrapper}
        style={styles.input}
      />
      {confirmPasswordError ? <Text style={styles.fieldError}>{confirmPasswordError}</Text> : null}

      <Button
        testID="register-submit"
        accessibilityLabel="signup-submit-button"
        tx="signupScreen.completeRegistration"
        onPress={handleSignup}
        preset="primary"
        style={styles.signupButton}
        textStyle={styles.signupButtonText}
        disabled={isLoading || !password || !confirmPassword}
      />

      <Text 
        style={styles.infoText}
        tx="signupScreen.preconfiguredMessage"
      />

      <LegalLinks />
    </Screen>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  error: {
    color: colors.palette.biancaError,
    marginBottom: 20,
    textAlign: "center",
  },
  fieldError: {
    color: colors.palette.biancaError,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  input: {
    color: colors.palette.biancaHeader,
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 16,
    width: "100%",
  },
  inputWrapper: {
    backgroundColor: colors.palette.neutral100,
    borderColor: colors.palette.biancaBorder,
    borderRadius: 6,
    borderWidth: 1,
    elevation: 1,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  signupButton: {
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    marginBottom: 16,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: "100%",
  },
  signupButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  infoText: {
    color: colors.palette.neutral600,
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 20,
  },
})