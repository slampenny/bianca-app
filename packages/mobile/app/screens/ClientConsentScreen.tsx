import React, { useCallback, useEffect, useState } from "react"
import { Linking, Platform, ScrollView, View, StyleSheet } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { Screen, Text, Button, Toggle } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { spacing } from "app/theme"
import type { ThemeColors } from "../types"
import {
  useLazyValidateConsentTokenQuery,
  useSubmitClientConsentMutation,
} from "app/services/api/clientApi"
import { logger } from "../utils/logger"

type ConsentPurpose = "recording" | "transcription" | "aiAnalysis" | "familyReports"

const PURPOSE_META: Record<ConsentPurpose, { label: string; description: string }> = {
  recording: {
    label: "Call recording",
    description:
      "Record wellness check calls for quality assurance and care coordination. Calls can still occur without recording if you decline.",
  },
  transcription: {
    label: "Call transcription",
    description:
      "Convert call audio into text so caregivers can review conversations and provide better support.",
  },
  aiAnalysis: {
    label: "AI analysis",
    description: "Use AI to analyze call content and generate wellness insights for your care team.",
  },
  familyReports: {
    label: "Family wellness reports",
    description:
      "Share weekly call summaries with an authorized emergency contact or family member you designate.",
  },
}

const ALL_PURPOSES: ConsentPurpose[] = ["recording", "transcription", "aiAnalysis", "familyReports"]

const emptyPurposeMap = (): Record<ConsentPurpose, boolean> => ({
  recording: false,
  transcription: false,
  aiAnalysis: false,
  familyReports: false,
})

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.palette.biancaBackground || colors.palette.neutral100,
    },
    contentWrapper: {
      width: "100%",
      maxWidth: 500,
      alignSelf: "center",
      padding: spacing.lg,
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
    intro: {
      color: colors.palette.neutral600,
      fontSize: 16,
      textAlign: "left",
      marginBottom: spacing.lg,
      lineHeight: 24,
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
    purposeRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    purposeText: {
      flex: 1,
    },
    purposeLabel: {
      color: colors.palette.neutral800 || colors.palette.biancaHeader,
      fontSize: 16,
      fontWeight: "600",
      marginBottom: spacing.xxs,
    },
    purposeDescription: {
      color: colors.palette.neutral600,
      fontSize: 14,
      lineHeight: 20,
    },
    grantedBadge: {
      color: colors.palette.biancaSuccess || "#0d9488",
      fontSize: 14,
      marginTop: spacing.xxs,
    },
    formError: {
      color: colors.palette.biancaError || colors.palette.error500 || "#ef4444",
      fontSize: 14,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    buttonContainer: {
      marginTop: spacing.md,
      width: "100%",
    },
  })

export const ClientConsentScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { colors, isLoading: themeLoading } = useTheme()
  const [token, setToken] = useState<string>("")
  const [status, setStatus] = useState<"loading" | "form" | "success" | "error">("loading")
  const [message, setMessage] = useState("")
  const [clientName, setClientName] = useState("")
  const [orgName, setOrgName] = useState("")
  const [selected, setSelected] = useState<Record<ConsentPurpose, boolean>>(emptyPurposeMap)
  const [alreadyGranted, setAlreadyGranted] = useState<Record<ConsentPurpose, boolean>>(emptyPurposeMap)

  const [validateToken, { isFetching: isValidating }] = useLazyValidateConsentTokenQuery()
  const [submitConsent, { isLoading: isSubmitting }] = useSubmitClientConsentMutation()

  useEffect(() => {
    let cancelled = false

    const resolveToken = async (): Promise<string | null> => {
      const routeParams = route.params as { token?: string } | undefined
      if (routeParams?.token) {
        return routeParams.token
      }

      if (Platform.OS === "web" && typeof window !== "undefined") {
        const urlToken = new URLSearchParams(window.location.search).get("token")
        if (urlToken) return urlToken
      }

      try {
        const initialUrl = await Linking.getInitialURL()
        if (initialUrl) {
          try {
            const url = new URL(initialUrl)
            const urlToken = url.searchParams.get("token")
            if (urlToken) return urlToken
          } catch {
            const match = initialUrl.match(/[?&]token=([^&]+)/)
            if (match?.[1]) return decodeURIComponent(match[1])
          }
        }
      } catch (e) {
        logger.error("Error extracting token from URL:", e)
      }

      return null
    }

    resolveToken().then((resolved) => {
      if (cancelled) return
      if (!resolved) {
        setStatus("error")
        setMessage("Consent token is missing. Please check your email for the correct link.")
        return
      }
      setToken(resolved)
    })

    if (Platform.OS !== "web") {
      const subscription = Linking.addEventListener("url", (event) => {
        try {
          const url = new URL(event.url)
          const urlToken = url.searchParams.get("token")
          if (urlToken) {
            setToken(urlToken)
            navigation.setParams({ token: urlToken } as never)
          }
        } catch {
          const match = event.url.match(/[?&]token=([^&]+)/)
          if (match?.[1]) {
            const urlToken = decodeURIComponent(match[1])
            setToken(urlToken)
            navigation.setParams({ token: urlToken } as never)
          }
        }
      })
      return () => {
        cancelled = true
        subscription.remove()
      }
    }

    return () => {
      cancelled = true
    }
  }, [navigation, route.params])

  useEffect(() => {
    if (!token) return

    let cancelled = false
    setStatus("loading")
    setMessage("")

    validateToken({ token })
      .unwrap()
      .then((res) => {
        if (cancelled) return
        setClientName(res.clientName || "")
        setOrgName(res.orgName || "")
        const granted = res.consentedPurposes || {}
        const grantedMap = ALL_PURPOSES.reduce(
          (acc, purpose) => {
            acc[purpose] = granted[purpose] === true
            return acc
          },
          {} as Record<ConsentPurpose, boolean>,
        )
        setAlreadyGranted(grantedMap)
        setSelected(emptyPurposeMap())
        setStatus("form")
      })
      .catch((error: { data?: { error?: string; message?: string }; message?: string }) => {
        if (cancelled) return
        setStatus("error")
        setMessage(
          error?.data?.error ||
            error?.data?.message ||
            error?.message ||
            "Invalid or expired consent link. Please contact your care organization for a new link.",
        )
      })

    return () => {
      cancelled = true
    }
  }, [token, validateToken])

  const togglePurpose = useCallback((purpose: ConsentPurpose) => {
    if (alreadyGranted[purpose]) return
    setSelected((prev) => ({ ...prev, [purpose]: !prev[purpose] }))
  }, [alreadyGranted])

  const handleSubmit = useCallback(async () => {
    const purposes = ALL_PURPOSES.filter((p) => selected[p] && !alreadyGranted[p])
    if (purposes.length === 0) {
      setMessage("Select at least one purpose you have not already consented to.")
      return
    }

    try {
      const result = await submitConsent({ token, purposes }).unwrap()
      setStatus("success")
      setMessage(result.message || "Your consent has been recorded. Thank you.")
    } catch (error: unknown) {
      const err = error as { data?: { error?: string; message?: string }; message?: string }
      logger.error("Consent submission failed:", error)
      setStatus("error")
      setMessage(
        err?.data?.error ||
          err?.data?.message ||
          err?.message ||
          "We could not save your consent. Please contact your care organization for help.",
      )
    }
  }, [alreadyGranted, selected, submitConsent, token])

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  const title =
    status === "success"
      ? "Consent recorded"
      : status === "error" && !token
        ? "Consent"
        : status === "error"
          ? "Could not save consent"
          : status === "loading"
            ? "Loading consent form"
            : "Your consent preferences"

  return (
    <Screen preset="scroll" style={styles.container} safeAreaEdges={["top", "bottom"]} testID="client-consent-screen">
      <ScrollView contentContainerStyle={styles.contentWrapper} keyboardShouldPersistTaps="handled">
        <Text preset="heading" style={styles.title}>
          {title}
        </Text>

        {(status === "loading" || isValidating) && (
          <Text preset="default" style={styles.message}>
            Please wait while we load your consent options…
          </Text>
        )}

        {status === "form" && (
          <>
            <Text preset="default" style={styles.intro}>
              {clientName ? `Hello ${clientName}, ` : ""}
              {orgName
                ? `${orgName} uses Bianca Wellness for wellness check calls. `
                : "Your care organization uses Bianca Wellness. "}
              Select each purpose you consent to. Nothing is pre-selected — submit only when you are ready.
            </Text>

            {ALL_PURPOSES.map((purpose) => {
              const meta = PURPOSE_META[purpose]
              const isGranted = alreadyGranted[purpose]
              return (
                <View key={purpose} style={styles.purposeRow}>
                  <Toggle
                    variant="checkbox"
                    value={isGranted || selected[purpose]}
                    onValueChange={() => togglePurpose(purpose)}
                    editable={!isGranted}
                    testID={`consent-purpose-${purpose}`}
                  />
                  <View style={styles.purposeText}>
                    <Text style={styles.purposeLabel}>{meta.label}</Text>
                    {isGranted ? (
                      <Text style={styles.grantedBadge}>(already on file)</Text>
                    ) : null}
                    <Text style={styles.purposeDescription}>{meta.description}</Text>
                  </View>
                </View>
              )
            })}

            {message ? <Text style={styles.formError}>{message}</Text> : null}

            <View style={styles.buttonContainer}>
              <Button
                text={isSubmitting ? "Saving…" : "Submit selected consents"}
                onPress={() => void handleSubmit()}
                disabled={isSubmitting}
                testID="consent-submit-button"
              />
            </View>
          </>
        )}

        {status === "success" && (
          <>
            <Text preset="heading" style={styles.successTitle}>
              ✓ Consent Confirmed
            </Text>
            <Text preset="default" style={styles.message}>
              {message}
            </Text>
            <Text preset="default" style={styles.message}>
              You can close this window.
            </Text>
          </>
        )}

        {status === "error" && (
          <>
            <Text preset="default" style={styles.errorMessage}>
              {message}
            </Text>
            {token ? (
              <Text preset="default" style={styles.message}>
                Contact your care organization if you need a new consent link.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}
