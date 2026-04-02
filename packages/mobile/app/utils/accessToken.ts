import type { AuthTokens } from "../services/api/api.types"

/**
 * Backend sends JWT expiry as Unix **seconds** (`moment().unix()`).
 * `new Date(seconds)` wrongly treats that as milliseconds (1970), so we normalize to ms.
 */
function accessExpiresToMs(exp: string | number | undefined | null): number | null {
  if (exp === undefined || exp === null || exp === "") return null
  if (typeof exp === "number" && Number.isFinite(exp)) {
    return exp < 1e12 ? exp * 1000 : exp
  }
  const s = String(exp).trim()
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    return n < 1e12 ? n * 1000 : n
  }
  const ms = new Date(s).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** True when there is a non-empty access token and its expiry (if present) is in the future. */
export function hasUsableAccessToken(tokens: AuthTokens | null | undefined): boolean {
  const t = tokens?.access?.token?.trim()
  if (!t) return false
  const exp = tokens?.access?.expires
  if (exp === undefined || exp === null || exp === "") return true
  const ms = accessExpiresToMs(exp)
  if (ms === null) return true
  return ms > Date.now()
}
