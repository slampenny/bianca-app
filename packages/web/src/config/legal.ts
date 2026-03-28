/** Public legal pages (same domain as marketing site). Override with VITE_* if needed. */
const base = typeof import.meta.env.VITE_LEGAL_BASE_URL === "string" && import.meta.env.VITE_LEGAL_BASE_URL.trim()
  ? import.meta.env.VITE_LEGAL_BASE_URL.replace(/\/$/, "")
  : "https://biancawellness.com"

export const TERMS_OF_SERVICE_URL =
  typeof import.meta.env.VITE_TERMS_URL === "string" && import.meta.env.VITE_TERMS_URL.trim()
    ? import.meta.env.VITE_TERMS_URL
    : `${base}/terms`

export const PRIVACY_POLICY_URL =
  typeof import.meta.env.VITE_PRIVACY_URL === "string" && import.meta.env.VITE_PRIVACY_URL.trim()
    ? import.meta.env.VITE_PRIVACY_URL
    : `${base}/privacy`
