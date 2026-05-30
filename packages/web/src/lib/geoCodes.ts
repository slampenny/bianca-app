/** Must match backend `auth.validation` register.country allowed values (uppercase). */
export const REGISTRATION_COUNTRY_CODES = [
  "US",
  "CA",
  "GB",
  "AU",
  "DE",
  "FR",
  "IT",
  "ES",
  "NL",
  "SE",
  "CH",
  "JP",
  "CN",
  "HK",
  "SG",
  "AE",
  "IN",
  "MX",
  "BR",
  "OTHER",
] as const

export type RegistrationCountryCode = (typeof REGISTRATION_COUNTRY_CODES)[number]

/** IANA timezone ids aligned with mobile org settings. */
export const ORG_TIMEZONE_IDS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Zurich",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
] as const

export type OrgTimezoneId = (typeof ORG_TIMEZONE_IDS)[number]
