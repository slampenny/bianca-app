import type { Org } from "../services/api/api.types"

/** Map backend OrgDTO JSON into web `Org` slice shape. */
export function normalizeOrgForStore(raw: unknown): Org | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const idRaw = o.id ?? o._id
  const id = idRaw != null ? String(idRaw) : ""
  return {
    id,
    name: String(o.name ?? ""),
    avatar: String(o.avatar ?? ""),
    email: String(o.email ?? ""),
    phone: String(o.phone ?? ""),
    stripeCustomerId: String(o.stripeCustomerId ?? ""),
    isEmailVerified: o.isEmailVerified === true,
    caregivers: Array.isArray(o.caregivers) ? o.caregivers.map((x) => String(x)) : [],
    clients: Array.isArray(o.clients) ? o.clients.map((x) => String(x)) : [],
    timezone: typeof o.timezone === "string" ? o.timezone : null,
    dailyDigestSettings:
      o.dailyDigestSettings && typeof o.dailyDigestSettings === "object"
        ? {
            enabled: (o.dailyDigestSettings as { enabled?: unknown }).enabled === true,
            sendTime:
              typeof (o.dailyDigestSettings as { sendTime?: unknown }).sendTime === "string"
                ? (o.dailyDigestSettings as { sendTime: string }).sendTime
                : null,
          }
        : undefined,
    familyPortalSettings:
      o.familyPortalSettings && typeof o.familyPortalSettings === "object"
        ? {
            enabled: (o.familyPortalSettings as { enabled?: unknown }).enabled === true,
            allowInviteAfterDigestVerify:
              (o.familyPortalSettings as { allowInviteAfterDigestVerify?: unknown })
                .allowInviteAfterDigestVerify !== false,
          }
        : undefined,
  }
}

export function orgStubFromCaregiverOrgId(orgId: string): Org {
  return {
    id: orgId,
    name: "",
    avatar: "",
    email: "",
    phone: "",
    stripeCustomerId: "",
    isEmailVerified: false,
    caregivers: [],
    clients: [],
  }
}
