import React from "react"
import { StyleSheet } from "react-native"
import { useSelector } from "react-redux"
import { useLogoutMutation } from "../services/api/authApi"
import { getAuthTokens } from "../store/authSlice"
import { Button, Screen, Text } from "app/components"
import { colors } from "app/theme/colors"

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
      <Button
        tx="logoutScreen.logoutButton"
        onPress={handleLogoutPress}
        style={styles.logoutButton}
        textStyle={styles.logoutButtonText}
        preset="filled"
      />
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
  logoutButton: {
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: "100%",
  },
  logoutButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  title: {
    color: colors.palette.biancaHeader,
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
})
