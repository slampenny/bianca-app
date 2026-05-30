/** @deprecated Import `ORG_TIMEZONE_IDS` from `./geoCodes` or use `useOrgTimezoneOptions`. */
import { ORG_TIMEZONE_IDS } from "./geoCodes"

/** @deprecated Use `useOrgTimezoneOptions()` for localized labels. */
export const ORG_TIMEZONE_OPTIONS = ORG_TIMEZONE_IDS.map((value) => ({ value, label: value }))
