import React from "react"
import { View, ViewStyle, ScrollView, Dimensions } from "react-native"
import { Text } from "./Text"
import { Icon } from "./Icon"
import { colors } from "../theme/colors"
import { SentimentTrendPoint, SentimentType } from "../services/api/api.types"
import { translate } from "../i18n"

interface SentimentRecentTrendsProps {
  recentTrend: SentimentTrendPoint[]
  style?: ViewStyle
}

export function SentimentRecentTrends({ recentTrend, style }: SentimentRecentTrendsProps) {
  const screenWidth = Dimensions.get("window").width
  const isMobile = screenWidth < 768

  if (recentTrend.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.title}>{translate("sentimentAnalysis.recentConversationsTitle")}</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{translate("sentimentAnalysis.noRecentConversations")}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{translate("sentimentAnalysis.recentConversationsTitle")}</Text>
      <Text style={styles.subtitle}>
        {recentTrend.length} {translate("sentimentAnalysis.conversationsWithSentiment", { s: recentTrend.length === 1 ? '' : 's' })}
      </Text>
      
      <ScrollView 
        horizontal={isMobile}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={isMobile ? styles.mobileScrollContent : styles.desktopGrid}
      >
        {recentTrend.map((conversation, index) => (
          <View 
            key={conversation.conversationId} 
            style={[
              styles.conversationCard,
              isMobile && styles.mobileCard
            ]}
          >
            {/* Header with date and duration */}
            <View style={styles.cardHeader}>
              <View style={styles.dateContainer}>
                <Icon icon="calendar" size={14} color={colors.textDim} />
                <Text style={styles.dateText}>
                  {new Date(conversation.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.durationContainer}>
                <Icon icon="clock" size={14} color={colors.textDim} />
                <Text style={styles.durationText}>
                  {Math.round(conversation.duration / 60)}m
                </Text>
              </View>
            </View>

            {/* Sentiment analysis */}
            {conversation.sentiment ? (
              <View style={styles.sentimentContainer}>
                <View style={styles.sentimentHeader}>
                  <View style={[
                    styles.sentimentBadge,
                    { backgroundColor: getSentimentColor(conversation.sentiment.sentimentScore) }
                  ]}>
                    <Text style={styles.sentimentBadgeText}>
                      {conversation.sentiment.overallSentiment}
                    </Text>
                  </View>
                  <Text style={styles.sentimentScore}>
                    {conversation.sentiment.sentimentScore > 0 ? "+" : ""}
                    {conversation.sentiment.sentimentScore.toFixed(1)}
                  </Text>
                </View>

                {/* Key emotions */}
                {conversation.sentiment.keyEmotions && conversation.sentiment.keyEmotions.length > 0 && (
                  <View style={styles.emotionsContainer}>
                    <Text style={styles.emotionsLabel}>{translate("sentimentAnalysis.keyEmotions")}</Text>
                    <View style={styles.emotionsList}>
                      {conversation.sentiment.keyEmotions.slice(0, 3).map((emotion, emotionIndex) => (
                        <View key={emotionIndex} style={styles.emotionTag}>
                          <Text style={styles.emotionText}>{emotion}</Text>
                        </View>
                      ))}
                      {conversation.sentiment.keyEmotions.length > 3 && (
                        <Text style={styles.moreEmotions}>
                          +{conversation.sentiment.keyEmotions.length - 3} {translate("sentimentAnalysis.moreEmotions")}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Patient mood */}
                {conversation.sentiment.patientMood && (
                  <View style={styles.moodContainer}>
                    <Text style={styles.moodLabel}>{translate("sentimentAnalysis.patientMood")}</Text>
                    <Text style={styles.moodText} numberOfLines={2}>
                      {conversation.sentiment.patientMood}
                    </Text>
                  </View>
                )}

                {/* Concern level */}
                {conversation.sentiment.concernLevel && (
                  <View style={styles.concernContainer}>
                    <View style={styles.concernHeader}>
                      <Icon 
                        icon={getConcernIcon(conversation.sentiment.concernLevel)} 
                        size={14} 
                        color={getConcernColor(conversation.sentiment.concernLevel)} 
                      />
                      <Text style={[
                        styles.concernText,
                        { color: getConcernColor(conversation.sentiment.concernLevel) }
                      ]}>
                        {conversation.sentiment.concernLevel} {translate("sentimentAnalysis.concern")}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Confidence */}
                <View style={styles.confidenceContainer}>
                  <Icon icon="shield" size={12} color={colors.textDim} />
                  <Text style={styles.confidenceText}>
                    {Math.round(conversation.sentiment.confidence * 100)}% {translate("sentimentAnalysis.confidence")}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.noSentimentContainer}>
                <Text style={styles.noSentimentText}>{translate("sentimentAnalysis.noSentimentAnalysisAvailable")}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

function getSentimentColor(score: number): string {
  if (score > 0.3) return colors.palette.biancaSuccess
  if (score < -0.3) return colors.error
  return colors.textDim
}

function getConcernIcon(level: string): "alertTriangle" | "alertCircle" | "shield" {
  switch (level) {
    case "high":
      return "alertTriangle"
    case "medium":
      return "alertCircle"
    default:
      return "shield"
  }
}

function getConcernColor(level: string): string {
  switch (level) {
    case "high":
      return colors.error
    case "medium":
      return colors.palette.biancaWarning
    default:
      return colors.palette.biancaSuccess
  }
}

const styles = {
  container: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: colors.palette.neutral800,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textDim,
    marginBottom: 16,
  },
  mobileScrollContent: {
    paddingRight: 16,
  },
  desktopGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 16,
  },
  conversationCard: {
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 12,
    minWidth: 280,
    maxWidth: 320,
  },
  mobileCard: {
    marginRight: 12,
    minWidth: 260,
  },
  cardHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: colors.textDim,
    fontWeight: "500" as const,
  },
  durationContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    color: colors.textDim,
    fontWeight: "500" as const,
  },
  sentimentContainer: {
    gap: 8,
  },
  sentimentHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  sentimentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sentimentBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.palette.neutral100,
    textTransform: "capitalize" as const,
  },
  sentimentScore: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: colors.text,
  },
  emotionsContainer: {
    gap: 4,
  },
  emotionsLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: colors.textDim,
  },
  emotionsList: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 4,
  },
  emotionTag: {
    backgroundColor: colors.palette.neutral300,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  emotionText: {
    fontSize: 10,
    color: colors.textDim,
    fontWeight: "500" as const,
  },
  moreEmotions: {
    fontSize: 10,
    color: colors.textDim,
    fontStyle: "italic" as const,
    alignSelf: "center" as const,
  },
  moodContainer: {
    gap: 4,
  },
  moodLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: colors.textDim,
  },
  moodText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 16,
  },
  concernContainer: {
    gap: 4,
  },
  concernHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  concernText: {
    fontSize: 12,
    fontWeight: "500" as const,
    textTransform: "capitalize" as const,
  },
  confidenceContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  confidenceText: {
    fontSize: 11,
    color: colors.textDim,
    fontWeight: "500" as const,
  },
  noSentimentContainer: {
    padding: 16,
    alignItems: "center" as const,
    backgroundColor: colors.palette.neutral300,
    borderRadius: 8,
  },
  noSentimentText: {
    fontSize: 12,
    color: colors.textDim,
    fontStyle: "italic" as const,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center" as const,
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textDim,
    textAlign: "center" as const,
  },
}

