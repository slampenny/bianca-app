import * as Localization from "expo-localization"
import i18n from "i18n-js"
import { I18nManager } from "react-native"
import * as storage from "../utils/storage"
import { notifyLanguageChange } from "../hooks/languageNotifications"
import { logger } from "../utils/logger"

// Type-only import to avoid loading the large en.ts file synchronously
import type { Translations } from "./en"

// Lazy load ALL languages (including English) to improve initial app load time
// This prevents the 40KB+ en.ts file from blocking app startup
const languageModules = {
  en: () => import("./en"),
  ar: () => import("./ar"),
  ko: () => import("./ko"),
  fr: () => import("./fr"),
  es: () => import("./es"),
  de: () => import("./de"),
  zh: () => import("./zh"),
  ja: () => import("./ja"),
  pt: () => import("./pt"),
  it: () => import("./it"),
  ru: () => import("./ru"),
}

i18n.fallbacks = true

// Start with empty translations - they'll be loaded asynchronously
i18n.translations = {}

const fallbackLocale = "en-US"
const LANGUAGE_STORAGE_KEY = "user_selected_language"

// Function to lazy load a language module
const loadLanguage = async (locale: string): Promise<void> => {
  if (i18n.translations[locale]) {
    return // Already loaded
  }

  const moduleLoader = languageModules[locale as keyof typeof languageModules]
  if (moduleLoader) {
    try {
      const module = await moduleLoader()
      i18n.translations[locale] = module.default
      logger.debug(`Loaded language: ${locale}`)
    } catch (error) {
      logger.error(`Failed to load language ${locale}:`, error)
    }
  }
}

// Function to initialize language with user preference or system default
export const initializeLanguage = async () => {
  logger.debug("Initializing language...")
  
  // CRITICAL: Load English first as it's the fallback language
  // This must happen before any other language operations
  await loadLanguage("en")
  if (i18n.translations.en) {
    // Also set en-US to use English translations
    i18n.translations["en-US"] = i18n.translations.en
  }
  
  // First, set a default to prevent undefined errors
  i18n.locale = "en"
  
  try {
    // Try to get user's previously selected language
    const savedLanguage = await storage.load(LANGUAGE_STORAGE_KEY)
    logger.debug("Saved language from storage:", savedLanguage)
    
    if (savedLanguage && savedLanguage !== "en" && savedLanguage !== "en-US") {
      // Load the saved language if it's not English
      await loadLanguage(savedLanguage)
      if (i18n.translations[savedLanguage]) {
        logger.debug("Setting language from saved preference:", savedLanguage)
        i18n.locale = savedLanguage
        return
      }
    } else if (savedLanguage === "en" || savedLanguage === "en-US") {
      logger.debug("Using saved English preference")
      i18n.locale = savedLanguage
      return
    }
  } catch (error) {
    logger.debug("No saved language preference found, using system default")
  }

  // Only use system locale if no user preference is saved
  const systemLocale = Localization.getLocales()[0]
  const systemLocaleTag = systemLocale?.languageTag ?? "en-US"
  logger.debug("System locale detected:", systemLocaleTag)

  if (systemLocaleTag === "en" || systemLocaleTag === "en-US") {
    logger.debug("System locale is English, using it")
    i18n.locale = systemLocaleTag
  } else if (Object.prototype.hasOwnProperty.call(i18n.translations, systemLocaleTag)) {
    // if specific locales like en-FI or en-US is available, set it
    logger.debug("Setting language from system locale:", systemLocaleTag)
    i18n.locale = systemLocaleTag
  } else {
    // otherwise try to fallback to the general locale (dropping the -XX suffix)
    const generalLocale = systemLocaleTag.split("-")[0]
    logger.debug("Trying general locale:", generalLocale)
    
    if (generalLocale !== "en") {
      // Load the language if it's not English
      await loadLanguage(generalLocale)
      if (i18n.translations[generalLocale]) {
        logger.debug("Setting language from general locale:", generalLocale)
        i18n.locale = generalLocale
      } else {
        logger.debug("General locale not available, defaulting to English")
        i18n.locale = "en"
      }
    } else {
      logger.debug("Defaulting to English")
      i18n.locale = "en"
    }
  }
  logger.debug("Final i18n.locale set to:", i18n.locale)
}

// Function to change language and persist the choice
export const changeLanguage = async (languageCode: string) => {
  logger.debug("changeLanguage called with:", languageCode)
  logger.debug("Available translations:", Object.keys(i18n.translations))
  
  // Load the language if it's not already loaded
  if (!i18n.translations[languageCode]) {
    await loadLanguage(languageCode)
  }
  
  if (i18n.translations[languageCode]) {
    logger.debug("Setting i18n.locale to:", languageCode)
    i18n.locale = languageCode
    logger.debug("i18n.locale is now:", i18n.locale)
    
    // Save the user's choice
    try {
      await storage.save(LANGUAGE_STORAGE_KEY, languageCode)
      logger.debug("Language preference saved:", languageCode)
    } catch (error) {
      logger.error("Failed to save language preference:", error)
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
      logger.error("Failed to notify language change:", error)
    }
  } else {
    logger.error("Language not found in translations:", languageCode)
  }
}

// Set initial locale synchronously to prevent undefined errors
const systemLocale = Localization.getLocales()[0]
const systemLocaleTag = systemLocale?.languageTag ?? "en-US"

// Set a default locale immediately (translations will be loaded asynchronously)
// This prevents blocking, but translations may not be available until initializeLanguage completes
i18n.locale = systemLocaleTag === "en" || systemLocaleTag === "en-US" ? systemLocaleTag : fallbackLocale

// Initialize language with user preference (async)
// This will load English translations immediately, then load user's preferred language if different
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
