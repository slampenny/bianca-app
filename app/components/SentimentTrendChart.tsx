import React from "react"
import { View, ViewStyle, Dimensions } from "react-native"
import { Text } from "./Text"
import { colors } from "../theme/colors"
import { SentimentTrend, SentimentTrendPoint } from "../services/api/api.types"
import { translate } from "../i18n"

interface SentimentTrendChartProps {
  trend: SentimentTrend
  style?: ViewStyle
}

export function SentimentTrendChart({ trend, style }: SentimentTrendChartProps) {
  const { dataPoints, summary } = trend
  const screenWidth = Dimensions.get("window").width
  const chartWidth = screenWidth - 40 // Account for padding
  const chartHeight = 120

  // Use dataPoints if available, otherwise show message
  const hasData = dataPoints.length > 0

  if (!hasData) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.title}>{translate("sentimentAnalysis.sentimentTrend")}</Text>
        <View style={[styles.emptyChart, { width: chartWidth, height: chartHeight }]}>
          <Text style={styles.emptyText}>
            {summary.analyzedConversations > 0 
              ? translate("sentimentAnalysis.conversationsAnalyzedNoTrend", { s: summary.analyzedConversations === 1 ? '' : 's' })
              : translate("sentimentAnalysis.noSentimentData")
            }
          </Text>
        </View>
      </View>
    )
  }

  // Calculate chart dimensions and data
  const maxScore = 1
  const minScore = -1
  const scoreRange = maxScore - minScore
  const pointWidth = chartWidth / Math.max(dataPoints.length - 1, 1)

  // Generate trend line points
  const trendPoints = dataPoints.map((point, index) => {
    const x = index * pointWidth
    const score = point.sentiment?.sentimentScore || 0
    const y = chartHeight - ((score - minScore) / scoreRange) * chartHeight
    return { x, y, score, point }
  })

  // Create SVG path for the trend line
  const pathData = trendPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{translate("sentimentAnalysis.sentimentTrend")} ({trend.timeRange})</Text>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            {translate("sentimentAnalysis.avg")} {summary.averageSentiment > 0 ? "+" : ""}{summary.averageSentiment.toFixed(1)}
          </Text>
          <Text style={[styles.trendText, getTrendStyle(summary.trendDirection)]}>
            {getTrendIcon(summary.trendDirection)} {summary.trendDirection}
          </Text>
        </View>
      </View>

      <View style={[styles.chartContainer, { width: chartWidth, height: chartHeight }]}>
        {/* Chart background with grid lines */}
        <View style={styles.chartBackground}>
          {/* Zero line */}
          <View style={[styles.zeroLine, { top: chartHeight / 2 }]} />
          
          {/* Positive area */}
          <View style={[styles.positiveArea, { height: chartHeight / 2 }]} />
          
          {/* Negative area */}
          <View style={[styles.negativeArea, { top: chartHeight / 2, height: chartHeight / 2 }]} />
        </View>

        {/* Data points */}
        {trendPoints.map((point, index) => (
          <View
            key={index}
            style={[
              styles.dataPoint,
              {
                left: point.x - 4,
                top: point.y - 4,
                backgroundColor: getSentimentColor(point.score),
              },
            ]}
          />
        ))}

        {/* Trend line (simplified as connected dots) */}
        {trendPoints.map((point, index) => {
          if (index === 0) return null
          const prevPoint = trendPoints[index - 1]
          const distance = Math.sqrt(
            Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.y - prevPoint.y, 2)
          )
          const angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * (180 / Math.PI)
          
          return (
            <View
              key={`line-${index}`}
              style={[
                styles.trendLine,
                {
                  left: prevPoint.x,
                  top: prevPoint.y,
                  width: distance,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          )
        })}
      </View>

      {/* Chart labels */}
      <View style={styles.chartLabels}>
        <Text style={styles.labelText}>{translate("sentimentAnalysis.negative")}</Text>
        <Text style={styles.labelText}>{translate("sentimentAnalysis.positive")}</Text>
      </View>

      {/* Data summary */}
      <View style={styles.dataSummary}>
        <Text style={styles.dataText}>
          {dataPoints.length} {translate("sentimentAnalysis.conversationsAnalyzed")}
        </Text>
        <Text style={styles.dataText}>
          {translate("sentimentAnalysis.confidence")}: {Math.round(summary.confidence * 100)}%
        </Text>
        <Text style={styles.dataText}>
          {translate("sentimentAnalysis.avg")}: {summary.averageSentiment > 0 ? "+" : ""}{summary.averageSentiment.toFixed(2)}
        </Text>
      </View>

      {/* Trend insights */}
      {summary.keyInsights && summary.keyInsights.length > 0 && (
        <View style={styles.insightsContainer}>
          <Text style={styles.insightsTitle}>{translate("sentimentAnalysis.keyInsights")}</Text>
          {summary.keyInsights.map((insight, index) => (
            <View key={index} style={styles.insightItem}>
              <Text style={styles.insightBullet}>•</Text>
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function getSentimentColor(score: number): string {
  if (score > 0.3) return colors.palette.biancaSuccess
  if (score < -0.3) return colors.error
  return colors.textDim
}

function getTrendStyle(trend: string) {
  switch (trend) {
    case "improving":
      return { color: colors.palette.biancaSuccess }
    case "declining":
      return { color: colors.error }
    default:
      return { color: colors.textDim }
  }
}

function getTrendIcon(trend: string): string {
  switch (trend) {
    case "improving":
      return "↗"
    case "declining":
      return "↘"
    default:
      return "→"
  }
}

const styles = {
  container: {
    padding: 16,
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    marginVertical: 8,
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.text,
  },
  summaryContainer: {
    alignItems: "flex-end" as const,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: colors.text,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  chartContainer: {
    position: "relative" as const,
    marginBottom: 8,
  },
  chartBackground: {
    position: "absolute" as const,
    width: "100%",
    height: "100%",
  },
  zeroLine: {
    position: "absolute" as const,
    width: "100%",
    height: 1,
    backgroundColor: colors.border,
  },
  positiveArea: {
    position: "absolute" as const,
    width: "100%",
    backgroundColor: colors.palette.biancaSuccessBackground,
  },
  negativeArea: {
    position: "absolute" as const,
    width: "100%",
    backgroundColor: colors.palette.biancaErrorBackground,
  },
  dataPoint: {
    position: "absolute" as const,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.palette.neutral100,
  },
  trendLine: {
    position: "absolute" as const,
    height: 2,
    backgroundColor: colors.palette.primary500,
    opacity: 0.7,
  },
  emptyChart: {
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 14,
  },
  chartLabels: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: 8,
  },
  labelText: {
    fontSize: 12,
    color: colors.textDim,
  },
  dataSummary: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    flexWrap: "wrap" as const,
    gap: 8,
  },
  dataText: {
    fontSize: 12,
    color: colors.textDim,
  },
  insightsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
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
    marginBottom: 4,
    gap: 8,
  },
  insightBullet: {
    fontSize: 14,
    color: colors.textDim,
    marginTop: 2,
  },
  insightText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
}

