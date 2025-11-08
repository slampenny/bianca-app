import React, { useState, useRef, useEffect, FC } from "react"
import { TextInput, View, StyleSheet } from "react-native"
import { useDispatch, useSelector } from "react-redux"
import { useLoginMutation } from "../services/api/authApi"
import { setAuthEmail, setAuthTokens, setCurrentUser, getValidationError, getAuthEmail } from "../store/authSlice"
import { setCaregiver } from "../store/caregiverSlice"
import { setOrg } from "../store/orgSlice"
import { Button, Text, TextField } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { SSOLoginButtons } from "./SSOLoginButtons"
import { translate } from "../i18n"
import { useNavigation } from "@react-navigation/native"
import { logger } from "../utils/logger"

// Temporary interfaces to avoid import issues
interface SSOUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'microsoft';
}

interface SSOError {
  error: string;
  description?: string;
}

interface LoginFormProps {
  onLoginSuccess?: () => void
  onRegisterPress?: () => void
  onForgotPasswordPress?: () => void
  onSSOAccountLinking?: (email: string, provider: string) => void
  onEmailVerificationRequired?: (email: string) => void
  onMFARequired?: (email: string, password: string, tempToken: string) => void
  showRegisterButton?: boolean
  showForgotPasswordButton?: boolean
  showSSOButtons?: boolean
  compact?: boolean // If true, hide header and some buttons for modal use
}

export const LoginForm: FC<LoginFormProps> = ({
  onLoginSuccess,
  onRegisterPress,
  onForgotPasswordPress,
  onSSOAccountLinking,
  onEmailVerificationRequired,
  onMFARequired,
  showRegisterButton = true,
  showForgotPasswordButton = true,
  showSSOButtons = true,
  compact = false,
}) => {
  const dispatch = useDispatch()
  const navigation = useNavigation()
  const [loginAPI] = useLoginMutation()
  const { colors, isLoading: themeLoading } = useTheme()

  const authPasswordInput = useRef<TextInput>(null)
  const validationError = useSelector(getValidationError)
  const authEmail = useSelector(getAuthEmail)

  const [authPassword, setAuthPassword] = useState("")
  const [isAuthPasswordHidden, setIsAuthPasswordHidden] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // No default credentials for production
    return () => {
      setAuthPassword("")
    }
  }, [])

  const handleLoginPress = async () => {
    if (validationError) return
    setIsLoading(true)
    setErrorMessage("") // Clear previous errors
    try {
      const result = await loginAPI({ email: authEmail, password: authPassword }).unwrap()
      
      // Check if MFA is required (backend returns status 200 with requireMFA: true)
      if ('requireMFA' in result && result.requireMFA) {
        setIsLoading(false)
        if (onMFARequired) {
          // Parent component handles navigation
          onMFARequired(authEmail, authPassword, result.tempToken)
        } else {
          // Navigate to MFA verification screen
          navigation.navigate("MFAVerification" as never, {
            email: authEmail,
            password: authPassword,
            tempToken: result.tempToken,
          } as never)
        }
        return
      }
      
      // Normal login success
      if ('tokens' in result) {
        dispatch(setAuthTokens(result.tokens))
        dispatch(setCurrentUser(result.caregiver))
        dispatch(setCaregiver(result.caregiver))
        if (result.org) {
          dispatch(setOrg(result.org))
        }
        
        // Call success callback if provided
        if (onLoginSuccess) {
          onLoginSuccess()
        }
      }
    } catch (error: unknown) {
      console.error('Login error:', error)
      console.error('Error data:', error?.data)
      console.error('Error status:', error?.status)
      
      // RTK Query errors: when .unwrap() throws, error structure is:
      // - error.status: HTTP status code (e.g., 401)
      // - error.data: Response body from backend (e.g., { code: 401, message: "..." })
      const errorData = error?.data
      const errorStatus = error?.status
      
      // Backend returns: { code: 401, message: "Incorrect email or password" }
      // So error.data.message should contain the message
      let errorMessage = errorData?.message
      
      // Check for SSO account linking requirement FIRST
      const requiresLinking = errorData?.requiresPasswordLinking || error?.requiresPasswordLinking
      const ssoProvider = errorData?.ssoProvider || error?.ssoProvider
      
      if (requiresLinking === true || requiresLinking === 'true') {
        logger.debug('✅ SSO account linking required')
        if (onSSOAccountLinking) {
          // Parent component handles navigation
          onSSOAccountLinking(authEmail, ssoProvider || 'google')
        } else {
          // Modal mode - show error message
          setErrorMessage("SSO account linking required. Please use the main login screen.")
        }
        setIsLoading(false)
        return
      }
      
      // Check for email verification error
      if (errorMessage?.includes('verify your email') || errorMessage?.includes('verification')) {
        if (onEmailVerificationRequired) {
          // Parent component handles navigation
          onEmailVerificationRequired(authEmail)
        } else {
          // Modal mode - show error message
          setErrorMessage("Please verify your email address before logging in.")
        }
        setIsLoading(false)
        return
      }
      
      // Extract specific error message from API response
      // Backend error format: { code: 401, message: "Incorrect email or password" }
      let finalErrorMessage = "Failed to log in. Please check your email and password."
      
      if (errorMessage) {
        // Use the message from backend
        finalErrorMessage = errorMessage
      } else if (errorData?.error) {
        finalErrorMessage = errorData.error
      } else if (typeof errorData === 'string') {
        finalErrorMessage = errorData
      } else if (errorStatus === 401 || errorStatus === 'FETCH_ERROR' || errorStatus === 401) {
        // 401 means unauthorized - invalid credentials
        finalErrorMessage = "Invalid email or password. Please check your credentials and try again."
      } else if (errorStatus) {
        // Any other status code
        finalErrorMessage = `Login failed. Please check your email and password.`
      }
      
      // Always set error message - this ensures it's displayed even if error structure is unexpected
      logger.debug('Setting error message:', finalErrorMessage, 'from error:', { status: errorStatus, data: errorData })
      setErrorMessage(finalErrorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSSOSuccess = async (user: SSOUser & { tokens?: any; backendUser?: any; backendOrg?: any }) => {
    setIsLoading(true)
    try {
      if (user.tokens && user.backendUser) {
        // SSO login successful - set tokens and user data
        dispatch(setAuthTokens(user.tokens));
        dispatch(setAuthEmail(user.email));
        dispatch(setCurrentUser(user.backendUser));
        dispatch(setCaregiver(user.backendUser));
        
        // Set org if included in response
        if (user.backendOrg) {
          dispatch(setOrg(user.backendOrg));
        }
        
        setErrorMessage("");
        if (onLoginSuccess) {
          onLoginSuccess()
        }
      } else {
        dispatch(setAuthEmail(user.email));
        setErrorMessage("SSO login successful but backend integration incomplete. Please use email/password login.");
      }
    } catch (error) {
      console.error('SSO login error:', error);
      setErrorMessage("SSO login failed. Please try again or use email/password login.");
    } finally {
      setIsLoading(false)
    }
  }

  const handleSSOError = (error: SSOError) => {
    console.error('SSO error:', error);
    setErrorMessage(`SSO login failed: ${error.description || error.error}`);
  }

  const focusPasswordInput = () => {
    if (authPasswordInput.current) {
      authPasswordInput.current.focus()
    }
  }

  if (themeLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>{translate("common.loading")}</Text>
      </View>
    )
  }

  const styles = createStyles(colors, compact)

  return (
    <View style={styles.container}>
      {errorMessage ? (
        <View 
          style={styles.errorContainer} 
          testID="login-error-container" 
          accessibilityLabel="login-error"
          accessibilityRole="alert"
        >
          <Text 
            testID="login-error" 
            accessibilityLabel="login-error" 
            accessibilityRole="alert"
            style={styles.errorText}
          >
            {errorMessage}
          </Text>
        </View>
      ) : null}
      <TextField
        testID="email-input"
        accessibilityLabel="email-input"
        value={authEmail}
        onChangeText={(value) => dispatch(setAuthEmail(value))}
        placeholderTx="loginScreen.emailFieldLabel"
        labelTx="loginScreen.emailFieldLabel"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={focusPasswordInput}
        containerStyle={styles.inputContainer}
        inputWrapperStyle={styles.inputWrapper}
        style={styles.input}
        editable={true}
      />
      <TextField
        testID="password-input"
        accessibilityLabel="password-input"
        ref={authPasswordInput}
        value={authPassword}
        onChangeText={setAuthPassword}
        placeholderTx="loginScreen.passwordFieldLabel"
        labelTx="loginScreen.passwordFieldLabel"
        secureTextEntry={isAuthPasswordHidden}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={handleLoginPress}
        containerStyle={styles.inputContainer}
        inputWrapperStyle={styles.inputWrapper}
        style={styles.input}
        editable={true}
      />
      <Button
        testID="login-button"
        accessibilityLabel="login-button"
        tx="loginScreen.signIn"
        onPress={handleLoginPress}
        preset="primary"
        style={styles.loginButton}
        textStyle={styles.loginButtonText}
        disabled={isLoading}
      />
      
      {showSSOButtons && (
        <SSOLoginButtons
          onSSOSuccess={handleSSOSuccess}
          onSSOError={handleSSOError}
          disabled={isLoading}
          showGenericSSO={false}
        />
      )}
      
      {showRegisterButton && onRegisterPress && (
        <Button
          testID="register-button"
          accessibilityLabel="register-link"
          tx="loginScreen.register"
          onPress={onRegisterPress}
          style={styles.registerButton}
          textStyle={styles.registerButtonText}
          preset="default"
        />
      )}
      {showForgotPasswordButton && onForgotPasswordPress && (
        <Button 
          testID="forgot-password-link" 
          style={styles.linkButton} 
          onPress={onForgotPasswordPress}
          preset="default"
        >
          <Text style={styles.linkButtonText} tx="loginScreen.forgotPassword" />
        </Button>
      )}
    </View>
  )
}

const createStyles = (colors: any, compact: boolean) => StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: compact ? "flex-start" : "center",
    padding: compact ? 20 : 20,
    width: "100%",
  },
  errorContainer: {
    backgroundColor: colors.palette.biancaErrorBackground || "#fee2e2",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.palette.biancaError || "#dc2626",
    marginBottom: 20,
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
  input: {
    color: colors.palette.biancaHeader,
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 16,
    width: "100%",
  },
  inputWrapper: {
    backgroundColor: colors.palette.neutral100,
    borderColor: colors.palette.biancaBorder,
    borderRadius: 6,
    borderWidth: 1,
    elevation: 1,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  linkButton: {
    alignSelf: "center",
    marginTop: 10,
  },
  linkButtonText: {
    color: colors.palette.biancaButtonSelected,
    fontSize: 16,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  loginButton: {
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: "100%",
  },
  loginButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  registerButton: {
    backgroundColor: colors.palette.biancaButtonUnselected,
    borderRadius: 5,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: "100%",
  },
  registerButtonText: {
    color: colors.palette.biancaButtonSelected,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
})

