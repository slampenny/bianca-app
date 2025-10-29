import React, { useState, useCallback } from "react"
import { View, StyleSheet } from "react-native"
import { useRoute, RouteProp } from "@react-navigation/native"
import { useNavigation } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { Screen } from "../components/Screen"
import { SentimentDashboard } from "../components/SentimentDashboard"
import { SentimentDebugPanel } from "../components/SentimentDebugPanel"
import { useTheme } from "../theme/ThemeContext"
import { Text } from "../components"
import { translate } from "../i18n"
import {
  useGetSentimentTrendQuery,
  useGetSentimentSummaryQuery,
} from "../services/api/sentimentApi"
import { HomeStackParamList } from "../navigators/navigationTypes"
import { getPatient } from "../store/patientSlice"

type SentimentAnalysisScreenRouteProp = RouteProp<HomeStackParamList, "SentimentAnalysis">

export function SentimentAnalysisScreen() {
  const route = useRoute<SentimentAnalysisScreenRouteProp>()
  const navigation = useNavigation()
  
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
  const shouldFetchData = !!patientId

  // Fetch sentiment data
  const {
    data: trendData,
    isLoading: isTrendLoading,
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
    refetch: refetchSummary,
    error: summaryError,
  } = useGetSentimentSummaryQuery({
    patientId: patientId || "",
  }, {
    skip: !shouldFetchData,
  })

  // Debug logging
  React.useEffect(() => {
    console.log('=== SENTIMENT ANALYSIS DEBUG ===')
    console.log('[SentimentAnalysis] Patient source:', routePatientId ? 'route params' : 'Redux state')
    console.log('[SentimentAnalysis] Patient ID:', patientId)
    console.log('[SentimentAnalysis] Patient name:', patientName)
    console.log('[SentimentAnalysis] Should fetch data:', shouldFetchData)
    console.log('[SentimentAnalysis] Trend loading:', isTrendLoading)
    console.log('[SentimentAnalysis] Summary loading:', isSummaryLoading)
    console.log('[SentimentAnalysis] Trend error:', trendError)
    console.log('[SentimentAnalysis] Summary error:', summaryError)
    console.log('[SentimentAnalysis] Trend data (full):', JSON.stringify(trendData, null, 2))
    console.log('[SentimentAnalysis] Summary data (full):', JSON.stringify(summaryData, null, 2))
    console.log('=== END DEBUG ===')
  }, [patientId, patientName, shouldFetchData, isTrendLoading, isSummaryLoading, trendError, summaryError, trendData, summaryData, routePatientId])

  const handleRefresh = useCallback(() => {
    refetchTrend()
    refetchSummary()
  }, [refetchTrend, refetchSummary])

  const handleTimeRangeChange = useCallback((timeRange: "lastCall" | "month" | "lifetime") => {
    setSelectedTimeRange(timeRange)
  }, [])

  const isLoading = isTrendLoading || isSummaryLoading

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
        onRefresh={handleRefresh}
        onTimeRangeChange={handleTimeRangeChange}
      />
      
      {/* Debug Panel - Only show in development */}
      {__DEV__ && <SentimentDebugPanel />}
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

