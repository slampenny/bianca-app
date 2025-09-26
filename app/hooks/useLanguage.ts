import { useState, useEffect } from "react"
import { changeLanguage } from "../i18n"
import i18n from "i18n-js"
import { addLanguageChangeListener, removeLanguageChangeListener } from "./languageNotifications"

// Enhanced changeLanguage function that notifies listeners
export const changeLanguageWithNotification = async (languageCode: string) => {
  try {
    console.log("changeLanguageWithNotification called with:", languageCode)
    await changeLanguage(languageCode)
    console.log("Language changed successfully")
  } catch (error) {
    console.error("Error changing language:", error)
  }
}

// Hook to track language changes and trigger re-renders
export const useLanguage = () => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    // Safely get initial language with fallback
    try {
      return (i18n && i18n.locale) ? i18n.locale : "en"
    } catch {
      return "en"
    }
  })

  useEffect(() => {
    const handleLanguageChange = () => {
      try {
        const newLanguage = (i18n && i18n.locale) ? i18n.locale : "en"
        console.log("useLanguage: Language change detected, updating to:", newLanguage)
        setCurrentLanguage(newLanguage)
      } catch (error) {
        console.error("Error in handleLanguageChange:", error)
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
