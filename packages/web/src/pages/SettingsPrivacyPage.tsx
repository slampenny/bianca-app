import { useState } from "react"
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
        informationRequested: "All my personal information held by Bianca",
        accessMethod: "email",
      }).unwrap()
      setMessage("Your access request was submitted. You’ll get an email when it’s ready.")
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || "Request failed.")
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
      setMessage("Your correction request was submitted.")
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || "Request failed.")
    }
  }

  const submitDeletion = async () => {
    setError("")
    setMessage("")
    try {
      await requestDeletion({ dataType: "all" }).unwrap()
      setMessage("Your data deletion request was submitted.")
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || "Request failed.")
    }
  }

  return (
    <div data-testid="settings-privacy-page" className="va-page-wrap">
      <Link to="/settings" className="va-link" style={{ fontSize: "0.875rem" }}>
        ← Back to settings
      </Link>
      <h1 className="va-page-title" style={{ marginTop: "1rem" }}>
        Privacy & data
      </h1>
      <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", lineHeight: 1.45 }}>
        Request access, correction, or deletion of your personal data. For complaints, use the{" "}
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="va-link">
          privacy policy
        </a>{" "}
        contact options.
      </p>

      <div className="va-page-section" style={{ marginTop: "1.25rem" }} data-testid="privacy-request-card-access">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Request my data</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-600)", marginBottom: "1rem", lineHeight: 1.45 }}>
          Submits an access request. Delivery is typically by email as a JSON export, per our processes.
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
          {submitting ? "Submitting…" : "Submit access request"}
        </button>
      </div>

      <div className="va-page-section" style={{ marginTop: "1.25rem" }} data-testid="privacy-request-card-correction">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Request a correction</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-600)", marginBottom: "1rem", lineHeight: 1.45 }}>
          Submits a correction request for personal information in your account.
        </p>
        <button
          type="button"
          data-testid="privacy-submit-correction"
          className="va-btn-primary"
          style={{ width: "100%" }}
          disabled={correcting}
          onClick={() => void submitCorrection()}
        >
          {correcting ? "Submitting…" : "Submit correction request"}
        </button>
      </div>

      <div className="va-page-section" style={{ marginTop: "1.25rem" }} data-testid="privacy-request-card-deletion">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Request data deletion</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-600)", marginBottom: "1rem", lineHeight: 1.45 }}>
          Request deletion of your account data according to applicable retention policies.
        </p>
        <button
          type="button"
          data-testid="privacy-submit-deletion"
          className="va-btn-ghost"
          style={{ width: "100%", color: "var(--va-red-600)", borderColor: "var(--va-red-200)" }}
          disabled={deleting}
          onClick={() => void submitDeletion()}
        >
          {deleting ? "Submitting…" : "Submit deletion request"}
        </button>
      </div>

      {(isLoading || hasRecentRequests) ? (
        <div className="va-page-section" style={{ marginTop: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Your recent requests</h2>
          {isLoading ? (
            <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>Loading…</p>
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
                    <div style={{ fontWeight: 600 }}>{r.requestType || "request"}</div>
                    <div style={{ color: "var(--va-slate-500)", fontSize: "0.75rem", marginTop: 4 }}>
                      {r.status} · {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
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
