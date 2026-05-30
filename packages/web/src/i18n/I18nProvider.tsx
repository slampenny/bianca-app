import { useEffect, useState, type ReactNode } from "react"
import { ensureWebLocaleLoaded, i18n, readStoredOrBrowserLang } from "./i18n"

/**
 * Loads the user's locale bundle before rendering children so the first paint uses the right language.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => readStoredOrBrowserLang() === "en")

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const target = readStoredOrBrowserLang()
      await ensureWebLocaleLoaded(target)
      if (i18n.language?.slice(0, 2) !== target.slice(0, 2)) {
        await i18n.changeLanguage(target)
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return null
  }

  return children
}
