import React, { useState } from "react"
import { View, Pressable, Modal, StyleSheet, ScrollView } from "react-native"
import { Text } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { themes, ThemeType } from "app/theme/ThemeContext"
import { translate } from "app/i18n"

export function ThemeSelector({ testID }: { testID?: string }) {
  const { currentTheme, setTheme, themeInfo, colors, isLoading } = useTheme()
  const [modalVisible, setModalVisible] = useState(false)

  if (isLoading) {
    return null
  }

  const handleThemeChange = (theme: ThemeType) => {
    setTheme(theme)
    setModalVisible(false)
  }

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[styles.label, { color: colors.palette.biancaHeader || colors.text }]}>{translate("profileScreen.theme")}</Text>
      <Pressable 
        style={[styles.selectorButton, { 
          borderColor: colors.palette.neutral300, 
          backgroundColor: colors.palette.neutral100 
        }]} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.selectorText, { color: colors.palette.biancaHeader || colors.text }]}>{themeInfo.name}</Text>
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
            <Text style={[styles.modalTitle, { color: colors.palette.biancaHeader || colors.text }]}>{translate("profileScreen.selectTheme")}</Text>
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
                  ]}
                  onPress={() => handleThemeChange(key as ThemeType)}
                >
                  <View style={styles.themeHeader}>
                    <Text style={[
                      styles.themeName, 
                      { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.biancaHeader || colors.text) }
                    ]}>
                      {theme.name}
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
                    </View>
                  </View>
                  <Text style={[
                    styles.themeDescription,
                    { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.biancaHeader || colors.text) }
                  ]}>
                    {theme.description}
                  </Text>
                  <View style={styles.accessibilityInfo}>
                    <Text style={[
                      styles.accessibilityText,
                      { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.neutral600 || colors.textDim || colors.text) }
                    ]}>
                      WCAG Level: {theme.accessibility.wcagLevel}
                    </Text>
                    {theme.accessibility.colorblindFriendly && (
                      <Text style={[
                        styles.accessibilityText,
                        { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.neutral600 || colors.textDim || colors.text) }
                      ]}>
                        Color-blind friendly
                      </Text>
                    )}
                    {theme.accessibility.highContrast && (
                      <Text style={[
                        styles.accessibilityText,
                        { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.neutral600 || colors.textDim || colors.text) }
                      ]}>
                        High contrast
                      </Text>
                    )}
                    {theme.accessibility.darkMode && (
                      <Text style={[
                        styles.accessibilityText,
                        { color: currentTheme === key ? colors.palette.neutral100 : (colors.palette.neutral600 || colors.textDim || colors.text) }
                      ]}>
                        Dark mode
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable 
              style={[styles.closeButton, { backgroundColor: colors.palette.primary500 }]} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.closeButtonText, { color: colors.palette.neutral100 }]}>{translate("common.close")}</Text>
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
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectorText: {
    fontSize: 16,
    // Color will be set via inline style using theme colors
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
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
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
  themeName: {
    fontSize: 16,
    fontWeight: "600",
  },
  themeSwatches: {
    flexDirection: "row",
    gap: 4,
  },
  themeDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  accessibilityInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  accessibilityText: {
    fontSize: 12,
    fontStyle: "italic",
  },
  closeButton: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
})