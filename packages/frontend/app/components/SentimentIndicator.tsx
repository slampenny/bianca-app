import React from "react"
import { View, ViewStyle } from "react-native"
import { Text } from "./Text"
import { Icon } from "./Icon"
import { colors } from "../theme/colors"
import { SentimentType, SentimentAnalysis } from "../services/api/api.types"

interface SentimentIndicatorProps {
  sentiment?: SentimentAnalysis | null
  size?: "small" | "medium" | "large"
  showScore?: boolean
  showMood?: boolean
  style?: ViewStyle
}

export function SentimentIndicator({
  sentiment,
  size = "medium",
  showScore = false,
  showMood = false,
  style,
}: SentimentIndicatorProps) {
  if (!sentiment) {
    return (
      <View style={[styles.container, style]}>
        <Icon icon="question" size={getIconSize(size)} color={colors.textDim} />
        <Text style={[styles.text, getTextStyle(size)]} text="No data" />
      </View>
    )
  }

  const sentimentConfig = getSentimentConfig(sentiment.overallSentiment)
  const confidence = sentiment.confidence || 0

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Icon
          icon={sentimentConfig.icon}
          size={getIconSize(size)}
          color={sentimentConfig.color}
        />
        {confidence < 0.7 && (
          <View style={[styles.lowConfidenceBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.lowConfidenceText}>!</Text>
          </View>
        )}
      </View>
      
      <View style={styles.textContainer}>
        <Text style={[styles.text, getTextStyle(size), { color: sentimentConfig.color }]}>
          {sentimentConfig.label}
        </Text>
        
        {showScore && (
          <Text style={[styles.score, getScoreStyle(size)]}>
            {sentiment.sentimentScore > 0 ? "+" : ""}{sentiment.sentimentScore.toFixed(1)}
          </Text>
        )}
        
        {showMood && sentiment.patientMood && (
          <Text style={[styles.mood, getMoodStyle(size)]} numberOfLines={2}>
            {sentiment.patientMood}
          </Text>
        )}
      </View>
    </View>
  )
}

function getSentimentConfig(sentiment: SentimentType) {
  switch (sentiment) {
    case "positive":
      return {
        icon: "checkCircle" as const,
        color: colors.palette.biancaSuccess,
        label: "Positive",
      }
    case "negative":
      return {
        icon: "xCircle" as const,
        color: colors.error,
        label: "Negative",
      }
    case "neutral":
      return {
        icon: "minusCircle" as const,
        color: colors.textDim,
        label: "Neutral",
      }
    case "mixed":
      return {
        icon: "alertCircle" as const,
        color: colors.palette.accent500,
        label: "Mixed",
      }
    default:
      return {
        icon: "question" as const,
        color: colors.textDim,
        label: "Unknown",
      }
  }
}

function getIconSize(size: "small" | "medium" | "large") {
  switch (size) {
    case "small":
      return 16
    case "medium":
      return 20
    case "large":
      return 24
  }
}

function getTextStyle(size: "small" | "medium" | "large") {
  switch (size) {
    case "small":
      return { fontSize: 12, fontWeight: "500" as const }
    case "medium":
      return { fontSize: 14, fontWeight: "600" as const }
    case "large":
      return { fontSize: 16, fontWeight: "700" as const }
  }
}

function getScoreStyle(size: "small" | "medium" | "large") {
  switch (size) {
    case "small":
      return { fontSize: 10, opacity: 0.8 }
    case "medium":
      return { fontSize: 12, opacity: 0.8 }
    case "large":
      return { fontSize: 14, opacity: 0.8 }
  }
}

function getMoodStyle(size: "small" | "medium" | "large") {
  switch (size) {
    case "small":
      return { fontSize: 10, opacity: 0.7, maxWidth: 80 }
    case "medium":
      return { fontSize: 12, opacity: 0.7, maxWidth: 120 }
    case "large":
      return { fontSize: 14, opacity: 0.7, maxWidth: 160 }
  }
}

const styles = {
  container: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  iconContainer: {
    position: "relative" as const,
  },
  lowConfidenceBadge: {
    position: "absolute" as const,
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  lowConfidenceText: {
    color: colors.palette.neutral100,
    fontSize: 8,
    fontWeight: "bold" as const,
  },
  textContainer: {
    flex: 1,
  },
  text: {
    fontWeight: "600" as const,
  },
  score: {
    color: colors.textDim,
    fontWeight: "500" as const,
  },
  mood: {
    color: colors.textDim,
    fontStyle: "italic" as const,
  },
}


