/** Public legal pages on the marketing site. Override with VITE_* if needed. */
import { urls } from "@bianca/legal"

const base =
  typeof import.meta.env.VITE_LEGAL_BASE_URL === "string" && import.meta.env.VITE_LEGAL_BASE_URL.trim()
    ? import.meta.env.VITE_LEGAL_BASE_URL.replace(/\/$/, "")
    : "https://biancawellness.com"

function legalUrl(envKey: string, slug: keyof typeof urls): string {
  const override = import.meta.env[envKey]
  if (typeof override === "string" && override.trim()) {
    return override
  }
  return urls[slug].replace("https://biancawellness.com", base)
}

export const TERMS_OF_SERVICE_URL = legalUrl("VITE_TERMS_URL", "terms")
export const PRIVACY_POLICY_URL = legalUrl("VITE_PRIVACY_URL", "privacy")
export const PRIVACY_PIPEDA_URL = legalUrl("VITE_PRIVACY_PIPEDA_URL", "privacy-pipeda")
export const PRIVACY_PRACTICES_URL = legalUrl("VITE_PRIVACY_PRACTICES_URL", "privacy-practices")
export const CROSS_BORDER_DATA_TRANSFERS_URL = legalUrl(
  "VITE_CROSS_BORDER_URL",
  "cross-border-data-transfers",
)
export const DATA_SAFETY_URL = legalUrl("VITE_DATA_SAFETY_URL", "data-safety")
