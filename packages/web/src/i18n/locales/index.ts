/** BCP-47-style codes supported in the web app language picker. */
export const LANG_CODES = ["en", "es", "fr", "de", "zh", "ja", "pt", "it", "ru", "ar", "ko", "hu"] as const

export type LangCode = (typeof LANG_CODES)[number]

export type { WebTranslationTree } from "./en"
