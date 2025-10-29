import React, { useState, useEffect } from "react"
import { View, StyleSheet, ScrollView, Dimensions } from "react-native"
import { useTheme } from "app/theme/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { Text } from "app/components"

const { width } = Dimensions.get('window')

// Mock data for mental health tracking
const mockHealthData = [
  { date: '2024-01-01', mood: 8, energy: 7, sleep: 8, anxiety: 3, notes: 'Feeling great today' },
  { date: '2024-01-02', mood: 6, energy: 5, sleep: 6, anxiety: 5, notes: 'Tired but okay' },
  { date: '2024-01-03', mood: 4, energy: 4, sleep: 5, anxiety: 7, notes: 'Struggling with anxiety' },
  { date: '2024-01-04', mood: 7, energy: 6, sleep: 7, anxiety: 4, notes: 'Better day' },
  { date: '2024-01-05', mood: 9, energy: 8, sleep: 9, anxiety: 2, notes: 'Excellent day' },
  { date: '2024-01-06', mood: 5, energy: 5, sleep: 6, anxiety: 6, notes: 'Mixed feelings' },
  { date: '2024-01-07', mood: 8, energy: 7, sleep: 8, anxiety: 3, notes: 'Good recovery' },
]

export function HealthReportScreen() {
  const [selectedMetric, setSelectedMetric] = useState('mood')
  const { colors, isLoading: themeLoading } = useTheme()

  const getMetricColor = (value: number, metric: string) => {
    if (metric === 'anxiety') {
      // Lower anxiety is better
      if (value <= 3) return colors.palette.biancaSuccess
      if (value <= 6) return colors.palette.biancaWarning
      return colors.palette.biancaError
    } else {
      // Higher values are better for mood, energy, sleep
      if (value >= 8) return colors.palette.biancaSuccess
      if (value >= 6) return colors.palette.biancaWarning
      return colors.palette.biancaError
    }
  }

  const getMetricIcon = (value: number, metric: string) => {
    if (metric === 'mood') {
      if (value >= 8) return 'happy'
      if (value >= 6) return 'remove'
      return 'sad'
    } else if (metric === 'energy') {
      if (value >= 8) return 'flash'
      if (value >= 6) return 'battery-half'
      return 'battery-dead'
    } else if (metric === 'sleep') {
      if (value >= 8) return 'moon'
      if (value >= 6) return 'moon-outline'
      return 'alert-circle'
    } else if (metric === 'anxiety') {
      if (value <= 3) return 'checkmark-circle'
      if (value <= 6) return 'warning'
      return 'alert-circle'
    }
    return 'help-circle'
  }

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'mood': return 'Mood'
      case 'energy': return 'Energy'
      case 'sleep': return 'Sleep Quality'
      case 'anxiety': return 'Anxiety Level'
      default: return metric
    }
  }

  const getMetricDescription = (metric: string) => {
    switch (metric) {
      case 'mood': return 'Overall emotional state (1-10)'
      case 'energy': return 'Energy levels throughout day (1-10)'
      case 'sleep': return 'Sleep quality rating (1-10)'
      case 'anxiety': return 'Anxiety level (1-10, lower is better)'
      default: return ''
    }
  }

  const averageValues = {
    mood: mockHealthData.reduce((sum, item) => sum + item.mood, 0) / mockHealthData.length,
    energy: mockHealthData.reduce((sum, item) => sum + item.energy, 0) / mockHealthData.length,
    sleep: mockHealthData.reduce((sum, item) => sum + item.sleep, 0) / mockHealthData.length,
    anxiety: mockHealthData.reduce((sum, item) => sum + item.anxiety, 0) / mockHealthData.length,
  }

  const metrics = ['mood', 'energy', 'sleep', 'anxiety']

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="heart" size={32} color={colors.palette.biancaError} />
          <Text style={styles.headerTitle}>Mental Health Report</Text>
        </View>
        <Text style={styles.headerSubtitle}>Patient wellness tracking over time</Text>
      </View>

      {/* Metric Selector */}
      <View style={styles.metricSelector}>
        {metrics.map((metric) => (
          <View
            key={metric}
            style={[
              styles.metricButton,
              selectedMetric === metric && styles.metricButtonSelected
            ]}
          >
            <Text
              style={[
                styles.metricButtonText,
                selectedMetric === metric && styles.metricButtonTextSelected
              ]}
            >
              {getMetricLabel(metric)}
            </Text>
          </View>
        ))}
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Average {getMetricLabel(selectedMetric)}</Text>
          <View style={styles.summaryValueContainer}>
            <Ionicons 
              name={getMetricIcon(averageValues[selectedMetric as keyof typeof averageValues], selectedMetric)} 
              size={24} 
              color={getMetricColor(averageValues[selectedMetric as keyof typeof averageValues], selectedMetric)} 
            />
            <Text style={[
              styles.summaryValue, 
              { color: getMetricColor(averageValues[selectedMetric as keyof typeof averageValues], selectedMetric) }
            ]}>
              {averageValues[selectedMetric as keyof typeof averageValues].toFixed(1)}/10
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Trend</Text>
          <View style={styles.trendContainer}>
            <Ionicons name="trending-up" size={20} color={colors.palette.biancaSuccess} />
            <Text style={styles.trendText}>Improving</Text>
          </View>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{getMetricLabel(selectedMetric)} Trend (7 Days)</Text>
        <Text style={styles.chartSubtitle}>{getMetricDescription(selectedMetric)}</Text>
        <View style={styles.chart}>
          {mockHealthData.map((item, index) => {
            const value = item[selectedMetric as keyof typeof item] as number
            return (
              <View key={item.date} style={styles.chartBar}>
                <View 
                  style={[
                    styles.bar, 
                    { 
                      height: (value / 10) * 100,
                      backgroundColor: getMetricColor(value, selectedMetric)
                    }
                  ]} 
                />
                <Text style={styles.barLabel}>{item.date.split('-')[2]}</Text>
                <Text style={styles.barValue}>{value}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Daily Details */}
      <View style={styles.dataContainer}>
        <Text style={styles.dataTitle}>Daily Health Log</Text>
        {mockHealthData.map((item, index) => (
          <View key={item.date} style={styles.dataRow}>
            <View style={styles.dataDate}>
              <Text style={styles.dataDateText}>{item.date}</Text>
              {item.notes && (
                <Text style={styles.dataNotes}>{item.notes}</Text>
              )}
            </View>
            <View style={styles.dataMetrics}>
              <View style={styles.dataMetric}>
                <Ionicons name="happy" size={16} color={getMetricColor(item.mood, 'mood')} />
                <Text style={styles.dataMetricText}>{item.mood}</Text>
              </View>
              <View style={styles.dataMetric}>
                <Ionicons name="flash" size={16} color={getMetricColor(item.energy, 'energy')} />
                <Text style={styles.dataMetricText}>{item.energy}</Text>
              </View>
              <View style={styles.dataMetric}>
                <Ionicons name="moon" size={16} color={getMetricColor(item.sleep, 'sleep')} />
                <Text style={styles.dataMetricText}>{item.sleep}</Text>
              </View>
              <View style={styles.dataMetric}>
                <Ionicons name="alert-circle" size={16} color={getMetricColor(item.anxiety, 'anxiety')} />
                <Text style={styles.dataMetricText}>{item.anxiety}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Insights */}
      <View style={styles.insightsContainer}>
        <Text style={styles.insightsTitle}>Health Insights</Text>
        <View style={styles.insightItem}>
          <Ionicons name="checkmark" size={16} color={colors.palette.biancaSuccess} />
          <Text style={styles.insightText}>
            Mood has been consistently positive (7.1/10 average)
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Ionicons name="warning" size={16} color={colors.palette.biancaWarning} />
          <Text style={styles.insightText}>
            Sleep quality could be improved (7.0/10 average)
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Ionicons name="trending-up" size={16} color={colors.palette.biancaButtonSelected} />
          <Text style={styles.insightText}>
            Anxiety levels are decreasing over time
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Ionicons name="heart" size={16} color={colors.palette.biancaError} />
          <Text style={styles.insightText}>
            Consider discussing sleep hygiene strategies
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
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
  metricSelector: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 4,
  },
  metricButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  metricButtonSelected: {
    backgroundColor: colors.palette.neutral100,
    elevation: 2,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  metricButtonText: {
    fontSize: 12,
    color: colors.palette.neutral600,
    fontWeight: '500',
  },
  metricButtonTextSelected: {
    color: colors.palette.biancaHeader,
    fontWeight: '600',
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
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.palette.biancaSuccess,
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
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: colors.palette.neutral600,
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
    marginBottom: 2,
  },
  barValue: {
    fontSize: 10,
    color: colors.palette.neutral500,
    fontWeight: '600',
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.neutral200,
  },
  dataDate: {
    marginBottom: 8,
  },
  dataDateText: {
    fontSize: 14,
    color: colors.palette.neutral600,
    fontWeight: '500',
  },
  dataNotes: {
    fontSize: 12,
    color: colors.palette.neutral500,
    fontStyle: 'italic',
    marginTop: 2,
  },
  dataMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dataMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dataMetricText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginLeft: 4,
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
