import React from "react"
import { View, ViewStyle } from "react-native"
import { Text } from "./Text"
import { Icon } from "./Icon"
import { colors } from "../theme/colors"
import { SentimentSummary, SentimentType, TrendDirection } from "../services/api/api.types"

interface SentimentSummaryCardProps {
  summary: SentimentSummary
  style?: ViewStyle
}

export function SentimentSummaryCard({ summary, style }: SentimentSummaryCardProps) {
  const { averageSentiment, sentimentDistribution, trendDirection, keyInsights, confidence } = summary

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Sentiment Overview</Text>
        <View style={styles.confidenceContainer}>
          <Icon icon="shield" size={16} color={colors.textDim} />
          <Text style={styles.confidenceText}>{Math.round(confidence * 100)}%</Text>
        </View>
      </View>

      {/* Main sentiment score */}
      <View style={styles.mainScoreContainer}>
        <Text style={[styles.mainScore, { color: getSentimentColor(averageSentiment) }]}>
          {averageSentiment > 0 ? "+" : ""}{averageSentiment.toFixed(1)}
        </Text>
        <Text style={styles.mainScoreLabel}>Average Sentiment</Text>
      </View>

      {/* Trend indicator */}
      <View style={styles.trendContainer}>
        <View style={[styles.trendIndicator, { backgroundColor: getTrendColor(trendDirection) }]}>
          <Icon icon={getTrendIcon(trendDirection)} size={16} color={colors.palette.neutral100} />
        </View>
        <Text style={[styles.trendText, { color: getTrendColor(trendDirection) }]}>
          {trendDirection.charAt(0).toUpperCase() + trendDirection.slice(1)} trend
        </Text>
      </View>

      {/* Sentiment distribution */}
      <View style={styles.distributionContainer}>
        <Text style={styles.distributionTitle}>Recent Distribution</Text>
        <View style={styles.distributionBars}>
          {Object.entries(sentimentDistribution).map(([sentiment, count]) => (
            <View key={sentiment} style={styles.distributionItem}>
              <View style={styles.distributionBarContainer}>
                <View
                  style={[
                    styles.distributionBar,
                    {
                      height: (count / Math.max(...Object.values(sentimentDistribution))) * 40,
                      backgroundColor: getSentimentTypeColor(sentiment as SentimentType),
                    },
                  ]}
                />
              </View>
              <Text style={styles.distributionLabel}>{sentiment}</Text>
              <Text style={styles.distributionCount}>{count}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Key insights */}
      {keyInsights.length > 0 && (
        <View style={styles.insightsContainer}>
          <Text style={styles.insightsTitle}>Key Insights</Text>
          {keyInsights.map((insight, index) => (
            <View key={index} style={styles.insightItem}>
              <Icon icon="lightbulb" size={14} color={colors.palette.accent500} />
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Additional summary information */}
      <View style={styles.additionalInfo}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Total Conversations</Text>
            <Text style={styles.infoValue}>{summary.totalConversations}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Analysis Coverage</Text>
            <Text style={styles.infoValue}>
              {summary.totalConversations > 0 
                ? Math.round((summary.analyzedConversations / summary.totalConversations) * 100)
                : 0
              }%
            </Text>
          </View>
        </View>
        {summary.recentTrend && summary.recentTrend.length > 0 && (
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Recent Conversations</Text>
              <Text style={styles.infoValue}>{summary.recentTrend.length} analyzed</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Latest Analysis</Text>
              <Text style={styles.infoValue}>
                {summary.recentTrend[0]?.sentimentAnalyzedAt 
                  ? new Date(summary.recentTrend[0].sentimentAnalyzedAt).toLocaleDateString()
                  : 'N/A'
                }
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Data summary */}
      <View style={styles.dataSummary}>
        <Text style={styles.dataText}>
          {summary.analyzedConversations} of {summary.totalConversations} conversations analyzed
        </Text>
      </View>
    </View>
  )
}

function getSentimentColor(score: number): string {
  if (score > 0.3) return colors.palette.biancaSuccess
  if (score < -0.3) return colors.error
  return colors.textDim
}

function getTrendColor(trend: TrendDirection): string {
  switch (trend) {
    case "improving":
      return colors.palette.biancaSuccess
    case "declining":
      return colors.error
    default:
      return colors.textDim
  }
}

function getTrendIcon(trend: TrendDirection): "arrowUp" | "arrowDown" | "minus" {
  switch (trend) {
    case "improving":
      return "arrowUp"
    case "declining":
      return "arrowDown"
    default:
      return "minus"
  }
}

function getSentimentTypeColor(sentiment: SentimentType): string {
  switch (sentiment) {
    case "positive":
      return colors.palette.biancaSuccess
    case "negative":
      return colors.error
    case "neutral":
      return colors.textDim
    case "mixed":
      return colors.palette.accent500
    default:
      return colors.border
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
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: colors.text,
  },
  confidenceContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: colors.textDim,
    fontWeight: "500" as const,
  },
  mainScoreContainer: {
    alignItems: "center" as const,
    marginBottom: 16,
  },
  mainScore: {
    fontSize: 32,
    fontWeight: "700" as const,
  },
  mainScoreLabel: {
    fontSize: 14,
    color: colors.textDim,
    marginTop: 4,
  },
  trendContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 20,
    gap: 8,
  },
  trendIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  trendText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  distributionContainer: {
    marginBottom: 20,
  },
  distributionTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: colors.text,
    marginBottom: 12,
  },
  distributionBars: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    alignItems: "flex-end" as const,
    height: 60,
  },
  distributionItem: {
    alignItems: "center" as const,
    flex: 1,
  },
  distributionBarContainer: {
    height: 40,
    justifyContent: "flex-end" as const,
    marginBottom: 4,
  },
  distributionBar: {
    width: 20,
    borderRadius: 2,
    minHeight: 2,
  },
  distributionLabel: {
    fontSize: 10,
    color: colors.textDim,
    textTransform: "capitalize" as const,
  },
  distributionCount: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.text,
    marginTop: 2,
  },
  insightsContainer: {
    marginBottom: 16,
  },
  insightsTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: colors.text,
    marginBottom: 8,
  },
  insightItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    marginBottom: 6,
    gap: 8,
  },
  insightText: {
    fontSize: 12,
    color: colors.textDim,
    flex: 1,
    lineHeight: 16,
  },
  additionalInfo: {
    marginBottom: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    gap: 16,
  },
  infoItem: {
    flex: 1,
    alignItems: "center" as const,
    backgroundColor: colors.palette.neutral200,
    padding: 12,
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textDim,
    fontWeight: "500" as const,
    marginBottom: 4,
    textAlign: "center" as const,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "600" as const,
    textAlign: "center" as const,
  },
  dataSummary: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  dataText: {
    fontSize: 12,
    color: colors.textDim,
    textAlign: "center" as const,
  },
}

