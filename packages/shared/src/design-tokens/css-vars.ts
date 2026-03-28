import type { ThemeColors } from "./theme-types"
import { spacing } from "./spacing"

function camelToKebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

/**
 * Maps semantic theme colors + palette to CSS custom properties for the web app.
 * Example: background -> --color-background, palette.primary500 -> --palette-primary-500
 */
export function themeColorsToCssVars(theme: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {}

  for (const [key, value] of Object.entries(theme)) {
    if (key === "palette" && value && typeof value === "object") {
      for (const [pk, pv] of Object.entries(value as Record<string, string>)) {
        if (typeof pv === "string") {
          vars[`--palette-${camelToKebab(pk)}`] = pv
        }
      }
      continue
    }
    if (typeof value === "string") {
      vars[`--color-${camelToKebab(key)}`] = value
    }
  }

  return vars
}

export function spacingToCssVars(): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [key, px] of Object.entries(spacing)) {
    vars[`--space-${key}`] = `${px}px`
  }
  return vars
}

/** Apply token maps to document.documentElement (call once at startup + on theme change). */
export function applyCssVarsToRoot(vars: Record<string, string>): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v)
  }
}
