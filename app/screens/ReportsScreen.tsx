import React from "react"
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native"
import { colors } from "app/theme/colors"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"

const { width } = Dimensions.get('window')
const buttonSize = Math.min((width - 60) / 2, 160) // Max 160px width, responsive

export function ReportsScreen() {
  const navigation = useNavigation()

  const handleSentimentPress = () => {
    navigation.navigate("SentimentReport" as never)
  }

  const handleHealthPress = () => {
    navigation.navigate("HealthReport" as never)
  }

  const handleComingSoonPress = () => {
    // TODO: Show coming soon message
    console.log("Coming soon pressed")
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {/* Top Row */}
        <View style={styles.row}>
          <Pressable 
            style={[styles.button, { width: buttonSize, height: buttonSize }]} 
            onPress={handleSentimentPress}
            testID="sentiment-reports-button"
          >
            <View style={styles.buttonContent}>
              <Ionicons 
                name="trending-up" 
                size={32} 
                color={colors.palette.neutral100}
              />
              <Text style={styles.buttonText}>Sentiment</Text>
            </View>
          </Pressable>
          
          <Pressable 
            style={[styles.button, { width: buttonSize, height: buttonSize }]} 
            onPress={handleHealthPress}
            testID="health-reports-button"
          >
            <View style={styles.buttonContent}>
              <Ionicons 
                name="heart" 
                size={32} 
                color={colors.palette.neutral100}
              />
              <Text style={styles.buttonText}>Health</Text>
            </View>
          </Pressable>
        </View>

        {/* Bottom Row */}
        <View style={styles.row}>
          <Pressable 
            style={[styles.button, styles.comingSoonButton, { width: buttonSize, height: buttonSize }]} 
            onPress={handleComingSoonPress}
            testID="coming-soon-button-1"
          >
            <View style={styles.buttonContent}>
              <Ionicons 
                name="time" 
                size={32} 
                color={colors.palette.neutral600}
              />
              <Text style={[styles.buttonText, styles.comingSoonText]}>Coming Soon</Text>
            </View>
          </Pressable>
          
          <Pressable 
            style={[styles.button, styles.comingSoonButton, { width: buttonSize, height: buttonSize }]} 
            onPress={handleComingSoonPress}
            testID="coming-soon-button-2"
          >
            <View style={styles.buttonContent}>
              <Ionicons 
                name="add-circle" 
                size={32} 
                color={colors.palette.neutral600}
              />
              <Text style={[styles.buttonText, styles.comingSoonText]}>Coming Soon</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.biancaBackground,
    padding: 20,
  },
  grid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    width: '100%',
    maxWidth: 400, // Limit max width for larger screens
  },
  button: {
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 12,
    elevation: 3,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minHeight: 120,
    minWidth: 120,
  },
  comingSoonButton: {
    backgroundColor: colors.palette.neutral200,
    borderWidth: 2,
    borderColor: colors.palette.neutral300,
    borderStyle: 'dashed',
  },
  buttonContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  buttonText: {
    color: colors.palette.neutral100,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  comingSoonText: {
    color: colors.palette.neutral600,
  },
})
