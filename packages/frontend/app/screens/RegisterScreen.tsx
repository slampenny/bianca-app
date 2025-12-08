import React, { useState, useEffect, useLayoutEffect, useRef } from "react"
import { StyleSheet, View, Pressable, ScrollView, Platform } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { useRegisterMutation } from "../services/api/authApi"
import { Button, Text, TextField, PasswordField, PhoneInputWeb, Screen } from "app/components"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import type { ThemeColors } from "../types"
import { logger } from "../utils/logger"

export const RegisterScreen = (props: StackScreenProps<LoginStackParamList, "Register">) => {
  const { navigation } = props
  const scrollRef = useRef<ScrollView>(null)
  const { colors, isLoading: themeLoading } = useTheme()

  // Don't return null - render a loading state instead to prevent navigation issues
  if (themeLoading) {
    return (
      <Screen 
        testID="register-screen"
        accessibilityLabel="Register"
        style={{ backgroundColor: colors.palette?.biancaBackground || '#FFFFFF', flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Loading...</Text>
        </View>
      </Screen>
    )
  }

  const styles = createStyles(colors)

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerBackTitleVisible: false,
      headerTintColor: colors.palette.biancaHeader || colors.text,
      headerStyle: {
        backgroundColor: colors.palette.biancaBackground,
      },
      headerTitleStyle: {
        color: colors.palette.biancaHeader || colors.text,
      },
      title: translate("registerScreen.title") || translate("headers.register"),
    })
  }, [navigation, colors])

  const [register, { isLoading }] = useRegisterMutation()

  // Form state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [accountType, setAccountType] = useState("individual")

  // Field-specific error messages
  const [nameError, setNameError] = useState("")
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [organizationNameError, setOrganizationNameError] = useState("")
  const [generalError, setGeneralError] = useState("")

  const [shouldRegister, setShouldRegister] = useState(false)

  // Clear field error when user starts typing
  const clearFieldError = (field: string) => {
    switch (field) {
      case "name":
        setNameError("")
        break
      case "email":
        setEmailError("")
        break
      case "password":
        setPasswordError("")
        break
      case "confirmPassword":
        setConfirmPasswordError("")
        break
      case "phone":
        setPhoneError("")
        break
      case "organizationName":
        setOrganizationNameError("")
        break
    }
    setGeneralError("") // Clear general error when any field changes
  }

  // Validation helpers
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const validatePassword = (password: string) =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)
  const validatePhone = (phone: string) => /^(\+1\d{10}|\d{10,})$/.test(phone)

  // Validate all inputs and set appropriate error messages
  const validateInputs = () => {
    let isValid = true

    // Reset all errors before validating
    setNameError("")
    setEmailError("")
    setPasswordError("")
    setConfirmPasswordError("")
    setPhoneError("")
    setOrganizationNameError("")
    setGeneralError("") // Reset general error during validation as well

    // Name validation
    if (name.trim() === "") {
      setNameError("Name cannot be empty")
      isValid = false
    }

    // Email validation
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address")
      isValid = false
    }

    // Password validation
    if (!validatePassword(password)) {
      setPasswordError(
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      )
      isValid = false
    }

    // Confirm password validation
    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match")
      isValid = false
    }

    // Phone validation
    if (!validatePhone(phone)) {
      setPhoneError("Phone number must contain at least 10 digits or use +1XXXXXXXXXX format")
      isValid = false
    }

    // Organization name validation (only if account type is organization)
    if (accountType === "organization" && organizationName.trim() === "") {
      setOrganizationNameError("Organization name cannot be empty")
      isValid = false
    }

    return isValid
  }

  useEffect(() => {
    const registerUser = async () => {
      try {
        // For organization accounts, use organizationName as the org name
        const orgName = accountType === "organization" && organizationName ? organizationName : name
        const result = await register({ name: orgName, email, password, phone }).unwrap()
        // Handle the new registration response format
        if (result && result.requiresEmailVerification) {
          // Navigate to email verification required screen with email
          navigation.navigate("EmailVerificationRequired" as never, { email } as never)
        } else {
          setGeneralError("Registration successful! Please check your email for verification instructions.")
        }
      } catch (error: unknown) {
        // Extract specific error message from API response
        logger.error("Registration API Error:", error); // Log the actual error for debugging
        
        if (error?.data?.message) {
          // API returned a specific error message (e.g., "Org Email already taken")
          setGeneralError(error.data.message)
        } else if (error?.message) {
          // Fallback to error.message if data.message doesn't exist
          setGeneralError(error.message)
        } else {
          // Generic fallback if no specific message is available
          setGeneralError("Registration failed. Please try again.")
        }
      }
    }

    if (shouldRegister) {
      const isValid = validateInputs()
      if (isValid) {
        registerUser().finally(() => setShouldRegister(false)) // Call API if frontend validation passes
      } else {
        // If validation fails, scroll to the top to show field errors? (Optional)
        // scrollRef.current?.scrollTo({ y: 0, animated: true })
        setShouldRegister(false) // Don't attempt API call if validation fails
      }
    }
  }, [shouldRegister]) // Dependencies adjusted - removed state variables causing potential extra runs

  const handleRegister = () => {
    setGeneralError("") // Clear previous general errors before attempting registration
    setShouldRegister(true) // Trigger the useEffect hook
  }

  return (
    <Screen 
      testID="register-screen"
      accessibilityLabel="Register"
      preset="scroll"
      style={{ backgroundColor: colors.palette.biancaBackground, flex: 1 }}
      KeyboardAvoidingViewProps={Platform.OS === 'web' ? { enabled: false } : undefined}
      ScrollViewProps={{
        ref: scrollRef,
        contentContainerStyle: { padding: 20 },
        testID: "register-form",
        showsVerticalScrollIndicator: true,
        scrollEnabled: true,
        nestedScrollEnabled: true,
        ...(Platform.OS === 'web' && {
          style: {
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            height: '100vh',
            maxHeight: '100vh',
            flex: 1,
          } as any,
        }),
      }}
    >
        {/* Error message block MOVED FROM HERE */}

        <View style={styles.buttonContainer}>
          <Button
            testID="register-individual-toggle"
            accessibilityLabel={translate("registerScreen.individualButton") || "Individual"}
            tx="registerScreen.individualButton" // Make sure these tx keys exist in your i18n files
            onPress={() => setAccountType("individual")}
            style={accountType === "individual" ? styles.selectedButton : styles.button}
            preset={accountType === "individual" ? "filled" : "default"} // Example preset usage
          />
          <Button
            testID="register-organization-toggle"
            accessibilityLabel={translate("registerScreen.organizationButton") || "Organization"}
            tx="registerScreen.organizationButton" // Make sure these tx keys exist in your i18n files
            onPress={() => setAccountType("organization")}
            style={accountType === "organization" ? styles.selectedButton : styles.button}
            preset={accountType === "organization" ? "filled" : "default"} // Example preset usage
          />
        </View>

        <Text style={styles.explanationText}>
          {accountType === "individual"
            ? translate("registerScreen.individualExplanation")
            : translate("registerScreen.organizationExplanation")}
        </Text>

        {/* Form Fields */}
        {accountType === "organization" && (
          <View style={styles.fieldContainer}>
          <TextField
            testID="register-org-name"
            accessibilityLabel={translate("registerScreen.organizationNameFieldLabel") || "Organization name"}
            placeholderTx="registerScreen.organizationNameFieldPlaceholder"
            labelTx="registerScreen.organizationNameFieldLabel"
              value={organizationName}
              onChangeText={(text) => {
                setOrganizationName(text)
                clearFieldError("organizationName")
              }}
              status={organizationNameError ? "error" : undefined}
              helper={organizationNameError || undefined}
            />
          </View>
        )}

        <View style={styles.fieldContainer}>
          <TextField
            testID="register-name"
            accessibilityLabel={translate("registerScreen.nameFieldLabel") || "Name"}
            placeholderTx="registerScreen.nameFieldPlaceholder"
            labelTx="registerScreen.nameFieldLabel"
            value={name}
            onChangeText={(text) => {
              setName(text)
              clearFieldError("name")
            }}
            autoCapitalize="words"
            // Optionally add status prop for error styling
            status={nameError ? "error" : undefined}
            helper={nameError || undefined} // Display error message below field
          />
          {/* Keep field-specific errors close to the field */}
          {/* {nameError ? <Text style={styles.fieldErrorText}>{nameError}</Text> : null} */}
        </View>

        <View style={styles.fieldContainer}>
          <TextField
            testID="register-email"
            accessibilityLabel={translate("registerScreen.emailFieldLabel") || "Email"}
            placeholderTx="registerScreen.emailFieldPlaceholder"
            labelTx="registerScreen.emailFieldLabel"
            value={email}
            onChangeText={(text) => {
              setEmail(text)
              clearFieldError("email")
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={true}
            status={emailError ? "error" : undefined}
            helper={emailError || undefined}
          />
          {/* {emailError ? <Text style={styles.fieldErrorText}>{emailError}</Text> : null} */}
        </View>

        <View style={styles.fieldContainer}>
          <PhoneInputWeb
            testID="register-phone"
            accessibilityLabel={translate("registerScreen.phoneFieldLabel") || "Phone"}
            placeholderTx="registerScreen.phoneFieldPlaceholder"
            labelTx="registerScreen.phoneFieldLabel"
            value={phone}
            onChangeText={(text) => {
              setPhone(text)
              clearFieldError("phone")
            }}
            editable={true}
            disabled={false}
            status={phoneError ? "error" : undefined}
            helper={phoneError || undefined}
          />
          {/* {phoneError ? <Text style={styles.fieldErrorText}>{phoneError}</Text> : null} */}
        </View>

        <View style={styles.fieldContainer}>
          <PasswordField
            testID="register-password"
            accessibilityLabel={translate("registerScreen.passwordFieldLabel") || "Password"}
            placeholderTx="registerScreen.passwordFieldPlaceholder"
            labelTx="registerScreen.passwordFieldLabel"
            value={password}
            onChangeText={(text) => {
              setPassword(text)
              clearFieldError("password")
            }}
            status={passwordError ? "error" : undefined}
            helper={passwordError || undefined}
            validatePassword={validatePassword}
            showRules={true}
          />
        </View>

        <View style={styles.fieldContainer}>
          <PasswordField
            testID="register-confirm-password"
            accessibilityLabel={translate("registerScreen.confirmPasswordFieldLabel") || "Confirm password"}
            placeholderTx="registerScreen.confirmPasswordFieldPlaceholder"
            labelTx="registerScreen.confirmPasswordFieldLabel"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text)
              clearFieldError("confirmPassword")
            }}
            status={confirmPasswordError ? "error" : undefined}
            helper={confirmPasswordError || undefined}
            isConfirmField={true}
            comparePassword={password}
            showRules={false}
          />
        </View>



        {/* General Error / Success Message */}
        {generalError ? (
          <View style={generalError.includes("successful") ? styles.successContainer : styles.errorContainer}>
            <Text
              testID="general-error-message"
              style={generalError.includes("successful") ? styles.successText : styles.errorText}
            >
              {generalError}
            </Text>
          </View>
        ) : null}

        {/* Submit Button */}
        <Button
          testID="register-submit"
          accessibilityLabel={translate("registerScreen.title") || "Register"}
          onPress={handleRegister}
          disabled={isLoading}
          loading={isLoading}
          tx="registerScreen.title"
          preset="primary"
          style={styles.registerButton}
        />

        {/* Consent Notice */}
        <View style={styles.consentContainer}>
          <Text style={styles.consentText}>
            {translate("registerScreen.consentText")}{" "}
            <Text style={styles.consentLink} onPress={() => navigation.navigate("Terms" as never)}>
              {translate("registerScreen.termsOfService")}
            </Text>{" "}
            {translate("registerScreen.consentAnd")}{" "}
            <Text style={styles.consentLink} onPress={() => navigation.navigate("Privacy" as never)}>
              {translate("registerScreen.privacyPolicy")}
            </Text>
          </Text>
        </View>

        {/* Add extra space at the bottom to ensure scrollability */}
        <View style={{ height: 100 }} />
    </Screen>
  )
}

// Add your StyleSheet definitions here
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaButtonUnselected,
    borderRadius: 4,
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: colors.palette.biancaErrorBackground || "#fee2e2",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.palette.biancaError || "#dc2626",
    marginBottom: 20,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
  },
  errorText: {
    color: colors.palette.biancaError || "#dc2626",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "left",
    lineHeight: 20,
  },
  explanationText: {
    color: colors.palette.biancaExplanation,
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  fieldContainer: {
    marginBottom: 15,
  },
  fieldErrorText: {
    color: colors.palette.biancaError,
    fontSize: 12,
    marginTop: 4,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.palette.neutral100,
    borderBottomWidth: 1,
    borderColor: colors.palette.biancaBorder,
    paddingVertical: 20,
  },
  headerTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 20,
    fontWeight: "600",
  },
  registerButton: {
    marginTop: 10,
    width: "100%",
  },
  selectedButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  successContainer: {
    backgroundColor: colors.palette.biancaSuccessBackground || "#d1fae5",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.palette.biancaSuccess || "#10b981",
    marginBottom: 20,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
  },
  successText: {
    color: colors.palette.biancaSuccess || "#059669",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "left",
    lineHeight: 20,
  },
  consentContainer: {
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.palette.neutral200,
    borderRadius: 6,
  },
  consentText: {
    color: colors.palette.neutral700,
    fontSize: 14,
    textAlign: "center",
  },
  consentLink: {
    color: colors.palette.biancaButtonSelected,
    textDecorationLine: "underline",
  },
})