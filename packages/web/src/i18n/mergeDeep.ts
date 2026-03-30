/** Deep-merge plain objects for locale overrides (nested keys). */
export function mergeDeep<T extends Record<string, unknown>>(
  base: T,
  patch: Record<string, unknown>,
): T {
  const out = structuredClone(base) as T
  for (const k of Object.keys(patch)) {
    const pv = patch[k]
    const existing = out[k as keyof T]
    if (
      pv !== null &&
      typeof pv === "object" &&
      !Array.isArray(pv) &&
      existing !== null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      ;(out as Record<string, unknown>)[k] = mergeDeep(existing as Record<string, unknown>, pv as Record<string, unknown>)
    } else if (pv !== undefined) {
      ;(out as Record<string, unknown>)[k] = pv
    }
  }
  return out
}
