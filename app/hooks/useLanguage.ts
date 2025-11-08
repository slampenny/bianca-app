import { useState, useEffect } from "react"
import { useSelector } from "react-redux"
import { changeLanguage } from "../i18n"
import i18n from "i18n-js"
import { addLanguageChangeListener, removeLanguageChangeListener } from "./languageNotifications"
import { getCaregiver } from "../store/caregiverSlice"
import { logger } from "../utils/logger"

// Enhanced changeLanguage function that notifies listeners
export const changeLanguageWithNotification = async (languageCode: string) => {
  try {
    logger.debug("changeLanguageWithNotification called with:", languageCode)
    await changeLanguage(languageCode)
    logger.debug("Language changed successfully")
  } catch (error) {
    logger.error("Error changing language:", error)
  }
}

// Hook to track language changes and trigger re-renders
export const useLanguage = () => {
  const caregiver = useSelector(getCaregiver)
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    // Safely get initial language with fallback
    try {
      return (i18n && i18n.locale) ? i18n.locale : "en"
    } catch {
      return "en"
    }
  })

  // Sync language from caregiver's preferredLanguage when caregiver data is loaded
  useEffect(() => {
    if (caregiver?.preferredLanguage && caregiver.preferredLanguage !== i18n.locale) {
      logger.debug("Syncing language from caregiver profile:", caregiver.preferredLanguage)
      changeLanguageWithNotification(caregiver.preferredLanguage).catch(error => {
        logger.error("Failed to sync language from caregiver profile:", error)
      })
    }
  }, [caregiver?.preferredLanguage, caregiver?.id])

  useEffect(() => {
    const handleLanguageChange = () => {
      try {
        const newLanguage = (i18n && i18n.locale) ? i18n.locale : "en"
        logger.debug("useLanguage: Language change detected, updating to:", newLanguage)
        setCurrentLanguage(newLanguage)
      } catch (error) {
        logger.error("Error in handleLanguageChange:", error)
        setCurrentLanguage("en")
      }
    }

    // Add listener
    addLanguageChangeListener(handleLanguageChange)

    // Force initial check after a short delay to ensure i18n is initialized
    const timeoutId = setTimeout(() => {
      handleLanguageChange()
    }, 100)

    // Cleanup
    return () => {
      removeLanguageChangeListener(handleLanguageChange)
      clearTimeout(timeoutId)
    }
  }, [])

  return {
    currentLanguage,
    changeLanguage: changeLanguageWithNotification,
  }
}
