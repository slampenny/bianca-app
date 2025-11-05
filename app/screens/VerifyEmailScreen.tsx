import React, { useEffect, useState } from "react"
import { View, StyleSheet, Linking } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { isAuthenticated } from "app/store/authSlice"
import { Screen, Text, Button } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { spacing } from "app/theme"
import { translate } from "app/i18n"
import Config from "app/config"
import { navigationRef } from "app/navigators/navigationUtilities"

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.biancaBackground || colors.palette.neutral100,
    padding: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 500,
    alignItems: "center",
  },
  title: {
    color: colors.palette.neutral800 || colors.palette.biancaHeader,
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: spacing.md,
  },
  message: {
    color: colors.palette.neutral600,
    fontSize: 16,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  errorMessage: {
    color: colors.palette.biancaError || colors.palette.error500 || "#ef4444",
    fontSize: 16,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  spinner: {
    marginTop: spacing.lg,
  },
  buttonContainer: {
    marginTop: spacing.lg,
    width: "100%",
  },
})

export const VerifyEmailScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { colors, isLoading: themeLoading } = useTheme()
  const isLoggedIn = useSelector(isAuthenticated)
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [errorMessage, setErrorMessage] = useState<string>("")

  // Extract token from route params
  // React Navigation linking should automatically parse ?token=... from URL on web
  // On mobile, Universal Links will pass it via route params
  const routeParams = route.params as any
  let token = routeParams?.token

  useEffect(() => {
    // Helper to extract token from URL (works for both web and mobile)
    const extractTokenFromUrl = async () => {
      try {
        // On web: Check window.location for query parameters
        if (typeof window !== 'undefined' && window.location) {
          const urlParams = new URLSearchParams(window.location.search)
          const urlToken = urlParams.get('token')
          if (urlToken) {
            token = urlToken
            navigation.setParams({ token: urlToken } as any)
            return urlToken
          }
        }

        // On mobile: Check Linking for deep link URL
        const initialUrl = await Linking.getInitialURL()
        if (initialUrl) {
          try {
            const urlObj = new URL(initialUrl)
            const urlToken = urlObj.searchParams.get('token')
            if (urlToken) {
              token = urlToken
              navigation.setParams({ token: urlToken } as any)
              return urlToken
            }
          } catch (e) {
            // URL parsing failed, try regex as fallback
            const tokenMatch = initialUrl.match(/[?&]token=([^&]+)/)
            if (tokenMatch && tokenMatch[1]) {
              token = decodeURIComponent(tokenMatch[1])
              navigation.setParams({ token } as any)
              return token
            }
          }
        }

        // Also listen for URL changes (in case link is opened while app is running)
        const subscription = Linking.addEventListener('url', (event) => {
          try {
            const urlObj = new URL(event.url)
            const urlToken = urlObj.searchParams.get('token')
            if (urlToken && !token) {
              token = urlToken
              navigation.setParams({ token: urlToken } as any)
            }
          } catch (e) {
            // Try regex fallback
            const tokenMatch = event.url.match(/[?&]token=([^&]+)/)
            if (tokenMatch && tokenMatch[1] && !token) {
              token = decodeURIComponent(tokenMatch[1])
              navigation.setParams({ token } as any)
            }
          }
        })

        return () => subscription.remove()
      } catch (e) {
        console.error('Error extracting token from URL:', e)
        return null
      }
    }

    // If no token in route params, try to extract from URL
    if (!token) {
      extractTokenFromUrl().then((extractedToken) => {
        if (!extractedToken && !token) {
          setStatus("error")
          setErrorMessage(translate("emailVerificationScreen.errorNoToken") || "Verification token is missing")
        }
      })
      return
    }

    // Call the backend API to verify the email
    const verifyEmail = async () => {
      try {
        // Config.API_URL already includes /v1
        // Use the API URL from config, which handles both localhost and production
        const apiUrl = Config.API_URL || 'http://localhost:3000/v1'
        const response = await fetch(`${apiUrl}/auth/verify-email?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/json',
          },
        })

        if (response.ok) {
          // Verification successful - navigate to EmailVerifiedScreen which handles the redirect logic
          navigation.navigate("EmailVerified" as never)
        } else {
          // Verification failed - backend returns HTML, try to extract error message
          setStatus("error")
          const errorText = await response.text()
          // Simple regex to extract error message from HTML
          const messageMatch = errorText.match(/<p[^>]*class="message"[^>]*>([^<]+)<\/p>/i) || 
                               errorText.match(/<p[^>]*>([^<]+)<\/p>/i)
          const errorMsg = messageMatch ? messageMatch[1].trim() : "Email verification failed"
          setErrorMessage(errorMsg)
        }
      } catch (error: any) {
        console.error('Email verification error:', error)
        setStatus("error")
        // Check if it's a network error (connection refused, etc.)
        if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
          setErrorMessage(translate("emailVerificationScreen.errorNetwork") || "Unable to connect to server. Please check your internet connection and try again.")
        } else {
          setErrorMessage(error?.message || translate("emailVerificationScreen.errorVerificationFailed") || "Failed to verify email")
        }
      }
    }

    // Only verify if we have a token
    if (token) {
      verifyEmail()
    }
  }, [token, navigation])

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  if (status === "success") {
    return (
      <Screen preset="fixed" style={styles.container} contentContainerStyle={styles.container}>
        <View style={styles.contentWrapper}>
          <Text preset="heading" text="✓" style={[styles.title, { fontSize: 64, color: colors.palette.biancaSuccess || colors.palette.success500 || "#10b981" }]} />
          <Text preset="heading" tx="emailVerifiedScreen.title" style={styles.title} />
          <Text preset="default" tx="emailVerifiedScreen.redirecting" style={styles.message} />
        </View>
      </Screen>
    )
  }

  if (status === "error") {
    return (
      <Screen preset="fixed" style={styles.container} contentContainerStyle={styles.container}>
        <View style={styles.contentWrapper}>
          <Text preset="heading" text="⚠️" style={[styles.title, { fontSize: 64, color: colors.palette.biancaError || colors.palette.error500 || "#ef4444" }]} />
          <Text preset="heading" tx="emailVerificationFailedPage.title" style={styles.title} />
          <Text preset="default" text={errorMessage} style={styles.errorMessage} />
          <View style={styles.buttonContainer}>
            <Button
              tx="emailVerificationFailedPage.loginButton"
              onPress={() => navigation.navigate("Login" as never)}
              preset="default"
            />
          </View>
        </View>
      </Screen>
    )
  }

  // Verifying state
  return (
    <Screen preset="fixed" style={styles.container} contentContainerStyle={styles.container}>
      <View style={styles.contentWrapper}>
        <Text preset="heading" tx="emailVerificationScreen.title" style={styles.title} />
        <Text preset="default" tx="emailVerificationScreen.message" style={styles.message} />
        <Text preset="default" tx="emailVerificationScreen.verifying" style={styles.message} />
      </View>
    </Screen>
  )
}

