import React, { useState, useRef, useEffect, FC } from "react"
import { TextInput, View, StyleSheet, Pressable } from "react-native"
import { useDispatch, useSelector } from "react-redux"
import { StackNavigationProp } from "@react-navigation/stack"
import { useLoginMutation } from "../services/api/authApi"
import { setAuthEmail, setAuthTokens, setCurrentUser, getValidationError, getAuthEmail } from "../store/authSlice"
import { setCaregiver } from "../store/caregiverSlice"
import { setOrg } from "../store/orgSlice"
import { orgApi } from "../services/api/orgApi"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { Button, Header, Screen, Text, TextField } from "app/components"
import { colors } from "app/theme/colors"
import { SSOLoginButtons } from "../components/SSOLoginButtons"

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

type LoginScreenNavigationProp = StackNavigationProp<LoginStackParamList, "Login">

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp
}

export const LoginScreen: FC<LoginScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch()
  const [loginAPI] = useLoginMutation()

  const authPasswordInput = useRef<TextInput>(null)
  const validationError = useSelector(getValidationError)
  const authEmail = useSelector(getAuthEmail)

  const [authPassword, setAuthPassword] = useState("")
  const [isAuthPasswordHidden, setIsAuthPasswordHidden] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // useLayoutEffect(() => {
  //   navigation.setOptions({
  //     headerShown: true,
  //     header: () => <Header titleTx='loginScreen.signIn' />,
  //   })
  // }, [])

  useEffect(() => {
    // No default credentials for production
    return () => {
      setAuthPassword("")
    }
  }, [])

  const handleLoginPress = async () => {
    if (validationError) return
    setIsLoading(true)
    try {
      const result = await loginAPI({ email: authEmail, password: authPassword }).unwrap()
      dispatch(setAuthTokens(result.tokens))
    } catch (error: any) {
      console.error(error)
      
      // Check for email verification error
      if (error?.data?.message?.includes('verify your email')) {
        setErrorMessage("Please check your email and click the verification link before logging in.")
        // Optionally navigate to verification screen
        navigation.navigate("EmailVerificationRequired" as never)
      } else {
        setErrorMessage("Failed to log in. Please check your email and password.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegisterPress = () => {
    // Navigate to the Register screen
    navigation.navigate("Register")
  }

  const handleForgotPasswordPress = () => {
    // Navigate to the Forgot Password screen
    navigation.navigate("RequestReset")
  }

  const handleSSOSuccess = async (user: SSOUser & { tokens?: any; backendUser?: any }) => {
    setIsLoading(true)
    try {
      if (user.tokens && user.backendUser) {
        // SSO login successful - set tokens and user data
        dispatch(setAuthTokens(user.tokens));
        dispatch(setAuthEmail(user.email));
        dispatch(setCurrentUser(user.backendUser));
        dispatch(setCaregiver(user.backendUser));
        
        // Fetch and set org data if the user has an org
        if (user.backendUser.org) {
          try {
            const orgResponse = await dispatch(orgApi.endpoints.getOrg.initiate({ orgId: user.backendUser.org }));
            if (orgResponse.data) {
              dispatch(setOrg(orgResponse.data));
              console.log('SSO login successful - org loaded:', orgResponse.data);
            }
          } catch (orgError) {
            console.error('Failed to load org data after SSO login:', orgError);
            // Don't fail the login if org loading fails
          }
        }
        
        setErrorMessage(""); // Clear any previous errors
        console.log('SSO login successful:', user.backendUser);
      } else {
        // Fallback for development/testing
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

  // When you want to focus the password input after submitting the email
  const focusPasswordInput = () => {
    if (authPasswordInput.current) {
      authPasswordInput.current.focus()
    }
  }

  return (
    <Screen style={styles.container} testID="login-form" accessibilityLabel="login-screen">
      <Header titleTx="loginScreen.signIn" />
      {errorMessage ? <Text testID="login-error" style={styles.error}>{errorMessage}</Text> : null}
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
      />
      <Button
        testID="login-button"
        accessibilityLabel="login-button"
        tx="loginScreen.signIn"
        onPress={handleLoginPress}
        style={styles.loginButton}
        textStyle={styles.loginButtonText}
        preset="filled"
        disabled={isLoading}
      />
      
      <SSOLoginButtons
        onSSOSuccess={handleSSOSuccess}
        onSSOError={handleSSOError}
        disabled={isLoading}
        showGenericSSO={false}
      />
      
      <Button
        testID="register-button"
        accessibilityLabel="register-link"
        tx="loginScreen.register"
        onPress={handleRegisterPress}
        style={styles.registerButton}
        textStyle={styles.registerButtonText}
        preset="default"
      />
      <Pressable testID="forgot-password-link" style={styles.linkButton} onPress={handleForgotPasswordPress}>
        <Text style={styles.linkButtonText} tx="loginScreen.forgotPassword" />
      </Pressable>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  error: {
    color: colors.palette.biancaError,
    marginBottom: 20,
    textAlign: "center",
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
