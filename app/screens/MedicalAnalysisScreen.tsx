import React, { useState, useCallback } from "react"
import { View, StyleSheet, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native"
import { useRoute, RouteProp } from "@react-navigation/native"
import { useNavigation } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { Screen } from "../components/Screen"
import { colors } from "../theme/colors"
import { translate } from "../i18n"
import { Ionicons } from "@expo/vector-icons"
import { 
  useGetMedicalAnalysisResultsQuery,
  useGetMedicalAnalysisTrendQuery,
  useTriggerMedicalAnalysisMutation,
  useGetMedicalAnalysisStatusQuery
} from "../services/api/medicalAnalysisApi"
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

  // RTK Query hooks
  const {
    data: analysisData,
    isLoading,
    error: analysisError
  } = useGetMedicalAnalysisResultsQuery(
    { patientId: patientId || '', limit: 5 },
    { skip: !patientId }
  )

  const {
    data: trendData,
    isLoading: isTrendLoading,
    error: trendError
  } = useGetMedicalAnalysisTrendQuery(
    { patientId: patientId || '', timeRange: 'month' },
    { skip: !patientId }
  )

  // Handle trend errors
  React.useEffect(() => {
    if (trendError) {
      console.error('Error fetching trend data:', trendError)
    }
  }, [trendError])

  const [triggerAnalysis, { isLoading: isTriggering, error: triggerError }] = useTriggerMedicalAnalysisMutation()

  const analysisResults = analysisData?.results || []

  // Handle analysis errors
  React.useEffect(() => {
    if (analysisError) {
      console.error('Error loading medical analysis results:', analysisError)
      let errorMessage = translate('medicalAnalysis.loadFailed')
      if ('data' in analysisError && analysisError.data) {
        errorMessage = (analysisError.data as any)?.message || errorMessage
      }
      Alert.alert(translate('medicalAnalysis.error'), errorMessage)
    }
  }, [analysisError])

  // Handle trigger errors
  React.useEffect(() => {
    if (triggerError) {
      console.error('Error triggering medical analysis:', triggerError)
      let errorMessage = translate('medicalAnalysis.triggerFailed')
      if ('data' in triggerError && triggerError.data) {
        errorMessage = (triggerError.data as any)?.message || errorMessage
      }
      Alert.alert(translate('medicalAnalysis.error'), errorMessage)
    }
  }, [triggerError])

  const handleTriggerAnalysis = useCallback(async () => {
    if (!patientId) return
    
    try {
      console.log('Triggering medical analysis for patient:', patientId)
      const result = await triggerAnalysis({ patientId }).unwrap()
      console.log('Trigger analysis result:', result)
      
      if (result.success) {
        Alert.alert(
          translate('medicalAnalysis.success'), 
          translate('medicalAnalysis.triggerSuccess')
        )
        // RTK Query will automatically refetch results after 10 seconds
        // No manual polling needed!
      } else {
        Alert.alert(translate('medicalAnalysis.error'), result.message || translate('medicalAnalysis.triggerFailed'))
      }
    } catch (error) {
      // Error is handled by the useEffect above
      console.error('Trigger analysis failed:', error)
    }
  }, [patientId, triggerAnalysis])


  if (!patientId) {
    return (
      <Screen preset="scroll" style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.palette.neutral600} />
          <Text style={styles.errorText}>{translate("medicalAnalysis.noPatientSelected")}</Text>
          <Text style={styles.errorSubtext}>{translate("medicalAnalysis.selectPatientToView")}</Text>
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
    if (score >= 70) return { level: translate('medicalAnalysis.high'), color: colors.palette.biancaError }
    if (score >= 40) return { level: translate('medicalAnalysis.medium'), color: colors.palette.biancaWarning }
    return { level: translate('medicalAnalysis.low'), color: colors.palette.biancaSuccess }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return 'trending-up'
      case 'declining': return 'trending-down'
      default: return 'remove'
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return colors.palette.biancaSuccess
      case 'declining': return colors.palette.biancaError
      default: return colors.palette.neutral500
    }
  }

  return (
    <Screen preset="scroll" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{translate("medicalAnalysis.title")}</Text>
        <Text style={styles.patientName}>{patientName}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable 
          style={[
            styles.actionButton, 
            styles.triggerButton,
            isTriggering && styles.buttonDisabled
          ]} 
          onPress={handleTriggerAnalysis}
          disabled={isTriggering}
        >
          {isTriggering ? (
            <ActivityIndicator size="small" color={colors.palette.neutral100} />
          ) : (
            <Ionicons 
              name="play-circle" 
              size={20} 
              color={colors.palette.neutral100} 
            />
          )}
          <Text style={styles.actionButtonText}>
            {isTriggering ? translate('medicalAnalysis.triggering') : translate('medicalAnalysis.triggerAnalysis')}
          </Text>
        </Pressable>

      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{translate("medicalAnalysis.loadingResults")}</Text>
        </View>
      ) : analysisResults.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics" size={48} color={colors.palette.neutral600} />
          <Text style={styles.emptyText}>{translate("medicalAnalysis.noResultsAvailable")}</Text>
          <Text style={styles.emptySubtext}>{translate("medicalAnalysis.triggerToGetStarted")}</Text>
        </View>
      ) : (
        <ScrollView style={styles.resultsContainer}>
          {(() => {
            console.log('Total analysis results:', analysisResults.length)
            
            // Get the most recent analysis result
            const latestResult = analysisResults
              .filter((result, index, self) => 
                // Keep only unique results based on analysis date
                index === self.findIndex(r => 
                  new Date(r.analysisDate).getTime() === new Date(result.analysisDate).getTime()
                )
              )
              .sort((a, b) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime()) // Sort by date, newest first
              [0] // Get only the most recent result
            
            // Get all results for time series (sorted by date)
            const timeSeriesData = analysisResults
              .filter((result, index, self) => 
                index === self.findIndex(r => 
                  new Date(r.analysisDate).getTime() === new Date(result.analysisDate).getTime()
                )
              )
              .sort((a, b) => new Date(a.analysisDate).getTime() - new Date(b.analysisDate).getTime()) // Sort chronologically for chart
            
            console.log('Latest result:', latestResult)
            console.log('Latest result cognitive metrics:', latestResult?.cognitiveMetrics)
            console.log('Latest result psychiatric metrics:', latestResult?.psychiatricMetrics)
            console.log('Latest result vocabulary metrics:', latestResult?.vocabularyMetrics)
            console.log('Cognitive risk score:', latestResult?.cognitiveMetrics?.riskScore)
            console.log('Psychiatric overall risk score:', latestResult?.psychiatricMetrics?.overallRiskScore)
            console.log('Vocabulary complexity score:', latestResult?.vocabularyMetrics?.complexityScore)
            
            // Debug: Show all properties of each metric object
            console.log('Cognitive metrics keys:', latestResult?.cognitiveMetrics ? Object.keys(latestResult.cognitiveMetrics) : 'no cognitive metrics')
            console.log('Psychiatric metrics keys:', latestResult?.psychiatricMetrics ? Object.keys(latestResult.psychiatricMetrics) : 'no psychiatric metrics')
            console.log('Vocabulary metrics keys:', latestResult?.vocabularyMetrics ? Object.keys(latestResult.vocabularyMetrics) : 'no vocabulary metrics')
            console.log('Time series data points:', timeSeriesData.length)
            console.log('Trend data:', trendData)
            console.log('Trend data structure:', {
              hasTrendData: !!trendData,
              hasTrend: !!trendData?.trend,
              hasSummary: !!trendData?.trend?.summary,
              summaryKeys: trendData?.trend?.summary ? Object.keys(trendData.trend.summary) : 'no summary'
            })
            
            if (!latestResult) {
              return (
                <View style={styles.emptyContainer}>
                  <Ionicons name="analytics" size={48} color={colors.palette.neutral600} />
                  <Text style={styles.emptyText}>{translate("medicalAnalysis.noResultsAvailable")}</Text>
                  <Text style={styles.emptySubtext}>{translate("medicalAnalysis.triggerToGetStarted")}</Text>
                </View>
              )
            }
            
            return (
              <>
                {/* Latest Analysis Card */}
                <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultDate}>
                  {new Date(latestResult.analysisDate).toLocaleDateString()}
                </Text>
                <View style={styles.confidenceBadge}>
                  <View 
                    style={[
                      styles.confidenceDot, 
                      { backgroundColor: getConfidenceColor(latestResult.confidence) }
                    ]} 
                  />
                  <Text style={styles.confidenceText}>
                    {latestResult.confidence.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.metricsGrid}>
                {/* Cognitive Metrics */}
                <View style={styles.metricCard}>
                  <Text style={styles.metricTitle}>{translate("medicalAnalysis.cognitiveHealth")}</Text>
                  <View style={styles.metricValue}>
                    <Text style={styles.metricNumber}>
                      {latestResult.cognitiveMetrics?.riskScore ?? '--'}
                    </Text>
                    <Text style={styles.metricUnit}>/100</Text>
                  </View>
                  <Text style={[
                    styles.metricLevel, 
                    { color: getRiskLevel(latestResult.cognitiveMetrics?.riskScore ?? 0).color }
                  ]}>
                    {getRiskLevel(latestResult.cognitiveMetrics?.riskScore ?? 0).level} {translate("medicalAnalysis.risk")}
                  </Text>
                </View>

                {/* Psychiatric Metrics */}
                <View style={styles.metricCard}>
                  <Text style={styles.metricTitle}>{translate("medicalAnalysis.mentalHealth")}</Text>
                  <View style={styles.metricValue}>
                    <Text style={styles.metricNumber}>
                      {latestResult.psychiatricMetrics?.overallRiskScore ?? '--'}
                    </Text>
                    <Text style={styles.metricUnit}>/100</Text>
                  </View>
                  <Text style={[
                    styles.metricLevel, 
                    { color: getRiskLevel(latestResult.psychiatricMetrics?.overallRiskScore ?? 0).color }
                  ]}>
                    {getRiskLevel(latestResult.psychiatricMetrics?.overallRiskScore ?? 0).level} {translate("medicalAnalysis.risk")}
                  </Text>
                </View>

                {/* Vocabulary Metrics */}
                <View style={styles.metricCard}>
                  <Text style={styles.metricTitle}>{translate("medicalAnalysis.language")}</Text>
                  <View style={styles.metricValue}>
                    <Text style={styles.metricNumber}>
                      {latestResult.vocabularyMetrics?.complexityScore ?? '--'}
                    </Text>
                    <Text style={styles.metricUnit}>/100</Text>
                  </View>
                  <Text style={[
                    styles.metricLevel, 
                    { color: getRiskLevel(100 - (latestResult.vocabularyMetrics?.complexityScore ?? 0)).color }
                  ]}>
                    {(latestResult.vocabularyMetrics?.complexityScore ?? 0) >= 70 ? translate('medicalAnalysis.good') : 
                     (latestResult.vocabularyMetrics?.complexityScore ?? 0) >= 40 ? translate('medicalAnalysis.fair') : translate('medicalAnalysis.poor')}
                  </Text>
                </View>
              </View>

              {/* Warnings */}
              {latestResult.warnings && latestResult.warnings.length > 0 && (
                <View style={styles.warningsContainer}>
                  <Text style={styles.warningsTitle}>{translate("medicalAnalysis.warningsInsights")}</Text>
                  {latestResult.warnings.map((warning, warningIndex) => (
                    <View key={warningIndex} style={styles.warningItem}>
                      <Ionicons name="warning" size={16} color={colors.palette.biancaWarning} />
                      <Text style={styles.warningText}>{warning}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Analysis Details */}
              <View style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>{translate("medicalAnalysis.analysisDetails")}</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>{translate("medicalAnalysis.conversations")}</Text>
                    <Text style={styles.detailValue}>{latestResult.conversationCount ?? '--'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>{translate("medicalAnalysis.messages")}</Text>
                    <Text style={styles.detailValue}>{latestResult.messageCount ?? '--'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>{translate("medicalAnalysis.totalWords")}</Text>
                    <Text style={styles.detailValue}>{latestResult.totalWords ?? '--'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>{translate("medicalAnalysis.trigger")}</Text>
                    <Text style={styles.detailValue}>{latestResult.trigger ?? '--'}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Time Series Chart */}
            {(trendData?.trend?.summary || timeSeriesData.length >= 1) && (
              <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>{translate("medicalAnalysis.trendsOverTime")}</Text>
                {trendData?.trend?.summary ? (
                  <View style={styles.trendsContainer}>
                    <View style={styles.trendItem}>
                      <Text style={styles.trendLabel}>{translate("medicalAnalysis.cognitiveHealth")}</Text>
                      <View style={styles.trendValue}>
                        <Ionicons 
                          name={getTrendIcon(trendData.trend.summary.cognitiveTrend)} 
                          size={20} 
                          color={getTrendColor(trendData.trend.summary.cognitiveTrend)} 
                        />
                        <Text style={[styles.trendText, { color: getTrendColor(trendData.trend.summary.cognitiveTrend) }]}>
                          {trendData.trend.summary.cognitiveTrend}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.trendItem}>
                      <Text style={styles.trendLabel}>{translate("medicalAnalysis.mentalHealth")}</Text>
                      <View style={styles.trendValue}>
                        <Ionicons 
                          name={getTrendIcon(trendData.trend.summary.psychiatricTrend)} 
                          size={20} 
                          color={getTrendColor(trendData.trend.summary.psychiatricTrend)} 
                        />
                        <Text style={[styles.trendText, { color: getTrendColor(trendData.trend.summary.psychiatricTrend) }]}>
                          {trendData.trend.summary.psychiatricTrend}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.trendItem}>
                      <Text style={styles.trendLabel}>{translate("medicalAnalysis.language")}</Text>
                      <View style={styles.trendValue}>
                        <Ionicons 
                          name={getTrendIcon(trendData.trend.summary.vocabularyTrend)} 
                          size={20} 
                          color={getTrendColor(trendData.trend.summary.vocabularyTrend)} 
                        />
                        <Text style={[styles.trendText, { color: getTrendColor(trendData.trend.summary.vocabularyTrend) }]}>
                          {trendData.trend.summary.vocabularyTrend}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.trendItem}>
                      <Text style={styles.trendLabel}>{translate("medicalAnalysis.overallHealth")}</Text>
                      <View style={styles.trendValue}>
                        <Text style={styles.trendText}>
                          {trendData.trend.totalAnalyses} {translate("medicalAnalysis.analyses")}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.chartPlaceholder}>
                    <Ionicons name="trending-up" size={48} color={colors.palette.neutral400} />
                    <Text style={styles.chartPlaceholderText}>
                      {translate("medicalAnalysis.trendAnalysisComingSoon")}
                    </Text>
                    <Text style={styles.chartSubtext}>
                      {timeSeriesData.length} {translate("medicalAnalysis.analysisResultsAvailable")}
                    </Text>
                  </View>
                )}
                
                {trendData?.trend?.totalAnalyses > 0 && (
                  <Text style={styles.chartSubtext}>
                    {translate("medicalAnalysis.basedOn")} {trendData.trend.totalAnalyses} {translate("medicalAnalysis.analysisResultsOver")} {trendData.trend.timeRange}
                  </Text>
                )}
              </View>
            )}
              </>
            )
          })()}
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
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.palette.neutral100,
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
  chartContainer: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.palette.neutral900,
    marginBottom: 16,
  },
  trendsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  trendItem: {
    width: '48%',
    backgroundColor: colors.palette.neutral50,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  trendLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.palette.neutral700,
    marginBottom: 8,
  },
  trendValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  chartPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: colors.palette.neutral50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.palette.neutral200,
    borderStyle: 'dashed',
  },
  chartPlaceholderText: {
    fontSize: 16,
    color: colors.palette.neutral600,
    marginTop: 12,
    textAlign: 'center',
  },
  chartSubtext: {
    fontSize: 14,
    color: colors.palette.neutral500,
    marginTop: 4,
    textAlign: 'center',
  },
})
