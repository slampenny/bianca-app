import React, { useEffect, useRef } from "react"
import { View, ViewStyle, StyleSheet } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { isAuthenticated } from "app/store/authSlice"
import { Screen, Text } from "app/components"
import { spacing } from "app/theme"
import { useTheme } from "app/theme/ThemeContext"
import { navigationRef, resetRoot } from "app/navigators/navigationUtilities"
import { translate } from "app/i18n"
import type { ThemeColors } from "../types"

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.biancaBackground || colors.palette.neutral100,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    alignItems: "center",
  },
  checkmarkContainer: {
    marginBottom: spacing.lg,
  },
  checkmark: {
    fontSize: 64,
    color: colors.palette.biancaSuccess || colors.palette.success500 || "#10b981",
    textAlign: "center",
  },
  title: {
    color: colors.palette.biancaHeader || colors.palette.neutral800,
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: spacing.md,
  },
  messageText: {
    color: colors.palette.neutral600 || colors.textDim,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  redirectingText: {
    color: colors.palette.neutral500 || colors.textDim,
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
})

export const EmailVerifiedScreen = () => {
  const isLoggedIn = useSelector(isAuthenticated)
  const { colors, isLoading: themeLoading } = useTheme()
  const hasNavigated = useRef(false)

  if (themeLoading) {
    return (
      <Screen style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>{translate("common.loading")}</Text>
      </Screen>
    )
  }

  const styles = createStyles(colors)

  useEffect(() => {
    // Prevent multiple navigations
    if (hasNavigated.current) {
      return
    }

    // If user logs out while on this screen, immediately navigate away
    if (!isLoggedIn) {
      // User logged out - replace with login to remove this screen from stack
      hasNavigated.current = true
      if (navigationRef.isReady()) {
        navigationRef.navigate("Login" as never)
      }
      return
    }

    // Show success message briefly (3 seconds), then navigate to MainTabs
    // Use resetRoot to properly reset the navigation stack to MainTabs
    const timer = setTimeout(() => {
      if (hasNavigated.current) {
        return
      }
      hasNavigated.current = true
      // Use resetRoot to properly reset navigation stack to MainTabs
      // This ensures we're at the root of the authenticated stack
      if (navigationRef.isReady()) {
        resetRoot({
          index: 0,
          routes: [{ name: "MainTabs" as never }],
        })
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [isLoggedIn])

  // Also handle focus effect to ensure we navigate away if we come back to this screen
  useFocusEffect(
    React.useCallback(() => {
      // If we're logged in and somehow back on this screen, navigate away immediately
      if (isLoggedIn && !hasNavigated.current) {
        hasNavigated.current = true
        if (navigationRef.isReady()) {
          resetRoot({
            index: 0,
            routes: [{ name: "MainTabs" as never }],
          })
        }
      } else if (!isLoggedIn && !hasNavigated.current) {
        hasNavigated.current = true
        if (navigationRef.isReady()) {
          resetRoot({
            index: 0,
            routes: [{ name: "Login" as never }],
          })
        }
      }
    }, [isLoggedIn])
  )

  return (
    <Screen 
      preset="fixed" 
      style={styles.container}
      contentContainerStyle={styles.container}
      accessibilityLabel="email-verified-screen"
      testID="email-verified-screen"
    >
      <View style={styles.contentWrapper}>
        <View style={styles.checkmarkContainer}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
        
        <Text 
          preset="heading" 
          tx="emailVerifiedScreen.title"
          style={styles.title}
        />
        
        <Text 
          preset="default"
          tx="emailVerifiedScreen.message"
          style={styles.messageText}
        />
        
        <Text 
          size="sm"
          tx="emailVerifiedScreen.redirecting"
          style={styles.redirectingText}
        />
      </View>
    </Screen>
  )
}