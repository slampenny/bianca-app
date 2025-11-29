import React, { useEffect, useState } from "react"
import { View, StyleSheet, Linking } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { useSelector, useDispatch } from "react-redux"
import { isAuthenticated, setAuthTokens, setCurrentUser, setAuthEmail } from "app/store/authSlice"
import { setCaregiver } from "app/store/caregiverSlice"
import { setOrg } from "app/store/orgSlice"
import { Screen, Text, Button } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { spacing } from "app/theme"
import { translate } from "app/i18n"
import type { ThemeColors } from "../types"
import { navigationRef } from "app/navigators/navigationUtilities"
import { useVerifyEmailMutation } from "app/services/api/authApi"
import { logger } from "../utils/logger"

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  const dispatch = useDispatch()
  const { colors, isLoading: themeLoading } = useTheme()
  const isLoggedIn = useSelector(isAuthenticated)
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [verifyEmail, { isLoading: isVerifying }] = useVerifyEmailMutation()

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
        logger.error('Error extracting token from URL:', e)
        return null
      }
    }

    // If no token in route params, try to extract from URL
    if (!token) {
      extractTokenFromUrl().then((extractedToken) => {
        if (!extractedToken && !token) {
          setStatus("error")
          setErrorMessage(translate("emailVerificationScreen.errorNoToken"))
        }
      })
      return
    }

    // Call the backend API to verify the email using RTK Query
    const verifyEmailMutation = async () => {
      try {
        const result = await verifyEmail({ token }).unwrap()
        
        if (result.success) {
          // If we got tokens back, automatically log the user in
          if (result.tokens && result.caregiver) {
            // Set tokens and user data for auto-login
            dispatch(setAuthTokens(result.tokens))
            dispatch(setCurrentUser(result.caregiver))
            dispatch(setAuthEmail(result.caregiver.email))
            dispatch(setCaregiver(result.caregiver))
            
            if (result.org) {
              dispatch(setOrg(result.org))
            }
            
            // Navigate to EmailVerifiedScreen which will replace itself with MainTabs
            navigation.navigate("EmailVerified" as never)
          } else {
            // No tokens (HTML response) - just navigate to EmailVerifiedScreen
            navigation.navigate("EmailVerified" as never)
          }
        } else {
          // Verification failed - backend returns HTML, try to extract error message
          setStatus("error")
          if (result.html) {
            // Simple regex to extract error message from HTML
            const messageMatch = result.html.match(/<p[^>]*class="message"[^>]*>([^<]+)<\/p>/i) || 
                                 result.html.match(/<p[^>]*>([^<]+)<\/p>/i)
            const errorMsg = messageMatch ? messageMatch[1].trim() : translate("emailVerificationScreen.verificationFailed")
            setErrorMessage(errorMsg)
          } else {
            setErrorMessage(result.message || translate("emailVerificationScreen.verificationFailed"))
          }
        }
      } catch (error: unknown) {
        logger.error('Email verification error:', error)
        setStatus("error")
        // RTK Query error handling
        if (error?.data?.html) {
          // Try to extract error from HTML response
          const messageMatch = error.data.html.match(/<p[^>]*class="message"[^>]*>([^<]+)<\/p>/i) || 
                               error.data.html.match(/<p[^>]*>([^<]+)<\/p>/i)
          const errorMsg = messageMatch ? messageMatch[1].trim() : translate("emailVerificationScreen.verificationFailed")
          setErrorMessage(errorMsg)
        } else if (error?.status === 'FETCH_ERROR' || error?.error === 'FETCH_ERROR') {
          setErrorMessage(translate("emailVerificationScreen.errorNetwork") || "Unable to connect to server. Please check your internet connection and try again.")
        } else {
          setErrorMessage(error?.data?.message || error?.message || translate("emailVerificationScreen.errorVerificationFailed"))
        }
      }
    }

    // Only verify if we have a token
    if (token) {
      verifyEmailMutation()
    }
  }, [token, navigation, verifyEmail])

  if (themeLoading || !colors) {
    return null
  }

  const styles = createStyles(colors)

  if (status === "success") {
    return (
      <Screen preset="fixed" style={styles.container} contentContainerStyle={styles.container}>
        <View style={styles.contentWrapper}>
          <Text preset="heading" text="✓" style={[styles.title, { fontSize: 64, color: colors?.palette?.biancaSuccess || colors?.palette?.success500 || "#10b981" }]} />
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
          <Text preset="heading" text="⚠️" style={[styles.title, { fontSize: 64, color: colors?.palette?.biancaError || colors?.palette?.error500 || "#ef4444" }]} />
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

