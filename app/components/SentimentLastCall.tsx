import React from "react"
import { View, ViewStyle, ScrollView, Dimensions, StyleSheet } from "react-native"
import { Text } from "./Text"
import { Icon } from "./Icon"
import { useTheme } from "../theme/ThemeContext"
import { SentimentTrendPoint, SentimentAnalysis, ConcernLevel } from "../services/api/api.types"
import { translate } from "../i18n"

interface SentimentLastCallProps {
  lastCall?: SentimentTrendPoint
  style?: ViewStyle
}

export function SentimentLastCall({ lastCall, style }: SentimentLastCallProps) {
  const { colors } = useTheme()
  const screenWidth = Dimensions.get("window").width
  const isMobile = screenWidth < 768
  const styles = createStyles(colors)

  if (!lastCall || !lastCall.sentiment) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.title}>{translate("sentimentAnalysis.lastCallAnalysis")}</Text>
        <View style={styles.emptyContainer}>
          <Icon icon="phoneOff" size={48} color={colors.textDim || colors.palette.neutral600} />
          <Text style={styles.emptyTitle}>{translate("sentimentAnalysis.noRecentCall")}</Text>
          <Text style={styles.emptyText}>
            {translate("sentimentAnalysis.noRecentCallMessage")}
          </Text>
        </View>
      </View>
    )
  }

  const sentiment = lastCall.sentiment

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{translate("sentimentAnalysis.lastCallAnalysis")}</Text>
      
      {/* Call Overview */}
      <View style={styles.callOverview}>
        <View style={styles.callHeader}>
          <View style={styles.callDateContainer}>
            <Icon icon="calendar" size={16} color={colors.textDim || colors.palette.neutral600} />
            <Text style={styles.callDate}>
              {new Date(lastCall.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>
          <View style={styles.callTimeContainer}>
            <Icon icon="clock" size={16} color={colors.textDim || colors.palette.neutral600} />
            <Text style={styles.callTime}>
              {new Date(lastCall.date).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </Text>
          </View>
        </View>
        
        <View style={styles.callStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{translate("sentimentAnalysis.duration")}</Text>
            <Text style={styles.statValue}>{Math.round(lastCall.duration / 60)} minutes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{translate("sentimentAnalysis.analysisDate")}</Text>
            <Text style={styles.statValue}>
              {lastCall.sentimentAnalyzedAt 
                ? new Date(lastCall.sentimentAnalyzedAt).toLocaleDateString()
                : 'N/A'
              }
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{translate("sentimentAnalysis.conversationId")}</Text>
            <Text style={styles.statValue}>{lastCall.conversationId?.slice(-8) || 'N/A'}</Text>
          </View>
        </View>
      </View>

      {/* Main Sentiment Score */}
      <View style={styles.mainSentimentCard}>
        <View style={styles.sentimentHeader}>
          <Text style={styles.sentimentTitle}>{translate("sentimentAnalysis.overallSentiment")}</Text>
          <View style={[
            styles.sentimentBadge,
            { backgroundColor: getSentimentColor(sentiment.sentimentScore, colors) }
          ]}>
            <Text style={styles.sentimentBadgeText}>
              {sentiment.overallSentiment.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <View style={styles.sentimentScoreContainer}>
          <Text style={[
            styles.sentimentScore,
            { color: getSentimentColor(sentiment.sentimentScore, colors) }
          ]}>
            {sentiment.sentimentScore > 0 ? "+" : ""}{sentiment.sentimentScore.toFixed(2)}
          </Text>
          <Text style={styles.sentimentScoreLabel}>
            {translate("sentimentAnalysis.scoreRange")}
          </Text>
        </View>

        <View style={styles.confidenceContainer}>
          <Icon icon="shield" size={16} color={colors.textDim || colors.palette.neutral600} />
          <Text style={styles.confidenceText}>
            {translate("sentimentAnalysis.analysisConfidence")} {Math.round(sentiment.confidence * 100)}%
          </Text>
        </View>
      </View>

      {/* Key Emotions */}
      {sentiment.keyEmotions && sentiment.keyEmotions.length > 0 && (
        <View style={styles.emotionsCard}>
          <Text style={styles.cardTitle}>{translate("sentimentAnalysis.keyEmotionsDetected")}</Text>
          <View style={styles.emotionsGrid}>
            {sentiment.keyEmotions.map((emotion, index) => (
              <View key={index} style={styles.emotionItem}>
                <Icon 
                  icon={getEmotionIcon(emotion)} 
                  size={20} 
                  color={getEmotionColor(emotion, colors)} 
                />
                <Text style={styles.emotionText}>{emotion}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Patient Mood */}
      {sentiment.patientMood && (
        <View style={styles.moodCard}>
          <Text style={styles.cardTitle}>{translate("sentimentAnalysis.patientMoodAssessment")}</Text>
          <Text style={styles.moodText}>{sentiment.patientMood}</Text>
        </View>
      )}

      {/* Concern Level */}
      {sentiment.concernLevel && (
        <View style={styles.concernCard}>
          <Text style={styles.cardTitle}>{translate("sentimentAnalysis.concernLevel")}</Text>
          <View style={styles.concernLevelContainer}>
            <View style={[
              styles.concernLevelBadge,
              { backgroundColor: getConcernColor(sentiment.concernLevel, colors) }
            ]}>
              <Icon 
                icon={getConcernIcon(sentiment.concernLevel)} 
                size={16} 
                color={colors.palette.neutral100} 
              />
              <Text style={styles.concernLevelText}>
                {sentiment.concernLevel.toUpperCase()} {translate("sentimentAnalysis.concern")}
              </Text>
            </View>
            <Text style={styles.concernDescription}>
              {sentiment.summary || getConcernDescription(sentiment.concernLevel)}
            </Text>
          </View>
        </View>
      )}

      {/* Satisfaction Indicators */}
      {sentiment.satisfactionIndicators && (
        <View style={styles.satisfactionCard}>
          <Text style={styles.cardTitle}>{translate("sentimentAnalysis.satisfactionIndicators")}</Text>
          
          {sentiment.satisfactionIndicators.positive && sentiment.satisfactionIndicators.positive.length > 0 && (
            <View style={styles.satisfactionSection}>
              <View style={styles.satisfactionHeader}>
                <Icon icon="checkCircle" size={16} color={colors.palette.biancaSuccess} />
                <Text style={styles.satisfactionSectionTitle}>{translate("sentimentAnalysis.positiveIndicators")}</Text>
              </View>
              {sentiment.satisfactionIndicators.positive.map((indicator, index) => (
                <View key={index} style={styles.satisfactionItem}>
                  <Text style={styles.satisfactionBullet}>•</Text>
                  <Text style={styles.satisfactionText}>{indicator}</Text>
                </View>
              ))}
            </View>
          )}

          {sentiment.satisfactionIndicators.negative && sentiment.satisfactionIndicators.negative.length > 0 && (
            <View style={styles.satisfactionSection}>
              <View style={styles.satisfactionHeader}>
                <Icon icon="alertCircle" size={16} color={colors.error} />
                <Text style={styles.satisfactionSectionTitle}>{translate("sentimentAnalysis.areasOfConcern")}</Text>
              </View>
              {sentiment.satisfactionIndicators.negative.map((indicator, index) => (
                <View key={index} style={styles.satisfactionItem}>
                  <Text style={styles.satisfactionBullet}>•</Text>
                  <Text style={styles.satisfactionText}>{indicator}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* AI Summary */}
      {sentiment.summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>{translate("sentimentAnalysis.aiSummary")}</Text>
          <Text style={styles.summaryText}>{sentiment.summary}</Text>
        </View>
      )}

      {/* Recommendations */}
      {sentiment.recommendations && (
        <View style={styles.recommendationsCard}>
          <Text style={styles.cardTitle}>{translate("sentimentAnalysis.recommendations")}</Text>
          <Text style={styles.recommendationsText}>{sentiment.recommendations}</Text>
        </View>
      )}
    </View>
  )
}

function getSentimentColor(score: number, colors: any): string {
  if (score > 0.3) return colors.palette.biancaSuccess
  if (score < -0.3) return colors.error
  return colors.textDim || colors.palette.neutral600
}

function getEmotionIcon(emotion: string): "smile" | "frown" | "meh" | "heart" | "zap" | "target" {
  const emotionLower = emotion.toLowerCase()
  if (emotionLower.includes('happy') || emotionLower.includes('joy') || emotionLower.includes('positive')) return "smile"
  if (emotionLower.includes('sad') || emotionLower.includes('negative') || emotionLower.includes('frustrated')) return "frown"
  if (emotionLower.includes('neutral') || emotionLower.includes('calm')) return "meh"
  if (emotionLower.includes('love') || emotionLower.includes('care')) return "heart"
  if (emotionLower.includes('excited') || emotionLower.includes('energetic')) return "zap"
  return "target"
}

function getEmotionColor(emotion: string, colors: any): string {
  const emotionLower = emotion.toLowerCase()
  if (emotionLower.includes('happy') || emotionLower.includes('joy') || emotionLower.includes('positive')) return colors.palette.biancaSuccess
  if (emotionLower.includes('sad') || emotionLower.includes('negative') || emotionLower.includes('frustrated')) return colors.error
  if (emotionLower.includes('neutral') || emotionLower.includes('calm')) return colors.textDim || colors.palette.neutral600
  return colors.palette.accent500
}

function getConcernIcon(level: ConcernLevel): "shield" | "alertCircle" | "alertTriangle" {
  switch (level) {
    case "low":
      return "shield"
    case "medium":
      return "alertCircle"
    case "high":
      return "alertTriangle"
  }
}

function getConcernColor(level: ConcernLevel, colors: any): string {
  switch (level) {
    case "low":
      return colors.palette.biancaSuccess
    case "medium":
      return colors.palette.biancaWarning
    case "high":
      return colors.error
  }
}

function getConcernDescription(level: ConcernLevel): string {
  switch (level) {
    case "low":
      return translate("sentimentAnalysis.lowConcernDescription")
    case "medium":
      return translate("sentimentAnalysis.mediumConcernDescription")
    case "high":
      return translate("sentimentAnalysis.highConcernDescription")
  }
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: colors.palette.neutral800 || colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.palette.biancaHeader || colors.text,
    marginBottom: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
    backgroundColor: colors.palette.neutral200,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textDim || colors.palette.neutral600,
    textAlign: "center",
    lineHeight: 20,
  },
  callOverview: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  callHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  callDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callDate: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
  },
  callTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callTime: {
    fontSize: 14,
    color: colors.textDim || colors.palette.neutral600,
  },
  callStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
    gap: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: colors.textDim || colors.palette.neutral600,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
  },
  mainSentimentCard: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sentimentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sentimentTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
  },
  sentimentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sentimentBadgeText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: colors.palette.neutral100,
  },
  sentimentScoreContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  sentimentScore: {
    fontSize: 48,
    fontWeight: "800",
    marginBottom: 8,
  },
  sentimentScoreLabel: {
    fontSize: 12,
    color: colors.textDim || colors.palette.neutral600,
    textAlign: "center",
  },
  confidenceContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  confidenceText: {
    fontSize: 14,
    color: colors.textDim || colors.palette.neutral600,
    fontWeight: "500",
  },
  emotionsCard: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
    marginBottom: 12,
  },
  emotionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  emotionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.palette.neutral300,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  emotionText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.palette.biancaHeader || colors.text,
    textTransform: "capitalize",
  },
  moodCard: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  moodText: {
    fontSize: 14,
    color: colors.palette.biancaHeader || colors.text,
    lineHeight: 20,
  },
  concernCard: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  concernLevelContainer: {
    alignItems: "center",
    gap: 8,
  },
  concernLevelBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  concernLevelText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.palette.neutral100,
  },
  concernDescription: {
    fontSize: 12,
    color: colors.textDim || colors.palette.neutral600,
    textAlign: "center",
    lineHeight: 16,
  },
  satisfactionCard: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  satisfactionSection: {
    marginBottom: 16,
  },
  satisfactionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  satisfactionSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
  },
  satisfactionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 8,
  },
  satisfactionBullet: {
    fontSize: 14,
    color: colors.textDim || colors.palette.neutral600,
    marginTop: 2,
  },
  satisfactionText: {
    fontSize: 13,
    color: colors.palette.biancaHeader || colors.text,
    flex: 1,
    lineHeight: 18,
  },
  summaryCard: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    color: colors.palette.biancaHeader || colors.text,
    lineHeight: 20,
  },
  recommendationsCard: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  recommendationsText: {
    fontSize: 14,
    color: colors.palette.biancaHeader || colors.text,
    lineHeight: 20,
  },
})

