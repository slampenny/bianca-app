import React, { useEffect, useState } from "react"
import { View, StyleSheet, Linking, Platform } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { Screen, Text, Button } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { spacing } from "app/theme"
import type { ThemeColors } from "../types"
import { useVerifyConsentMutation } from "app/services/api/patientApi"
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
  successTitle: {
    color: colors.palette.success || "#27ae60",
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

export const PatientConsentScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { colors, isLoading: themeLoading } = useTheme()
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [successMessage, setSuccessMessage] = useState<string>("")
  const [verifyConsent, { isLoading: isVerifying }] = useVerifyConsentMutation()

  // Extract token from route params
  const routeParams = route.params as any
  let token = routeParams?.token

  useEffect(() => {
    // Helper to extract token from URL (works for both web and mobile)
    const extractTokenFromUrl = async () => {
      try {
        // On web: Check window.location for query parameters
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          const urlToken = urlParams.get('token')
          if (urlToken) {
            return urlToken
          }
        }

        // On mobile: Check initial URL from Linking
        const initialUrl = await Linking.getInitialURL()
        if (initialUrl) {
          try {
            const url = new URL(initialUrl)
            const urlToken = url.searchParams.get('token')
            if (urlToken) {
              return urlToken
            }
          } catch (e) {
            // URL parsing failed, try manual parsing
            const match = initialUrl.match(/[?&]token=([^&]+)/)
            if (match && match[1]) {
              return decodeURIComponent(match[1])
            }
          }
        }

        // Listen for deep links while app is running
        if (Platform.OS !== 'web') {
          const subscription = Linking.addEventListener('url', (event) => {
            try {
              const url = new URL(event.url)
              const urlToken = url.searchParams.get('token')
              if (urlToken) {
                token = urlToken
                navigation.setParams({ token } as any)
              }
            } catch (e) {
              // URL parsing failed, try manual parsing
              const match = event.url.match(/[?&]token=([^&]+)/)
              if (match && match[1]) {
                token = decodeURIComponent(match[1])
                navigation.setParams({ token } as any)
              }
            }
          })

          return () => subscription.remove()
        }
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
          setErrorMessage("Consent token is missing. Please check your email for the correct link.")
        } else if (extractedToken) {
          token = extractedToken
        }
      })
      return
    }

    // Call the backend API to verify consent
    const verifyConsentMutation = async () => {
      try {
        const result = await verifyConsent({ token }).unwrap()
        
        if (result.success) {
          setStatus("success")
          setSuccessMessage(result.message)
        } else {
          setStatus("error")
          setErrorMessage(result.message || "Failed to verify consent")
        }
      } catch (error: any) {
        logger.error('Consent verification failed:', error)
        setStatus("error")
        setErrorMessage(
          error?.data?.error || 
          error?.message || 
          "Invalid or expired consent token. Please contact your healthcare organization for a new consent link."
        )
      }
    }

    verifyConsentMutation()
  }, [token, navigation, verifyConsent])

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  return (
    <Screen 
      preset="fixed" 
      style={styles.container}
      contentContainerStyle={styles.container}
    >
      <View style={styles.contentWrapper}>
        {status === "verifying" && (
          <>
            <Text preset="heading" style={styles.title}>
              Verifying Consent...
            </Text>
            <Text preset="default" style={styles.message}>
              Please wait while we verify your consent token.
            </Text>
            {isVerifying && (
              <View style={styles.spinner}>
                <Text>Loading...</Text>
              </View>
            )}
          </>
        )}

        {status === "success" && (
          <>
            <Text preset="heading" style={styles.successTitle}>
              ✓ Consent Confirmed
            </Text>
            <Text preset="default" style={styles.message}>
              {successMessage}
            </Text>
            <Text preset="default" style={styles.message}>
              You can close this window.
            </Text>
          </>
        )}

        {status === "error" && (
          <>
            <Text preset="heading" style={styles.title}>
              Consent Error
            </Text>
            <Text preset="default" style={styles.errorMessage}>
              {errorMessage}
            </Text>
            <Text preset="default" style={styles.message}>
              Please contact your healthcare organization if you need a new consent link.
            </Text>
          </>
        )}
      </View>
    </Screen>
  )
}





