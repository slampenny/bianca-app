import React, { useState } from "react"
import { View, ViewStyle, ScrollView, RefreshControl, Dimensions } from "react-native"
import { Text } from "./Text"
import { Button } from "./Button"
import { colors } from "../theme/colors"
import { SentimentTrendChart } from "./SentimentTrendChart"
import { SentimentSummaryCard } from "./SentimentSummaryCard"
import { SentimentRecentTrends } from "./SentimentRecentTrends"
import { SentimentLastCall } from "./SentimentLastCall"
import { SentimentTrend, SentimentSummary } from "../services/api/api.types"
import { translate } from "../i18n"

interface SentimentDashboardProps {
  patientId: string
  trend?: SentimentTrend
  summary?: SentimentSummary
  isLoading?: boolean
  onRefresh?: () => void
  onTimeRangeChange?: (timeRange: "lastCall" | "month" | "lifetime") => void
  style?: ViewStyle
}

export function SentimentDashboard({
  patientId,
  trend,
  summary,
  isLoading = false,
  onRefresh,
  onTimeRangeChange,
  style,
}: SentimentDashboardProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<"lastCall" | "month" | "lifetime">("month")
  const screenWidth = Dimensions.get("window").width
  const isMobile = screenWidth < 768

  const handleTimeRangeChange = (timeRange: "lastCall" | "month" | "lifetime") => {
    setSelectedTimeRange(timeRange)
    onTimeRangeChange?.(timeRange)
  }

  const timeRangeButtons = [
    { key: "lastCall" as const, label: translate("sentimentAnalysis.lastCall") },
    { key: "month" as const, label: translate("sentimentAnalysis.last30Days") },
    { key: "lifetime" as const, label: translate("sentimentAnalysis.allTime") },
  ]

  return (
    <ScrollView
      style={[styles.container, style]}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{translate("sentimentAnalysis.patientSentimentAnalysis")}</Text>
        <Text style={styles.subtitle}>{translate("sentimentAnalysis.emotionalWellnessInsights")}</Text>
      </View>

      {/* Time range selector */}
      <View style={styles.timeRangeContainer}>
        <Text style={styles.timeRangeLabel}>{translate("sentimentAnalysis.timeRange")}</Text>
        <View style={[styles.timeRangeButtons, isMobile && styles.timeRangeButtonsMobile]}>
          {timeRangeButtons.map((button) => (
            <Button
              key={button.key}
              text={button.label}
              onPress={() => handleTimeRangeChange(button.key)}
              style={[
                styles.timeRangeButton,
                isMobile && styles.timeRangeButtonMobile,
                selectedTimeRange === button.key && styles.timeRangeButtonActive,
              ]}
              textStyle={[
                styles.timeRangeButtonText,
                isMobile && styles.timeRangeButtonTextMobile,
                selectedTimeRange === button.key && styles.timeRangeButtonTextActive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Show different content based on selected time range */}
      {selectedTimeRange === "lastCall" ? (
        // Last Call View - Detailed analysis of most recent conversation
        <>
          {summary && summary.recentTrend && summary.recentTrend.length > 0 && (
            <SentimentLastCall 
              lastCall={summary.recentTrend[0]} 
              style={styles.lastCall} 
            />
          )}
        </>
      ) : (
        // Historical Views - Summary and trends
        <>
          {/* Summary Card */}
          {summary && (
            <SentimentSummaryCard summary={summary} style={styles.summaryCard} />
          )}

          {/* Recent Trends - Show this first since it has the actual data */}
          {summary && summary.recentTrend && summary.recentTrend.length > 0 && (
            <SentimentRecentTrends recentTrend={summary.recentTrend} style={styles.recentTrends} />
          )}

          {/* Trend Chart */}
          {trend && (
            <SentimentTrendChart trend={trend} style={styles.trendChart} />
          )}
        </>
      )}

      {/* No data state */}
      {!trend && !summary && !isLoading && (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataTitle}>{translate("sentimentAnalysis.noSentimentDataAvailable")}</Text>
          <Text style={styles.noDataText}>
            {translate("sentimentAnalysis.noSentimentDataMessage")}
          </Text>
        </View>
      )}

      {/* Loading state */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{translate("sentimentAnalysis.loadingSentimentAnalysis")}</Text>
        </View>
      )}

      {/* Footer info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {translate("sentimentAnalysis.sentimentAnalysisFooter")}
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: colors.palette.neutral100,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textDim,
  },
  timeRangeContainer: {
    padding: 16,
    backgroundColor: colors.palette.neutral100,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timeRangeLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: colors.text,
    marginBottom: 12,
  },
  timeRangeButtons: {
    flexDirection: "row" as const,
    gap: 8,
  },
  timeRangeButtonsMobile: {
    gap: 6,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.palette.neutral200,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeRangeButtonMobile: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  timeRangeButtonActive: {
    backgroundColor: colors.palette.primary500,
    borderColor: colors.palette.primary500,
  },
  timeRangeButtonText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: colors.text,
    textAlign: "center" as const,
  },
  timeRangeButtonTextMobile: {
    fontSize: 13,
  },
  timeRangeButtonTextActive: {
    color: colors.palette.neutral100,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  lastCall: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  recentTrends: {
    marginHorizontal: 16,
  },
  trendChart: {
    marginHorizontal: 16,
  },
  noDataContainer: {
    padding: 32,
    alignItems: "center" as const,
    backgroundColor: colors.palette.neutral100,
    margin: 16,
    borderRadius: 12,
  },
  noDataTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.text,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 14,
    color: colors.textDim,
    textAlign: "center" as const,
    lineHeight: 20,
  },
  loadingContainer: {
    padding: 32,
    alignItems: "center" as const,
    backgroundColor: colors.palette.neutral100,
    margin: 16,
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textDim,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.palette.neutral100,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
  },
  footerText: {
    fontSize: 12,
    color: colors.textDim,
    textAlign: "center" as const,
    lineHeight: 16,
  },
}

