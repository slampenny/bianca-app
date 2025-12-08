import React from "react"
import { View, ViewStyle, Dimensions, StyleSheet } from "react-native"
import { Text } from "./Text"
import { useTheme } from "../theme/ThemeContext"
import { SentimentTrend, SentimentTrendPoint } from "../services/api/api.types"
import { translate } from "../i18n"
import { logger } from "../utils/logger"

interface SentimentTrendChartProps {
  trend: SentimentTrend
  style?: ViewStyle
}

export function SentimentTrendChart({ trend, style }: SentimentTrendChartProps) {
  const { colors } = useTheme()
  const { dataPoints, summary } = trend
  const screenWidth = Dimensions.get("window").width
  const chartWidth = screenWidth - 40 // Use full screen width minus small padding
  const chartHeight = 120
  const styles = createStyles(colors)

  // Debug logging
  logger.debug('[SentimentChart] Received trend data:', {
    trend,
    dataPoints,
    summary,
    dataPointsLength: dataPoints?.length,
    firstDataPoint: dataPoints?.[0]
  })

  // Use dataPoints if available, otherwise show message
  const hasData = dataPoints.length > 0
  const hasEnoughData = dataPoints.length >= 2
  const isLowConfidence = summary.confidence < 0.5

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

  if (!hasEnoughData) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.title}>{translate("sentimentAnalysis.sentimentTrend")} ({trend.timeRange})</Text>
        <View style={[styles.emptyChart, { width: chartWidth, height: chartHeight }]}>
          <Text style={styles.emptyText}>
            {translate("sentimentAnalysis.insufficientDataForTrend")}
          </Text>
          <Text style={styles.emptySubtext}>
            {translate("sentimentAnalysis.needMoreConversations")}
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
    
    // Debug logging
    logger.debug(`[SentimentChart] Point ${index}:`, {
      point,
      sentiment: point.sentiment,
      sentimentScore: point.sentiment?.sentimentScore,
      calculatedScore: score,
      x,
      y
    })
    
    return { x, y, score, point }
  })

  // Create SVG path for the trend line - ensure continuous line
  const pathData = trendPoints.length > 0 
    ? `M ${trendPoints[0].x} ${trendPoints[0].y} ` + 
      trendPoints.slice(1).map(point => `L ${point.x} ${point.y}`).join(" ")
    : ""

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{translate("sentimentAnalysis.sentimentTrend")} ({trend.timeRange})</Text>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            {translate("sentimentAnalysis.avg")} {summary.averageSentiment > 0 ? "+" : ""}{summary.averageSentiment.toFixed(1)}
          </Text>
          <View style={styles.trendContainer}>
            <Text style={[styles.trendText, getTrendStyle(summary.trendDirection, colors)]}>
              {getTrendIcon(summary.trendDirection)} {summary.trendDirection}
            </Text>
            {isLowConfidence && (
              <Text style={styles.lowConfidenceWarning}>
                {translate("sentimentAnalysis.lowConfidence")}
              </Text>
            )}
          </View>
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
                backgroundColor: getSentimentColor(point.score, colors),
              },
            ]}
          />
        ))}

        {/* Trend line using SVG for proper continuous line */}
        {pathData && (
          <View style={styles.svgContainer}>
            <svg width={chartWidth} height={chartHeight} style={styles.svg}>
              <path
                d={pathData}
                stroke={colors.palette.accent700 || colors.palette.primary500}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </View>
        )}
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

function getSentimentColor(score: number, colors: any): string {
  if (score > 0.3) return colors.palette.biancaSuccess
  if (score < -0.3) return colors.error
  return colors.textDim || colors.palette.neutral600
}

function getTrendStyle(trend: string, colors: any) {
  switch (trend) {
    case "improving":
      return { color: colors.palette.biancaSuccess }
    case "declining":
      return { color: colors.error }
    default:
      return { color: colors.textDim || colors.palette.neutral600 }
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

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    marginVertical: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.palette.biancaHeader || colors.text,
  },
  summaryContainer: {
    alignItems: "flex-end",
  },
  summaryText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.palette.biancaHeader || colors.text,
  },
  trendContainer: {
    alignItems: "flex-end",
  },
  trendText: {
    fontSize: 12,
    fontWeight: "500",
  },
  lowConfidenceWarning: {
    fontSize: 10,
    color: colors.palette.angry500 || colors.error,
    fontStyle: "italic",
    marginTop: 2,
  },
  chartContainer: {
    position: "relative",
    marginBottom: 8,
  },
  chartBackground: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  zeroLine: {
    position: "absolute",
    width: "100%",
    height: 1,
    backgroundColor: colors.palette.biancaBorder || colors.border,
  },
  positiveArea: {
    position: "absolute",
    width: "100%",
    backgroundColor: colors.palette.biancaSuccessBackground || "rgba(34, 197, 94, 0.1)",
  },
  negativeArea: {
    position: "absolute",
    width: "100%",
    backgroundColor: colors.palette.biancaErrorBackground || "rgba(239, 68, 68, 0.1)",
  },
  dataPoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.palette.neutral100,
  },
  trendLine: {
    position: "absolute",
    height: 2,
    backgroundColor: colors.palette.primary500,
    opacity: 0.7,
  },
  svgContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  svg: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  emptyChart: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
  },
  emptyText: {
    color: colors.textDim || colors.palette.neutral600,
    fontSize: 14,
  },
  emptySubtext: {
    color: colors.textDim || colors.palette.neutral600,
    fontSize: 12,
    marginTop: 4,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  labelText: {
    fontSize: 12,
    color: colors.textDim || colors.palette.neutral600,
  },
  dataSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  dataText: {
    fontSize: 12,
    color: colors.textDim || colors.palette.neutral600,
  },
  insightsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
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
    marginBottom: 4,
    gap: 8,
  },
  insightBullet: {
    fontSize: 14,
    color: colors.textDim || colors.palette.neutral600,
    marginTop: 2,
  },
  insightText: {
    fontSize: 13,
    color: colors.palette.biancaHeader || colors.text,
    flex: 1,
    lineHeight: 18,
  },
})

