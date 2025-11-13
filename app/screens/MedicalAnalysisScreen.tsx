import React, { useState, useCallback } from "react"
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native"
import { useToast } from "../hooks/useToast"
import Toast from "../components/Toast"
import { useRoute, RouteProp } from "@react-navigation/native"
import { useNavigation } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { Screen } from "../components/Screen"
import { useTheme } from "../theme/ThemeContext"
import { translate } from "../i18n"
import { Ionicons } from "@expo/vector-icons"
import { Text } from "../components"
import { 
  useGetMedicalAnalysisResultsQuery,
  useGetMedicalAnalysisTrendQuery,
  useTriggerMedicalAnalysisMutation,
} from "../services/api/medicalAnalysisApi"
import { 
  MedicalAnalysisResult, 
  MedicalAnalysisConfidence,
} from "../services/api/api.types"
import { HomeStackParamList } from "../navigators/navigationTypes"
import { getPatient } from "../store/patientSlice"
import { logger } from "../utils/logger"

type MedicalAnalysisScreenRouteProp = RouteProp<HomeStackParamList, "MedicalAnalysis">

export function MedicalAnalysisScreen() {
  const route = useRoute<MedicalAnalysisScreenRouteProp>()
  const { toast, showError, showSuccess, hideToast } = useToast()
  const navigation = useNavigation()
  
  // Get patient from route params (when accessed from Patient screen) or Redux state (when accessed from Reports)
  const routePatientId = route.params?.patientId
  const routePatientName = route.params?.patientName
  const selectedPatient = useSelector(getPatient)
  const { colors, isLoading: themeLoading } = useTheme()
  
  // Prioritize route params (from Patient screen) over Redux state (from Reports)
  const patientId = routePatientId || selectedPatient?.id
  const patientName = routePatientName || selectedPatient?.name

  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['cognitive', 'psychiatric', 'vocabulary']))

  // RTK Query hooks
  const {
    data: analysisData,
    isLoading,
    error: analysisError,
    refetch: refetchResults
  } = useGetMedicalAnalysisResultsQuery(
    { patientId: patientId || '', limit: 5 },
    { 
      skip: !patientId,
      // Don't retry on 403 errors (permission denied)
      retry: (failureCount, error: any) => {
        if (error?.status === 403) {
          return false
        }
        return failureCount < 3
      }
    }
  )

  const {
    data: trendData,
    isLoading: isTrendLoading,
    error: trendError
  } = useGetMedicalAnalysisTrendQuery(
    { patientId: patientId || '', timeRange: 'month' },
    { 
      skip: !patientId,
      // Don't retry on 403 errors (permission denied)
      retry: (failureCount, error: any) => {
        if (error?.status === 403) {
          return false
        }
        return failureCount < 3
      }
    }
  )

  const [triggerAnalysis, { isLoading: isTriggering, error: triggerError }] = useTriggerMedicalAnalysisMutation()

  const analysisResults = analysisData?.results || []
  const latestAnalysis = analysisResults[0] as MedicalAnalysisResult | undefined

  // Handle errors
  React.useEffect(() => {
    if (analysisError) {
      console.error('Error loading medical analysis results:', analysisError)
      let errorMessage = translate('medicalAnalysis.loadFailed')
      if ('data' in analysisError && analysisError.data) {
        errorMessage = (analysisError.data as any)?.message || errorMessage
      }
      showError(errorMessage)
    }
  }, [analysisError, showError])

  React.useEffect(() => {
    if (triggerError) {
      console.error('Error triggering medical analysis:', triggerError)
      let errorMessage = translate('medicalAnalysis.triggerFailed')
      if ('data' in triggerError && triggerError.data) {
        errorMessage = (triggerError.data as any)?.message || errorMessage
      }
      showError(errorMessage)
    }
  }, [triggerError, showError])

  const handleTriggerAnalysis = useCallback(async () => {
    if (!patientId) return
    
    try {
      logger.debug('Triggering medical analysis for patient:', patientId)
      const result = await triggerAnalysis({ patientId }).unwrap()
      logger.debug('Trigger analysis result:', result)
      
      if (result.success) {
        showSuccess(translate('medicalAnalysis.triggerSuccess'))
        // Immediately refetch since analysis is now synchronous
        refetchResults()
      } else {
        showError(result.message || translate('medicalAnalysis.triggerFailed'))
      }
    } catch (error) {
      console.error('Trigger analysis failed:', error)
    }
  }, [patientId, triggerAnalysis, refetchResults, showSuccess, showError])

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

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

  // Helper functions for plain language analysis
  const getCognitiveInterpretation = (metrics: any) => {
    if (!metrics) return translate('medicalAnalysis.noDataAvailable')
    
    const riskScore = metrics.riskScore || 0
    const fillerDensity = (metrics.fillerWordDensity || 0) * 100
    const vagueDensity = (metrics.vagueReferenceDensity || 0) * 100
    
    if (riskScore < 30) {
      return translate('medicalAnalysis.cognitiveInterpretation.normal')
    } else if (riskScore < 50) {
      return translate('medicalAnalysis.cognitiveInterpretation.mildConcern')
    } else if (riskScore < 70) {
      return translate('medicalAnalysis.cognitiveInterpretation.moderateConcern')
    } else {
      return translate('medicalAnalysis.cognitiveInterpretation.significantConcern')
    }
  }

  const getPsychiatricInterpretation = (metrics: any) => {
    if (!metrics) return translate('medicalAnalysis.noDataAvailable')
    
    const overallRisk = metrics.overallRiskScore || 0
    const depression = metrics.depressionScore || 0
    const anxiety = metrics.anxietyScore || 0
    const hasCrisis = metrics.crisisIndicators?.hasCrisisIndicators || false
    
    if (hasCrisis) {
      return translate('medicalAnalysis.psychiatricInterpretation.crisis')
    } else if (overallRisk < 40) {
      return translate('medicalAnalysis.psychiatricInterpretation.stable')
    } else if (overallRisk < 60) {
      return translate('medicalAnalysis.psychiatricInterpretation.mildConcern')
    } else if (overallRisk < 80) {
      return translate('medicalAnalysis.psychiatricInterpretation.moderateConcern')
    } else {
      return translate('medicalAnalysis.psychiatricInterpretation.significantConcern')
    }
  }

  const getVocabularyInterpretation = (metrics: any) => {
    if (!metrics) return translate('medicalAnalysis.noDataAvailable')
    
    const complexity = metrics.complexityScore || 0
    const typeTokenRatio = metrics.typeTokenRatio || 0
    
    if (complexity >= 70) {
      return translate('medicalAnalysis.vocabularyInterpretation.strong')
    } else if (complexity >= 50) {
      return translate('medicalAnalysis.vocabularyInterpretation.average')
    } else {
      return translate('medicalAnalysis.vocabularyInterpretation.limited')
    }
  }

  const getConfidenceColor = (confidence: MedicalAnalysisConfidence) => {
    switch (confidence) {
      case 'high': return colors.palette.biancaSuccess
      case 'medium': return colors.palette.biancaWarning
      case 'low': return colors.palette.biancaError
      case 'none': return colors.palette.neutral600
      default: return colors.palette.neutral600
    }
  }

  const getConfidenceColorWithOpacity = (confidence: MedicalAnalysisConfidence, opacity: number = 0.1) => {
    const color = getConfidenceColor(confidence)
    if (!color) return colors.palette.neutral600
    // If color is already a string (like rgba or hex), try to add opacity
    if (typeof color === 'string') {
      // If it's rgba format, replace the opacity
      if (color.includes('rgba')) {
        return color.replace(/[\d\.]+\)$/g, `${opacity})`)
      }
      // If it's rgb format, convert to rgba
      if (color.includes('rgb(')) {
        return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`)
      }
      // If it's hex, convert to rgba (simplified - assumes 6 char hex)
      if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16)
        const g = parseInt(color.slice(3, 5), 16)
        const b = parseInt(color.slice(5, 7), 16)
        return `rgba(${r}, ${g}, ${b}, ${opacity})`
      }
      // Fallback: return original color
      return color
    }
    // If it's not a string, return default
    return colors.palette.neutral600
  }

  const getRiskLevel = (score: number) => {
    if (score >= 70) return { level: translate('medicalAnalysis.high'), color: colors.palette.biancaError }
    if (score >= 40) return { level: translate('medicalAnalysis.medium'), color: colors.palette.biancaWarning }
    return { level: translate('medicalAnalysis.low'), color: colors.palette.biancaSuccess }
  }

  // Helper to invert risk scores for display (lower risk = higher health percentage)
  // Use this for scores where lower is better (cognitive risk, psychiatric overall risk)
  // These show as "health percentage" where higher is better
  const invertRiskScore = (riskScore: number | undefined): number | undefined => {
    if (riskScore === undefined || riskScore === null) return undefined
    return Math.round(100 - riskScore)
  }

  // Helper to get health level for inverted scores (for display purposes)
  // When we invert a risk score, we need to invert the risk level logic too
  const getHealthLevel = (invertedScore: number) => {
    // Inverted: high risk (70+) becomes low health (30-), low risk (0-30) becomes high health (70+)
    if (invertedScore >= 70) return { level: translate('medicalAnalysis.good'), color: colors.palette.biancaSuccess }
    if (invertedScore >= 40) return { level: translate('medicalAnalysis.fair'), color: colors.palette.biancaWarning }
    return { level: translate('medicalAnalysis.poor'), color: colors.palette.biancaError }
  }

  return (
    <Screen preset="scroll" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{translate("medicalAnalysis.title")}</Text>
        <Text style={styles.patientName}>{patientName}</Text>
      </View>

      {/* Medical Disclaimer */}
      <View style={styles.disclaimerContainer}>
        <Ionicons name="medical" size={20} color={colors.palette.biancaWarning} />
        <Text style={styles.disclaimerText}>
          {translate("medicalAnalysis.disclaimer")}
        </Text>
      </View>

      {/* Trigger Button */}
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
          <ActivityIndicator size="large" color={colors.palette.primary500} />
          <Text style={styles.loadingText}>{translate("medicalAnalysis.loadingResults")}</Text>
        </View>
      ) : !latestAnalysis ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics" size={48} color={colors.palette.neutral600} />
          <Text style={styles.emptyText}>{translate("medicalAnalysis.noResultsAvailable")}</Text>
          <Text style={styles.emptySubtext}>{translate("medicalAnalysis.triggerToGetStarted")}</Text>
        </View>
      ) : (
        <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
          {/* Overview Section */}
          <View style={styles.overviewCard}>
            <View style={styles.overviewHeader}>
              <Text style={styles.sectionTitle}>{translate("medicalAnalysis.overview")}</Text>
              <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColorWithOpacity(latestAnalysis.confidence, 0.1) }]}>
                <View 
                  style={[
                    styles.confidenceDot, 
                    { backgroundColor: getConfidenceColor(latestAnalysis.confidence) || colors.palette.neutral600 }
                  ]} 
                />
                <Text style={styles.confidenceText}>
                  {(latestAnalysis.confidence || 'none').toUpperCase()} {translate("medicalAnalysis.confidence")}
                </Text>
              </View>
            </View>
            <Text style={styles.overviewDate}>
              {new Date(latestAnalysis.analysisDate).toLocaleDateString()}
            </Text>
            <View style={styles.overviewStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{latestAnalysis.conversationCount || 0}</Text>
                <Text style={styles.statLabel}>{translate("medicalAnalysis.conversations")}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{latestAnalysis.messageCount || 0}</Text>
                <Text style={styles.statLabel}>{translate("medicalAnalysis.messages")}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{latestAnalysis.totalWords || 0}</Text>
                <Text style={styles.statLabel}>{translate("medicalAnalysis.totalWords")}</Text>
              </View>
            </View>
          </View>

          {/* Cognitive Health Section */}
          <Pressable 
            style={styles.sectionCard}
            onPress={() => toggleSection('cognitive')}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="brain" size={24} color={colors.palette.primary500} />
                <Text style={styles.sectionTitle}>{translate("medicalAnalysis.cognitiveHealth")}</Text>
              </View>
              <Ionicons 
                name={expandedSections.has('cognitive') ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={colors.palette.neutral600} 
              />
            </View>
            
            <View style={styles.sectionSummary}>
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreValue}>
                  {invertRiskScore(latestAnalysis.cognitiveMetrics?.riskScore)?.toFixed(0) || '--'}
                </Text>
                <Text style={styles.scoreLabel}>%</Text>
              </View>
              <View style={styles.riskBadge}>
                <View 
                  style={[
                    styles.riskDot, 
                    { backgroundColor: getHealthLevel(invertRiskScore(latestAnalysis.cognitiveMetrics?.riskScore) || 0).color }
                  ]} 
                />
                <Text style={[styles.riskText, { color: getHealthLevel(invertRiskScore(latestAnalysis.cognitiveMetrics?.riskScore) || 0).color }]}>
                  {getHealthLevel(invertRiskScore(latestAnalysis.cognitiveMetrics?.riskScore) || 0).level}
                </Text>
              </View>
            </View>

            <Text style={styles.interpretationText}>
              {getCognitiveInterpretation(latestAnalysis.cognitiveMetrics)}
            </Text>

            {expandedSections.has('cognitive') && latestAnalysis.cognitiveMetrics && (
              <View style={styles.detailsContainer}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("medicalAnalysis.fillerWords")}</Text>
                  <Text style={styles.metricValue}>
                    {((latestAnalysis.cognitiveMetrics.fillerWordDensity || 0) * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("medicalAnalysis.vagueReferences")}</Text>
                  <Text style={styles.metricValue}>
                    {((latestAnalysis.cognitiveMetrics.vagueReferenceDensity || 0) * 100).toFixed(1)}%
                  </Text>
                </View>
                {latestAnalysis.cognitiveMetrics.temporalConfusionCount !== undefined && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{translate("medicalAnalysis.temporalConfusion")}</Text>
                    <Text style={styles.metricValue}>
                      {latestAnalysis.cognitiveMetrics.temporalConfusionCount}
                    </Text>
                  </View>
                )}
                {latestAnalysis.cognitiveMetrics.wordFindingDifficultyCount !== undefined && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{translate("medicalAnalysis.wordFinding")}</Text>
                    <Text style={styles.metricValue}>
                      {latestAnalysis.cognitiveMetrics.wordFindingDifficultyCount}
                    </Text>
                  </View>
                )}
                {latestAnalysis.cognitiveMetrics.repetitionScore !== undefined && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{translate("medicalAnalysis.repetition")}</Text>
                    <Text style={styles.metricValue}>
                      {latestAnalysis.cognitiveMetrics.repetitionScore.toFixed(1)}%
                    </Text>
                  </View>
                )}
                {latestAnalysis.cognitiveMetrics.informationDensity?.score !== undefined && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{translate("medicalAnalysis.informationDensity")}</Text>
                    <Text style={styles.metricValue}>
                      {latestAnalysis.cognitiveMetrics.informationDensity.score.toFixed(1)}%
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>

          {/* Mental Health Section */}
          <Pressable 
            style={styles.sectionCard}
            onPress={() => toggleSection('psychiatric')}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="heart" size={24} color={colors.palette.biancaError} />
                <Text style={styles.sectionTitle}>{translate("medicalAnalysis.mentalHealth")}</Text>
              </View>
              <Ionicons 
                name={expandedSections.has('psychiatric') ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={colors.palette.neutral600} 
              />
            </View>

            {/* Crisis Alert */}
            {latestAnalysis.psychiatricMetrics?.crisisIndicators?.hasCrisisIndicators && (
              <View style={styles.crisisAlert}>
                <Ionicons name="warning" size={20} color={colors.palette.biancaError} />
                <Text style={styles.crisisText}>
                  {translate("medicalAnalysis.crisisIndicators")}
                </Text>
              </View>
            )}

            <View style={styles.sectionSummary}>
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreValue}>
                  {invertRiskScore(latestAnalysis.psychiatricMetrics?.overallRiskScore)?.toFixed(0) || '--'}
                </Text>
                <Text style={styles.scoreLabel}>%</Text>
              </View>
              <View style={styles.riskBadge}>
                <View 
                  style={[
                    styles.riskDot, 
                    { backgroundColor: getHealthLevel(invertRiskScore(latestAnalysis.psychiatricMetrics?.overallRiskScore) || 0).color }
                  ]} 
                />
                <Text style={[styles.riskText, { color: getHealthLevel(invertRiskScore(latestAnalysis.psychiatricMetrics?.overallRiskScore) || 0).color }]}>
                  {getHealthLevel(invertRiskScore(latestAnalysis.psychiatricMetrics?.overallRiskScore) || 0).level}
                </Text>
              </View>
            </View>

            <Text style={styles.interpretationText}>
              {getPsychiatricInterpretation(latestAnalysis.psychiatricMetrics)}
            </Text>

            {expandedSections.has('psychiatric') && latestAnalysis.psychiatricMetrics && (
              <View style={styles.detailsContainer}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("medicalAnalysis.depressionScore")}</Text>
                  <Text style={[styles.metricValue, { color: getRiskLevel(latestAnalysis.psychiatricMetrics.depressionScore || 0).color }]}>
                    {(latestAnalysis.psychiatricMetrics.depressionScore || 0).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("medicalAnalysis.anxietyScore")}</Text>
                  <Text style={[styles.metricValue, { color: getRiskLevel(latestAnalysis.psychiatricMetrics.anxietyScore || 0).color }]}>
                    {(latestAnalysis.psychiatricMetrics.anxietyScore || 0).toFixed(0)}%
                  </Text>
                </View>
                {latestAnalysis.psychiatricMetrics.emotionalTone && (
                  <>
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>{translate("medicalAnalysis.emotionalTone")}</Text>
                      <Text style={styles.metricValue}>
                        {latestAnalysis.psychiatricMetrics.emotionalTone.dominantTone || 'neutral'}
                      </Text>
                    </View>
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>{translate("medicalAnalysis.negativeRatio")}</Text>
                      <Text style={styles.metricValue}>
                        {(latestAnalysis.psychiatricMetrics.emotionalTone.negativeRatio * 100).toFixed(1)}%
                      </Text>
                    </View>
                  </>
                )}
                {latestAnalysis.psychiatricMetrics.protectiveFactors !== undefined && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{translate("medicalAnalysis.protectiveFactors")}</Text>
                    <Text style={styles.metricValue}>
                      {latestAnalysis.psychiatricMetrics.protectiveFactors}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>

          {/* Language & Vocabulary Section */}
          <Pressable 
            style={styles.sectionCard}
            onPress={() => toggleSection('vocabulary')}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="chatbubbles" size={24} color={colors.palette.biancaSuccess} />
                <Text style={styles.sectionTitle}>{translate("medicalAnalysis.language")}</Text>
              </View>
              <Ionicons 
                name={expandedSections.has('vocabulary') ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={colors.palette.neutral600} 
              />
            </View>

            <View style={styles.sectionSummary}>
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreValue}>
                  {latestAnalysis.vocabularyMetrics?.complexityScore?.toFixed(0) || '--'}
                </Text>
                <Text style={styles.scoreLabel}>%</Text>
              </View>
              <View style={styles.riskBadge}>
                <Text style={[styles.riskText, { color: getRiskLevel(100 - (latestAnalysis.vocabularyMetrics?.complexityScore || 0)).color }]}>
                  {(latestAnalysis.vocabularyMetrics?.complexityScore || 0) >= 70 ? translate('medicalAnalysis.good') : 
                   (latestAnalysis.vocabularyMetrics?.complexityScore || 0) >= 40 ? translate('medicalAnalysis.fair') : translate('medicalAnalysis.poor')}
                </Text>
              </View>
            </View>

            <Text style={styles.interpretationText}>
              {getVocabularyInterpretation(latestAnalysis.vocabularyMetrics)}
            </Text>

            {expandedSections.has('vocabulary') && latestAnalysis.vocabularyMetrics && (
              <View style={styles.detailsContainer}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("medicalAnalysis.typeTokenRatio")}</Text>
                  <Text style={styles.metricValue}>
                    {(latestAnalysis.vocabularyMetrics.typeTokenRatio * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("medicalAnalysis.avgWordLength")}</Text>
                  <Text style={styles.metricValue}>
                    {latestAnalysis.vocabularyMetrics.avgWordLength?.toFixed(1) || '--'}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("medicalAnalysis.avgSentenceLength")}</Text>
                  <Text style={styles.metricValue}>
                    {latestAnalysis.vocabularyMetrics.avgSentenceLength?.toFixed(1) || '--'}
                  </Text>
                </View>
                {latestAnalysis.vocabularyMetrics.uniqueWords !== undefined && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{translate("medicalAnalysis.uniqueWords")}</Text>
                    <Text style={styles.metricValue}>
                      {latestAnalysis.vocabularyMetrics.uniqueWords}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>

          {/* Key Indicators Section */}
          {latestAnalysis.cognitiveMetrics?.indicators && latestAnalysis.cognitiveMetrics.indicators.length > 0 && (
            <View style={styles.indicatorsCard}>
              <Text style={styles.sectionTitle}>{translate("medicalAnalysis.keyIndicators")}</Text>
              {latestAnalysis.cognitiveMetrics.indicators.map((indicator: any, index: number) => (
                <View key={index} style={styles.indicatorItem}>
                  <Ionicons 
                    name="information-circle" 
                    size={16} 
                    color={indicator.severity === 'high' ? colors.palette.biancaError : colors.palette.biancaWarning} 
                  />
                  <Text style={styles.indicatorText}>{indicator.message || indicator}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Warnings Section */}
          {latestAnalysis.warnings && latestAnalysis.warnings.length > 0 && (
            <View style={styles.warningsCard}>
              <Text style={styles.sectionTitle}>{translate("medicalAnalysis.warningsInsights")}</Text>
              {latestAnalysis.warnings.map((warning, index) => (
                <View key={index} style={styles.warningItem}>
                  <Ionicons name="warning" size={16} color={colors.palette.biancaWarning} />
                  <Text style={styles.warningText}>{warning}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        testID="medical-analysis-toast"
      />
    </Screen>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
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
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.palette.neutral100,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.palette.biancaWarning,
    gap: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: colors.palette.neutral700,
    lineHeight: 16,
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
    backgroundColor: colors.palette.primary500,
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
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
    gap: 16,
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
  overviewCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overviewDate: {
    fontSize: 14,
    color: colors.palette.neutral600,
    marginBottom: 16,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.palette.biancaHeader,
  },
  statLabel: {
    fontSize: 12,
    color: colors.palette.neutral600,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
  },
  sectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.palette.biancaHeader,
  },
  scoreLabel: {
    fontSize: 16,
    color: colors.palette.neutral600,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  riskText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
  interpretationText: {
    fontSize: 14,
    color: colors.palette.neutral700,
    lineHeight: 20,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  detailsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.palette.neutral300,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: colors.palette.neutral600,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
  },
  crisisAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.palette.biancaError + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  crisisText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.palette.biancaError,
  },
  indicatorsCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  indicatorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  indicatorText: {
    flex: 1,
    fontSize: 14,
    color: colors.palette.neutral700,
    lineHeight: 20,
  },
  warningsCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.palette.biancaWarning,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: colors.palette.neutral700,
    lineHeight: 20,
  },
})
