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
import { getPatient } from "../store/patientSlice"
import { logger } from "../utils/logger"

type SentimentAnalysisScreenRouteProp = RouteProp<HomeStackParamList, "SentimentAnalysis">

export function SentimentAnalysisScreen() {
  const route = useRoute<SentimentAnalysisScreenRouteProp>()
  
  // Get patient from route params (when accessed from Patient screen) or Redux state (when accessed from Reports)
  const routePatientId = route.params?.patientId
  const routePatientName = route.params?.patientName
  const selectedPatient = useSelector(getPatient)
  const { colors, isLoading: themeLoading } = useTheme()
  
  // Prioritize route params (from Patient screen) over Redux state (from Reports)
  const patientId = routePatientId || selectedPatient?.id
  const patientName = routePatientName || selectedPatient?.name

  const [selectedTimeRange, setSelectedTimeRange] = useState<"lastCall" | "month" | "lifetime">("lastCall")

  // Only fetch sentiment data if we have a patient
  const shouldFetchData = !!patientId && (typeof patientId === 'string' ? patientId.trim().length > 0 : true)

  // Fetch sentiment data
  const {
    data: trendData,
    isLoading: isTrendLoading,
    isFetching: isTrendFetching,
    refetch: refetchTrend,
    error: trendError,
  } = useGetSentimentTrendQuery({
    patientId: patientId || "",
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
    patientId: patientId || "",
  }, {
    skip: !shouldFetchData,
  })

  // Debug logging
  React.useEffect(() => {
    logger.debug('=== SENTIMENT ANALYSIS DEBUG ===')
    logger.debug('[SentimentAnalysis] Patient source:', routePatientId ? 'route params' : 'Redux state')
    logger.debug('[SentimentAnalysis] Patient ID:', patientId)
    logger.debug('[SentimentAnalysis] Patient name:', patientName)
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
  }, [patientId, patientName, shouldFetchData, isTrendLoading, isSummaryLoading, isTrendFetching, isSummaryFetching, trendError, summaryError, trendData, summaryData, routePatientId])

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

  // Show message if no patient is selected
  if (!patientId) {
    return (
      <Screen
        style={styles.container}
        preset="scroll"
        safeAreaEdges={["top"]}
      >
        <View style={styles.noPatientContainer}>
          <Text style={styles.noPatientTitle}>{translate("sentimentAnalysis.noPatientSelected")}</Text>
          <Text style={styles.noPatientMessage}>
            {translate("sentimentAnalysis.selectPatientToView")}
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
        patientId={patientId}
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
  noPatientContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  noPatientTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.palette.biancaHeader,
    marginBottom: 16,
    textAlign: "center",
  },
  noPatientMessage: {
    fontSize: 16,
    color: colors.palette.neutral600,
    textAlign: "center",
    lineHeight: 24,
  },
})

