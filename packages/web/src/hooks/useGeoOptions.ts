import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { orgTimezoneOptions, registrationCountryOptions } from "../lib/geoLabels"

/** Country dropdown options localized for the active UI language. */
export function useRegistrationCountryOptions() {
  const { i18n, t } = useTranslation()
  const lang = i18n.language?.slice(0, 2) ?? "en"
  return useMemo(() => registrationCountryOptions(lang, t), [lang, t])
}

/** Timezone dropdown options localized for the active UI language. */
export function useOrgTimezoneOptions() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.slice(0, 2) ?? "en"
  return useMemo(() => orgTimezoneOptions(lang), [lang])
}
