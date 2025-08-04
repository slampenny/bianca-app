import React, { useState, useEffect, useLayoutEffect } from "react"
import { StyleSheet, View, ScrollView, Alert } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { useRoute } from "@react-navigation/native"
import { useRegisterWithInviteMutation } from "../services/api/authApi"
import { Button, Text, TextField } from "app/components"
import { LegalLinks } from "app/components/LegalLinks"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { colors, spacing } from "app/theme"

type SignupScreenRouteProp = StackScreenProps<LoginStackParamList, "Signup">

export const SignupScreen = (props: SignupScreenRouteProp) => {
  const { navigation } = props
  const route = useRoute()
  const token = (route.params as any)?.token

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      header: () => (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Complete Your Invitation</Text>
        </View>
      ),
    })
  }, [navigation])

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

  // Check if we have an invite token
  useEffect(() => {
    if (!token) {
      Alert.alert(
        "Invalid Invitation",
        "This invitation link is invalid or has expired. Please contact your organization administrator.",
        [{ text: "OK", onPress: () => navigation.navigate("Login") }]
      )
      return
    }

    // TODO: Decode token to prefill user information
    // For now, we'll let the backend handle token validation
    console.log("Signup with invite token:", token)
  }, [token, navigation])

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
        // The backend will get name, email, phone from the token
      }).unwrap()

      console.log("Signup successful:", result)
      
      // Navigate to main app since user is now registered and logged in
      navigation.navigate("MainTabs" as any)
      
    } catch (error: any) {
      console.error("Signup error:", error)
      
      if (error?.data?.message) {
        setGeneralError(error.data.message)
      } else if (error?.message) {
        setGeneralError(error.message)
      } else {
        setGeneralError("An error occurred during signup. Please try again.")
      }
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to My Phone Friend!</Text>
        <Text style={styles.subtitle}>
          You've been invited to join your organization's account. 
          Complete your registration below.
        </Text>

        {generalError ? (
          <Text style={styles.errorText}>{generalError}</Text>
        ) : null}

        <View style={styles.form}>
          <TextField
            value={password}
            onChangeText={(text) => {
              setPassword(text)
              setPasswordError("")
            }}
            label="Password"
            placeholder="Enter your password"
            secureTextEntry
            status={passwordError ? "error" : undefined}
            helper={passwordError}
            style={styles.textField}
          />

          <TextField
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text)
              setConfirmPasswordError("")
            }}
            label="Confirm Password"
            placeholder="Confirm your password"
            secureTextEntry
            status={confirmPasswordError ? "error" : undefined}
            helper={confirmPasswordError}
            style={styles.textField}
          />

          <Button
            text="Complete Registration"
            onPress={handleSignup}
            disabled={isLoading || !password || !confirmPassword}
            style={styles.signupButton}
          />

          <Text style={styles.infoText}>
            Your name, email, and organization details have been pre-configured by your administrator.
          </Text>
        </View>

        <LegalLinks />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  header: {
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textDim,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  form: {
    flex: 1,
  },
  textField: {
    marginBottom: spacing.md,
  },
  signupButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  infoText: {
    fontSize: 14,
    color: colors.textDim,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: spacing.md,
    lineHeight: 20,
  },
})