import { useState } from "react"
import { Link } from "react-router-dom"
import { PRIVACY_POLICY_URL } from "../config/legal"
import { useCreateAccessRequestMutation, useGetPrivacyRequestsQuery } from "../services/api/privacyApi"
import "../app.css"

export function SettingsPrivacyPage() {
  const { data: pages, isLoading } = useGetPrivacyRequestsQuery({ page: 1, limit: 20 })
  const [createAccess, { isLoading: submitting }] = useCreateAccessRequestMutation()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

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

  return (
    <div data-testid="settings-privacy-page" style={{ maxWidth: 560, margin: "0 auto" }}>
      <Link to="/settings" className="va-link" style={{ fontSize: "0.875rem" }}>
        ← Back to settings
      </Link>
      <h1 className="va-page-title" style={{ marginTop: "1rem" }}>
        Privacy & data
      </h1>
      <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", lineHeight: 1.45 }}>
        Request a copy of your personal data (access request). For corrections, complaints, or deletion, use the{" "}
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="va-link">
          privacy policy
        </a>{" "}
        contact options or the mobile app’s full privacy tools.
      </p>

      <div className="va-card va-card-pad" style={{ marginTop: "1.25rem" }}>
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
        <button type="button" className="va-btn-primary" style={{ width: "100%" }} disabled={submitting} onClick={() => void submitAccess()}>
          {submitting ? "Submitting…" : "Submit access request"}
        </button>
      </div>

      <div className="va-card va-card-pad" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Your recent requests</h2>
        {isLoading ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>Loading…</p>
        ) : !pages?.results?.length ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>No requests yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pages.results.map((r) => {
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
    </div>
  )
}
