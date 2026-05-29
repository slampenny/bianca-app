import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { buildWebResources } from "./localePatches"

const STORAGE_KEY = "bianca_web_locale"

export function readStoredOrBrowserLang(): string {
  if (typeof window === "undefined") return "en"
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s && /^[a-z]{2}$/i.test(s)) return s.toLowerCase()
  } catch {
    /* private mode */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language?.split("-")[0]?.toLowerCase() : ""
  return nav && nav.length === 2 ? nav : "en"
}

export function setWebLocaleStorage(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, code.toLowerCase())
  } catch {
    /* ignore */
  }
}

void i18n.use(initReactI18next).init({
  resources: buildWebResources(),
  lng: readStoredOrBrowserLang(),
  fallbackLng: "en",
  supportedLngs: ["en", "es", "fr", "de", "zh", "ja", "pt", "it", "ru", "ar", "ko", "hu"],
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

export function applyDocumentLangDir(lang: string) {
  const code = lang.split("-")[0].toLowerCase()
  document.documentElement.lang = code
  document.documentElement.dir = code === "ar" ? "rtl" : "ltr"
}

void i18n.on("languageChanged", (lng) => {
  applyDocumentLangDir(lng)
  setWebLocaleStorage(lng)
})

applyDocumentLangDir(i18n.language)

export { i18n }
