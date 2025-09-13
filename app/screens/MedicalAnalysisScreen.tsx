import React, { useState, useCallback } from "react"
import { View, StyleSheet, Text, ScrollView, Pressable, Alert } from "react-native"
import { useRoute, RouteProp } from "@react-navigation/native"
import { useNavigation } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { Screen } from "../components/Screen"
import { colors } from "../theme/colors"
import { Ionicons } from "@expo/vector-icons"
import { medicalAnalysisApi } from "../services/api"
import { 
  MedicalAnalysisResult, 
  MedicalAnalysisConfidence,
  CognitiveMetrics,
  PsychiatricMetrics,
  VocabularyMetrics 
} from "../services/api/api.types"
import { HomeStackParamList } from "../navigators/navigationTypes"
import { getPatient } from "../store/patientSlice"

type MedicalAnalysisScreenRouteProp = RouteProp<HomeStackParamList, "MedicalAnalysis">

export function MedicalAnalysisScreen() {
  const route = useRoute<MedicalAnalysisScreenRouteProp>()
  const navigation = useNavigation()
  
  // Get patient from route params (when accessed from Patient screen) or Redux state (when accessed from Reports)
  const routePatientId = route.params?.patientId
  const routePatientName = route.params?.patientName
  const selectedPatient = useSelector(getPatient)
  
  // Prioritize route params (from Patient screen) over Redux state (from Reports)
  const patientId = routePatientId || selectedPatient?.id
  const patientName = routePatientName || selectedPatient?.name

  const [analysisResults, setAnalysisResults] = useState<MedicalAnalysisResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTriggering, setIsTriggering] = useState(false)

  const loadAnalysisResults = useCallback(async () => {
    if (!patientId) return
    
    setIsLoading(true)
    try {
      const results = await medicalAnalysisApi.getMedicalAnalysisResults(patientId, 5)
      setAnalysisResults(results)
    } catch (error) {
      console.error('Error loading medical analysis results:', error)
      Alert.alert('Error', 'Failed to load medical analysis results')
    } finally {
      setIsLoading(false)
    }
  }, [patientId])

  const triggerAnalysis = useCallback(async () => {
    if (!patientId) return
    
    setIsTriggering(true)
    try {
      const result = await medicalAnalysisApi.triggerMedicalAnalysis(patientId)
      if (result.success) {
        Alert.alert('Success', 'Medical analysis triggered successfully. Results will be available shortly.')
        // Reload results after a short delay
        setTimeout(() => {
          loadAnalysisResults()
        }, 2000)
      } else {
        Alert.alert('Error', result.message || 'Failed to trigger analysis')
      }
    } catch (error) {
      console.error('Error triggering medical analysis:', error)
      Alert.alert('Error', 'Failed to trigger medical analysis')
    } finally {
      setIsTriggering(false)
    }
  }, [patientId, loadAnalysisResults])

  // Load results when component mounts or patient changes
  React.useEffect(() => {
    loadAnalysisResults()
  }, [loadAnalysisResults])

  if (!patientId) {
    return (
      <Screen preset="scroll" style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.palette.neutral600} />
          <Text style={styles.errorText}>No patient selected</Text>
          <Text style={styles.errorSubtext}>Please select a patient to view medical analysis</Text>
        </View>
      </Screen>
    )
  }

  const latestAnalysis = analysisResults[0]

  const getConfidenceColor = (confidence: MedicalAnalysisConfidence) => {
    switch (confidence) {
      case 'high': return colors.palette.biancaSuccess
      case 'medium': return colors.palette.biancaWarning
      case 'low': return colors.palette.biancaError
      case 'none': return colors.palette.neutral600
      default: return colors.palette.neutral600
    }
  }

  const getRiskLevel = (score: number) => {
    if (score >= 70) return { level: 'High', color: colors.palette.biancaError }
    if (score >= 40) return { level: 'Medium', color: colors.palette.biancaWarning }
    return { level: 'Low', color: colors.palette.biancaSuccess }
  }

  return (
    <Screen preset="scroll" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Medical Analysis</Text>
        <Text style={styles.patientName}>{patientName}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable 
          style={[styles.actionButton, styles.triggerButton]} 
          onPress={triggerAnalysis}
          disabled={isTriggering}
        >
          <Ionicons 
            name="play-circle" 
            size={20} 
            color={colors.palette.neutral100} 
          />
          <Text style={styles.actionButtonText}>
            {isTriggering ? 'Triggering...' : 'Trigger Analysis'}
          </Text>
        </Pressable>

        <Pressable 
          style={[styles.actionButton, styles.refreshButton]} 
          onPress={loadAnalysisResults}
          disabled={isLoading}
        >
          <Ionicons 
            name="refresh" 
            size={20} 
            color={colors.palette.biancaButtonSelected} 
          />
          <Text style={[styles.actionButtonText, styles.refreshButtonText]}>
            {isLoading ? 'Loading...' : 'Refresh'}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading analysis results...</Text>
        </View>
      ) : analysisResults.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics" size={48} color={colors.palette.neutral600} />
          <Text style={styles.emptyText}>No analysis results available</Text>
          <Text style={styles.emptySubtext}>Trigger an analysis to get started</Text>
        </View>
      ) : (
        <ScrollView style={styles.resultsContainer}>
          {analysisResults.map((result, index) => (
            <View key={result.analysisDate || index} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultDate}>
                  {new Date(result.analysisDate).toLocaleDateString()}
                </Text>
                <View style={styles.confidenceBadge}>
                  <View 
                    style={[
                      styles.confidenceDot, 
                      { backgroundColor: getConfidenceColor(result.confidence) }
                    ]} 
                  />
                  <Text style={styles.confidenceText}>
                    {result.confidence.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.metricsGrid}>
                {/* Cognitive Metrics */}
                <View style={styles.metricCard}>
                  <Text style={styles.metricTitle}>Cognitive Health</Text>
                  <View style={styles.metricValue}>
                    <Text style={styles.metricNumber}>{result.cognitiveMetrics.riskScore}</Text>
                    <Text style={styles.metricUnit}>/100</Text>
                  </View>
                  <Text style={[
                    styles.metricLevel, 
                    { color: getRiskLevel(result.cognitiveMetrics.riskScore).color }
                  ]}>
                    {getRiskLevel(result.cognitiveMetrics.riskScore).level} Risk
                  </Text>
                </View>

                {/* Psychiatric Metrics */}
                <View style={styles.metricCard}>
                  <Text style={styles.metricTitle}>Mental Health</Text>
                  <View style={styles.metricValue}>
                    <Text style={styles.metricNumber}>{result.psychiatricMetrics.overallRiskScore}</Text>
                    <Text style={styles.metricUnit}>/100</Text>
                  </View>
                  <Text style={[
                    styles.metricLevel, 
                    { color: getRiskLevel(result.psychiatricMetrics.overallRiskScore).color }
                  ]}>
                    {getRiskLevel(result.psychiatricMetrics.overallRiskScore).level} Risk
                  </Text>
                </View>

                {/* Vocabulary Metrics */}
                <View style={styles.metricCard}>
                  <Text style={styles.metricTitle}>Language</Text>
                  <View style={styles.metricValue}>
                    <Text style={styles.metricNumber}>{result.vocabularyMetrics.complexityScore}</Text>
                    <Text style={styles.metricUnit}>/100</Text>
                  </View>
                  <Text style={[
                    styles.metricLevel, 
                    { color: getRiskLevel(100 - result.vocabularyMetrics.complexityScore).color }
                  ]}>
                    {result.vocabularyMetrics.complexityScore >= 70 ? 'Good' : 
                     result.vocabularyMetrics.complexityScore >= 40 ? 'Fair' : 'Poor'}
                  </Text>
                </View>
              </View>

              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <View style={styles.warningsContainer}>
                  <Text style={styles.warningsTitle}>Warnings & Insights</Text>
                  {result.warnings.map((warning, warningIndex) => (
                    <View key={warningIndex} style={styles.warningItem}>
                      <Ionicons name="warning" size={16} color={colors.palette.biancaWarning} />
                      <Text style={styles.warningText}>{warning}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Analysis Details */}
              <View style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>Analysis Details</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Conversations</Text>
                    <Text style={styles.detailValue}>{result.conversationCount}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Messages</Text>
                    <Text style={styles.detailValue}>{result.messageCount}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Total Words</Text>
                    <Text style={styles.detailValue}>{result.totalWords}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Trigger</Text>
                    <Text style={styles.detailValue}>{result.trigger}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.biancaBackground,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.palette.biancaHeader,
    marginBottom: 4,
  },
  patientName: {
    fontSize: 16,
    color: colors.palette.neutral600,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  triggerButton: {
    backgroundColor: colors.palette.biancaButtonSelected,
    flex: 1,
  },
  refreshButton: {
    backgroundColor: colors.palette.neutral200,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.palette.neutral100,
  },
  refreshButtonText: {
    color: colors.palette.biancaButtonSelected,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: colors.palette.neutral600,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.palette.neutral600,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: colors.palette.neutral600,
    textAlign: 'center',
  },
  resultsContainer: {
    paddingHorizontal: 20,
  },
  resultCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.palette.neutral700,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.palette.neutral700,
    marginBottom: 8,
    textAlign: 'center',
  },
  metricValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.palette.biancaHeader,
  },
  metricUnit: {
    fontSize: 14,
    color: colors.palette.neutral600,
    marginLeft: 2,
  },
  metricLevel: {
    fontSize: 12,
    fontWeight: '600',
  },
  warningsContainer: {
    marginBottom: 16,
  },
  warningsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginBottom: 8,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: colors.palette.neutral700,
    flex: 1,
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.palette.neutral300,
    paddingTop: 16,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginBottom: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    flex: 1,
    minWidth: '45%',
  },
  detailLabel: {
    fontSize: 12,
    color: colors.palette.neutral600,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
  },
})
