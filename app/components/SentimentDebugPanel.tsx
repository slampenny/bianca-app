import React, { useState } from "react"
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native"
import { Button } from "./Button"
import { colors } from "../theme/colors"
import { useDebugSentimentAnalysisMutation, useDebugConversationDataMutation, useGetSentimentSummaryQuery, sentimentApi } from "../services/api/sentimentApi"
import { useSelector, useDispatch } from "react-redux"
import { getPatient } from "../store/patientSlice"

interface SentimentDebugPanelProps {
  style?: any
}

export function SentimentDebugPanel({ style }: SentimentDebugPanelProps) {
  const [debugResult, setDebugResult] = useState<any>(null)
  const [conversationDebugResult, setConversationDebugResult] = useState<any>(null)
  const [debugSentimentAnalysis, { isLoading: isDebugLoading }] = useDebugSentimentAnalysisMutation()
  const [debugConversationData, { isLoading: isConversationDebugLoading }] = useDebugConversationDataMutation()
  const dispatch = useDispatch()
  
  // Get current patient for testing
  const currentPatient = useSelector(getPatient)
  
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
        "Debug Complete",
        `Found ${result.summary.totalConversations} conversations. Successfully analyzed ${result.summary.successfullyAnalyzed}, failed ${result.summary.failedAnalyses}.`,
        [{ text: "OK" }]
      )
    } catch (error: any) {
      console.error("Debug sentiment analysis failed:", error)
      Alert.alert(
        "Debug Failed",
        error?.data?.message || error?.message || "Unknown error occurred",
        [{ text: "OK" }]
      )
    }
  }

  const handleDebugConversationData = async () => {
    if (!currentPatient?.id) {
      Alert.alert("No Patient", "Please select a patient first", [{ text: "OK" }])
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
        "Conversation Debug Complete",
        `Total: ${result.summary.totalConversations}, Recent: ${result.summary.recentConversations}, With Sentiment: ${result.summary.conversationsWithSentiment}, Test Found: ${result.summary.testConversationFound}`,
        [{ text: "OK" }]
      )
    } catch (error: any) {
      console.error("Debug conversation data failed:", error)
      Alert.alert(
        "Debug Failed",
        error?.data?.message || error?.message || "Unknown error occurred",
        [{ text: "OK" }]
      )
    }
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Sentiment Analysis Debug</Text>
      <Text style={styles.subtitle}>
        Debug and fix missing sentiment analysis for recent conversations
      </Text>
      
      <Button
        text={isDebugLoading ? "Debugging..." : "Debug Sentiment Analysis"}
        onPress={handleDebugSentiment}
        disabled={isDebugLoading}
        style={styles.debugButton}
        testID="debug-sentiment-button"
      />
      
      <Button
        text={isConversationDebugLoading ? "Loading..." : "Debug Conversation Data"}
        onPress={handleDebugConversationData}
        disabled={isConversationDebugLoading || !currentPatient}
        style={[styles.debugButton, styles.conversationButton]}
        testID="debug-conversation-data-button"
      />
      
      <Button
        text={isTestLoading ? "Testing..." : "Test Direct API Call"}
        onPress={() => {
          console.log('=== DIRECT API TEST ===')
          console.log('Current Patient:', currentPatient)
          console.log('Test Summary Data:', JSON.stringify(testSummaryData, null, 2))
          console.log('Test Error:', testError)
          console.log('=== END DIRECT TEST ===')
          Alert.alert(
            "Direct API Test",
            `Patient: ${currentPatient?.name || 'None'}\nLoading: ${isTestLoading}\nError: ${testError ? 'Yes' : 'No'}\nData: ${testSummaryData ? 'Received' : 'None'}\n\nSummary Data:\n${JSON.stringify(testSummaryData, null, 2)}`,
            [{ text: "OK" }]
          )
        }}
        disabled={isTestLoading || !currentPatient}
        style={[styles.debugButton, styles.testButton]}
        testID="test-direct-api-button"
      />
      
      <Button
        text="Force Refresh Cache"
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
            "Cache Refreshed",
            "Sentiment analysis cache has been invalidated. The UI should refresh automatically.",
            [{ text: "OK" }]
          )
        }}
        disabled={!currentPatient}
        style={[styles.debugButton, styles.refreshButton]}
        testID="force-refresh-cache-button"
      />
      
      {/* Show current patient info */}
      <View style={styles.patientInfo}>
        <Text style={styles.patientInfoTitle}>Current Patient:</Text>
        <Text style={styles.patientInfoText}>
          {currentPatient ? `${currentPatient.name} (${currentPatient.id})` : 'No patient selected'}
        </Text>
      </View>

      {debugResult && (
        <ScrollView style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Debug Results</Text>
          
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              Total Conversations: {debugResult.summary.totalConversations}
            </Text>
            <Text style={styles.summaryText}>
              Without Sentiment: {debugResult.summary.conversationsWithoutSentiment}
            </Text>
            <Text style={styles.summaryText}>
              Successfully Analyzed: {debugResult.summary.successfullyAnalyzed}
            </Text>
            <Text style={styles.summaryText}>
              Failed Analyses: {debugResult.summary.failedAnalyses}
            </Text>
          </View>

          <Text style={styles.conversationsTitle}>Conversation Details</Text>
          {debugResult.conversations.map((conv: any, index: number) => (
            <View key={conv.conversationId} style={styles.conversationItem}>
              <Text style={styles.conversationHeader}>
                {index + 1}. {conv.patientName} ({conv.messageCount} messages)
              </Text>
              <Text style={styles.conversationTime}>
                {new Date(conv.endTime).toLocaleString()}
              </Text>
              
              {conv.analysisResult ? (
                conv.analysisResult.success ? (
                  <View style={styles.successResult}>
                    <Text style={styles.resultText}>
                      ✅ Sentiment: {conv.analysisResult.sentiment} (Score: {conv.analysisResult.score})
                    </Text>
                    <Text style={styles.resultText}>
                      Mood: {conv.analysisResult.mood}
                    </Text>
                    <Text style={styles.resultText}>
                      Emotions: {conv.analysisResult.emotions?.join(", ") || "N/A"}
                    </Text>
                    <Text style={styles.resultText}>
                      Concern Level: {conv.analysisResult.concernLevel}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.errorResult}>
                    <Text style={styles.errorText}>
                      ❌ Failed: {conv.analysisResult.error}
                    </Text>
                  </View>
                )
              ) : (
                <Text style={styles.noResultText}>No analysis performed</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.palette.biancaHeader,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.palette.neutral600,
    marginBottom: 16,
    lineHeight: 20,
  },
  debugButton: {
    backgroundColor: colors.palette.biancaWarning,
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: colors.palette.biancaButtonSelected,
  },
  conversationButton: {
    backgroundColor: colors.palette.biancaError,
  },
  refreshButton: {
    backgroundColor: colors.palette.biancaPrimary,
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
    color: colors.palette.biancaHeader,
    marginBottom: 4,
  },
  patientInfoText: {
    fontSize: 12,
    color: colors.palette.neutral700,
  },
  resultsContainer: {
    maxHeight: 400,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.palette.biancaHeader,
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
    color: colors.palette.neutral700,
    marginBottom: 4,
  },
  conversationsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.palette.biancaHeader,
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
    color: colors.palette.biancaHeader,
    marginBottom: 4,
  },
  conversationTime: {
    fontSize: 12,
    color: colors.palette.neutral600,
    marginBottom: 8,
  },
  successResult: {
    backgroundColor: colors.palette.biancaSuccessBackground,
    borderRadius: 6,
    padding: 8,
  },
  errorResult: {
    backgroundColor: colors.palette.biancaErrorBackground,
    borderRadius: 6,
    padding: 8,
  },
  resultText: {
    fontSize: 12,
    color: colors.palette.neutral700,
    marginBottom: 2,
  },
  errorText: {
    fontSize: 12,
    color: colors.palette.biancaError,
  },
  noResultText: {
    fontSize: 12,
    color: colors.palette.neutral600,
    fontStyle: "italic",
  },
})
