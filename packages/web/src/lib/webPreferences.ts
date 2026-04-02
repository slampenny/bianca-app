const STORAGE = {
  theme: "bianca-web-theme",
  font: "bianca-web-font-scale",
} as const

export type WebThemeMode = "light" | "dark" | "system"

export function getStoredThemeMode(): WebThemeMode {
  const v = localStorage.getItem(STORAGE.theme)
  if (v === "light" || v === "dark" || v === "system") return v
  return "light"
}

export function getStoredFontScalePct(): number {
  const n = Number(localStorage.getItem(STORAGE.font))
  if (n === 90 || n === 100 || n === 110 || n === 125) return n
  return 100
}

function resolveDark(mode: WebThemeMode): boolean {
  if (mode === "dark") return true
  if (mode === "light") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function applyWebThemeMode(mode: WebThemeMode): void {
  localStorage.setItem(STORAGE.theme, mode)
  document.documentElement.classList.toggle("va-dark", resolveDark(mode))
}

export function applyWebFontScalePct(pct: number): void {
  localStorage.setItem(STORAGE.font, String(pct))
  const basePx = 15.5
  document.documentElement.style.fontSize = `${(basePx * pct) / 100}px`
}

/** Call once on app boot (before paint if possible). */
export function initWebPreferencesFromStorage(): void {
  applyWebThemeMode(getStoredThemeMode())
  applyWebFontScalePct(getStoredFontScalePct())
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getStoredThemeMode() === "system") {
      document.documentElement.classList.toggle("va-dark", resolveDark("system"))
    }
  })
}
