import React, { useState, useRef, useEffect, FC } from "react"
import { TextInput, View, StyleSheet, Pressable } from "react-native"
import { useDispatch, useSelector } from "react-redux"
import { StackNavigationProp } from "@react-navigation/stack"
import { useLoginMutation } from "../services/api/authApi"
import { setAuthEmail, setAuthTokens, getValidationError, getAuthEmail } from "../store/authSlice"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { Button, Header, Screen, Text, TextField } from "app/components"
import { colors } from "app/theme/colors"

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

  const [authPassword, setAuthPassword] = useState("password1")
  const [isAuthPasswordHidden, setIsAuthPasswordHidden] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  // useLayoutEffect(() => {
  //   navigation.setOptions({
  //     headerShown: true,
  //     header: () => <Header titleTx='loginScreen.signIn' />,
  //   })
  // }, [])

  useEffect(() => {
    dispatch(setAuthEmail("fake@example.org"))
    setAuthPassword("password1")
    return () => {
      setAuthPassword("")
      dispatch(setAuthEmail(""))
    }
  }, [])

  const handleLoginPress = async () => {
    if (validationError) return
    try {
      const result = await loginAPI({ email: authEmail, password: authPassword }).unwrap()
      dispatch(setAuthTokens(result.tokens))
    } catch (error) {
      console.error(error)
      setErrorMessage("Failed to log in. Please check your email and password.")
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

  // When you want to focus the password input after submitting the email
  const focusPasswordInput = () => {
    if (authPasswordInput.current) {
      authPasswordInput.current.focus()
    }
  }

  return (
    <Screen style={styles.container}>
      <Header titleTx="loginScreen.signIn" />
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <TextField
        testID="email-input"
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
        tx="loginScreen.signIn"
        onPress={handleLoginPress}
        style={styles.loginButton}
        textStyle={styles.loginButtonText}
        preset="filled"
      />
      <Button
        testID="register-button"
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
