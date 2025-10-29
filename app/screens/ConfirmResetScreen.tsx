import React, { useState, useEffect } from "react"
import { View, ViewStyle, Alert, StyleSheet } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { useRoute } from "@react-navigation/native"
import { useResetPasswordMutation } from "../services/api/authApi"
import { Button, Text, TextField, Screen, Header } from "app/components"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { spacing } from "app/theme"
import { translate } from "../i18n"
import { useTheme } from "app/theme/ThemeContext"

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.neutral100,
    padding: spacing.lg,
  },
  title: {
    color: colors.palette.neutral800,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: spacing.md,
  },
  message: {
    color: colors.palette.neutral600,
    fontSize: 16,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  formContainer: {
    marginBottom: spacing.lg,
  },
  buttonContainer: {
    marginTop: spacing.lg,
  },
})

type ConfirmResetScreenRouteProp = StackScreenProps<LoginStackParamList, "ConfirmReset">

export const ConfirmResetScreen = (props: ConfirmResetScreenRouteProp) => {
  const { navigation } = props
  const route = useRoute()
  const token = (route.params as any)?.token
  const { colors, isLoading: themeLoading } = useTheme()

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

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
        style={styles.container}
        contentContainerStyle={styles.container}
      >
        <View style={styles.container}>
          <Text style={styles.title}>✓</Text>
          
          <Text 
            preset="heading" 
            text="Password Reset Successful!" 
            style={styles.title}
          />
          
          <Text 
            preset="default"
            text="Your password has been updated successfully. You can now log in with your new password."
            style={styles.message}
          />
          
          <Text 
            size="sm"
            text="Redirecting to login..."
            style={styles.message}
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
        title={translate("confirmResetScreen.title")}
        leftIcon="back"
        onLeftPress={() => navigation.goBack()}
      />
      
      <View style={$content}>
        <Text 
          preset="heading" 
          text={translate("confirmResetScreen.title")} 
          style={$title}
        />
        
        <Text 
          preset="default"
          text={translate("confirmResetScreen.subtitle")}
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
            label={translate("confirmResetScreen.newPasswordLabel")}
            placeholder={translate("confirmResetScreen.newPasswordPlaceholder")}
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
            label={translate("confirmResetScreen.confirmPasswordLabel")}
            placeholder={translate("confirmResetScreen.confirmPasswordPlaceholder")}
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
            preset="default"
            style={$backButton}
          />
        </View>
      </View>
    </Screen>
  )
}

