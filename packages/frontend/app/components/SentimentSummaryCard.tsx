import React from "react"
import { View, ViewStyle, StyleSheet } from "react-native"
import { Text } from "./Text"
import { Icon } from "./Icon"
import { useTheme } from "../theme/ThemeContext"
import { SentimentSummary, SentimentType, TrendDirection } from "../services/api/api.types"
import { translate } from "../i18n"

interface SentimentSummaryCardProps {
  summary: SentimentSummary
  style?: ViewStyle
}

export function SentimentSummaryCard({ summary, style }: SentimentSummaryCardProps) {
  const { colors } = useTheme()
  const { averageSentiment, sentimentDistribution, trendDirection, keyInsights, confidence } = summary
  const styles = createStyles(colors)

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{translate("sentimentAnalysis.sentimentOverview")}</Text>
        <View style={styles.confidenceContainer}>
          <Icon icon="shield" size={16} color={colors.textDim || colors.palette.neutral600} />
          <Text style={styles.confidenceText}>{Math.round(confidence * 100)}%</Text>
        </View>
      </View>

      {/* Main sentiment score */}
      <View style={styles.mainScoreContainer}>
        <Text style={[styles.mainScore, { color: getSentimentColor(averageSentiment, colors) }]}>
          {averageSentiment > 0 ? "+" : ""}{averageSentiment.toFixed(1)}
        </Text>
        <Text style={styles.mainScoreLabel}>{translate("sentimentAnalysis.averageSentiment")}</Text>
      </View>

      {/* Trend indicator */}
      <View style={styles.trendContainer}>
        <View style={[styles.trendIndicator, { backgroundColor: getTrendColor(trendDirection, colors) }]}>
          <Icon icon={getTrendIcon(trendDirection)} size={16} color={colors.palette.neutral100} />
        </View>
        <Text style={[styles.trendText, { color: getTrendColor(trendDirection, colors) }]}>
          {trendDirection.charAt(0).toUpperCase() + trendDirection.slice(1)} {translate("sentimentAnalysis.trend")}
        </Text>
      </View>

      {/* Sentiment distribution */}
      <View style={styles.distributionContainer}>
        <Text style={styles.distributionTitle}>{translate("sentimentAnalysis.recentDistribution")}</Text>
        <View style={styles.distributionBars}>
          {Object.entries(sentimentDistribution).map(([sentiment, count]) => (
            <View key={sentiment} style={styles.distributionItem}>
              <View style={styles.distributionBarContainer}>
                <View
                  style={[
                    styles.distributionBar,
                    {
                      height: (count / Math.max(...Object.values(sentimentDistribution))) * 30,
                      backgroundColor: getSentimentTypeColor(sentiment as SentimentType, colors),
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
          <Text style={styles.insightsTitle}>{translate("sentimentAnalysis.keyInsights")}</Text>
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
            <Text style={styles.infoLabel}>{translate("sentimentAnalysis.totalConversations")}</Text>
            <Text style={styles.infoValue}>{summary.totalConversations}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{translate("sentimentAnalysis.analysisCoverage")}</Text>
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
              <Text style={styles.infoLabel}>{translate("sentimentAnalysis.recentConversations")}</Text>
              <Text style={styles.infoValue}>{summary.recentTrend.length} {translate("sentimentAnalysis.analyzed")}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{translate("sentimentAnalysis.latestAnalysis")}</Text>
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
          {summary.analyzedConversations} of {summary.totalConversations} {translate("sentimentAnalysis.conversationsAnalyzed")}
        </Text>
      </View>
    </View>
  )
}

function getSentimentColor(score: number, colors: any): string {
  if (score > 0.3) return colors.palette.biancaSuccess
  if (score < -0.3) return colors.error
  return colors.textDim || colors.palette.neutral600
}

function getTrendColor(trend: TrendDirection, colors: any): string {
  switch (trend) {
    case "improving":
      return colors.palette.biancaSuccess
    case "declining":
      return colors.error
    default:
      return colors.textDim || colors.palette.neutral600
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

function getSentimentTypeColor(sentiment: SentimentType, colors: any): string {
  switch (sentiment) {
    case "positive":
      return colors.palette.biancaSuccess
    case "negative":
      return colors.error
    case "neutral":
      return colors.textDim || colors.palette.neutral600
    case "mixed":
      return colors.palette.accent500
    default:
      return colors.palette.biancaBorder || colors.border
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
  },
  confidenceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: colors.textDim || colors.palette.neutral600,
    fontWeight: "500",
  },
  mainScoreContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  mainScore: {
    fontSize: 32,
    fontWeight: "700",
  },
  mainScoreLabel: {
    fontSize: 14,
    color: colors.textDim || colors.palette.neutral600,
    marginTop: 4,
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 8,
  },
  trendIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  trendText: {
    fontSize: 14,
    fontWeight: "600",
  },
  distributionContainer: {
    marginBottom: 20,
  },
  distributionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
    marginBottom: 12,
  },
  distributionBars: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    height: 50,
    gap: 16,
  },
  distributionItem: {
    alignItems: "center",
    minWidth: 50,
  },
  distributionBarContainer: {
    height: 30,
    justifyContent: "flex-end",
    marginBottom: 6,
    alignItems: "center",
  },
  distributionBar: {
    width: 28,
    borderRadius: 4,
    minHeight: 2,
  },
  distributionLabel: {
    fontSize: 11,
    color: colors.textDim || colors.palette.neutral600,
    textTransform: "capitalize",
    marginBottom: 2,
  },
  distributionCount: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
  },
  insightsContainer: {
    marginBottom: 16,
  },
  insightsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
    marginBottom: 8,
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 8,
  },
  insightText: {
    fontSize: 12,
    color: colors.textDim || colors.palette.neutral600,
    flex: 1,
    lineHeight: 16,
  },
  additionalInfo: {
    marginBottom: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  infoItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.palette.neutral200,
    padding: 12,
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textDim || colors.palette.neutral600,
    fontWeight: "500",
    marginBottom: 4,
    textAlign: "center",
  },
  infoValue: {
    fontSize: 14,
    color: colors.palette.biancaHeader || colors.text,
    fontWeight: "600",
    textAlign: "center",
  },
  dataSummary: {
    borderTopWidth: 1,
    borderTopColor: colors.palette.biancaBorder || colors.border,
    paddingTop: 12,
  },
  dataText: {
    fontSize: 12,
    color: colors.textDim || colors.palette.neutral600,
    textAlign: "center",
  },
})

