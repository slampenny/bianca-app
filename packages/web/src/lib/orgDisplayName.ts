import type { TFunction } from "i18next"

const SSO_ORG_NAME = /^(.+)'s Organization$/

/** Localize known default org names (e.g. SSO-created "{name}'s Organization"). */
export function formatOrgDisplayName(
  name: string | undefined,
  t: TFunction,
  fallbackKey = "appShell.defaultFacility",
): string {
  if (!name?.trim()) return t(fallbackKey)
  const match = name.match(SSO_ORG_NAME)
  if (match) return t("orgDisplay.ssoDefaultName", { name: match[1].trim() })
  return name
}
