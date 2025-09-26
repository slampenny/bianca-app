import * as Localization from "expo-localization"
import i18n from "i18n-js"
import { I18nManager } from "react-native"
import * as storage from "../utils/storage"
import { notifyLanguageChange } from "../hooks/languageNotifications"

// if English isn't your default language, move Translations to the appropriate language file.
import en, { Translations } from "./en"
import ar from "./ar"
import ko from "./ko"
import fr from "./fr"
import es from "./es"
import de from "./de"
import zh from "./zh"
import ja from "./ja"
import pt from "./pt"
import it from "./it"
import ru from "./ru"

i18n.fallbacks = true

// to use regional locales use { "en-US": enUS } etc
i18n.translations = { 
  ar, 
  en, 
  "en-US": en, 
  ko, 
  fr, 
  es, 
  de, 
  zh, 
  ja, 
  pt, 
  it, 
  ru 
}

const fallbackLocale = "en-US"
const LANGUAGE_STORAGE_KEY = "user_selected_language"

// Function to initialize language with user preference or system default
export const initializeLanguage = async () => {
  console.log("Initializing language...")
  
  // First, set a default to prevent undefined errors
  i18n.locale = "en"
  
  try {
    // Try to get user's previously selected language
    const savedLanguage = await storage.load(LANGUAGE_STORAGE_KEY)
    console.log("Saved language from storage:", savedLanguage)
    
    if (savedLanguage && Object.prototype.hasOwnProperty.call(i18n.translations, savedLanguage)) {
      console.log("Setting language from saved preference:", savedLanguage)
      i18n.locale = savedLanguage
      return
    }
  } catch (error) {
    console.log("No saved language preference found, using system default")
  }

  // Only use system locale if no user preference is saved
  const systemLocale = Localization.getLocales()[0]
  const systemLocaleTag = systemLocale?.languageTag ?? "en-US"
  console.log("System locale detected:", systemLocaleTag)

  if (Object.prototype.hasOwnProperty.call(i18n.translations, systemLocaleTag)) {
    // if specific locales like en-FI or en-US is available, set it
    console.log("Setting language from system locale:", systemLocaleTag)
    i18n.locale = systemLocaleTag
  } else {
    // otherwise try to fallback to the general locale (dropping the -XX suffix)
    const generalLocale = systemLocaleTag.split("-")[0]
    console.log("Trying general locale:", generalLocale)
    if (Object.prototype.hasOwnProperty.call(i18n.translations, generalLocale)) {
      console.log("Setting language from general locale:", generalLocale)
      i18n.locale = generalLocale
    } else {
      // Default to English if system language is not supported
      console.log("Defaulting to English")
      i18n.locale = "en"
    }
  }
  console.log("Final i18n.locale set to:", i18n.locale)
}

// Function to change language and persist the choice
export const changeLanguage = async (languageCode: string) => {
  console.log("changeLanguage called with:", languageCode)
  console.log("Available translations:", Object.keys(i18n.translations))
  
  if (Object.prototype.hasOwnProperty.call(i18n.translations, languageCode)) {
    console.log("Setting i18n.locale to:", languageCode)
    i18n.locale = languageCode
    console.log("i18n.locale is now:", i18n.locale)
    
    // Save the user's choice
    try {
      await storage.save(LANGUAGE_STORAGE_KEY, languageCode)
      console.log("Language preference saved:", languageCode)
    } catch (error) {
      console.error("Failed to save language preference:", error)
    }
    
    // Handle RTL for the new language
    const systemLocale = Localization.getLocales()[0]
    const isRTL = languageCode === "ar" || systemLocale?.textDirection === "rtl"
    I18nManager.allowRTL(isRTL)
    I18nManager.forceRTL(isRTL)
    
    // Notify language change listeners
    try {
      notifyLanguageChange()
    } catch (error) {
      console.error("Failed to notify language change:", error)
    }
  } else {
    console.error("Language not found in translations:", languageCode)
  }
}

// Set initial locale synchronously to prevent undefined errors
const systemLocale = Localization.getLocales()[0]
const systemLocaleTag = systemLocale?.languageTag ?? "en-US"

// Set a default locale immediately
if (Object.prototype.hasOwnProperty.call(i18n.translations, systemLocaleTag)) {
  i18n.locale = systemLocaleTag
} else {
  const generalLocale = systemLocaleTag.split("-")[0]
  if (Object.prototype.hasOwnProperty.call(i18n.translations, generalLocale)) {
    i18n.locale = generalLocale
  } else {
    i18n.locale = fallbackLocale
  }
}

// Initialize language with user preference (async)
initializeLanguage()

// handle RTL languages for initial load
export const isRTL = systemLocale?.textDirection === "rtl"
I18nManager.allowRTL(isRTL)
I18nManager.forceRTL(isRTL)

/**
 * Builds up valid keypaths for translations.
 */
export type TxKeyPath = RecursiveKeyOf<Translations>

// via: https://stackoverflow.com/a/65333050
type RecursiveKeyOf<TObj extends object> = {
  [TKey in keyof TObj & (string | number)]: RecursiveKeyOfHandleValue<TObj[TKey], `${TKey}`>
}[keyof TObj & (string | number)]

type RecursiveKeyOfInner<TObj extends object> = {
  [TKey in keyof TObj & (string | number)]: RecursiveKeyOfHandleValue<
    TObj[TKey],
    `['${TKey}']` | `.${TKey}`
  >
}[keyof TObj & (string | number)]

type RecursiveKeyOfHandleValue<TValue, Text extends string> = TValue extends any[]
  ? Text
  : TValue extends object
  ? Text | `${Text}${RecursiveKeyOfInner<TValue>}`
  : Text
