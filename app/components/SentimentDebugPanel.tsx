import React, { useState } from "react"
import { View, StyleSheet, ScrollView, Alert } from "react-native"
import { Button, Text } from "./"
import { useTheme } from "../theme/ThemeContext"
import { useDebugSentimentAnalysisMutation, useDebugConversationDataMutation, useGetSentimentSummaryQuery, sentimentApi } from "../services/api/sentimentApi"
import { useSelector, useDispatch } from "react-redux"
import { getPatient } from "../store/patientSlice"
import { translate } from "../i18n"

interface SentimentDebugPanelProps {
  style?: any
}

export function SentimentDebugPanel({ style }: SentimentDebugPanelProps) {
  const { colors } = useTheme()
  const [debugResult, setDebugResult] = useState<any>(null)
  const [conversationDebugResult, setConversationDebugResult] = useState<any>(null)
  const [debugSentimentAnalysis, { isLoading: isDebugLoading }] = useDebugSentimentAnalysisMutation()
  const [debugConversationData, { isLoading: isConversationDebugLoading }] = useDebugConversationDataMutation()
  const dispatch = useDispatch()
  
  // Get current patient for testing
  const currentPatient = useSelector(getPatient)
  const styles = createStyles(colors)
  
  // Test the sentiment summary query directly
  const {
    data: testSummaryData,
    isLoading: isTestLoading,
    error: testError,
  } = useGetSentimentSummaryQuery(
    { patientId: currentPatient?.id || "" },
    { skip: !currentPatient?.id }
  )

  const handleDebugSentiment = async () => {
    try {
      const result = await debugSentimentAnalysis({
        hoursBack: 48, // Look back 48 hours
        maxConversations: 20,
        forceReanalyze: false,
      }).unwrap()

      setDebugResult(result)
      
      Alert.alert(
        translate("sentimentAnalysis.debugComplete"),
        `Found ${result.summary.totalConversations} conversations. Successfully analyzed ${result.summary.successfullyAnalyzed}, failed ${result.summary.failedAnalyses}.`,
        [{ text: "OK" }]
      )
    } catch (error: any) {
      console.error("Debug sentiment analysis failed:", error)
      Alert.alert(
        translate("sentimentAnalysis.debugFailed"),
        error?.data?.message || error?.message || "Unknown error occurred",
        [{ text: "OK" }]
      )
    }
  }

  const handleDebugConversationData = async () => {
    if (!currentPatient?.id) {
      Alert.alert(translate("sentimentAnalysis.noPatient"), translate("sentimentAnalysis.pleaseSelectPatient"), [{ text: "OK" }])
      return
    }

    try {
      const result = await debugConversationData({
        patientId: currentPatient.id,
      }).unwrap()

      setConversationDebugResult(result)
      
      console.log('=== CONVERSATION DEBUG RESULT ===')
      console.log(JSON.stringify(result, null, 2))
      console.log('=== END CONVERSATION DEBUG ===')
      
      Alert.alert(
        translate("sentimentAnalysis.conversationDebugComplete"),
        `Total: ${result.summary.totalConversations}, Recent: ${result.summary.recentConversations}, With Sentiment: ${result.summary.conversationsWithSentiment}, Test Found: ${result.summary.testConversationFound}`,
        [{ text: "OK" }]
      )
    } catch (error: any) {
      console.error("Debug conversation data failed:", error)
      Alert.alert(
        translate("sentimentAnalysis.debugFailed"),
        error?.data?.message || error?.message || "Unknown error occurred",
        [{ text: "OK" }]
      )
    }
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{translate("sentimentAnalysis.sentimentAnalysisDebug")}</Text>
      <Text style={styles.subtitle}>
        {translate("sentimentAnalysis.debugSubtitle")}
      </Text>
      
      <Button
        text={isDebugLoading ? translate("sentimentAnalysis.debugging") : translate("sentimentAnalysis.debugSentimentAnalysis")}
        onPress={handleDebugSentiment}
        disabled={isDebugLoading}
        style={styles.debugButton}
        testID="debug-sentiment-button"
      />
      
      <Button
        text={isConversationDebugLoading ? translate("sentimentAnalysis.loading") : translate("sentimentAnalysis.debugConversationData")}
        onPress={handleDebugConversationData}
        disabled={isConversationDebugLoading || !currentPatient}
        style={[styles.debugButton, styles.conversationButton]}
        testID="debug-conversation-data-button"
      />
      
      <Button
        text={isTestLoading ? translate("sentimentAnalysis.testing") : translate("sentimentAnalysis.testDirectApiCall")}
        onPress={() => {
          console.log('=== DIRECT API TEST ===')
          console.log('Current Patient:', currentPatient)
          console.log('Test Summary Data:', JSON.stringify(testSummaryData, null, 2))
          console.log('Test Error:', testError)
          console.log('=== END DIRECT TEST ===')
          Alert.alert(
            translate("sentimentAnalysis.directApiTest"),
            `Patient: ${currentPatient?.name || 'None'}\nLoading: ${isTestLoading}\nError: ${testError ? 'Yes' : 'No'}\nData: ${testSummaryData ? 'Received' : 'None'}\n\nSummary Data:\n${JSON.stringify(testSummaryData, null, 2)}`,
            [{ text: "OK" }]
          )
        }}
        disabled={isTestLoading || !currentPatient}
        style={[styles.debugButton, styles.testButton]}
        testID="test-direct-api-button"
      />
      
      <Button
        text={translate("sentimentAnalysis.forceRefreshCache")}
        onPress={() => {
          console.log('=== FORCE REFRESH CACHE ===')
          
          // Invalidate all sentiment-related cache entries
          dispatch(sentimentApi.util.invalidateTags([
            { type: "SentimentTrend", id: "LIST" },
            { type: "SentimentSummary", id: "LIST" },
            { type: "SentimentAnalysis", id: "LIST" },
          ]))
          
          // Also try to refetch the current queries
          if (currentPatient?.id) {
            dispatch(sentimentApi.util.invalidateTags([
              { type: "SentimentTrend", id: currentPatient.id },
              { type: "SentimentSummary", id: currentPatient.id },
            ]))
          }
          
          console.log('Cache invalidated - queries should refetch automatically')
          console.log('=== END FORCE REFRESH ===')
          
          Alert.alert(
            translate("sentimentAnalysis.cacheRefreshed"),
            translate("sentimentAnalysis.cacheRefreshedMessage"),
            [{ text: "OK" }]
          )
        }}
        disabled={!currentPatient}
        style={[styles.debugButton, styles.refreshButton]}
        testID="force-refresh-cache-button"
      />
      
      {/* Show current patient info */}
      <View style={styles.patientInfo}>
        <Text style={styles.patientInfoTitle}>{translate("sentimentAnalysis.currentPatient")}</Text>
        <Text style={styles.patientInfoText}>
          {currentPatient ? `${currentPatient.name} (${currentPatient.id})` : translate("sentimentAnalysis.noPatientSelected")}
        </Text>
      </View>

      {debugResult && (
        <ScrollView style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>{translate("sentimentAnalysis.debugResults")}</Text>
          
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              {translate("sentimentAnalysis.totalConversations")}: {debugResult.summary.totalConversations}
            </Text>
            <Text style={styles.summaryText}>
              {translate("sentimentAnalysis.withoutSentiment")}: {debugResult.summary.conversationsWithoutSentiment}
            </Text>
            <Text style={styles.summaryText}>
              {translate("sentimentAnalysis.successfullyAnalyzed")}: {debugResult.summary.successfullyAnalyzed}
            </Text>
            <Text style={styles.summaryText}>
              {translate("sentimentAnalysis.failedAnalyses")}: {debugResult.summary.failedAnalyses}
            </Text>
          </View>

          <Text style={styles.conversationsTitle}>{translate("sentimentAnalysis.conversationDetails")}</Text>
          {debugResult.conversations.map((conv: any, index: number) => (
            <View key={conv.conversationId} style={styles.conversationItem}>
              <Text style={styles.conversationHeader}>
                {index + 1}. {conv.patientName} ({conv.messageCount} {translate("sentimentAnalysis.messages")})
              </Text>
              <Text style={styles.conversationTime}>
                {new Date(conv.endTime).toLocaleString()}
              </Text>
              
              {conv.analysisResult ? (
                conv.analysisResult.success ? (
                  <View style={styles.successResult}>
                    <Text style={styles.resultText}>
                      ✅ {translate("sentimentAnalysis.sentiment")}: {conv.analysisResult.sentiment} ({translate("sentimentAnalysis.score")}: {conv.analysisResult.score})
                    </Text>
                    <Text style={styles.resultText}>
                      {translate("sentimentAnalysis.mood")}: {conv.analysisResult.mood}
                    </Text>
                    <Text style={styles.resultText}>
                      {translate("sentimentAnalysis.emotions")}: {conv.analysisResult.emotions?.join(", ") || "N/A"}
                    </Text>
                    <Text style={styles.resultText}>
                      {translate("sentimentAnalysis.concernLevel")}: {conv.analysisResult.concernLevel}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.errorResult}>
                    <Text style={styles.errorText}>
                      ❌ {translate("sentimentAnalysis.failed")}: {conv.analysisResult.error}
                    </Text>
                  </View>
                )
              ) : (
                <Text style={styles.noResultText}>{translate("sentimentAnalysis.noAnalysisPerformed")}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textDim || colors.palette.neutral600,
    marginBottom: 16,
    lineHeight: 20,
  },
  debugButton: {
    backgroundColor: colors.palette.biancaWarning,
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: colors.palette.biancaButtonSelected || colors.palette.primary500,
  },
  conversationButton: {
    backgroundColor: colors.palette.biancaError || colors.error,
  },
  refreshButton: {
    backgroundColor: colors.palette.biancaPrimary || colors.palette.primary500,
  },
  patientInfo: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  patientInfoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
    marginBottom: 4,
  },
  patientInfoText: {
    fontSize: 12,
    color: colors.textDim || colors.palette.neutral700 || colors.palette.neutral600,
  },
  resultsContainer: {
    maxHeight: 400,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
    marginBottom: 12,
  },
  summaryContainer: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    color: colors.palette.biancaHeader || colors.text,
    marginBottom: 4,
  },
  conversationsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
    marginBottom: 8,
  },
  conversationItem: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  conversationHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
    marginBottom: 4,
  },
  conversationTime: {
    fontSize: 12,
    color: colors.textDim || colors.palette.neutral600,
    marginBottom: 8,
  },
  successResult: {
    backgroundColor: colors.palette.biancaSuccessBackground || "rgba(34, 197, 94, 0.1)",
    borderRadius: 6,
    padding: 8,
  },
  errorResult: {
    backgroundColor: colors.palette.biancaErrorBackground || "rgba(239, 68, 68, 0.1)",
    borderRadius: 6,
    padding: 8,
  },
  resultText: {
    fontSize: 12,
    color: colors.palette.biancaHeader || colors.text,
    marginBottom: 2,
  },
  errorText: {
    fontSize: 12,
    color: colors.palette.biancaError || colors.error,
  },
  noResultText: {
    fontSize: 12,
    color: colors.textDim || colors.palette.neutral600,
    fontStyle: "italic",
  },
})
