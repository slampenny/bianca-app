import React, { useState, useCallback } from "react"
import { View, StyleSheet } from "react-native"
import { useRoute, RouteProp } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { Screen } from "../components/Screen"
import { SentimentDashboard } from "../components/SentimentDashboard"
import { useTheme } from "../theme/ThemeContext"
import { Text } from "../components"
import { translate } from "../i18n"
import {
  useGetSentimentTrendQuery,
  useGetSentimentSummaryQuery,
} from "../services/api/sentimentApi"
import { HomeStackParamList } from "../navigators/navigationTypes"
import { getClient } from "../store/clientSlice"
import { logger } from "../utils/logger"

type SentimentAnalysisScreenRouteProp = RouteProp<HomeStackParamList, "SentimentAnalysis">

export function SentimentAnalysisScreen() {
  const route = useRoute<SentimentAnalysisScreenRouteProp>()
  
  const routeClientId = route.params?.clientId
  const routeClientName = route.params?.clientName
  const selectedClient = useSelector(getClient)
  const { colors, isLoading: themeLoading } = useTheme()
  const clientId = routeClientId || selectedClient?.id
  const clientName = routeClientName || selectedClient?.name

  const [selectedTimeRange, setSelectedTimeRange] = useState<"lastCall" | "month" | "lifetime">("lastCall")

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
  
  // Log errors for debugging
  React.useEffect(() => {
    if (trendError) {
      logger.error('[SentimentAnalysis] Trend query error:', trendError)
    }
    if (summaryError) {
      logger.error('[SentimentAnalysis] Summary query error:', summaryError)
    }
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
})

