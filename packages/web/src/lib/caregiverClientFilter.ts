import type { Caregiver, CaregiverRole, Client } from "../services/api/api.types"

const ROSTER_SCOPED_ROLES: ReadonlySet<CaregiverRole> = new Set([
  "staff",
  "orgAdmin",
  "admin",
  "unverified",
])

/** True when the report roster should be limited to this user's assigned clients (not the whole org). */
export function shouldScopeClientsToCaregiverRoster(role: CaregiverRole | undefined): boolean {
  return role != null && ROSTER_SCOPED_ROLES.has(role)
}

/** Facility reports that span the whole org (vs. assigned residents only for staff). */
export function seesWholeFacilityInReports(role: CaregiverRole | undefined): boolean {
  return role === "orgAdmin" || role === "superAdmin"
}

/**
 * Keep clients on the caregiver's roster or explicitly assigned via `client.caregivers`.
 * Aligns with backend GET /clients when the account lacks readAny:client (e.g. staff). Org admins / super-admins see the full API result set.
 */
export function filterClientsToCaregiverRoster(
  clients: Client[],
  user: Pick<Caregiver, "id" | "role" | "clients"> | null | undefined,
): Client[] {
  if (!user?.id || !shouldScopeClientsToCaregiverRoster(user.role)) {
    return clients
  }
  const uid = String(user.id)
  const roster = new Set((user.clients ?? []).map(String))
  return clients.filter((c) => {
    const cid = String(c.id ?? "")
    if (!cid) return false
    if (roster.has(cid)) return true
    return (c.caregivers ?? []).some((cg) => String(cg) === uid)
  })
}
