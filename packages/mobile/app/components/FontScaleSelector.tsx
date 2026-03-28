import React from "react"
import { View, StyleSheet, Pressable } from "react-native"
import { Text, Button } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { useLanguage } from "app/hooks/useLanguage"
import { useKeyboardFocus } from "app/hooks/useKeyboardFocus"

export function FontScaleSelector({ testID }: { testID?: string }) {
  const { fontScale, setFontScale, colors, isLoading } = useTheme()
  const { currentLanguage } = useLanguage()
  const keyboardFocusStyle = useKeyboardFocus()

  if (isLoading) {
    return null
  }

  const handleDecrease = () => {
    const newScale = Math.max(0.8, fontScale - 0.1)
    setFontScale(newScale)
  }

  const handleIncrease = () => {
    const newScale = Math.min(2.0, fontScale + 0.1)
    setFontScale(newScale)
  }

  const presetScales = [0.8, 1.0, 1.2, 1.5, 2.0]

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[styles.label, { color: colors.palette.biancaHeader || colors.text }]}>
        {translate("profileScreen.fontSize") || "Font Size"}
      </Text>
      
      <View style={[styles.controlsContainer, { backgroundColor: colors.palette.neutral100, borderColor: colors.palette.neutral300 }]}>
        <Pressable
          style={[
            styles.button, 
            { backgroundColor: colors.palette.primary500 },
            keyboardFocusStyle, // Add keyboard focus styles (web only)
          ]}
          onPress={handleDecrease}
          disabled={fontScale <= 0.8}
          testID="font-scale-decrease"
          accessibilityRole="button"
          accessibilityLabel={translate("profileScreen.decreaseFontSize") || "Decrease font size"}
          accessibilityState={{ disabled: fontScale <= 0.8 }}
        >
          <Text style={[styles.buttonText, { color: colors.palette.neutral100 }]}>−</Text>
        </Pressable>
        
        <View style={styles.valueContainer}>
          <Text style={[styles.valueText, { color: colors.palette.biancaHeader || colors.text }]}>
            {Math.round(fontScale * 100)}%
          </Text>
        </View>
        
        <Pressable
          style={[
            styles.button, 
            { backgroundColor: colors.palette.primary500 },
            keyboardFocusStyle, // Add keyboard focus styles (web only)
          ]}
          onPress={handleIncrease}
          disabled={fontScale >= 2.0}
          testID="font-scale-increase"
          accessibilityRole="button"
          accessibilityLabel={translate("profileScreen.increaseFontSize") || "Increase font size"}
          accessibilityState={{ disabled: fontScale >= 2.0 }}
        >
          <Text style={[styles.buttonText, { color: colors.palette.neutral100 }]}>+</Text>
        </Pressable>
      </View>

      <View style={styles.presetContainer}>
        {presetScales.map((scale) => (
          <Pressable
            key={scale}
            style={[
              styles.presetButton,
              {
                backgroundColor: fontScale === scale ? colors.palette.primary500 : colors.palette.neutral200,
                borderColor: colors.palette.neutral300,
              },
              keyboardFocusStyle, // Add keyboard focus styles (web only)
            ]}
            onPress={() => setFontScale(scale)}
            testID={`font-scale-preset-${scale}`}
            accessibilityLabel={`${Math.round(scale * 100)}% font size`}
          >
            <Text
              style={[
                styles.presetText,
                { color: fontScale === scale ? colors.palette.neutral100 : colors.palette.biancaHeader || colors.text },
              ]}
            >
              {Math.round(scale * 100)}%
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.hintText, { color: colors.palette.neutral600 || colors.textDim }]}>
        {translate("profileScreen.fontSizeDescription") || "Adjust text size for better readability. Changes apply immediately."}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 24,
    fontWeight: "600",
  },
  valueContainer: {
    flex: 1,
    alignItems: "center",
  },
  valueText: {
    fontSize: 18,
    fontWeight: "600",
  },
  presetContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  presetButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  presetText: {
    fontSize: 14,
    fontWeight: "600",
  },
  hintText: {
    fontSize: 12,
    fontStyle: "italic",
  },
})

