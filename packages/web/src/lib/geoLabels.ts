import type { TFunction } from "i18next"
import {
  ORG_TIMEZONE_IDS,
  REGISTRATION_COUNTRY_CODES,
  type OrgTimezoneId,
  type RegistrationCountryCode,
} from "./geoCodes"

/** Map app language codes to BCP 47 tags for `Intl`. */
const INTL_LOCALE: Record<string, string> = {
  en: "en-US",
  es: "es",
  fr: "fr",
  de: "de",
  zh: "zh-CN",
  ja: "ja",
  pt: "pt",
  it: "it",
  ru: "ru",
  ar: "ar",
  ko: "ko",
  hu: "hu",
}

function intlLocale(lang: string): string {
  const code = lang.slice(0, 2).toLowerCase()
  return INTL_LOCALE[code] ?? code
}

const regionNamesCache = new Map<string, Intl.DisplayNames>()

function regionNames(lang: string): Intl.DisplayNames | null {
  const key = intlLocale(lang)
  if (regionNamesCache.has(key)) return regionNamesCache.get(key)!
  try {
    const dn = new Intl.DisplayNames([key], { type: "region" })
    regionNamesCache.set(key, dn)
    return dn
  } catch {
    return null
  }
}

/** Localized country name for a registration/org country code. */
export function countryLabel(code: string, lang: string, t?: TFunction): string {
  if (code === "OTHER") {
    return t?.("geo.countries.OTHER") ?? "Other"
  }
  const dn = regionNames(lang)
  if (dn) {
    try {
      const name = dn.of(code.toUpperCase())
      if (name) return name
    } catch {
      /* invalid region */
    }
  }
  return code
}

/** Localized timezone label via `Intl.DateTimeFormat` (long generic name). */
export function timezoneLabel(timeZone: string, lang: string): string {
  try {
    const parts = new Intl.DateTimeFormat(intlLocale(lang), {
      timeZone,
      timeZoneName: "longGeneric",
    }).formatToParts(new Date())
    const name = parts.find((p) => p.type === "timeZoneName")?.value
    if (name) return name
  } catch {
    /* unsupported tz or locale */
  }
  return timeZone
}

export function registrationCountryOptions(lang: string, t?: TFunction) {
  return REGISTRATION_COUNTRY_CODES.map((value) => ({
    value,
    label: countryLabel(value, lang, t),
  }))
}

export function orgTimezoneOptions(lang: string) {
  return ORG_TIMEZONE_IDS.map((value) => ({
    value,
    label: timezoneLabel(value, lang),
  }))
}

export { REGISTRATION_COUNTRY_CODES, ORG_TIMEZONE_IDS }
export type { RegistrationCountryCode, OrgTimezoneId }
