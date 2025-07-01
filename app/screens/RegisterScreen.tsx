import React, { useState, useEffect, useLayoutEffect, useRef } from "react"
import { StyleSheet, View, Pressable, Platform, Dimensions } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { useRegisterMutation } from "../services/api/authApi"
import { Button, Text, TextField } from "app/components"
import { LoginStackParamList } from "app/navigators/navigationTypes"

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
        backgroundColor: "#ecf0f1",
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

        {/* Go Back Link */}
        <Pressable testID="register-go-back" style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkButtonText} tx="registerScreen.goBack" />
        </Pressable>

        {/* Add extra space at the bottom to ensure scrollability */}
        <div style={{ height: "100px" }}></div>
      </div>
    </div>
  )
}

// Add your StyleSheet definitions here
const styles = StyleSheet.create({
  button: {
    // from original code
    alignItems: "center",
    backgroundColor: "lightgray",
    borderRadius: 4,
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 10,
  },
  buttonContainer: {
    // from original code
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  errorText: {
    // from original code
    width: "100%", // Make the container span the width
    textAlign: "center", // Center the text within the container
    fontSize: 16, // Slightly larger font size
    fontWeight: "500", // Medium weight to make it stand out
    color: "#cc0000", // Keep dark red color
    backgroundColor: "rgba(255, 0, 0, 0.08)", // Subtle background tint
    paddingVertical: 10, // Vertical padding
    paddingHorizontal: 12, // Horizontal padding
    marginBottom: 15, // Space above the element below (submit button)
    borderRadius: 6, // Slightly more rounded corners
  },
  explanationText: {
    // from original code
    color: "gray",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  fieldContainer: {
    // from original code
    marginBottom: 15, // Increased spacing between fields slightly
  },
  fieldErrorText: { // This might be redundant if using TextField's helper/status prop
    // from original code
    color: "red",
    fontSize: 12,
    // marginBottom: 8, // Handled by TextField helper prop margin
    marginTop: 4,
  },
  header: {
    // from original code
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 20,
  },
  headerTitle: {
    // from original code
    color: "#2c3e50",
    fontSize: 20,
    fontWeight: "600",
  },
  linkButton: {
    // from original code
    marginBottom: 40,
    marginTop: 15,
  },
  linkButtonText: {
    // from original code
    color: "#3498db",
    fontSize: 16,
    textAlign: "center",
  },
  registerButton: {
    // from original code - You might adjust this if using presets heavily
    // alignItems: "center", // Handled by base preset
    // backgroundColor: "#3498db", // Handled by 'filled' preset (example)
    // borderRadius: 4, // Handled by base preset
    marginTop: 10, // Keep or adjust as needed
    // paddingVertical: 12, // Handled by base preset
    width: "100%",
  },
  selectedButton: {
    // from original code - Using presets might make this less necessary,
    // or you might apply specific styles here not covered by presets.
    // Example: Add extra visual cue beyond background color if needed.
    // alignItems: "center", // Handled by base preset
    // backgroundColor: "#3498db", // Handled by 'filled' preset (example)
    // borderRadius: 4, // Handled by base preset
    flex: 1,
    marginHorizontal: 5,
    // paddingVertical: 10, // Handled by base preset
    // Add specific selected styles if needed, e.g., border
    // borderWidth: 2,
    // borderColor: 'blue',
  },
  successText: {
    // from original code
    width: "100%", // Make the container span the width
    textAlign: "center", // Center the text within the container
    fontSize: 16, // Slightly larger font size
    fontWeight: "500", // Medium weight to make it stand out
    color: "#006400", // Keep dark green color
    backgroundColor: "rgba(0, 200, 0, 0.1)", // Subtle background tint
    paddingVertical: 10, // Vertical padding
    paddingHorizontal: 12, // Horizontal padding
    marginBottom: 15, // Space above the element below (submit button)
    borderRadius: 6, // Slightly more rounded corners
  },
})