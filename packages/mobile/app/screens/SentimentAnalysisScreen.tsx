import React, { useState, useCallback } from "react"
import { View, StyleSheet } from "react-native"
import { useRoute } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { Screen } from "../components/Screen"
import { SentimentDashboard } from "../components/SentimentDashboard"
import { useTheme } from "../theme/ThemeContext"
import { Text, Button } from "../components"
import { useAuthModal } from "../contexts/AuthModalContext"
import { getQueryErrorMessage, getQueryErrorStatus } from "../utils/rtkQueryError"
import { translate } from "../i18n"
import {
  useGetSentimentTrendQuery,
  useGetSentimentSummaryQuery,
} from "../services/api/sentimentApi"
import type { SentimentAnalysisScreenParams } from "../navigators/navigationTypes"
import { getClient } from "../store/clientSlice"
import { logger } from "../utils/logger"

function sentimentParamsFromRoute(route: { params?: object }): SentimentAnalysisScreenParams {
  return (route.params ?? {}) as SentimentAnalysisScreenParams
}

export function SentimentAnalysisScreen() {
  const route = useRoute()
  const { showAuthModal } = useAuthModal()

  const sp = sentimentParamsFromRoute(route)
  const routeClientId = sp.clientId
  const routeClientName = sp.clientName
  const timeRangeFromParams = sp.timeRange
  const selectedClient = useSelector(getClient)
  const { colors, isLoading: themeLoading } = useTheme()
  const clientId = routeClientId || selectedClient?.id
  const clientName = routeClientName || selectedClient?.name

  const resolveTimeRange = (tr: SentimentAnalysisScreenParams["timeRange"]): "lastCall" | "month" | "lifetime" => {
    if (tr === "month" || tr === "lifetime" || tr === "lastCall") return tr
    return "lastCall"
  }

  const [selectedTimeRange, setSelectedTimeRange] = useState<"lastCall" | "month" | "lifetime">(() =>
    resolveTimeRange(timeRangeFromParams),
  )

  React.useEffect(() => {
    setSelectedTimeRange(resolveTimeRange(timeRangeFromParams))
  }, [timeRangeFromParams])

  const shouldFetchData = !!clientId && (typeof clientId === 'string' ? clientId.trim().length > 0 : true)

  // Fetch sentiment data
  const {
    data: trendData,
    isLoading: isTrendLoading,
    isFetching: isTrendFetching,
    refetch: refetchTrend,
    error: trendError,
  } = useGetSentimentTrendQuery({
    clientId: clientId || "",
    timeRange: selectedTimeRange,
  }, {
    skip: !shouldFetchData,
  })

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isFetching: isSummaryFetching,
    refetch: refetchSummary,
    error: summaryError,
  } = useGetSentimentSummaryQuery({
    clientId: clientId || "",
  }, {
    skip: !shouldFetchData,
  })

  // Debug logging
  React.useEffect(() => {
    logger.debug('=== SENTIMENT ANALYSIS DEBUG ===')
    logger.debug('[SentimentAnalysis] Client source:', routeClientId ? 'route params' : 'Redux state')
    logger.debug('[SentimentAnalysis] Client ID:', clientId)
    logger.debug('[SentimentAnalysis] Client name:', clientName)
    logger.debug('[SentimentAnalysis] Should fetch data:', shouldFetchData)
    logger.debug('[SentimentAnalysis] Trend loading:', isTrendLoading)
    logger.debug('[SentimentAnalysis] Summary loading:', isSummaryLoading)
    logger.debug('[SentimentAnalysis] Trend fetching:', isTrendFetching)
    logger.debug('[SentimentAnalysis] Summary fetching:', isSummaryFetching)
    logger.debug('[SentimentAnalysis] Trend error:', trendError)
    logger.debug('[SentimentAnalysis] Summary error:', summaryError)
    logger.debug('[SentimentAnalysis] Trend data (full):', JSON.stringify(trendData, null, 2))
    logger.debug('[SentimentAnalysis] Summary data (full):', JSON.stringify(summaryData, null, 2))
    logger.debug('=== END DEBUG ===')
  }, [clientId, clientName, shouldFetchData, isTrendLoading, isSummaryLoading, isTrendFetching, isSummaryFetching, trendError, summaryError, trendData, summaryData, routeClientId])

  const handleRefresh = useCallback(() => {
    refetchTrend()
    refetchSummary()
  }, [refetchTrend, refetchSummary])

  const handleTimeRangeChange = useCallback((timeRange: "lastCall" | "month" | "lifetime") => {
    setSelectedTimeRange(timeRange)
  }, [])

  // Only show loading if we're actually fetching (not just skipped)
  const isLoading = shouldFetchData && (isTrendLoading || isSummaryLoading || isTrendFetching || isSummaryFetching)

  const trendStatus = getQueryErrorStatus(trendError)
  const summaryStatus = getQueryErrorStatus(summaryError)
  const showSessionRequired =
    shouldFetchData && !isLoading && (trendStatus === 401 || summaryStatus === 401)
  const showAccessDenied =
    shouldFetchData &&
    !isLoading &&
    !showSessionRequired &&
    (trendStatus === 403 || summaryStatus === 403)

  // Log errors for debugging (401/403 are handled in UI; avoid error-level noise)
  React.useEffect(() => {
    if (!trendError && !summaryError) return
    const ts = getQueryErrorStatus(trendError)
    const ss = getQueryErrorStatus(summaryError)
    if (ts === 401 || ss === 401 || ts === 403 || ss === 403) {
      logger.warn("[SentimentAnalysis] Trend/summary unavailable:", {
        trendStatus: ts,
        summaryStatus: ss,
      })
      return
    }
    if (trendError) logger.error("[SentimentAnalysis] Trend query error:", trendError)
    if (summaryError) logger.error("[SentimentAnalysis] Summary query error:", summaryError)
  }, [trendError, summaryError])

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  if (!clientId) {
    return (
      <Screen
        style={styles.container}
        preset="scroll"
        safeAreaEdges={["top"]}
      >
        <View style={styles.noClientContainer}>
          <Text style={styles.noClientTitle}>{translate("sentimentAnalysis.noClientSelected")}</Text>
          <Text style={styles.noClientMessage}>
            {translate("sentimentAnalysis.selectClientToView")}
          </Text>
        </View>
      </Screen>
    )
  }

  if (showSessionRequired) {
    return (
      <Screen style={styles.container} preset="scroll" safeAreaEdges={["top"]}>
        <View style={styles.noClientContainer}>
          <Text style={styles.noClientTitle}>{translate("sentimentAnalysis.sessionRequiredTitle")}</Text>
          <Text style={styles.noClientMessage}>{translate("sentimentAnalysis.sessionRequiredMessage")}</Text>
          <Button
            preset="primary"
            text={translate("sentimentAnalysis.signInToContinueButton")}
            onPress={() => showAuthModal(translate("common.signInToContinue"))}
            style={styles.authActionButton}
          />
        </View>
      </Screen>
    )
  }

  if (showAccessDenied) {
    const detail =
      getQueryErrorMessage(trendError) || getQueryErrorMessage(summaryError)
    return (
      <Screen style={styles.container} preset="scroll" safeAreaEdges={["top"]}>
        <View style={styles.noClientContainer}>
          <Text style={styles.noClientTitle}>{translate("sentimentAnalysis.accessDeniedTitle")}</Text>
          <Text style={styles.noClientMessage}>{translate("sentimentAnalysis.accessDeniedMessage")}</Text>
          {detail ? (
            <Text style={[styles.noClientMessage, styles.errorDetail]}>{detail}</Text>
          ) : null}
        </View>
      </Screen>
    )
  }

  return (
    <Screen
      style={styles.container}
      preset="scroll"
      safeAreaEdges={["top"]}
    >
      <SentimentDashboard
        clientId={clientId}
        trend={trendData}
        summary={summaryData}
        isLoading={isLoading}
        selectedTimeRange={selectedTimeRange}
        onRefresh={handleRefresh}
        onTimeRangeChange={handleTimeRangeChange}
      />
    </Screen>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.biancaBackground,
  },
  noClientContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  noClientTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.palette.biancaHeader,
    marginBottom: 16,
    textAlign: "center",
  },
  noClientMessage: {
    fontSize: 16,
    color: colors.palette.neutral600,
    textAlign: "center",
    lineHeight: 24,
  },
  authActionButton: {
    marginTop: 20,
    minWidth: 200,
    alignSelf: "center",
  },
  errorDetail: {
    marginTop: 12,
    fontSize: 14,
    opacity: 0.9,
  },
})

