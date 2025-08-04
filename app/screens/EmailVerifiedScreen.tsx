import React, { useEffect } from "react"
import { View, Text, StyleSheet } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { isAuthenticated } from "app/store/authSlice"
import { colors, spacing } from "app/theme"

export const EmailVerifiedScreen = () => {
  const navigation = useNavigation()
  const isLoggedIn = useSelector(isAuthenticated)

  useEffect(() => {
    // Show success message for 2 seconds, then navigate
    const timer = setTimeout(() => {
      if (isLoggedIn) {
        // User is logged in, go to main app
        navigation.navigate("MainTabs" as never)
      } else {
        // User is not logged in, go to login
        navigation.navigate("Login" as never)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [navigation, isLoggedIn])

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.title}>Email Verified!</Text>
        <Text style={styles.message}>
          Your My Phone Friend account has been successfully verified.
        </Text>
        <Text style={styles.redirect}>
          Redirecting you to the app...
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  content: {
    alignItems: "center",
    backgroundColor: colors.palette.neutral100,
    padding: spacing.xl,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  checkmark: {
    fontSize: 48,
    color: colors.palette.primary500,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: colors.textDim,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  redirect: {
    fontSize: 14,
    color: colors.textDim,
    fontStyle: "italic",
  },
})