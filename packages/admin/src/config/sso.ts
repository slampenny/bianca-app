/**
 * OAuth client IDs for admin SSO — same env vars as facility web (`packages/web/src/config/sso.ts`).
 * Production admin build must set VITE_GOOGLE_CLIENT_ID / VITE_MICROSOFT_* if not using defaults.
 */
export function getGoogleClientId(): string | undefined {
  const v = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (typeof v === "string" && v.trim() !== "") return v.trim()
  return "959208772047-srq01jpg8sq31afovfb38afsroee0o53.apps.googleusercontent.com"
}

export function getMicrosoftClientId(): string | undefined {
  const v = import.meta.env.VITE_MICROSOFT_CLIENT_ID
  if (typeof v === "string" && v.trim() !== "") return v.trim()
  return "be3192d6-72ae-4257-9591-7a32797e0919"
}

export function getMicrosoftTenantId(): string {
  const v = import.meta.env.VITE_MICROSOFT_TENANT_ID
  if (typeof v === "string" && v.trim() !== "") return v.trim()
  return "common"
}

export function isGoogleSsoConfigured(): boolean {
  return Boolean(getGoogleClientId())
}

export function isMicrosoftSsoConfigured(): boolean {
  return Boolean(getMicrosoftClientId())
}
