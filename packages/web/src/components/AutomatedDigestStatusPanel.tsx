import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import type { DailyDigestAutomationStatus } from "../lib/dailyDigestAutomation"
import type { Caregiver } from "../services/api/api.types"

function statusColor(pass: boolean, unknown?: boolean): string {
  if (unknown) return "var(--va-slate-500)"
  return pass ? "var(--va-teal)" : "var(--va-red-600, #dc2626)"
}

function CheckRow({
  label,
  value,
  pass,
  unknown,
}: {
  label: string
  value: string
  pass: boolean
  unknown?: boolean
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", fontSize: "0.8125rem", lineHeight: 1.45 }}>
      <span style={{ color: "var(--va-slate-600)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: statusColor(pass, unknown), textAlign: "right" }}>{value}</span>
    </div>
  )
}

export function AutomatedDigestStatusPanel({
  status,
  caregiver,
  orgLoading,
}: {
  status: DailyDigestAutomationStatus
  caregiver: Caregiver | null | undefined
  orgLoading: boolean
}) {
  const { t } = useTranslation()

  const orgSchedulingCheck = status.checks.find((c) => c.key === "orgScheduling")
  const emailCheck = status.checks.find((c) => c.key === "email")
  const accountCheck = status.checks.find((c) => c.key === "account")
  const preferenceCheck = status.checks.find((c) => c.key === "preference")

  const emailMissing = !caregiver?.email?.trim()
  const emailLabel = emailMissing
    ? t("dailyDigest.automationEmailMissing")
    : emailCheck?.pass
      ? t("dailyDigest.automationEmailVerified")
      : t("dailyDigest.automationEmailUnverified")

  const orgSchedulingLabel =
    status.orgSchedulingAvailability === "loading" || orgLoading
      ? t("dailyDigest.automationLoading")
      : status.orgSchedulingAvailability === "unavailable"
        ? t("dailyDigest.automationOrgSchedulingUnavailable")
        : status.orgSchedulingAvailability === "error"
          ? t("dailyDigest.automationOrgSchedulingUnavailable")
          : orgSchedulingCheck?.pass
            ? t("dailyDigest.automationEnabled")
            : t("dailyDigest.automationDisabled")

  return (
    <section
      data-testid="daily-digest-automation-status"
      style={{
        padding: "1rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--va-slate-200)",
        background: "var(--va-white)",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem 1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", color: "var(--va-navy)" }}>{t("dailyDigest.automationTitle")}</h2>
        <span
          data-testid="daily-digest-automation-ready-badge"
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            padding: "0.2rem 0.55rem",
            borderRadius: 999,
            color: status.automatedReady ? "var(--va-teal-900, var(--va-navy))" : "var(--va-slate-700)",
            background: status.automatedReady ? "rgba(20, 184, 166, 0.15)" : "var(--va-slate-100)",
            border: `1px solid ${status.automatedReady ? "rgba(20, 184, 166, 0.35)" : "var(--va-slate-200)"}`,
          }}
        >
          {status.automatedReady ? t("dailyDigest.automationReady") : t("dailyDigest.automationNotReady")}
        </span>
      </div>

      <p data-testid="daily-digest-manual-send-status" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-600)", lineHeight: 1.45 }}>
        {t("dailyDigest.automationManualSendStatus", {
          status: status.manualSendReady ? t("dailyDigest.automationReady") : t("dailyDigest.automationNotReady"),
        })}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        <CheckRow
          label={t("dailyDigest.automationCheckOrgScheduling")}
          value={orgSchedulingLabel}
          pass={orgSchedulingCheck?.pass === true}
          unknown={orgSchedulingCheck?.unknown}
        />
        <CheckRow label={t("dailyDigest.automationCheckEmail")} value={emailLabel} pass={emailCheck?.pass === true} />
        <CheckRow
          label={t("dailyDigest.automationCheckAccount")}
          value={accountCheck?.pass ? t("dailyDigest.automationActive") : t("dailyDigest.automationInactive")}
          pass={accountCheck?.pass === true}
        />
        <CheckRow
          label={t("dailyDigest.automationCheckPreference")}
          value={preferenceCheck?.pass ? t("dailyDigest.automationEnabled") : t("dailyDigest.automationDisabled")}
          pass={preferenceCheck?.pass === true}
        />
        {status.orgSendTime && status.orgTimezone ? (
          <CheckRow
            label={t("dailyDigest.automationCheckSendTime")}
            value={t("dailyDigest.automationSendTimeValue", { time: status.orgSendTime, timezone: status.orgTimezone })}
            pass={status.automatedReady}
            unknown={false}
          />
        ) : status.orgTimezone ? (
          <CheckRow
            label={t("dailyDigest.automationCheckTimezone")}
            value={status.orgTimezone}
            pass={status.automatedReady}
            unknown={false}
          />
        ) : status.orgSchedulingAvailability === "available" ? (
          <CheckRow
            label={t("dailyDigest.automationCheckTimezone")}
            value={t("dailyDigest.automationTimezoneUnset")}
            pass={false}
            unknown={false}
          />
        ) : null}
      </div>

      <div style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", lineHeight: 1.45, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <p data-testid="daily-digest-automation-manual-copy" style={{ margin: 0 }}>
          {t("dailyDigest.automationManualCopy")}
        </p>
        <p data-testid="daily-digest-automation-scheduled-copy" style={{ margin: 0 }}>
          {t("dailyDigest.automationScheduledCopy")}
        </p>
      </div>

      {status.orgSchedulingAvailability === "unavailable" ? (
        <p data-testid="daily-digest-automation-org-unavailable" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-600)", lineHeight: 1.45 }}>
          {t("dailyDigest.automationOrgUnavailableNote")}
        </p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8125rem" }}>
        {status.showPreferenceCta ? (
          <Link data-testid="daily-digest-automation-settings-cta" to="/settings" style={{ color: "var(--va-teal)" }}>
            {t("dailyDigest.automationEnableInSettings")}
          </Link>
        ) : null}
        {status.showVerifyEmailCta ? (
          <Link data-testid="daily-digest-automation-verify-cta" to="/settings" style={{ color: "var(--va-teal)" }}>
            {t("dailyDigest.automationVerifyEmailInSettings")}
          </Link>
        ) : null}
        {status.showAskAdminForScheduling ? (
          <p data-testid="daily-digest-automation-ask-admin" style={{ margin: 0, color: "var(--va-slate-600)", lineHeight: 1.45 }}>
            {t("dailyDigest.automationAskAdminEnableScheduling")}
          </p>
        ) : null}
      </div>
    </section>
  )
}
