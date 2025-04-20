import React, { useState, useRef, useEffect, FC } from "react"
import { TextInput, View, StyleSheet, Pressable } from "react-native"
import { useDispatch, useSelector } from "react-redux"
import { StackNavigationProp } from "@react-navigation/stack"
import { useLoginMutation } from "../services/api/authApi"
import { setAuthEmail, setAuthTokens, getValidationError, getAuthEmail } from "../store/authSlice"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { Button, Header, Screen, Text, TextField } from "app/components"

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
      />
      <Button testID="login-button" tx="loginScreen.signIn" onPress={handleLoginPress} />
      <Button testID="register-button" tx="loginScreen.register" onPress={handleRegisterPress} />
      <Pressable testID="forgot-password-link" style={styles.linkButton} onPress={handleForgotPasswordPress}>
        <Text style={styles.linkButtonText} tx="loginScreen.forgotPassword" />
      </Pressable>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  // input: {
  //   backgroundColor: 'white',
  //   paddingHorizontal: 15,
  //   paddingVertical: 10,
  //   borderRadius: 5,
  //   borderWidth: 1,
  //   borderColor: '#dedede',
  //   marginBottom: 10,
  // },
  button: {
    backgroundColor: "#3498db",
    borderRadius: 5,
    marginBottom: 10,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  linkButton: {
    marginTop: 10,
  },
  linkButtonText: {
    color: "#3498db",
    fontSize: 16,
    textAlign: "center",
  },
  error: {
    color: "red",
    marginBottom: 20,
  },
})
