import type { TFunction } from "i18next"

const ROLE_KEYS: Record<string, string> = {
  staff: "caregivers.roleStaff",
  orgAdmin: "caregivers.roleOrgAdmin",
  superAdmin: "caregivers.roleSuperAdmin",
  invited: "caregivers.roleInvited",
  admin: "caregivers.roleAdmin",
  unverified: "caregivers.roleUnverified",
}

export function formatCaregiverRole(role: string | undefined | null, t: TFunction): string {
  if (!role?.trim()) return t("common.emDash")
  const key = ROLE_KEYS[role]
  return key ? t(key) : role
}
