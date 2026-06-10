import React, { useState, useRef, useEffect, FC, useContext } from "react"
import { TextInput, View, StyleSheet, Image, ImageStyle, Platform } from "react-native"
import { useDispatch, useSelector } from "react-redux"
import { useLoginMutation } from "../services/api/authApi"
import { setAuthEmail, setAuthTokens, setCurrentUser, getValidationError, getAuthEmail } from "../store/authSlice"
import { setCaregiver } from "../store/caregiverSlice"
import { setOrg } from "../store/orgSlice"
import { setClientsForCaregiver } from "../store/clientSlice"
import { Button, Text, TextField, PasswordField } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { SSOLoginButtons } from "./SSOLoginButtons"
import { translate } from "../i18n"
import { navigationRef } from "../navigators/navigationUtilities"
import { logger } from "../utils/logger"
import { AuthModalContext } from "../contexts/AuthModalContext"
import Config from "../config"
import { consumeSSORedirectError } from "../effects/useSSORedirectCompletion"

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
  onError?: (message: string) => void // Callback to show error in parent (e.g., modal toast)
  initialErrorMessage?: string | null // Initial error message to display (e.g., from 401 that triggered modal)
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
  onError,
  initialErrorMessage,
}) => {
  const dispatch = useDispatch()
  // Get auth modal context to close modal after successful login (if available)
  // useContext returns undefined if not in provider, which is safe
  // We must call useContext unconditionally (React hook rules)
  const authModalContext = useContext(AuthModalContext)
  const hideAuthModal = authModalContext?.hideAuthModal
  // Use global navigationRef instead of useNavigation() hook
  // This works both inside and outside NavigationContainer (e.g., in AuthModal)
  // navigationRef is available globally and doesn't require being inside NavigationContainer
  const [loginAPI] = useLoginMutation()
  const { colors, isLoading: themeLoading } = useTheme()
  // Note: Removed toast - errors now show in error container above button

  const authPasswordInput = useRef<TextInput>(null)
  const validationError = useSelector(getValidationError)
  const authEmail = useSelector(getAuthEmail)

  const [authPassword, setAuthPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage || "")
  const [isLoading, setIsLoading] = useState(false)

  // Update error message when initialErrorMessage changes (e.g., modal opens with error)
  useEffect(() => {
    if (initialErrorMessage) {
      setErrorMessage(initialErrorMessage)
    }
  }, [initialErrorMessage])

  // On web, show SSO redirect error if we landed back after a failed redirect flow
  useEffect(() => {
    const ssoError = consumeSSORedirectError()
    if (ssoError) setErrorMessage(ssoError)
  }, [])

  useEffect(() => {
    // No default credentials for production
    return () => {
      setAuthPassword("")
    }
  }, [])

  const handleLoginPress = async () => {
    // Show validation error if email is invalid
    if (validationError) {
      // Convert validation error to user-friendly message
      let userFriendlyError = validationError
      if (validationError === "can't be blank") {
        userFriendlyError = "Please enter your email address"
      } else if (validationError === "must be at least 6 characters") {
        userFriendlyError = "Email address is too short"
      } else if (validationError === "must be a valid email address") {
        userFriendlyError = "Please enter a valid email address"
      }
      setErrorMessage(userFriendlyError)
      return
    }
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
        } else if (navigationRef.isReady()) {
          // Use global navigationRef to navigate to MFA verification screen
          ;(navigationRef.navigate as (name: string, params?: object) => void)("MFAVerification", {
            email: authEmail,
            password: authPassword,
            tempToken: result.tempToken,
          })
        } else {
          // No navigation available and no callback - show error
          setErrorMessage("MFA verification required but navigation is not available. Please use the main login screen.")
          setIsLoading(false)
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
        
        // Explicitly close auth modal after successful login
        // This ensures the modal closes even if the AuthModalContext effect doesn't trigger
        if (hideAuthModal) {
          hideAuthModal()
        }
        
        // Call success callback if provided
        if (onLoginSuccess) {
          onLoginSuccess()
        }
      }
    } catch (error: unknown) {
      console.error('Login error:', error)
      const err = error as { data?: unknown; status?: number; ssoProvider?: string }
      console.error('Error data:', err?.data)
      console.error('Error status:', err?.status)
      
      // RTK Query errors: when .unwrap() throws, error structure is:
      // - error.status: HTTP status code (e.g., 401) or 'CUSTOM_ERROR'
      // - error.data: Response body from backend (e.g., { code: 401, message: "..." })
      // - error.error: For CUSTOM_ERROR, format is {status: 'CUSTOM_ERROR', error: 'message'}
      const errorAny = error as any
      const errorData = errorAny?.data
      const errorStatus = errorAny?.status
      const customError = errorAny?.error
      
      // Handle CUSTOM_ERROR format: {error: {status: 'CUSTOM_ERROR', error: 'Authentication cancelled'}}
      let errorMessage = null
      if (customError && customError.status === 'CUSTOM_ERROR' && customError.error) {
        errorMessage = customError.error
      } else if (errorData?.message) {
        // Standard RTK Query error format: {data: {message: "..."}}
        errorMessage = errorData.message
      } else if (errorData?.error) {
        errorMessage = errorData.error
      } else if (typeof errorData === 'string') {
        errorMessage = errorData
      }
      
      // Check for SSO account linking requirement FIRST
      // RTK Query error structure: error.data contains the response body
      // For 403 status, check if requiresPasswordLinking is in the error data
      const requiresLinking = 
        errorData?.requiresPasswordLinking === true || 
        errorData?.requiresPasswordLinking === 'true' || 
        errorData?.requiresPasswordLinking === 1 ||
        (errorStatus === 403 && (errorMessage?.toLowerCase().includes('sso') || errorMessage?.toLowerCase().includes('link')))
      
      logger.debug('SSO linking check:', { 
        requiresLinking, 
        errorData, 
        errorStatus, 
        errorMessage,
        hasRequiresPasswordLinking: !!errorData?.requiresPasswordLinking,
        compact,
        hasOnError: !!onError
      })
      
      const ssoProvider = errorData?.ssoProvider || (error as { ssoProvider?: string })?.ssoProvider || 'google'
      
      if (requiresLinking) {
        logger.debug('✅ SSO account linking required')
        const linkingErrorMessage = errorMessage || "This account was created with SSO. Please link your account by setting a password or using SSO login."
        
        // In modal/compact mode, always show error (don't navigate to link account screen)
        // Only navigate if we're in full-screen mode AND onSSOAccountLinking is provided
        if (compact) {
          // Modal mode - show error in error container above button, don't navigate
          logger.debug('✅ Modal mode: Showing error in error container', { linkingErrorMessage })
          setErrorMessage(linkingErrorMessage) // Show error above button
        } else if (onSSOAccountLinking) {
          // Full-screen mode - parent component can handle navigation
          logger.debug('✅ Full-screen mode: Navigating to SSO account linking screen')
          onSSOAccountLinking(authEmail, ssoProvider || 'google')
        } else {
          // Full-screen mode but no callback - show error message
          logger.debug('✅ Full-screen mode (no callback): Showing error message')
          setErrorMessage(linkingErrorMessage)
        }
        setIsLoading(false)
        return
      }
      
      // Check for email verification error
      if (errorMessage?.includes('verify your email') || errorMessage?.includes('verification')) {
        const verificationErrorMessage = errorMessage || "Please verify your email address before logging in."
        
        if (onEmailVerificationRequired) {
          // Parent component handles navigation
          onEmailVerificationRequired(authEmail)
        } else {
          // Show error message in error container
          setErrorMessage(verificationErrorMessage)
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
      logger.debug('Setting error message:', finalErrorMessage, 'from error:', { status: errorStatus, data: errorData, customError })
      setErrorMessage(finalErrorMessage) // Show error above button
    } finally {
      setIsLoading(false)
    }
  }

  const handleSSOSuccess = async (user: SSOUser & { tokens?: any; backendUser?: any; backendOrg?: any; backendClients?: any[]; backendAlerts?: any[] }) => {
    setIsLoading(true)
    try {
      logger.debug('LoginForm: SSO success handler called with user:', {
        hasTokens: !!user.tokens,
        hasBackendUser: !!user.backendUser,
        userId: user.backendUser?.id,
        userEmail: user.backendUser?.email,
        userName: user.backendUser?.name,
        hasOrg: !!user.backendOrg,
        hasClients: !!user.backendClients
      });
      
      if (user.tokens && user.backendUser) {
        // Validate user data is complete before setting state
        if (!user.backendUser.id || !user.backendUser.email || !user.backendUser.name) {
          logger.error('LoginForm: SSO returned incomplete user data:', {
            hasId: !!user.backendUser.id,
            hasEmail: !!user.backendUser.email,
            hasName: !!user.backendUser.name,
            user: user.backendUser
          });
          setErrorMessage("SSO login returned incomplete data. Please try again.");
          return;
        }
        
        // SSO login successful - set tokens and user data
        logger.debug('LoginForm: dispatching SSO auth data to Redux');
        dispatch(setAuthTokens(user.tokens));
        dispatch(setAuthEmail(user.email));
        dispatch(setCurrentUser(user.backendUser));
        dispatch(setCaregiver(user.backendUser));
        
        // Set org if included in response
        if (user.backendOrg) {
          logger.debug('LoginForm: dispatching org to Redux');
          dispatch(setOrg(user.backendOrg));
        }
        
        if (user.backendClients && user.backendUser?.id) {
          logger.debug('LoginForm: dispatching clients to Redux, count:', user.backendClients.length);
          dispatch(setClientsForCaregiver({ 
            caregiverId: user.backendUser.id, 
            clients: user.backendClients 
          }));
        }
        
        setErrorMessage("");
        
        // Explicitly close auth modal after successful SSO login
        // This ensures the modal closes even if the AuthModalContext effect doesn't trigger
        if (hideAuthModal) {
          logger.debug('LoginForm: hiding auth modal');
          hideAuthModal();
        }
        
        if (onLoginSuccess) {
          logger.debug('LoginForm: calling onLoginSuccess callback');
          onLoginSuccess()
        }
        
        logger.debug('LoginForm: SSO login complete');
      } else {
        logger.warn('LoginForm: SSO success but missing tokens or backendUser');
        dispatch(setAuthEmail(user.email));
        setErrorMessage("SSO login successful but backend integration incomplete. Please use email/password login.");
      }
    } catch (error) {
      logger.error('LoginForm: SSO login error in handler:', error);
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
  const devLogin =
    typeof __DEV__ !== "undefined" &&
    __DEV__ &&
    !compact &&
    Config.API_URL.includes("localhost") &&
    "devLogin" in Config
      ? (Config as typeof Config & { devLogin?: { email: string; password: string } }).devLogin
      : undefined

  const formContent = (
    <>
      <TextField
        testID="email-input"
        accessibilityLabel="Email address"
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
      <PasswordField
        testID="password-input"
        accessibilityLabel="Password"
        ref={authPasswordInput}
        value={authPassword}
        onChangeText={setAuthPassword}
        placeholderTx="loginScreen.passwordFieldLabel"
        labelTx="loginScreen.passwordFieldLabel"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={handleLoginPress}
        containerStyle={styles.inputContainer}
        inputWrapperStyle={styles.inputWrapper}
        style={styles.input}
        editable={true}
        showRules={false}
      />
    </>
  )

  return (
    <View style={styles.container}>
      {/* App Branding */}
      {!compact && (
        <View style={styles.brandingContainer}>
          <View style={styles.iconWrapper}>
            <Image 
              source={{ uri: Config.appIconUrl }}
              style={styles.appIcon as ImageStyle}
              resizeMode="contain"
              accessibilityLabel="Bianca App Icon"
              testID="app-icon"
              {...(Platform.OS === 'web' && {
                style: [
                  styles.appIcon as ImageStyle,
                  {
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    shadowOpacity: 0,
                    elevation: 0,
                  } as ImageStyle
                ]
              })}
            />
          </View>
          <Text style={styles.appName}>{translate("loginScreen.appName") || "Bianca"}</Text>
          <Text style={styles.appTagline}>{translate("loginScreen.tagline") || "Wellness Check Communication"}</Text>
        </View>
      )}
      
      {Platform.OS === 'web' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleLoginPress()
          }}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
        >
          {formContent}
        </form>
      ) : (
        formContent
      )}
      
      {/* Error message displayed above login button */}
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
      
      <Button
        testID="login-button"
        accessibilityLabel="Log in"
        tx="loginScreen.signIn"
        onPress={handleLoginPress}
        preset="primary"
        style={styles.loginButton}
        textStyle={styles.loginButtonText}
        loading={isLoading}
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
          accessibilityLabel="Create account"
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
      {devLogin ? (
        <Text style={styles.devHintText} testID="login-dev-hint">
          {translate("loginScreen.devSeedHint", {
            email: devLogin.email,
            password: devLogin.password,
          })}
        </Text>
      ) : null}
    </View>
  )
}

const createStyles = (colors: any, compact: boolean) => StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: compact ? "flex-start" : "center",
    padding: compact ? 16 : 16, // Reduced from 20
    paddingTop: compact ? 16 : 12, // Reduced top padding
    width: "100%",
    overflow: 'visible', // Allow toast to render above other elements
  },
  brandingContainer: {
    alignItems: "center",
    marginBottom: compact ? 16 : 20, // Reduced from 32
    marginTop: compact ? 0 : 8, // Reduced from 20
    backgroundColor: 'transparent', // Ensure container is transparent
  },
  iconWrapper: {
    width: 60, // Reduced from 80
    height: 60, // Reduced from 80
    marginBottom: 8, // Reduced from 12
    backgroundColor: 'transparent',
    overflow: 'hidden', // Ensure no overflow creates background
  },
  appIcon: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent', // Ensure transparent background
    // Explicitly remove any borders or backgrounds
    borderWidth: 0,
    borderColor: 'transparent',
    // Ensure no tinting that might affect transparency
    opacity: 1,
    // Web-specific styles
    ...(Platform.OS === 'web' && {
      objectFit: 'contain',
      display: 'flex',
    } as const),
  },
  appName: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.palette.biancaHeader,
    marginBottom: 2,
  },
  appTagline: {
    fontSize: 14,
    color: colors.palette.neutral500,
    lineHeight: 20,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: colors.palette.biancaErrorBackground || "#fee2e2",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.palette.biancaError || "#dc2626",
    marginBottom: 12, // Reduced from 20
    paddingHorizontal: 12, // Reduced from 16
    paddingVertical: 8, // Reduced from 12
    width: "100%",
    minHeight: 40, // Ensure minimum height for visibility
    zIndex: 10,
    elevation: 5, // For Android
  },
  errorText: {
    color: colors.palette.biancaError || "#dc2626",
    fontSize: 13, // Reduced from 14
    fontWeight: "500",
    textAlign: "left",
    lineHeight: 18, // Reduced from 20
  },
  input: {
    color: colors.palette.biancaHeader,
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 12, // Reduced from 16
    width: "100%",
  },
  inputWrapper: {
    backgroundColor: colors.palette.neutral200,
    borderColor: colors.palette.biancaBorder,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  linkButton: {
    alignSelf: "center",
    marginTop: 6, // Reduced from 10
  },
  linkButtonText: {
    color: colors.palette.primary500,
    fontSize: 15,
    textAlign: "center",
  },
  loginButton: {
    marginBottom: 8,
    marginTop: 12,
    width: "100%",
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  registerButton: {
    marginTop: 4,
    width: "100%",
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  devHintText: {
    color: colors.palette.neutral500,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
    textAlign: "center",
  },
})

