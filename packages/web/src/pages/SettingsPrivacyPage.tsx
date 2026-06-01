import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { PRIVACY_POLICY_URL } from "../config/legal"
import {
  useCreateAccessRequestMutation,
  useCreateCorrectionRequestMutation,
  useGetPrivacyRequestsQuery,
  useRequestDataDeletionMutation,
} from "../services/api/privacyApi"
import "../app.css"

export function SettingsPrivacyPage() {
  const { t } = useTranslation()
  const { data: pages, isLoading } = useGetPrivacyRequestsQuery({ page: 1, limit: 20 })
  const [createAccess, { isLoading: submitting }] = useCreateAccessRequestMutation()
  const [createCorrection, { isLoading: correcting }] = useCreateCorrectionRequestMutation()
  const [requestDeletion, { isLoading: deleting }] = useRequestDataDeletionMutation()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const recentRequests = pages?.results ?? []
  const hasRecentRequests = recentRequests.length > 0

  const submitAccess = async () => {
    setError("")
    setMessage("")
    try {
      await createAccess({
        informationRequested: t("settingsPrivacy.defaultInformationRequested"),
        accessMethod: "email",
      }).unwrap()
      setMessage(t("settingsPrivacy.submitted"))
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || t("settingsPrivacy.requestFailed"))
    }
  }

  const submitCorrection = async () => {
    setError("")
    setMessage("")
    try {
      await createCorrection({
        field: "fullName",
        currentValue: "Name and profile details",
        requestedValue: "Updated profile details",
        reason: "Please update my profile details to match current records.",
      }).unwrap()
      setMessage(t("settingsPrivacy.correctionSubmitted"))
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || t("settingsPrivacy.requestFailed"))
    }
  }

  const submitDeletion = async () => {
    setError("")
    setMessage("")
    try {
      await requestDeletion({ dataType: "all" }).unwrap()
      setMessage(t("settingsPrivacy.deletionSubmitted"))
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || t("settingsPrivacy.requestFailed"))
    }
  }

  return (
    <div data-testid="settings-privacy-page" className="va-page-wrap">
      <Link to="/settings" className="va-link" style={{ fontSize: "0.875rem" }} data-testid="settings-back-link">
        ← {t("settings.backToSettings")}
      </Link>
      <h1 className="va-page-title" style={{ marginTop: "1rem" }}>
        {t("settingsPrivacy.title")}
      </h1>
      <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", lineHeight: 1.45 }}>
        {t("settingsPrivacy.subtitle")}{" "}
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="va-link">
          {t("settingsPrivacy.privacyPolicyLink")}
        </a>
        .
      </p>

      <div className="va-page-section" style={{ marginTop: "1.25rem" }} data-testid="privacy-request-card-access">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("settingsPrivacy.requestTitle")}</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-600)", marginBottom: "1rem", lineHeight: 1.45 }}>
          {t("settingsPrivacy.requestBody")}
        </p>
        {message ? (
          <div className="va-login-success" style={{ marginBottom: "1rem" }} role="status">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="va-login-error" style={{ marginBottom: "1rem" }} role="alert">
            {error}
          </div>
        ) : null}
        <button
          type="button"
          data-testid="privacy-submit-access"
          className="va-btn-primary"
          style={{ width: "100%" }}
          disabled={submitting}
          onClick={() => void submitAccess()}
        >
          {submitting ? t("settingsPrivacy.submitting") : t("settingsPrivacy.submit")}
        </button>
      </div>

      <div className="va-page-section" style={{ marginTop: "1.25rem" }} data-testid="privacy-request-card-correction">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("settingsPrivacy.correctionTitle")}</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-600)", marginBottom: "1rem", lineHeight: 1.45 }}>
          {t("settingsPrivacy.correctionBody")}
        </p>
        <button
          type="button"
          data-testid="privacy-submit-correction"
          className="va-btn-primary"
          style={{ width: "100%" }}
          disabled={correcting}
          onClick={() => void submitCorrection()}
        >
          {correcting ? t("settingsPrivacy.submitting") : t("settingsPrivacy.submitCorrection")}
        </button>
      </div>

      <div className="va-page-section" style={{ marginTop: "1.25rem" }} data-testid="privacy-request-card-deletion">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("settingsPrivacy.deletionTitle")}</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-600)", marginBottom: "1rem", lineHeight: 1.45 }}>
          {t("settingsPrivacy.deletionBody")}
        </p>
        <button
          type="button"
          data-testid="privacy-submit-deletion"
          className="va-btn-ghost"
          style={{ width: "100%", color: "var(--va-red-600)", borderColor: "var(--va-red-200)" }}
          disabled={deleting}
          onClick={() => void submitDeletion()}
        >
          {deleting ? t("settingsPrivacy.submitting") : t("settingsPrivacy.submitDeletion")}
        </button>
      </div>

      {isLoading || hasRecentRequests ? (
        <div className="va-page-section" style={{ marginTop: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>{t("settingsPrivacy.recentTitle")}</h2>
          {isLoading ? (
            <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("common.loading")}</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {recentRequests.map((r) => {
                const rid = String(r._id ?? r.id ?? "")
                return (
                  <li
                    key={rid}
                    style={{
                      padding: "0.75rem 0",
                      borderBottom: "1px solid var(--va-slate-100)",
                      fontSize: "0.875rem",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.requestType || t("settingsPrivacy.requestTypeFallback")}</div>
                    <div style={{ color: "var(--va-slate-500)", fontSize: "0.75rem", marginTop: 4 }}>
                      {r.status} · {r.createdAt ? new Date(r.createdAt).toLocaleString() : t("common.emDash")}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
