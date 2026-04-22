import type { Client } from "../services/api/api.types"

function trim(s: string | null | undefined): string {
  if (s == null) return ""
  return String(s).trim()
}

/**
 * List / header label: given name is preferred name if set, otherwise legal first name;
 * last name is always appended when present (e.g. "Betty Smith").
 */
export function clientDisplayName(
  c: Pick<Client, "preferredName" | "firstName" | "lastName" | "name">,
): string {
  const preferred = trim(c.preferredName)
  const fn = trim(c.firstName)
  const ln = trim(c.lastName)
  const fallback = trim(c.name)
  const given = preferred || fn
  if (ln) {
    const head = given || fn
    return [head, ln].filter(Boolean).join(" ").trim()
  }
  return given || fallback || "—"
}

export function clientInitialsFromClient(
  c: Pick<Client, "preferredName" | "firstName" | "lastName">,
): string {
  const given = trim(c.preferredName) || trim(c.firstName) || ""
  const ln = trim(c.lastName) || ""
  return `${given[0] ?? "?"}${ln[0] ?? ""}`.toUpperCase()
}
