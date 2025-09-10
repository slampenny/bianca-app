import React, { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native"
import { colors } from "app/theme/colors"
import { Ionicons } from "@expo/vector-icons"

const { width } = Dimensions.get('window')

// Mock data for sentiment analysis
const mockSentimentData = [
  { date: '2024-01-01', sentiment: 0.8, label: 'Very Positive' },
  { date: '2024-01-02', sentiment: 0.6, label: 'Positive' },
  { date: '2024-01-03', sentiment: 0.3, label: 'Neutral' },
  { date: '2024-01-04', sentiment: 0.7, label: 'Positive' },
  { date: '2024-01-05', sentiment: 0.9, label: 'Very Positive' },
  { date: '2024-01-06', sentiment: 0.4, label: 'Neutral' },
  { date: '2024-01-07', sentiment: 0.8, label: 'Very Positive' },
]

export function SentimentReportScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState('7d')

  const getSentimentColor = (sentiment: number) => {
    if (sentiment >= 0.7) return colors.palette.biancaSuccess
    if (sentiment >= 0.4) return colors.palette.biancaWarning
    return colors.palette.biancaError
  }

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment >= 0.7) return 'happy'
    if (sentiment >= 0.4) return 'remove'
    return 'sad'
  }

  const averageSentiment = mockSentimentData.reduce((sum, item) => sum + item.sentiment, 0) / mockSentimentData.length

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="trending-up" size={32} color={colors.palette.biancaButtonSelected} />
          <Text style={styles.headerTitle}>Sentiment Analysis</Text>
        </View>
        <Text style={styles.headerSubtitle}>Patient conversation sentiment over time</Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Average Sentiment</Text>
          <View style={styles.summaryValueContainer}>
            <Ionicons 
              name={getSentimentIcon(averageSentiment)} 
              size={24} 
              color={getSentimentColor(averageSentiment)} 
            />
            <Text style={[styles.summaryValue, { color: getSentimentColor(averageSentiment) }]}>
              {(averageSentiment * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Positive Days</Text>
          <Text style={styles.summaryValue}>
            {mockSentimentData.filter(item => item.sentiment >= 0.6).length} / {mockSentimentData.length}
          </Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Sentiment Trend (7 Days)</Text>
        <View style={styles.chart}>
          {mockSentimentData.map((item, index) => (
            <View key={item.date} style={styles.chartBar}>
              <View 
                style={[
                  styles.bar, 
                  { 
                    height: item.sentiment * 100,
                    backgroundColor: getSentimentColor(item.sentiment)
                  }
                ]} 
              />
              <Text style={styles.barLabel}>{item.date.split('-')[2]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Detailed Data */}
      <View style={styles.dataContainer}>
        <Text style={styles.dataTitle}>Daily Breakdown</Text>
        {mockSentimentData.map((item, index) => (
          <View key={item.date} style={styles.dataRow}>
            <View style={styles.dataDate}>
              <Text style={styles.dataDateText}>{item.date}</Text>
            </View>
            <View style={styles.dataSentiment}>
              <Ionicons 
                name={getSentimentIcon(item.sentiment)} 
                size={20} 
                color={getSentimentColor(item.sentiment)} 
              />
              <Text style={[styles.dataSentimentText, { color: getSentimentColor(item.sentiment) }]}>
                {item.label}
              </Text>
            </View>
            <View style={styles.dataScore}>
              <Text style={styles.dataScoreText}>{(item.sentiment * 100).toFixed(0)}%</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Insights */}
      <View style={styles.insightsContainer}>
        <Text style={styles.insightsTitle}>Key Insights</Text>
        <View style={styles.insightItem}>
          <Ionicons name="checkmark" size={16} color={colors.palette.biancaSuccess} />
          <Text style={styles.insightText}>
            Patient shows consistently positive sentiment (71% average)
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Ionicons name="trending-up" size={16} color={colors.palette.biancaButtonSelected} />
          <Text style={styles.insightText}>
            Sentiment improved over the past week
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Ionicons name="heart" size={16} color={colors.palette.biancaError} />
          <Text style={styles.insightText}>
            One neutral day detected - may need follow-up
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.biancaBackground,
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginLeft: 12,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.palette.neutral600,
  },
  summaryContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.palette.neutral600,
    marginBottom: 8,
  },
  summaryValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    marginLeft: 8,
  },
  chartContainer: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginBottom: 16,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  bar: {
    width: '80%',
    borderRadius: 4,
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 12,
    color: colors.palette.neutral600,
  },
  dataContainer: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dataTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginBottom: 16,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.neutral200,
  },
  dataDate: {
    flex: 1,
  },
  dataDateText: {
    fontSize: 14,
    color: colors.palette.neutral600,
  },
  dataSentiment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataSentimentText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  dataScore: {
    flex: 0.5,
    alignItems: 'flex-end',
  },
  dataScoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
  },
  insightsContainer: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginBottom: 16,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  insightText: {
    fontSize: 14,
    color: colors.palette.neutral700,
    marginLeft: 12,
    flex: 1,
  },
})
