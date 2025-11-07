import React, { useState } from "react"
import { View, Pressable, Modal, StyleSheet, FlatList } from "react-native"
import { Text } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { Icon } from "./Icon"
import { translate } from "../i18n"
import { LANGUAGE_OPTIONS } from "../constants/languages"
import { useLanguage } from "../hooks/useLanguage"
import { useSelector } from "react-redux"
import { getCaregiver } from "../store/caregiverSlice"
import { useUpdateCaregiverMutation } from "../services/api/caregiverApi"

interface LanguageSelectorProps {
  style?: any
  testID?: string
}

export function LanguageSelector({ style, testID }: LanguageSelectorProps) {
  const { colors } = useTheme()
  const [isModalVisible, setIsModalVisible] = useState(false)
  const { currentLanguage: currentLocale, changeLanguage } = useLanguage()
  const currentUser = useSelector(getCaregiver)
  const [updateCaregiver] = useUpdateCaregiverMutation()

  // Get current language option
  const currentLanguage = LANGUAGE_OPTIONS.find(lang => lang.code === currentLocale) || LANGUAGE_OPTIONS[0]
  
  const createStyles = (colors: any) => StyleSheet.create({
    container: {
      marginBottom: 15,
    },
    selector: {
      backgroundColor: colors.palette.neutral100,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.palette.neutral300,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    selectorLabel: {
      color: colors.palette.biancaHeader || colors.text,
      fontSize: 14,
      marginBottom: 5,
    },
    selectorContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    currentLanguage: {
      color: colors.palette.biancaHeader,
      fontSize: 16,
      fontWeight: "500",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.palette.overlay50 || "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.palette.neutral100,
      borderRadius: 10,
      width: "100%",
      maxHeight: "70%",
      elevation: 5,
      shadowColor: colors.palette.neutral900,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.palette.neutral300,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.palette.biancaHeader,
    },
    languageList: {
      maxHeight: 300,
    },
    languageItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.palette.neutral200,
    },
    selectedLanguageItem: {
      backgroundColor: colors.palette.biancaButtonSelected + "10", // 10% opacity
    },
    languageText: {
      fontSize: 16,
      color: colors.palette.biancaHeader,
    },
    selectedLanguageText: {
      fontWeight: "600",
      color: colors.palette.biancaButtonSelected,
    },
  })
  
  const styles = createStyles(colors)

  const handleLanguageSelect = async (languageCode: string) => {
    console.log("Selecting language:", languageCode)
    console.log("Current locale before change:", currentLocale)
    
    // Update i18n locale and persist the choice
    await changeLanguage(languageCode)
    
    // Save to backend caregiver profile if user is logged in
    if (currentUser?.id) {
      try {
        await updateCaregiver({
          id: currentUser.id,
          caregiver: {
            preferredLanguage: languageCode,
          },
        }).unwrap()
        console.log("Language preference saved to backend:", languageCode)
      } catch (error) {
        console.error("Failed to save language preference to backend:", error)
        // Don't block the UI - language change still works locally
      }
    }
    
    console.log("Current locale after change:", currentLocale)
    
    // Close modal
    setIsModalVisible(false)
  }

  const renderLanguageItem = ({ item }: { item: typeof LANGUAGE_OPTIONS[0] }) => {
    const isSelected = currentLocale === item.code
    return (
      <Pressable
        style={[
          styles.languageItem,
          isSelected && styles.selectedLanguageItem
        ]}
        onPress={() => handleLanguageSelect(item.code)}
        testID={`language-option-${item.code}`}
      >
        <Text style={[
          styles.languageText,
          isSelected && styles.selectedLanguageText
        ]}>
          {item.nativeName}
        </Text>
        {isSelected && (
          <Icon icon="check" size={20} color={colors.palette.biancaButtonSelected} />
        )}
      </Pressable>
    )
  }

  return (
    <View style={[styles.container, style]}>
      <Pressable
        style={styles.selector}
        onPress={() => setIsModalVisible(true)}
        testID={testID || "language-selector"}
      >
        <Text style={styles.selectorLabel}>
          {(() => {
            try {
              return translate("profileScreen.languageSelector")
            } catch {
              return "Language / Idioma"
            }
          })()}
        </Text>
        <View style={styles.selectorContent}>
          <Text style={styles.currentLanguage}>{currentLanguage.nativeName}</Text>
          <Icon icon="caretDown" size={16} color={colors.palette.neutral600} />
        </View>
      </Pressable>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setIsModalVisible(false)}
        >
          <Pressable 
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {(() => {
                  try {
                    return translate("profileScreen.selectLanguage")
                  } catch {
                    return "Select Language"
                  }
                })()}
              </Text>
              <Pressable
                onPress={() => setIsModalVisible(false)}
                testID="close-language-modal"
              >
                <Icon icon="x" size={24} color={colors.palette.neutral600} />
              </Pressable>
            </View>
            
            <FlatList
              data={LANGUAGE_OPTIONS}
              renderItem={renderLanguageItem}
              keyExtractor={(item) => item.code}
              style={styles.languageList}
              showsVerticalScrollIndicator={false}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
