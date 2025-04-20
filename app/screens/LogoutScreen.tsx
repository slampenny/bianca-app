import React from "react"
import { StyleSheet } from "react-native"
import { useSelector } from "react-redux"
import { useLogoutMutation } from "../services/api/authApi"
import { getAuthTokens } from "../store/authSlice"
import { Button, Screen, Text } from "app/components"

export const LogoutScreen = () => {
  const [logout] = useLogoutMutation()

  const tokens = useSelector(getAuthTokens)

  const handleLogoutPress = async () => {
    if (tokens) {
      try {
        await logout({ refreshToken: tokens.refresh.token }).unwrap()
        // Perform any additional actions needed after successful logout
      } catch (error) {
        console.error("Logout failed", error)
        // Handle logout failure (e.g., display a message or log the error)
      }
    }
  }

  return (
    <Screen style={styles.container}>
      <Text style={styles.title} tx="logoutScreen.logoutMessage" />
      <Button tx="logoutScreen.logoutButton" onPress={handleLogoutPress} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#3498db",
    borderRadius: 5,
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
  container: {
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
})
