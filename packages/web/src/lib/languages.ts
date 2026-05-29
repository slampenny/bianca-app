/** Aligned with `packages/mobile/app/constants/languages.ts` */
export interface LanguageOption {
  code: string
  label: string
  nativeName: string
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English", nativeName: "English" },
  { code: "es", label: "Spanish", nativeName: "Español" },
  { code: "fr", label: "French", nativeName: "Français" },
  { code: "de", label: "German", nativeName: "Deutsch" },
  { code: "zh", label: "Chinese", nativeName: "中文" },
  { code: "ja", label: "Japanese", nativeName: "日本語" },
  { code: "pt", label: "Portuguese", nativeName: "Português" },
  { code: "it", label: "Italian", nativeName: "Italiano" },
  { code: "ru", label: "Russian", nativeName: "Русский" },
  { code: "ar", label: "Arabic", nativeName: "العربية" },
  { code: "ko", label: "Korean", nativeName: "한국어" },
  { code: "hu", label: "Hungarian", nativeName: "Magyar" },
]
