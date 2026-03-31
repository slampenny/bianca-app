/**
 * OAuth client IDs for web SSO — align with `packages/mobile/app.config.ts` `extra`.
 * Override at build time with VITE_GOOGLE_CLIENT_ID, VITE_MICROSOFT_CLIENT_ID, VITE_MICROSOFT_TENANT_ID.
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
