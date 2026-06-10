import React, { useState, useEffect, useLayoutEffect, useRef, createElement } from "react"
import { StyleSheet, View, ScrollView, Platform } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { useRegisterMutation } from "../services/api/authApi"
import { Button, Text, TextField, PasswordField, PhoneInputWeb, CountryPicker, AuthScreenLayout } from "app/components"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import type { ThemeColors } from "../types"
import { logger } from "../utils/logger"

// Stable wrapper so it isn't recreated each render (which was remounting inputs and breaking keyboard input)
function RegisterFormWrapper({
  children,
  onSubmit,
}: {
  children: React.ReactNode
  onSubmit: () => void
}) {
  if (Platform.OS === "web") {
    return createElement("form", {
      onSubmit: (e: React.FormEvent) => {
        e.preventDefault()
        onSubmit()
      },
      style: { flex: 1, display: "flex", flexDirection: "column" },
    }, children)
  }
  return <View style={{ flex: 1 }}>{children}</View>
}

export const RegisterScreen = (props: StackScreenProps<LoginStackParamList, "Register">) => {
  const { navigation, route } = props
  const scrollRef = useRef<ScrollView>(null)
  const { colors, isLoading: themeLoading } = useTheme()
  const fromOnboarding = !!(route.params?.persona)
  const onboardingPersona = route.params?.persona
  const onboardingOrgName = route.params?.orgName
  const onboardingOrgCountry = route.params?.orgCountry
  const onboardingOrgTimezone = route.params?.orgTimezone

  // Don't return null - render a loading state instead to prevent navigation issues
  if (themeLoading) {
    return (
      <AuthScreenLayout testID="register-screen" accessibilityLabel="Register">
        <Text>{translate("common.loading")}</Text>
      </AuthScreenLayout>
    )
  }

  const styles = createStyles(colors)

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    })
  }, [navigation])

  const [register, { isLoading }] = useRegisterMutation()

  // Form state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [organizationName, setOrganizationName] = useState(onboardingOrgName ?? "")
  const [country, setCountry] = useState<string>(onboardingOrgCountry ?? "CA")
  const [accountType, setAccountType] = useState<"individual" | "organization">(
    onboardingPersona === "organization" ? "organization" : "individual"
  )

  // Field-specific error messages
  const [nameError, setNameError] = useState("")
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [organizationNameError, setOrganizationNameError] = useState("")
  const [generalError, setGeneralError] = useState("")

  const [shouldRegister, setShouldRegister] = useState(false)

  // Sync from onboarding params when navigating to Register with params
  useEffect(() => {
    if (route.params?.persona) {
      setAccountType(route.params.persona === "organization" ? "organization" : "individual")
    }
    if (route.params?.orgName != null) setOrganizationName(route.params.orgName)
    if (route.params?.orgCountry != null) setCountry(route.params.orgCountry)
  }, [route.params?.persona, route.params?.orgName, route.params?.orgCountry])

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
  // Backend requires: at least 8 characters, at least 1 letter, and at least 1 number
  const validatePassword = (password: string) =>
    /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(password)
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
        "Password must be at least 8 characters and contain at least one letter and one number",
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
        const result = await register({ name: orgName, email, password, phone, ...(country ? { country } as { country?: string } : {}) } as Parameters<typeof register>[0]).unwrap()
        // Handle the new registration response format
        if (result && result.requiresEmailVerification) {
          // Navigate to email verification required screen with email
          (navigation.navigate as (name: string, params?: object) => void)("EmailVerificationRequired", { email })
        } else {
          setGeneralError("Registration successful! Please check your email for verification instructions.")
        }
      } catch (error: unknown) {
        const err = error as { data?: { message?: string }; message?: string }
        logger.error("Registration API Error:", error)
        if (err?.data?.message) {
          setGeneralError(err.data.message)
        } else if (err?.message) {
          setGeneralError(err.message)
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
    <AuthScreenLayout
      testID="register-screen"
      accessibilityLabel="Register"
      contentContainerStyle={{ justifyContent: "flex-start", paddingVertical: 24 }}
    >
        <RegisterFormWrapper onSubmit={handleRegister}>
        <View testID="register-form">
        <Text style={styles.screenTitle} tx="registerScreen.title" />

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

        {/* Country Section - shown for both individual and organization */}
        <CountryPicker
          value={country}
          onValueChange={setCountry}
          labelTx="registerScreen.countryFieldLabel"
          containerStyle={styles.fieldContainer}
        />

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

        <View style={{ height: 24 }} />
        </View>
        </RegisterFormWrapper>
    </AuthScreenLayout>
  )
}

// Add your StyleSheet definitions here
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaButtonUnselected,
    borderRadius: 12,
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
  screenTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  selectedButton: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 12,
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