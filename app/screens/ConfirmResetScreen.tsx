import React, { useState, useEffect } from "react"
import { View, ViewStyle, Alert } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { useRoute } from "@react-navigation/native"
import { useResetPasswordMutation } from "../services/api/authApi"
import { Button, Text, TextField, Screen, Header } from "app/components"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { spacing } from "app/theme"

type ConfirmResetScreenRouteProp = StackScreenProps<LoginStackParamList, "ConfirmReset">

export const ConfirmResetScreen = (props: ConfirmResetScreenRouteProp) => {
  const { navigation } = props
  const route = useRoute()
  const token = (route.params as any)?.token



  const [resetPassword, { isLoading }] = useResetPasswordMutation()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")
  const [generalError, setGeneralError] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)

  // Check if we have a reset token
  useEffect(() => {
    if (!token) {
      Alert.alert(
        "Invalid Reset Link",
        "This password reset link is invalid or has expired. Please request a new password reset.",
        [{ text: "OK", onPress: () => navigation.navigate("RequestReset") }]
      )
      return
    }

    console.log("Password reset with token:", token)
  }, [token, navigation])

  const validateForm = () => {
    let isValid = true
    
    // Reset errors
    setPasswordError("")
    setConfirmPasswordError("")
    setGeneralError("")

    // Validate password
    if (!newPassword) {
      setPasswordError("Password is required")
      isValid = false
    } else if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      isValid = false
    }

    // Validate confirm password
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password")
      isValid = false
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match")
      isValid = false
    }

    return isValid
  }

  const handleConfirmReset = async () => {
    if (!validateForm()) return
    if (!token) return

    try {
      await resetPassword({ token, password: newPassword }).unwrap()
      
      setIsSuccess(true)
      
      // Show success and redirect to login after 2 seconds
      setTimeout(() => {
        navigation.navigate("Login")
      }, 2000)
      
    } catch (error: any) {
      console.error("Password reset error:", error)
      
      if (error?.data?.message) {
        setGeneralError(error.data.message)
      } else if (error?.message) {
        setGeneralError(error.message)
      } else {
        setGeneralError("Password reset failed. Please try again or request a new reset link.")
      }
    }
  }

  if (isSuccess) {
    return (
      <Screen 
        preset="fixed" 
        style={$container}
        contentContainerStyle={$contentContainer}
      >
        <View style={$successContainer}>
          <Text style={$successIcon}>✓</Text>
          
          <Text 
            preset="heading" 
            text="Password Reset Successful!" 
            style={$successTitle}
          />
          
          <Text 
            preset="default"
            text="Your password has been updated successfully. You can now log in with your new password."
            style={$successMessage}
          />
          
          <Text 
            size="sm"
            text="Redirecting to login..."
            style={$redirectText}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen 
      preset="auto" 
      contentContainerStyle={$screenContentContainer}
      safeAreaEdges={["top"]}
    >
      <Header 
        title="Reset Your Password"
        leftIcon="back"
        onLeftPress={() => navigation.goBack()}
      />
      
      <View style={$content}>
        <Text 
          preset="heading" 
          text="Reset Your Password" 
          style={$title}
        />
        
        <Text 
          preset="default"
          text="Enter your new password below. Make sure it's secure and easy for you to remember."
          style={$subtitle}
        />

        {generalError ? (
          <Text 
            text={generalError}
            style={$errorText}
          />
        ) : null}

        <View style={$form}>
          <TextField
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text)
              setPasswordError("")
            }}
            label="New Password"
            placeholder="Enter your new password"
            secureTextEntry
            status={passwordError ? "error" : undefined}
            helper={passwordError}
            containerStyle={$textField}
          />

          <TextField
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text)
              setConfirmPasswordError("")
            }}
            label="Confirm New Password"
            placeholder="Confirm your new password"
            secureTextEntry
            status={confirmPasswordError ? "error" : undefined}
            helper={confirmPasswordError}
            containerStyle={$textField}
          />

          <Button
            text={isLoading ? "Resetting Password..." : "Reset Password"}
            onPress={handleConfirmReset}
            disabled={isLoading || !newPassword || !confirmPassword}
            style={$resetButton}
          />

          <Button
            text="Back to Login"
            onPress={() => navigation.navigate("Login")}
            preset="secondary"
            style={$backButton}
          />
        </View>
      </View>
    </Screen>
  )
}

const $container: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: spacing.lg,
}

const $contentContainer: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
}

const $screenContentContainer: ViewStyle = {
  flexGrow: 1,
}

const $content: ViewStyle = {
  flex: 1,
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.md,
  paddingBottom: spacing.lg,
}

const $title = {
  textAlign: "center" as const,
  marginBottom: spacing.sm,
}

const $subtitle = {
  textAlign: "center" as const,
  marginBottom: spacing.xl,
  lineHeight: 24,
}

const $form: ViewStyle = {
  flex: 1,
}

const $textField: ViewStyle = {
  marginBottom: spacing.md,
}

const $resetButton: ViewStyle = {
  marginTop: spacing.lg,
  marginBottom: spacing.md,
}

const $backButton: ViewStyle = {
  marginTop: spacing.sm,
}

const $errorText = {
  textAlign: "center" as const,
  marginBottom: spacing.md,
  paddingHorizontal: spacing.sm,
}

const $successContainer: ViewStyle = {
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
  maxWidth: 320,
  width: "100%",
}

const $successIcon = {
  fontSize: 60,
  marginBottom: spacing.md,
}

const $successTitle = {
  textAlign: "center" as const,
  marginBottom: spacing.sm,
}

const $successMessage = {
  textAlign: "center" as const,
  lineHeight: 24,
  marginBottom: spacing.lg,
}

const $redirectText = {
  textAlign: "center" as const,
  fontStyle: "italic" as const,
}
