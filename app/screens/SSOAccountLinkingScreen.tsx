import React, { useState, useEffect, useRef } from "react"
import { View, ViewStyle, StyleSheet } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { Screen, Text, Button, TextField } from "app/components"
import { LoadingButton } from "app/components/LoadingButton"
import { spacing } from "app/theme"
import { useSetPasswordForSSOMutation, authApi } from "app/services/api/authApi"
import { useTheme } from "app/theme/ThemeContext"
import { SSOLoginButtons } from "app/components/SSOLoginButtons"
import { ssoService, SSOUser } from "app/services/ssoService"
import { useDispatch } from "react-redux"
import { setAuthEmail, setAuthTokens, setCurrentUser } from "app/store/authSlice"
import { setCaregiver } from "app/store/caregiverSlice"
import { setOrg } from "app/store/orgSlice"
import { translate } from "app/i18n"
import { logger } from "../utils/logger"

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.biancaBackground || colors.palette.neutral100,
    padding: spacing.lg,
    justifyContent: "center",
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
  },
  title: {
    color: colors.palette.neutral800 || colors.palette.biancaHeader,
    fontSize: 28,
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
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  successMessage: {
    color: colors.palette.success500 || colors.palette.biancaSuccess,
    fontSize: 16,
    textAlign: "center",
    marginBottom: spacing.lg,
    backgroundColor: colors.palette.biancaSuccessBackground || "#d1fae5",
    padding: spacing.md,
    borderRadius: 8,
  },
  errorContainer: {
    backgroundColor: colors.palette.biancaErrorBackground || "#fee2e2",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.palette.biancaError || "#dc2626",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  errorText: {
    color: colors.palette.biancaError || "#dc2626",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "left",
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.palette.neutral300,
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    color: colors.palette.neutral600,
    fontSize: 14,
  },
})

export const SSOAccountLinkingScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const dispatch = useDispatch()
  const [setPasswordForSSO, { isLoading: isSettingPassword }] = useSetPasswordForSSOMutation()
  const routeEmail = (route.params as any)?.email || ""
  const routeProvider = (route.params as any)?.ssoProvider || ""
  const [email] = useState(routeEmail)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordSet, setPasswordSet] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isSSOLoading, setIsSSOLoading] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])
  const { colors: themeColors, isLoading: themeLoading } = useTheme()

  if (themeLoading) {
    return null
  }

  const styles = createStyles(themeColors)

  const handleSetPassword = async () => {
    setErrorMessage("")
    setPasswordSet(false)

    if (!password.trim()) {
      setErrorMessage(translate("ssoLinkingScreen.errorNoPassword"))
      return
    }

    if (!confirmPassword.trim()) {
      setErrorMessage(translate("ssoLinkingScreen.errorNoConfirmPassword"))
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage(translate("ssoLinkingScreen.errorPasswordMismatch"))
      return
    }

    if (password.length < 8) {
      setErrorMessage(translate("ssoLinkingScreen.errorPasswordTooShort"))
      return
    }

    try {
      await setPasswordForSSO({ email, password, confirmPassword }).unwrap()
      setPasswordSet(true)
      setErrorMessage("")
      
      // After setting password, automatically log the user in
      // Use the password they just set
      try {
        const loginResult = await dispatch(authApi.endpoints.login.initiate({ 
          email, 
          password 
        })).unwrap()
        
        // Login successful - set tokens and user data
        dispatch(setAuthTokens(loginResult.tokens))
        dispatch(setAuthEmail(email))
        dispatch(setCurrentUser(loginResult.caregiver))
        dispatch(setCaregiver(loginResult.caregiver))
        
        if (loginResult.org) {
          dispatch(setOrg(loginResult.org))
        }
        
        // Navigation will happen automatically via AppNavigator when isLoggedIn becomes true
        // No need to manually navigate - the app will switch to AuthStack
      } catch (loginError) {
        // If auto-login fails, navigate back to login screen
        logger.error('Auto-login after password set failed:', loginError)
        
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        
        timeoutRef.current = setTimeout(() => {
          navigation.navigate("Login" as never)
          timeoutRef.current = null
        }, 2000)
      }
    } catch (error: unknown) {
      logger.error("Set password error:", error)
      const errorMsg = error?.data?.message || error?.message || translate("ssoLinkingScreen.errorSetPasswordFailed")
      setErrorMessage(errorMsg)
      setPasswordSet(false)
    }
  }

  const handleSSOSuccess = async (user: SSOUser & { tokens?: any; backendUser?: any; backendOrg?: any }) => {
    setIsSSOLoading(true)
    try {
      if (user.tokens && user.backendUser) {
        // SSO login successful - set tokens and user data
        dispatch(setAuthTokens(user.tokens))
        dispatch(setAuthEmail(user.email))
        dispatch(setCurrentUser(user.backendUser))
        dispatch(setCaregiver(user.backendUser))
        
        // Set org if included in response (orgSlice handles this)
        if (user.backendOrg) {
          dispatch(setOrg(user.backendOrg))
        }
        
        setErrorMessage("")
        
        // Navigation will happen automatically via AppNavigator when isLoggedIn becomes true
        // But for immediate feedback, we can wait a moment for state to propagate
        // The AppNavigator will detect the login state change and switch to AuthStack
      } else {
        setErrorMessage(translate("ssoLinkingScreen.errorSSOFailed"))
      }
    } catch (error) {
      logger.error('SSO login error:', error)
      setErrorMessage(translate("ssoLinkingScreen.errorSSOFailed"))
    } finally {
      setIsSSOLoading(false)
    }
  }

  const handleSSOError = (error: any) => {
    console.error('SSO error:', error)
    setErrorMessage(error?.description || error?.error || translate("ssoLinkingScreen.errorSSOFailed"))
  }

  const handleBackToLogin = () => {
    navigation.navigate("Login" as never)
  }

  const getProviderName = () => {
    if (routeProvider === "google") return translate("ssoLinkingScreen.providerGoogle")
    if (routeProvider === "microsoft") return translate("ssoLinkingScreen.providerMicrosoft")
    return translate("ssoLinkingScreen.providerSSO")
  }

  return (
    <Screen 
      preset="fixed" 
      style={styles.container}
      contentContainerStyle={styles.container}
      accessibilityLabel="sso-account-linking-screen"
      testID="sso-account-linking-screen"
    >
      <View style={styles.contentWrapper}>
        <Text preset="heading" tx="ssoLinkingScreen.title" style={styles.title} />
        
        <Text 
          preset="default"
          tx="ssoLinkingScreen.message"
          txOptions={{ provider: getProviderName() }}
          style={styles.message}
        />
        
        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text preset="default" text={errorMessage} style={styles.errorText} testID="error-message" />
          </View>
        ) : null}

        {passwordSet && (
          <Text preset="default" tx="ssoLinkingScreen.successMessage" style={styles.successMessage} />
        )}

        <View style={styles.fieldContainer}>
          <TextField
            value={password}
            onChangeText={setPassword}
            labelTx="ssoLinkingScreen.passwordLabel"
            placeholderTx="ssoLinkingScreen.passwordPlaceholder"
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSettingPassword && !isSSOLoading}
            accessibilityLabel="password-input"
            testID="password-input"
          />
        </View>

        <View style={styles.fieldContainer}>
          <TextField
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            labelTx="ssoLinkingScreen.confirmPasswordLabel"
            placeholderTx="ssoLinkingScreen.confirmPasswordPlaceholder"
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSettingPassword && !isSSOLoading}
            accessibilityLabel="confirm-password-input"
            testID="confirm-password-input"
          />
        </View>

        <View style={styles.buttonContainer}>
          <LoadingButton
            title={translate("ssoLinkingScreen.setPasswordButton")}
            onPress={handleSetPassword}
            loading={isSettingPassword}
            disabled={!password.trim() || !confirmPassword.trim() || isSSOLoading}
            testID="set-password-button"
            accessibilityLabel="set-password-button"
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText} tx="ssoLinkingScreen.orDivider" />
          <View style={styles.dividerLine} />
        </View>

        <SSOLoginButtons
          onSSOSuccess={handleSSOSuccess}
          onSSOError={handleSSOError}
          disabled={isSettingPassword || isSSOLoading}
          showGenericSSO={false}
        />

        <View style={styles.buttonContainer}>
          <Button
            tx="ssoLinkingScreen.backToLoginButton"
            onPress={handleBackToLogin}
            preset="default"
            accessibilityLabel="back-to-login-button"
            testID="back-to-login-button"
          />
        </View>
      </View>
    </Screen>
  )
}

