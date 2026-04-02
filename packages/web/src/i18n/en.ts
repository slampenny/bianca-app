import { nav, header, profile, settingsLanguage } from "./locales/shell"
import { appLocalesAuth } from "./locales/appLocalesAuth"
import { appLocalesPages } from "./locales/appLocalesPages"

/** Default (English) UI strings for the web app — other locales merge overrides on top. */
export const en = {
  nav,
  header,
  profile,
  settingsLanguage,
  ...appLocalesAuth,
  ...appLocalesPages,
} as const

export type WebTranslationTree = typeof en
