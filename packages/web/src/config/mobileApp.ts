/** Mobile app web origin for family portal signup redirects (matches backend MOBILE_APP_URL). */
export function getMobileAppUrl(): string {
  const fromEnv = import.meta.env.VITE_MOBILE_APP_URL
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, "")
  }
  return "http://localhost:8084"
}

export function buildMobileFamilySignupUrl(token: string): string {
  return `${getMobileAppUrl()}/signup?token=${encodeURIComponent(token)}&family=1`
}
