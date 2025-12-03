import React, { useState, useEffect, useRef, useMemo } from "react"
import { View, ViewStyle, StyleSheet, Linking } from "react-native"
import { useToast } from "../hooks/useToast"
import Toast from "../components/Toast"
import { StackScreenProps } from "@react-navigation/stack"
import { useRoute, useNavigation } from "@react-navigation/native"
import { useResetPasswordMutation } from "../services/api/authApi"
import { Button, Text, TextField, PasswordField, Screen, Header } from "app/components"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { spacing } from "app/theme"
import { translate } from "../i18n"
import { useTheme } from "app/theme/ThemeContext"
import { logger } from "../utils/logger"
import { TIMEOUTS } from "../constants"
import type { ErrorResponse } from "../types"

// Module-level log to confirm this file is loaded
console.log('🔵 ConfirmResetScreen module loaded - v2.1 - Build: 2025-11-15-08:30')

// Default fallback styles
const defaultStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
  },
  screenContentContainer: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  title: {
    color: "#000000",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: spacing.md,
  },
  subtitle: {
    color: "#666666",
    fontSize: 16,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  errorText: {
    color: "#FF0000",
    fontSize: 14,
    textAlign: "center",
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: "#FFE5E5",
    borderRadius: 4,
  },
  form: {
    marginTop: spacing.lg,
  },
  textField: {
    marginBottom: spacing.md,
  },
  resetButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  backButton: {
    marginTop: spacing.sm,
  },
  message: {
    color: "#666666",
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

const createStyles = (colors: any) => {
  // useTheme() always returns colors, but add safety check just in case
  // Use optional chaining to safely access colors.palette
  if (!colors || !colors?.palette) {
    return defaultStyles
  }

  // Safely extract palette with fallbacks
  const palette = colors?.palette || {}
  
  return StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: palette.neutral100 || defaultStyles.container.backgroundColor,
        padding: spacing.lg,
      },
      screenContentContainer: {
        flexGrow: 1,
        padding: spacing.lg,
      },
      content: {
        flex: 1,
        padding: spacing.md,
      },
      title: {
        color: palette.neutral800 || defaultStyles.title.color,
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: spacing.md,
      },
      subtitle: {
        color: palette.neutral600 || defaultStyles.subtitle.color,
        fontSize: 16,
        textAlign: "center",
        marginBottom: spacing.xl,
        lineHeight: 24,
      },
      errorText: {
        color: palette.angry500 || defaultStyles.errorText.color,
        fontSize: 14,
        textAlign: "center",
        marginBottom: spacing.md,
        padding: spacing.sm,
        backgroundColor: palette.angry100 || defaultStyles.errorText.backgroundColor,
        borderRadius: 4,
      },
      form: {
        marginTop: spacing.lg,
      },
      textField: {
        marginBottom: spacing.md,
      },
      resetButton: {
        marginTop: spacing.lg,
        marginBottom: spacing.md,
      },
      backButton: {
        marginTop: spacing.sm,
      },
      message: {
        color: palette.neutral600 || defaultStyles.message.color,
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
}

type ConfirmResetScreenRouteProp = StackScreenProps<LoginStackParamList, "ConfirmReset">

export const ConfirmResetScreen = (props: ConfirmResetScreenRouteProp) => {
  console.log('🟢 ConfirmResetScreen component rendering...')
  
  const { navigation } = props
  const route = useRoute()
  const nav = useNavigation()
  
  console.log('🟡 About to call useTheme()...')
  const themeResult = useTheme()
  console.log('🟡 useTheme() returned:', { 
    hasColors: !!themeResult?.colors, 
    isLoading: themeResult?.isLoading,
    keys: themeResult ? Object.keys(themeResult).slice(0, 5) : 'undefined'
  })
  
  const { colors, isLoading: themeLoading } = themeResult || { colors: undefined, isLoading: true }
  const { toast, showError, hideToast } = useToast()
  
  // Extract token from route params or URL query string (for web compatibility)
  const [token, setToken] = useState<string | undefined>((route.params as any)?.token)
  
  // IMPORTANT: All hooks must be called before any early returns to avoid React Hooks violations
  // Extract token from URL on web (React Navigation might not parse query params automatically)
  useEffect(() => {
    const extractTokenFromUrl = async () => {
      // If we already have a token from route params, use it
      if (token) {
        return
      }

      try {
        // On web: Check window.location for query parameters
        if (typeof window !== 'undefined' && window.location) {
          const urlParams = new URLSearchParams(window.location.search)
          const urlToken = urlParams.get('token')
          if (urlToken) {
            setToken(urlToken)
            nav.setParams({ token: urlToken } as any)
            return
          }
        }

        // On mobile: Check Linking for deep link URL
        const initialUrl = await Linking.getInitialURL()
        if (initialUrl) {
          try {
            const urlObj = new URL(initialUrl)
            const urlToken = urlObj.searchParams.get('token')
            if (urlToken) {
              setToken(urlToken)
              nav.setParams({ token: urlToken } as any)
              return
            }
          } catch (e) {
            // URL parsing failed, try regex as fallback
            const tokenMatch = initialUrl.match(/[?&]token=([^&]+)/)
            if (tokenMatch && tokenMatch[1]) {
              const decodedToken = decodeURIComponent(tokenMatch[1])
              setToken(decodedToken)
              nav.setParams({ token: decodedToken } as any)
              return
            }
          }
        }

        // Also listen for URL changes (in case link is opened while app is running)
        const subscription = Linking.addEventListener('url', (event) => {
          try {
            const urlObj = new URL(event.url)
            const urlToken = urlObj.searchParams.get('token')
            if (urlToken && !token) {
              setToken(urlToken)
              nav.setParams({ token: urlToken } as any)
            }
          } catch (e) {
            // Try regex fallback
            const tokenMatch = event.url.match(/[?&]token=([^&]+)/)
            if (tokenMatch && tokenMatch[1] && !token) {
              const decodedToken = decodeURIComponent(tokenMatch[1])
              setToken(decodedToken)
              nav.setParams({ token: decodedToken } as any)
            }
          }
        })

        return () => subscription.remove()
      } catch (error) {
        logger.error("Error extracting token from URL:", error)
      }
    }

    extractTokenFromUrl()
  }, [token, nav])

  const [resetPassword, { isLoading }] = useResetPasswordMutation()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")
  const [generalError, setGeneralError] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check if we have a reset token
  useEffect(() => {
    if (!token) {
      showError("This password reset link is invalid or has expired. Please request a new password reset.")
      timeoutRef.current = setTimeout(() => navigation.navigate("RequestReset" as never), TIMEOUTS.PASSWORD_RESET_REDIRECT)
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    }

    logger.debug("Password reset with token:", token)
    
    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [token, navigation])
  
  // Early return if theme is still loading OR colors is not available
  // This prevents child components (Screen, Header, Text) from accessing undefined colors
  // IMPORTANT: This must be AFTER all hooks are called
  if (themeLoading || !colors) {
    console.log('⏳ Waiting for theme... themeLoading:', themeLoading, 'colors:', !!colors)
    return null
  }
  
  console.log('🟢 Theme ready, creating styles...')

  // Create styles - useTheme() always returns colors, but double-check just in case
  const styles = createStyles(colors)

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
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Show success and redirect to login after 2 seconds
      timeoutRef.current = setTimeout(() => {
        navigation.navigate("Login")
        timeoutRef.current = null
      }, TIMEOUTS.PASSWORD_RESET_REDIRECT)
      
    } catch (error: unknown) {
      logger.error("Password reset error:", error)
      
      // RTK Query errors have a specific structure
      const errorResponse = error as { data?: { message?: string }; message?: string }
      if (errorResponse?.data?.message) {
        setGeneralError(errorResponse.data.message)
      } else if (errorResponse?.message) {
        setGeneralError(errorResponse.message)
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
      contentContainerStyle={styles.screenContentContainer}
      safeAreaEdges={["top"]}
    >
      <Header 
        title={translate("confirmResetScreen.title")}
        leftIcon="back"
        onLeftPress={() => navigation.goBack()}
      />
      
      <View style={styles.content}>
        <Text 
          preset="heading" 
          text={translate("confirmResetScreen.title")} 
          style={styles.title}
        />
        
        <Text 
          preset="default"
          text={translate("confirmResetScreen.subtitle")}
          style={styles.subtitle}
        />

        {generalError ? (
          <Text 
            text={generalError}
            style={styles.errorText}
          />
        ) : null}

        <View style={styles.form}>
          <PasswordField
            testID="new-password-input"
            accessibilityLabel={translate("confirmResetScreen.newPasswordLabel") || "New password"}
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text)
              setPasswordError("")
            }}
            label={translate("confirmResetScreen.newPasswordLabel")}
            placeholder={translate("confirmResetScreen.newPasswordPlaceholder")}
            status={passwordError ? "error" : undefined}
            helper={passwordError}
            containerStyle={styles.textField}
            showRules={true}
          />

          <PasswordField
            testID="confirm-password-input"
            accessibilityLabel={translate("confirmResetScreen.confirmPasswordLabel") || "Confirm password"}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text)
              setConfirmPasswordError("")
            }}
            label={translate("confirmResetScreen.confirmPasswordLabel")}
            placeholder={translate("confirmResetScreen.confirmPasswordPlaceholder")}
            status={confirmPasswordError ? "error" : undefined}
            helper={confirmPasswordError}
            containerStyle={styles.textField}
            isConfirmField={true}
            comparePassword={newPassword}
            showRules={false}
          />

          <Button
            testID="reset-password-submit"
            accessibilityLabel="Reset password"
            text="Reset Password"
            onPress={handleConfirmReset}
            disabled={isLoading || !newPassword || !confirmPassword}
            loading={isLoading}
            style={styles.resetButton}
          />

          <Button
            text="Back to Login"
            onPress={() => navigation.navigate("Login")}
            preset="default"
            style={styles.backButton}
          />
        </View>
      </View>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        testID="confirm-reset-toast"
      />
    </Screen>
  )
}

