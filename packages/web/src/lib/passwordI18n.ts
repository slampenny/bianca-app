import type { TFunction } from "i18next"
import { validatePasswordRules } from "./passwordRules"

/** Returns localized password rule error, or null if valid. */
export function validatePasswordRulesI18n(password: string, t: TFunction): string | null {
  const raw = validatePasswordRules(password)
  if (!raw) return null
  if (raw.includes("8 characters")) return t("auth.passwordErrors.too_short")
  if (raw.includes("letter and one number")) return t("auth.passwordErrors.needs_letter_number")
  return raw
}
