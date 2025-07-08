import React, { useState, useEffect, useLayoutEffect, useRef } from "react"
import { StyleSheet, View, Pressable, Platform, Dimensions, Linking } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { useRegisterMutation } from "../services/api/authApi"
import { Button, Text, TextField } from "app/components"
import { LegalLinks } from "app/components/LegalLinks"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { colors } from "app/theme/colors"

export const RegisterScreen = (props: StackScreenProps<LoginStackParamList, "Register">) => {
  const { navigation } = props
  const scrollRef = useRef(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      header: () => (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Register</Text>
        </View>
      ),
    })
  }, [navigation])

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
  const validatePhone = (phone: string) => /^\d{10,}$/.test(phone)

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
      setPhoneError("Phone number must contain at least 10 digits")
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
        const result = await register({ name, email, password, phone }).unwrap()
        // Assuming 'result' indicates success. Adjust if your API returns differently.
        if (result) {
          setGeneralError("Registration successful!") // Set success message
          // IMPORTANT: Navigation should happen AFTER setting state or be handled elsewhere
          // For example, navigation could be triggered by this success state in another useEffect or saga
          // navigation.navigate("Home"); // Example: Navigate on success
        }
      } catch (error) {
        // Handle specific errors if possible, otherwise show generic message
        console.error("Registration API Error:", error); // Log the actual error for debugging
        // You could inspect 'error' here to show more specific messages
        // e.g., if (error.status === 409) setGeneralError("Email already exists.")
        setGeneralError("Registration Failed. Please try again.") // Set failure message
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

  // Pure HTML approach for React Native Web
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
      ref={scrollRef}
    >
      <div style={{ padding: "20px" }}>
        {/* Error message block MOVED FROM HERE */}

        <View style={styles.buttonContainer}>
          <Button
            testID="register-individual-toggle"
            tx="registerScreen.individualButton" // Make sure these tx keys exist in your i18n files
            onPress={() => setAccountType("individual")}
            style={accountType === "individual" ? styles.selectedButton : styles.button}
            preset={accountType === "individual" ? "filled" : "default"} // Example preset usage
          />
          <Button
            testID="register-organization-toggle"
            tx="registerScreen.organizationButton" // Make sure these tx keys exist in your i18n files
            onPress={() => setAccountType("organization")}
            style={accountType === "organization" ? styles.selectedButton : styles.button}
            preset={accountType === "organization" ? "filled" : "default"} // Example preset usage
          />
        </View>

        <Text style={styles.explanationText}>
          {accountType === "individual"
            ? "Register as an individual for personal use."
            : "Register as an organization for company or group use."}
        </Text>

        {/* Form Fields */}
        <View style={styles.fieldContainer}>
          <TextField
            testID="register-name"
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
            placeholderTx="registerScreen.emailFieldPlaceholder"
            labelTx="registerScreen.emailFieldLabel"
            value={email}
            onChangeText={(text) => {
              setEmail(text)
              clearFieldError("email")
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            status={emailError ? "error" : undefined}
            helper={emailError || undefined}
          />
          {/* {emailError ? <Text style={styles.fieldErrorText}>{emailError}</Text> : null} */}
        </View>

        <View style={styles.fieldContainer}>
          <TextField
            testID="register-password"
            placeholderTx="registerScreen.passwordFieldPlaceholder"
            labelTx="registerScreen.passwordFieldLabel"
            secureTextEntry
            value={password}
            onChangeText={(text) => {
              setPassword(text)
              clearFieldError("password")
            }}
            status={passwordError ? "error" : undefined}
            helper={passwordError || undefined}
          />
          {/* {passwordError ? <Text style={styles.fieldErrorText}>{passwordError}</Text> : null} */}
        </View>

        <View style={styles.fieldContainer}>
          <TextField
            testID="register-confirm-password"
            placeholderTx="registerScreen.confirmPasswordFieldPlaceholder"
            labelTx="registerScreen.confirmPasswordFieldLabel"
            secureTextEntry
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text)
              clearFieldError("confirmPassword")
            }}
            status={confirmPasswordError ? "error" : undefined}
            helper={confirmPasswordError || undefined}
          />
          {/* {confirmPasswordError ? (<Text style={styles.fieldErrorText}>{confirmPasswordError}</Text>) : null} */}
        </View>

        <View style={styles.fieldContainer}>
          <TextField
            testID="register-phone"
            placeholderTx="registerScreen.phoneFieldPlaceholder"
            labelTx="registerScreen.phoneFieldLabel"
            value={phone}
            onChangeText={(text) => {
              setPhone(text)
              clearFieldError("phone")
            }}
            keyboardType="phone-pad"
            status={phoneError ? "error" : undefined}
            helper={phoneError || undefined}
          />
          {/* {phoneError ? <Text style={styles.fieldErrorText}>{phoneError}</Text> : null} */}
        </View>

        {accountType === "organization" && (
          <View style={styles.fieldContainer}>
            <TextField
              testID="register-org-name"
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
            {/* {organizationNameError ? (<Text style={styles.fieldErrorText}>{organizationNameError}</Text>) : null} */}
          </View>
        )}

        {/* MOVED General Error / Success Message HERE */}
        {generalError ? (
          <Text
           testID="general-error-message" // Add testID for easier selection in tests
           style={generalError.includes("successful") ? styles.successText : styles.errorText}
          >
            {generalError}
          </Text>
        ) : null}

        {/* Submit Button */}
        <Button
          testID="register-submit"
          onPress={handleRegister}
          disabled={isLoading}
          tx="registerScreen.title" // Make sure this tx key exists
          style={styles.registerButton}
          preset="filled" // Example preset usage
        />

        {/* Consent Notice */}
        <View style={styles.consentContainer}>
          <Text style={styles.consentText}>
            By signing up, you agree to our{" "}
            <Text style={styles.consentLink} onPress={() => Linking.openURL("https://app.myphonefriend.com/terms")}>
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text style={styles.consentLink} onPress={() => Linking.openURL("https://app.myphonefriend.com/privacy")}>
              Privacy Policy
            </Text>
          </Text>
        </View>

        {/* Go Back Link */}
        <Pressable testID="register-go-back" style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkButtonText} tx="registerScreen.goBack" />
        </Pressable>

        {/* Legal Links */}
        <View style={styles.legalLinksContainer}>
          <LegalLinks style={styles.legalLinks} />
        </View>

        {/* Add extra space at the bottom to ensure scrollability */}
        <div style={{ height: "100px" }}></div>
      </div>
    </div>
  )
}

// Add your StyleSheet definitions here
const styles = StyleSheet.create({
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
  errorText: {
    backgroundColor: colors.palette.biancaErrorBackground,
    borderRadius: 6,
    color: colors.palette.biancaError,
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
    width: "100%",
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
  linkButton: {
    marginBottom: 40,
    marginTop: 15,
  },
  linkButtonText: {
    color: colors.palette.biancaButtonSelected,
    fontSize: 16,
    textAlign: "center",
  },
  registerButton: {
    marginTop: 10,
    width: "100%",
  },
  selectedButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  successText: {
    backgroundColor: colors.palette.biancaSuccessBackground,
    borderRadius: 6,
    color: colors.palette.biancaSuccess,
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
    width: "100%",
  },
  legalLinksContainer: {
    marginTop: 20,
    paddingBottom: 20,
  },
  legalLinks: {
    // Add any specific styles for LegalLinks if needed
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