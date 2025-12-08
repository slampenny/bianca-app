import React, { useState } from "react"
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
  useGetFraudAbuseAnalysisQuery,
  useGetFraudAbuseAnalysisResultsQuery,
} from "../services/api/fraudAbuseAnalysisApi"
import { 
  FraudAbuseAnalysisResult, 
  FraudAbuseConfidence,
} from "../services/api/api.types"
import { HomeStackParamList } from "../navigators/navigationTypes"
import { getPatient } from "../store/patientSlice"
import { logger } from "../utils/logger"
import { formatDate as formatDateLocalized } from "../utils/formatDate"

type FraudAbuseAnalysisScreenRouteProp = RouteProp<HomeStackParamList, "FraudAbuseAnalysis">

export function FraudAbuseAnalysisScreen() {
  const route = useRoute<FraudAbuseAnalysisScreenRouteProp>()
  const { toast, showError, showSuccess, hideToast } = useToast()
  const navigation = useNavigation()
  
  const routePatientId = route.params?.patientId
  const routePatientName = route.params?.patientName
  const selectedPatient = useSelector(getPatient)
  const { colors, isLoading: themeLoading } = useTheme()
  
  const patientId = routePatientId || selectedPatient?.id
  const patientName = routePatientName || selectedPatient?.name

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['financial', 'abuse', 'relationship']))

  // Get the main analysis (this will generate one if it doesn't exist)
  const {
    data: analysisResponse,
    isLoading,
    error: analysisError,
    refetch: refetchAnalysis
  } = useGetFraudAbuseAnalysisQuery(
    { patientId: patientId || '', timeRange: 'month' },
    { 
      skip: !patientId,
      retry: (failureCount, error: any) => {
        if (error?.status === 403 || error?.status === 404) {
          return false
        }
        return failureCount < 3
      }
    }
  )

  const latestAnalysis = analysisResponse?.data?.analysis as FraudAbuseAnalysisResult | undefined
  const recommendations = analysisResponse?.data?.recommendations || []
  
  // Minimum data points needed for reliable analysis (based on baselineManager minDataPoints: 5)
  const MIN_DATA_POINTS_FOR_RELIABLE_ANALYSIS = 5
  const hasInsufficientData = latestAnalysis && (latestAnalysis.conversationCount || 0) < MIN_DATA_POINTS_FOR_RELIABLE_ANALYSIS

  React.useEffect(() => {
    if (analysisError) {
      // Only log and show error for non-404 errors (404 is expected when no analysis exists yet)
      if ('status' in analysisError && analysisError.status !== 404) {
        console.error('Error loading fraud/abuse analysis results:', analysisError)
        let errorMessage = translate('fraudAbuseAnalysis.loadFailed')
        if ('data' in analysisError && analysisError.data) {
          errorMessage = (analysisError.data as any)?.message || errorMessage
        }
        showError(errorMessage)
      }
      // Silently ignore 404 errors - they're expected when no analysis exists
    }
  }, [analysisError, showError])

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
          <Text style={styles.errorText}>{translate("fraudAbuseAnalysis.noPatientSelected")}</Text>
          <Text style={styles.errorSubtext}>{translate("fraudAbuseAnalysis.selectPatientToView")}</Text>
        </View>
      </Screen>
    )
  }

  const getConfidenceColor = (confidence: FraudAbuseConfidence) => {
    switch (confidence) {
      case 'high': return colors.palette.biancaSuccess
      case 'medium': return colors.palette.biancaWarning
      case 'low': return colors.palette.biancaError
      case 'none': return colors.palette.neutral600
      default: return colors.palette.neutral600
    }
  }

  const getRiskLevel = (score: number) => {
    if (score >= 70) return { level: translate('fraudAbuseAnalysis.critical'), color: colors.palette.biancaError }
    if (score >= 50) return { level: translate('fraudAbuseAnalysis.high'), color: colors.palette.biancaError }
    if (score >= 30) return { level: translate('fraudAbuseAnalysis.medium'), color: colors.palette.biancaWarning }
    return { level: translate('fraudAbuseAnalysis.low'), color: colors.palette.biancaSuccess }
  }

  return (
    <Screen preset="scroll" style={styles.container} testID="fraud-abuse-analysis-screen" accessibilityLabel="fraud-abuse-analysis-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{translate("fraudAbuseAnalysis.title")}</Text>
        <Text style={styles.patientName}>{patientName}</Text>
      </View>

      <View style={styles.disclaimerContainer}>
        <Ionicons name="warning" size={20} color={colors.palette.biancaError} />
        <Text style={styles.disclaimerText}>
          {translate("fraudAbuseAnalysis.disclaimer")}
        </Text>
      </View>

      {/* Insufficient Data Warning */}
      {hasInsufficientData && (
        <View style={[styles.disclaimerContainer, { backgroundColor: colors.palette.biancaWarning + '20', borderColor: colors.palette.biancaWarning }]}>
          <Ionicons name="information-circle" size={20} color={colors.palette.biancaWarning} />
          <Text style={[styles.disclaimerText, { color: colors.palette.biancaWarning }]}>
            {translate("fraudAbuseAnalysis.insufficientDataWarning", { 
              current: latestAnalysis?.conversationCount || 0, 
              minimum: MIN_DATA_POINTS_FOR_RELIABLE_ANALYSIS 
            })}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.palette.primary500} />
          <Text style={styles.loadingText}>{translate("fraudAbuseAnalysis.loadingResults")}</Text>
        </View>
      ) : !latestAnalysis ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="shield" size={48} color={colors.palette.neutral600} />
          <Text style={styles.emptyText}>{translate("fraudAbuseAnalysis.noResultsAvailable")}</Text>
          <Text style={styles.emptySubtext}>{translate("fraudAbuseAnalysis.analysisWillAppearAfterCalls")}</Text>
        </View>
      ) : (
        <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.overviewCard}>
            <View style={styles.overviewHeader}>
              <Text style={styles.sectionTitle}>{translate("fraudAbuseAnalysis.overview")}</Text>
              <View style={[styles.riskBadge, { backgroundColor: getRiskLevel(latestAnalysis.overallRiskScore).color + '20' }]}>
                <View 
                  style={[
                    styles.riskDot, 
                    { backgroundColor: getRiskLevel(latestAnalysis.overallRiskScore).color }
                  ]} 
                />
                <Text style={[styles.riskText, { color: getRiskLevel(latestAnalysis.overallRiskScore).color }]}>
                  {getRiskLevel(latestAnalysis.overallRiskScore).level}
                </Text>
              </View>
            </View>
            <Text style={styles.overviewDate}>
              {formatDateLocalized(latestAnalysis.analysisDate)}
            </Text>
            <View style={styles.overviewStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{analysisResponse?.data?.conversationCount || 0}</Text>
                <Text style={styles.statLabel}>{translate("fraudAbuseAnalysis.conversations")}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{analysisResponse?.data?.messageCount || 0}</Text>
                <Text style={styles.statLabel}>{translate("fraudAbuseAnalysis.messages")}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: getRiskLevel(latestAnalysis.overallRiskScore).color }]}>
                  {latestAnalysis.overallRiskScore.toFixed(0)}
                </Text>
                <Text style={styles.statLabel}>{translate("fraudAbuseAnalysis.riskScore")}</Text>
              </View>
            </View>
          </View>

          {/* Financial Risk Section */}
          <Pressable 
            style={styles.sectionCard}
            onPress={() => toggleSection('financial')}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="cash" size={24} color={colors.palette.biancaWarning} />
                <Text style={styles.sectionTitle}>{translate("fraudAbuseAnalysis.financialRisk")}</Text>
              </View>
              <Ionicons 
                name={expandedSections.has('financial') ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={colors.palette.neutral600} 
              />
            </View>
            
            <View style={styles.sectionSummary}>
              <View style={styles.scoreContainer}>
                <Text style={[styles.scoreValue, { color: getRiskLevel(latestAnalysis.financialRisk.riskScore).color }]}>
                  {latestAnalysis.financialRisk.riskScore.toFixed(0)}
                </Text>
                <Text style={styles.scoreLabel}>%</Text>
              </View>
              <View style={styles.riskBadge}>
                <View 
                  style={[
                    styles.riskDot, 
                    { backgroundColor: getRiskLevel(latestAnalysis.financialRisk.riskScore).color }
                  ]} 
                />
                <Text style={[styles.riskText, { color: getRiskLevel(latestAnalysis.financialRisk.riskScore).color }]}>
                  {getRiskLevel(latestAnalysis.financialRisk.riskScore).level}
                </Text>
              </View>
            </View>

            {expandedSections.has('financial') && latestAnalysis.financialRisk && (
              <View style={styles.detailsContainer}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("fraudAbuseAnalysis.largeAmountMentions")}</Text>
                  <Text style={styles.metricValue}>
                    {latestAnalysis.financialRisk.largeAmountMentions}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("fraudAbuseAnalysis.transferMethodMentions")}</Text>
                  <Text style={styles.metricValue}>
                    {latestAnalysis.financialRisk.transferMethodMentions}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("fraudAbuseAnalysis.scamIndicators")}</Text>
                  <Text style={styles.metricValue}>
                    {latestAnalysis.financialRisk.scamIndicatorMentions}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>

          {/* Abuse Risk Section */}
          <Pressable 
            style={styles.sectionCard}
            onPress={() => toggleSection('abuse')}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="warning" size={24} color={colors.palette.biancaError} />
                <Text style={styles.sectionTitle}>{translate("fraudAbuseAnalysis.abuseRisk")}</Text>
              </View>
              <Ionicons 
                name={expandedSections.has('abuse') ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={colors.palette.neutral600} 
              />
            </View>

            <View style={styles.sectionSummary}>
              <View style={styles.scoreContainer}>
                <Text style={[styles.scoreValue, { color: getRiskLevel(latestAnalysis.abuseRisk.riskScore).color }]}>
                  {latestAnalysis.abuseRisk.riskScore.toFixed(0)}
                </Text>
                <Text style={styles.scoreLabel}>%</Text>
              </View>
              <View style={styles.riskBadge}>
                <View 
                  style={[
                    styles.riskDot, 
                    { backgroundColor: getRiskLevel(latestAnalysis.abuseRisk.riskScore).color }
                  ]} 
                />
                <Text style={[styles.riskText, { color: getRiskLevel(latestAnalysis.abuseRisk.riskScore).color }]}>
                  {getRiskLevel(latestAnalysis.abuseRisk.riskScore).level}
                </Text>
              </View>
            </View>

            {expandedSections.has('abuse') && latestAnalysis.abuseRisk && (
              <View style={styles.detailsContainer}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("fraudAbuseAnalysis.physicalAbuseScore")}</Text>
                  <Text style={styles.metricValue}>
                    {latestAnalysis.abuseRisk.physicalAbuseScore.toFixed(0)}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("fraudAbuseAnalysis.emotionalAbuseScore")}</Text>
                  <Text style={styles.metricValue}>
                    {latestAnalysis.abuseRisk.emotionalAbuseScore.toFixed(0)}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("fraudAbuseAnalysis.neglectScore")}</Text>
                  <Text style={styles.metricValue}>
                    {latestAnalysis.abuseRisk.neglectScore.toFixed(0)}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>

          {/* Relationship Risk Section */}
          <Pressable 
            style={styles.sectionCard}
            onPress={() => toggleSection('relationship')}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="people" size={24} color={colors.palette.primary500} />
                <Text style={styles.sectionTitle}>{translate("fraudAbuseAnalysis.relationshipRisk")}</Text>
              </View>
              <Ionicons 
                name={expandedSections.has('relationship') ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={colors.palette.neutral600} 
              />
            </View>

            <View style={styles.sectionSummary}>
              <View style={styles.scoreContainer}>
                <Text style={[styles.scoreValue, { color: getRiskLevel(latestAnalysis.relationshipRisk.riskScore).color }]}>
                  {latestAnalysis.relationshipRisk.riskScore.toFixed(0)}
                </Text>
                <Text style={styles.scoreLabel}>%</Text>
              </View>
              <View style={styles.riskBadge}>
                <View 
                  style={[
                    styles.riskDot, 
                    { backgroundColor: getRiskLevel(latestAnalysis.relationshipRisk.riskScore).color }
                  ]} 
                />
                <Text style={[styles.riskText, { color: getRiskLevel(latestAnalysis.relationshipRisk.riskScore).color }]}>
                  {getRiskLevel(latestAnalysis.relationshipRisk.riskScore).level}
                </Text>
              </View>
            </View>

            {expandedSections.has('relationship') && latestAnalysis.relationshipRisk && (
              <View style={styles.detailsContainer}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("fraudAbuseAnalysis.newPeopleCount")}</Text>
                  <Text style={styles.metricValue}>
                    {latestAnalysis.relationshipRisk.newPeopleCount}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("fraudAbuseAnalysis.isolationCount")}</Text>
                  <Text style={styles.metricValue}>
                    {latestAnalysis.relationshipRisk.isolationCount}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{translate("fraudAbuseAnalysis.suspiciousBehaviorCount")}</Text>
                  <Text style={styles.metricValue}>
                    {latestAnalysis.relationshipRisk.suspiciousBehaviorCount}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>

          {/* Warnings Section */}
          {latestAnalysis.warnings && latestAnalysis.warnings.length > 0 && (
            <View style={styles.warningsCard}>
              <Text style={styles.sectionTitle}>{translate("fraudAbuseAnalysis.warnings")}</Text>
              {latestAnalysis.warnings.map((warning, index) => (
                <View key={index} style={styles.warningItem}>
                  <Ionicons name="alert-circle" size={16} color={colors.palette.biancaError} />
                  <Text style={styles.warningText}>{warning}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Recommendations Section */}
          {recommendations && recommendations.length > 0 && (
            <View style={styles.recommendationsCard}>
              <Text style={styles.sectionTitle}>{translate("fraudAbuseAnalysis.recommendations")}</Text>
              {recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <Ionicons 
                    name={rec.priority === 'high' ? "alert-circle" : "information-circle"} 
                    size={16} 
                    color={rec.priority === 'high' ? colors.palette.biancaError : colors.palette.biancaWarning} 
                  />
                  <View style={styles.recommendationContent}>
                    <Text style={styles.recommendationAction}>{rec.action}</Text>
                    <Text style={styles.recommendationDescription}>{rec.description}</Text>
                  </View>
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
        testID="fraud-abuse-analysis-toast"
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
    borderLeftColor: colors.palette.biancaError,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
  warningsCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.palette.biancaError,
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
  recommendationsCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.palette.biancaWarning,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationAction: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 12,
    color: colors.palette.neutral600,
    lineHeight: 16,
  },
})

