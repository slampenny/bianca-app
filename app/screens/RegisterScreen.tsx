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
    setGeneralError("")
  }

  // Validation helpers
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const validatePassword = (password: string) =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)
  const validatePhone = (phone: string) => /^\d{10,}$/.test(phone)

  // Validate all inputs and set appropriate error messages
  const validateInputs = () => {
    let isValid = true

    // Reset all errors
    setNameError("")
    setEmailError("")
    setPasswordError("")
    setConfirmPasswordError("")
    setPhoneError("")
    setOrganizationNameError("")
    setGeneralError("")

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
        if (result) {
          setGeneralError("Registration successful!")
          // Could navigate to login/home here
        }
      } catch (error) {
        setGeneralError("Registration Failed. Please try again.")
      }
    }

    if (shouldRegister) {
      const isValid = validateInputs()
      if (isValid) {
        registerUser().finally(() => setShouldRegister(false))
      } else {
        setShouldRegister(false)
      }
    }
  }, [shouldRegister, name, email, password, phone, register])

  const handleRegister = () => {
    setShouldRegister(true)
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
        {generalError ? (
          <Text style={generalError.includes("successful") ? styles.successText : styles.errorText}>
            {generalError}
          </Text>
        ) : null}

        <View style={styles.buttonContainer}>
          <Button
            testID="register-individual-toggle"
            tx="registerScreen.individualButton"
            onPress={() => setAccountType("individual")}
            style={accountType === "individual" ? styles.selectedButton : styles.button}
          />
          <Button
            testID="register-organization-toggle"
            tx="registerScreen.organizationButton"
            onPress={() => setAccountType("organization")}
            style={accountType === "organization" ? styles.selectedButton : styles.button}
          />
        </View>

        <Text style={styles.explanationText}>
          {accountType === "individual"
            ? "Register as an individual for personal use."
            : "Register as an organization for company or group use."}
        </Text>

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
          />
          {nameError ? <Text style={styles.fieldErrorText}>{nameError}</Text> : null}
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
          />
          {emailError ? <Text style={styles.fieldErrorText}>{emailError}</Text> : null}
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
          />
          {passwordError ? <Text style={styles.fieldErrorText}>{passwordError}</Text> : null}
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
          />
          {confirmPasswordError ? (
            <Text style={styles.fieldErrorText}>{confirmPasswordError}</Text>
          ) : null}
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
          />
          {phoneError ? <Text style={styles.fieldErrorText}>{phoneError}</Text> : null}
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
            />
            {organizationNameError ? (
              <Text style={styles.fieldErrorText}>{organizationNameError}</Text>
            ) : null}
          </View>
        )}

        <Button
          testID="register-submit"
          onPress={handleRegister}
          disabled={isLoading}
          tx="registerScreen.title"
          style={styles.registerButton}
        />

        <Pressable testID="register-go-back" style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkButtonText} tx="registerScreen.goBack" />
        </Pressable>

        {/* Add extra space at the bottom to ensure scrollability */}
        <div style={{ height: "100px" }}></div>
      </div>
    </div>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "lightgray",
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
    backgroundColor: "rgba(255,0,0,0.05)",
    borderRadius: 4,
    color: "red",
    marginBottom: 20,
    padding: 10,
    textAlign: "center",
  },
  explanationText: {
    color: "gray",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  fieldContainer: {
    marginBottom: 10,
  },
  fieldErrorText: {
    color: "red",
    fontSize: 12,
    marginBottom: 8,
    marginTop: 2,
  },
  header: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 20,
  },
  headerTitle: {
    color: "#2c3e50",
    fontSize: 20,
    fontWeight: "600",
  },
  linkButton: {
    marginBottom: 40,
    marginTop: 15,
  },
  linkButtonText: {
    color: "#3498db",
    fontSize: 16,
    textAlign: "center",
  },
  registerButton: {
    alignItems: "center",
    backgroundColor: "#3498db",
    borderRadius: 4,
    marginTop: 10,
    paddingVertical: 12,
    width: "100%",
  },
  selectedButton: {
    alignItems: "center",
    backgroundColor: "#3498db",
    borderRadius: 4,
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 10,
  },
  successText: {
    backgroundColor: "rgba(0,255,0,0.05)",
    borderRadius: 4,
    color: "green",
    marginBottom: 20,
    padding: 10,
    textAlign: "center",
  },
})
