import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import type { DailyDigestAutomationStatus } from "../lib/dailyDigestAutomation"

/** One-line Ready / Not ready nudge for the digest reports page (full detail lives on Settings). */
export function AutomatedDigestStatusIndicator({ status }: { status: DailyDigestAutomationStatus }) {
  const { t } = useTranslation()

  if (status.automatedReady) {
    return (
      <p
        data-testid="daily-digest-automation-indicator"
        style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.45 }}
      >
        {t("dailyDigest.automationCompactReady")}
      </p>
    )
  }

  return (
    <p
      data-testid="daily-digest-automation-indicator"
      style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.45 }}
    >
      {t("dailyDigest.automationCompactNotReady")}{" "}
      <Link data-testid="daily-digest-automation-indicator-settings-link" to="/settings" style={{ color: "var(--va-teal)" }}>
        {t("dailyDigest.automationCompactSeeSettings")}
      </Link>
    </p>
  )
}
