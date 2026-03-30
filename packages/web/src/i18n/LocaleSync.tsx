import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { applyDocumentLangDir, readStoredOrBrowserLang, setWebLocaleStorage } from "./i18n"

/** Keeps i18n in sync with the caregiver’s saved `preferredLanguage` (and html lang/dir). */
export function LocaleSync() {
  const user = useAppSelector(getCurrentUser)
  const pref = user?.preferredLanguage
  const { i18n } = useTranslation()

  useEffect(() => {
    const fromAccount = pref && typeof pref === "string" && pref.length >= 2 ? pref.slice(0, 2).toLowerCase() : null
    const next = fromAccount ?? readStoredOrBrowserLang()
    if (i18n.language?.slice(0, 2) !== next) {
      void i18n.changeLanguage(next)
    } else {
      applyDocumentLangDir(next)
      setWebLocaleStorage(next)
    }
  }, [pref, user?.id, i18n])

  return null
}
