import React, { useState } from "react"
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native"
import { useResetPasswordMutation } from "../services/api/authApi" // Adjust the path as necessary

export const ConfirmResetScreen = () => {
  const [confirmReset, { isLoading }] = useResetPasswordMutation()

  const [token, setToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const validatePassword = (password: string) => {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/ // Minimum eight characters, at least one letter and one number
    return passwordRegex.test(password)
  }

  const handleConfirmReset = async () => {
    if (token.trim() === "") {
      setErrorMessage("Token cannot be empty")
      return
    }
    if (!validatePassword(newPassword)) {
      setErrorMessage("Password must contain at least one letter and one number")
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match")
      return
    }
    setErrorMessage("")

    try {
      await confirmReset({ token, password: newPassword }).unwrap()
      setErrorMessage("Password reset successful!")
    } catch (err) {
      setErrorMessage("Password reset failed")
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirm Password Reset</Text>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Reset Token"
        value={token}
        onChangeText={setToken}
      />
      <TextInput
        style={styles.input}
        placeholder="New Password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm New Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      <Pressable style={styles.button} onPress={handleConfirmReset} disabled={isLoading}>
        <Text style={styles.buttonText}>RESET PASSWORD</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#007BFF",
    borderRadius: 5,
    padding: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  errorText: {
    color: "red",
    marginBottom: 10,
  },
  input: {
    borderColor: "gray",
    borderWidth: 1,
    height: 40,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
})
