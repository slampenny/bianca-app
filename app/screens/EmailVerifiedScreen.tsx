import React, { useEffect } from "react"
import { View, ViewStyle } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { isAuthenticated } from "app/store/authSlice"
import { Screen, Text } from "app/components"
import { colors, spacing } from "app/theme"

export const EmailVerifiedScreen = () => {
  const navigation = useNavigation()
  const isLoggedIn = useSelector(isAuthenticated)
  const { colors, isLoading: themeLoading } = useTheme()

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
      style={$container}
      contentContainerStyle={$contentContainer}
    >
      <View style={$successCard}>
        <Text style={$checkmark}>✓</Text>
        
        <Text 
          preset="heading" 
          text="Email Verified!" 
          style={$title}
        />
        
        <Text 
          preset="default"
          text="Your My Phone Friend account has been successfully verified."
          style={$message}
        />
        
        <Text 
          size="sm"
          text="Redirecting you to the app..."
          style={$redirectText}
        />
      </View>
    </Screen>
  )
}

const $container: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: spacing.lg,
}

const $contentContainer: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
}

const $successCard: ViewStyle = {
  backgroundColor: colors.palette.neutral100,
  padding: spacing.xl,
  borderRadius: spacing.md,
  alignItems: "center",
  shadowColor: colors.palette.neutral800,
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 5,
  maxWidth: 320,
  width: "100%",
}

const $checkmark = {
  fontSize: 60,
  color: colors.palette.accent500,
  marginBottom: spacing.md,
}

const $title = {
  textAlign: "center" as const,
  marginBottom: spacing.md,
}

const $message = {
  textAlign: "center" as const,
  marginBottom: spacing.lg,
  lineHeight: 24,
}

const $redirectText = {
  textAlign: "center" as const,
  color: colors.textDim,
  fontStyle: "italic" as const,
}