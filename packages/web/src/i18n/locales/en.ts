import { nav, header, timeFormat, orgDisplay, profile, settingsLanguage } from "./shell"
import { appLocalesAuth } from "./appLocalesAuth"
import { appLocalesPages } from "./appLocalesPages"
import { geo } from "./appLocalesGeo"

/** English UI strings (source of truth for the web app). */
export const en = {
  nav,
  header,
  timeFormat,
  orgDisplay,
  profile,
  settingsLanguage,
  geo,
  ...appLocalesAuth,
  ...appLocalesPages,
} as const

export type WebTranslationTree = typeof en
