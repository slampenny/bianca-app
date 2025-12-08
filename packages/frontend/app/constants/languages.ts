// Language options for patient preferences
export interface LanguageOption {
  code: string
  label: string
  nativeName: string
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
  { code: 'zh', label: 'Chinese', nativeName: '中文' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語' },
  { code: 'pt', label: 'Portuguese', nativeName: 'Português' },
  { code: 'it', label: 'Italian', nativeName: 'Italiano' },
  { code: 'ru', label: 'Russian', nativeName: 'Русский' },
  { code: 'ar', label: 'Arabic', nativeName: 'العربية' },
  { code: 'ko', label: 'Korean', nativeName: '한국어' },
]

export const getLanguageByCode = (code: string): LanguageOption => {
  return LANGUAGE_OPTIONS.find(lang => lang.code === code) || LANGUAGE_OPTIONS[0]
}

export const DEFAULT_LANGUAGE = 'en'