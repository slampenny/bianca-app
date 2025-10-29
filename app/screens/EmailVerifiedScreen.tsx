import React, { useEffect } from "react"
import { View, ViewStyle, StyleSheet } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { isAuthenticated } from "app/store/authSlice"
import { Screen, Text } from "app/components"
import { spacing } from "app/theme"
import { useTheme } from "app/theme/ThemeContext"

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.neutral100,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  successText: {
    color: colors.palette.success500,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: spacing.md,
  },
  messageText: {
    color: colors.palette.neutral800,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
})

export const EmailVerifiedScreen = () => {
  const navigation = useNavigation()
  const isLoggedIn = useSelector(isAuthenticated)
  const { colors, isLoading: themeLoading } = useTheme()

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  useEffect(() => {
    // Show success message for 3 seconds, then navigate
    const timer = setTimeout(() => {
      if (isLoggedIn) {
        // User is logged in, go to main app
        navigation.navigate("MainTabs" as never)
      } else {
        // User is not logged in, go to login
        navigation.navigate("Login" as never)
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [navigation, isLoggedIn])

  return (
    <Screen 
      preset="fixed" 
      style={styles.container}
      contentContainerStyle={styles.container}
    >
      <View style={styles.container}>
        <Text style={styles.successText}>✓</Text>
        
        <Text 
          preset="heading" 
          text="Email Verified!" 
          style={styles.successText}
        />
        
        <Text 
          preset="default"
          text="Your My Phone Friend account has been successfully verified."
          style={styles.messageText}
        />
        
        <Text 
          size="sm"
          text="Redirecting you to the app..."
          style={styles.messageText}
        />
      </View>
    </Screen>
  )
}