import React, { useState } from "react"
import { View, Text, Pressable, Modal, StyleSheet, ScrollView } from "react-native"
import { colors } from "app/theme/colors"
import { translate } from "app/i18n"

export function ThemeSelector({ testID }: { testID?: string }) {
  const [modalVisible, setModalVisible] = useState(false)
  const [currentTheme, setCurrentTheme] = useState("healthcare")

  const themes = [
    {
      key: "healthcare",
      name: "Healthcare",
      description: "Professional medical theme with blue and green colors",
      colors: {
        primary: colors.palette.primary500,
        success: colors.palette.success500,
        error: colors.palette.error500,
      }
    },
    {
      key: "colorblind",
      name: "Color-Blind Friendly", 
      description: "High contrast theme optimized for color vision deficiency",
      colors: {
        primary: "#0066CC", // Distinct blue
        success: "#00CC00", // Distinct green
        error: "#CC0000", // Distinct red
      }
    }
  ]

  const handleThemeChange = (themeKey: string) => {
    setCurrentTheme(themeKey)
    setModalVisible(false)
    // TODO: Implement actual theme switching
    console.log("Theme changed to:", themeKey)
  }

  const currentThemeData = themes.find(t => t.key === currentTheme) || themes[0]

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>{translate("profileScreen.theme")}</Text>
      <Pressable 
        style={styles.selectorButton} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.selectorText}>{currentThemeData.name}</Text>
        <View style={styles.currentThemeSwatchContainer}>
          <View style={[styles.colorSwatch, { backgroundColor: currentThemeData.colors.primary }]} />
          <View style={[styles.colorSwatch, { backgroundColor: currentThemeData.colors.success }]} />
          <View style={[styles.colorSwatch, { backgroundColor: currentThemeData.colors.error }]} />
        </View>
      </Pressable>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{translate("profileScreen.selectTheme")}</Text>
            <ScrollView>
              {themes.map((theme) => (
                <Pressable
                  key={theme.key}
                  style={[
                    styles.themeOption,
                    currentTheme === theme.key && styles.selectedThemeOption
                  ]}
                  onPress={() => handleThemeChange(theme.key)}
                >
                  <View style={styles.themeHeader}>
                    <Text style={[
                      styles.themeName,
                      currentTheme === theme.key && styles.selectedThemeText
                    ]}>
                      {theme.name}
                    </Text>
                    <View style={styles.themeSwatches}>
                      <View style={[styles.colorSwatch, { backgroundColor: theme.colors.primary }]} />
                      <View style={[styles.colorSwatch, { backgroundColor: theme.colors.success }]} />
                      <View style={[styles.colorSwatch, { backgroundColor: theme.colors.error }]} />
                    </View>
                  </View>
                  <Text style={[
                    styles.themeDescription,
                    currentTheme === theme.key && styles.selectedThemeText
                  ]}>
                    {theme.description}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable 
              style={styles.closeButton} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>{translate("common.close")}</Text>
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
    color: colors.palette.neutral800,
    marginBottom: 8,
  },
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: colors.palette.neutral100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  selectorText: {
    fontSize: 16,
    color: colors.palette.neutral800,
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.palette.neutral800,
    marginBottom: 16,
    textAlign: "center",
  },
  themeOption: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
    backgroundColor: colors.palette.neutral100,
    marginBottom: 12,
  },
  selectedThemeOption: {
    backgroundColor: colors.palette.primary500,
    borderColor: colors.palette.primary500,
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
    color: colors.palette.neutral800,
  },
  selectedThemeText: {
    color: colors.palette.neutral100,
  },
  themeSwatches: {
    flexDirection: "row",
    gap: 4,
  },
  themeDescription: {
    fontSize: 14,
    color: colors.palette.neutral500,
  },
  closeButton: {
    backgroundColor: colors.palette.primary500,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  closeButtonText: {
    color: colors.palette.neutral100,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
})