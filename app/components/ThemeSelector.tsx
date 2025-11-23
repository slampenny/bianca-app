import React, { useState } from "react"
import { View, Pressable, Modal, StyleSheet, ScrollView } from "react-native"
import { Text } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { themes, ThemeType } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { useLanguage } from "app/hooks/useLanguage"
import { useFontScale } from "app/hooks/useFontScale"
import { useKeyboardFocus } from "app/hooks/useKeyboardFocus"

export function ThemeSelector({ testID }: { testID?: string }) {
  const { currentTheme, setTheme, themeInfo, colors, isLoading } = useTheme()
  const { scale } = useFontScale()
  const keyboardFocusStyle = useKeyboardFocus()
  const [modalVisible, setModalVisible] = useState(false)
  
  // Use language hook to trigger re-renders on language change
  const { currentLanguage } = useLanguage()

  if (isLoading) {
    return null
  }

  // Create dynamic styles with font scaling
  const dynamicStyles = {
    label: { fontSize: scale(16), fontWeight: "600" as const, marginBottom: 8 },
    selectorText: { fontSize: scale(16) },
    modalTitle: { fontSize: scale(20), fontWeight: "600" as const, marginBottom: 16, textAlign: "center" as const },
    themeName: { fontSize: scale(16), fontWeight: "600" as const },
    themeDescription: { fontSize: scale(14), marginBottom: 8 },
    accessibilityText: { fontSize: scale(12), fontStyle: "italic" as const },
    closeButtonText: { fontSize: scale(16), fontWeight: "600" as const, textAlign: "center" as const },
  }

  const handleThemeChange = (theme: ThemeType) => {
    setTheme(theme)
    setModalVisible(false)
  }

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[dynamicStyles.label, { color: colors.palette.biancaHeader || colors.text }]}>{translate("profileScreen.theme")}</Text>
      <Pressable 
        style={[
          styles.selectorButton, 
          { 
            borderColor: colors.palette.neutral300, 
            backgroundColor: colors.palette.neutral100 
          },
          keyboardFocusStyle, // Add keyboard focus styles (web only)
        ]} 
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`${translate("profileScreen.theme")}: ${translate(`themes.${currentTheme}.name`)}`}
        accessibilityHint="Opens theme selection dialog"
      >
        <Text style={[dynamicStyles.selectorText, { color: colors.palette.biancaHeader || colors.text }]}>{translate(`themes.${currentTheme}.name`)}</Text>
        <View style={styles.currentThemeSwatchContainer}>
          <View style={[styles.colorSwatch, { backgroundColor: colors.palette.primary500 }]} testID="colorSwatch-primary" accessibilityLabel="colorSwatch-primary" />
          <View style={[styles.colorSwatch, { backgroundColor: colors.palette.success500 }]} testID="colorSwatch-success" accessibilityLabel="colorSwatch-success" />
          <View style={[styles.colorSwatch, { backgroundColor: colors.palette.error500 }]} testID="colorSwatch-error" accessibilityLabel="colorSwatch-error" />
          {currentTheme === 'colorblind' && (
            <View style={[styles.colorSwatch, { backgroundColor: colors.palette.secondary500 }]} testID="colorSwatch-secondary" accessibilityLabel="colorSwatch-secondary" />
          )}
          {currentTheme === 'dark' && (
            <View style={[styles.colorSwatch, { backgroundColor: colors.palette.warning500 }]} testID="colorSwatch-warning" accessibilityLabel="colorSwatch-warning" />
          )}
          {currentTheme === 'highcontrast' && (
            <View style={[styles.colorSwatch, { backgroundColor: colors.palette.primary500 }]} testID="colorSwatch-primary" accessibilityLabel="colorSwatch-primary" />
          )}
        </View>
      </Pressable>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.palette.overlay50 || "rgba(0, 0, 0, 0.5)" }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.palette.neutral100 }]}>
            <Text key={currentLanguage} style={[dynamicStyles.modalTitle, { color: colors.palette.biancaHeader || colors.text }]}>{translate("profileScreen.selectTheme")}</Text>
            <ScrollView>
              {Object.entries(themes).map(([key, theme]) => (
                <Pressable
                  key={key}
                  style={[
                    styles.themeOption,
                    {
                      borderColor: colors.palette.neutral300,
                      backgroundColor: currentTheme === key ? colors.palette.primary500 : colors.palette.neutral100,
                    },
                    keyboardFocusStyle, // Add keyboard focus styles (web only)
                  ]}
                  onPress={() => handleThemeChange(key as ThemeType)}
                  accessibilityRole="button"
                  accessibilityLabel={translate(`themes.${key}.name`)}
                  accessibilityState={{ selected: currentTheme === key }}
                  accessibilityHint={translate(`themes.${key}.description`)}
                >
                  <View style={styles.themeHeader}>
                    <Text style={[
                      dynamicStyles.themeName, 
                      { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.biancaHeader || colors.text) }
                    ]}>
                      {translate(`themes.${key}.name`)}
                    </Text>
                    <View style={styles.themeSwatches}>
                      <View style={[styles.colorSwatch, { backgroundColor: theme.colors.palette.primary500 }]} testID="colorSwatch-primary" accessibilityLabel="colorSwatch-primary" />
                      <View style={[styles.colorSwatch, { backgroundColor: theme.colors.palette.success500 }]} testID="colorSwatch-success" accessibilityLabel="colorSwatch-success" />
                      <View style={[styles.colorSwatch, { backgroundColor: theme.colors.palette.error500 }]} testID="colorSwatch-error" accessibilityLabel="colorSwatch-error" />
                      {key === 'colorblind' && (
                        <View style={[styles.colorSwatch, { backgroundColor: theme.colors.palette.secondary500 }]} testID="colorSwatch-secondary" accessibilityLabel="colorSwatch-secondary" />
                      )}
                      {key === 'dark' && (
                        <View style={[styles.colorSwatch, { backgroundColor: theme.colors.palette.warning500 }]} testID="colorSwatch-warning" accessibilityLabel="colorSwatch-warning" />
                      )}
                      {key === 'highcontrast' && (
                        <View style={[styles.colorSwatch, { backgroundColor: theme.colors.palette.primary500 }]} testID="colorSwatch-primary" accessibilityLabel="colorSwatch-primary" />
                      )}
                    </View>
                  </View>
                  <Text style={[
                    dynamicStyles.themeDescription,
                    { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.biancaHeader || colors.text) }
                  ]}>
                    {translate(`themes.${key}.description`)}
                  </Text>
                  <View style={styles.accessibilityInfo}>
                    <Text style={[
                      dynamicStyles.accessibilityText,
                      { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.neutral600 || colors.textDim || colors.text) }
                    ]}>
                      {translate("themes.accessibility.wcagLevel")}: {theme.accessibility.wcagLevel}
                    </Text>
                    {theme.accessibility.colorblindFriendly && (
                      <Text style={[
                        dynamicStyles.accessibilityText,
                        { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.neutral600 || colors.textDim || colors.text) }
                      ]}>
                        {translate("themes.accessibility.colorblindFriendly")}
                      </Text>
                    )}
                    {theme.accessibility.highContrast && (
                      <Text style={[
                        dynamicStyles.accessibilityText,
                        { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.neutral600 || colors.textDim || colors.text) }
                      ]}>
                        {translate("themes.accessibility.highContrast")}
                      </Text>
                    )}
                    {theme.accessibility.darkMode && (
                      <Text style={[
                        dynamicStyles.accessibilityText,
                        { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.neutral600 || colors.textDim || colors.text) }
                      ]}>
                        {translate("themes.accessibility.darkMode")}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable 
              style={[
                styles.closeButton, 
                { backgroundColor: colors.palette.primary500 },
                keyboardFocusStyle, // Add keyboard focus styles (web only)
              ]} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={[dynamicStyles.closeButtonText, { color: colors.palette.neutral100 }]}>{translate("common.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  currentThemeSwatchContainer: {
    flexDirection: "row",
    gap: 4,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Will be overridden by inline style with theme colors
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
  },
  themeOption: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  themeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  themeSwatches: {
    flexDirection: "row",
    gap: 4,
  },
  accessibilityInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  closeButton: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
})