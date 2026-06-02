import { Link, useParams } from "react-router-dom"
import { useEffect, useState } from "react"
import {
  useGetBreachLogQuery,
  useUpdateBreachLogStatusMutation,
} from "../services/api/adminApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import type { BreachLogStatus } from "../services/api/api.types"
import { AdminHeaderNav } from "../components/AdminHeaderNav"

const RESOLUTION_REASONS = [
  { value: "timezone_false_positive", label: "Timezone false positive" },
  { value: "legitimate_access", label: "Legitimate access" },
  { value: "detector_bug", label: "Detector bug" },
  { value: "user_error", label: "User error" },
  { value: "confirmed_unauthorized_access", label: "Confirmed unauthorized access" },
  { value: "confirmed_breach", label: "Confirmed breach" },
  { value: "other", label: "Other" },
]

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

export function SecurityEventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const authed = useAppSelector(isAuthenticated)

  const { data, isLoading, isError, refetch } = useGetBreachLogQuery(id!, { skip: !authed || !id })
  const [updateStatus, { isLoading: saving }] = useUpdateBreachLogStatusMutation()

  const [selectedStatus, setSelectedStatus] = useState<BreachLogStatus>("FALSE_POSITIVE")
  const [resolutionReason, setResolutionReason] = useState("timezone_false_positive")
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [saveError, setSaveError] = useState("")
  const [saveSuccess, setSaveSuccess] = useState("")

  useEffect(() => {
    if (data?.resolutionNotes) {
      setResolutionNotes(data.resolutionNotes)
    }
    if (data?.resolutionReason) {
      setResolutionReason(data.resolutionReason)
    }
    if (data?.status) {
      setSelectedStatus(data.status as BreachLogStatus)
    }
  }, [data])

  const submitStatus = async (status: BreachLogStatus) => {
    if (!id) return
    setSaveError("")
    setSaveSuccess("")
    try {
      await updateStatus({
        id,
        body: {
          status,
          resolutionNotes: resolutionNotes.trim() || undefined,
          resolutionReason: resolutionReason || undefined,
        },
      }).unwrap()
      setSaveSuccess(`Updated to ${status}`)
      void refetch()
    } catch {
      setSaveError("Could not update investigation. Check required notes for this status.")
    }
  }

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div>
          <span className="admin-badge">Admin</span>
          <h1 className="admin-header-title">Security event detail</h1>
          <p className="admin-header-sub">{id}</p>
        </div>
        <div className="admin-header-actions">
          <AdminHeaderNav>
            <Link to="/security-events" className="admin-btn admin-btn--ghost">
              Back to list
            </Link>
          </AdminHeaderNav>
        </div>
      </header>

      <main className="admin-main">
        {isLoading ? <p className="admin-muted">Loading…</p> : null}
        {isError ? <p className="admin-error" role="alert">Could not load security event.</p> : null}

        {data ? (
          <div className="admin-grid">
            <section className="admin-card admin-card--wide">
              <h2 className="admin-section-title">Alert summary</h2>
              <dl className="admin-dl">
                <dt>Status</dt><dd>{data.status}</dd>
                <dt>Type</dt><dd><code className="admin-code">{data.type}</code></dd>
                <dt>Severity</dt><dd>{data.severity}</dd>
                <dt>Jurisdiction</dt><dd>{data.jurisdiction} ({data.organizationCountry || "—"})</dd>
                <dt>Detected</dt><dd>{formatDate(data.detectedAt)}</dd>
                <dt>Details</dt><dd>{data.details}</dd>
                <dt>Org</dt><dd>{data.org?.name || data.orgName || "—"} {data.org?.timezone ? `(${data.org.timezone})` : ""}</dd>
                <dt>User</dt><dd>{data.userName || "—"} {data.userEmail ? `· ${data.userEmail}` : ""} {data.userRole ? `· ${data.userRole}` : ""}</dd>
                <dt>IP</dt><dd>{data.ipAddress || "—"}</dd>
                <dt>Resources</dt><dd>{data.affectedResourceType || "—"} {data.affectedResourceIds?.length ? `· ${data.affectedResourceIds.join(", ")}` : ""}</dd>
                <dt>Notification deadline</dt><dd>{formatDate(data.notificationDeadline)}</dd>
              </dl>
            </section>

            {data.alertSnapshot ? (
              <section className="admin-card admin-card--wide">
                <h2 className="admin-section-title">Original alert email</h2>
                <p><strong>{data.alertSnapshot.subject}</strong></p>
                <pre className="admin-pre">{data.alertSnapshot.text}</pre>
              </section>
            ) : null}

            <section className="admin-card admin-card--wide">
              <h2 className="admin-section-title">Related audit logs (±15 min)</h2>
              {data.relatedAuditLogs.length === 0 ? (
                <p className="admin-muted">No related audit logs found.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Resource</th>
                      <th>Outcome</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.relatedAuditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.timestamp)}</td>
                        <td>{log.action}</td>
                        <td>{log.resource} / {log.resourceId}</td>
                        <td>{log.outcome}</td>
                        <td>{log.ipAddress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="admin-card admin-card--wide">
              <h2 className="admin-section-title">Status history</h2>
              {data.statusHistory.length === 0 ? (
                <p className="admin-muted">No status changes recorded.</p>
              ) : (
                <ul className="admin-list">
                  {data.statusHistory.map((entry, index) => (
                    <li key={`${entry.changedAt}-${index}`}>
                      <strong>{entry.status}</strong> · {formatDate(entry.changedAt)}
                      {entry.resolutionReason ? ` · ${entry.resolutionReason}` : ""}
                      {entry.notes ? <div className="admin-muted">{entry.notes}</div> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="admin-card admin-card--wide">
              <h2 className="admin-section-title">Resolution</h2>
              <div className="admin-form-row">
                <label className="admin-label admin-label--wide">
                  Status
                  <select className="admin-input" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as BreachLogStatus)}>
                    <option value="INVESTIGATING">INVESTIGATING</option>
                    <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
                    <option value="SECURITY_EVENT_CONFIRMED">SECURITY_EVENT_CONFIRMED</option>
                    <option value="BREACH_CONFIRMED">BREACH_CONFIRMED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </label>
                <label className="admin-label admin-label--wide">
                  Resolution reason
                  <select className="admin-input" value={resolutionReason} onChange={(e) => setResolutionReason(e.target.value)}>
                    {RESOLUTION_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="admin-label admin-label--wide">
                Resolution notes
                <textarea
                  className="admin-input admin-textarea"
                  rows={5}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Required for FALSE_POSITIVE, BREACH_CONFIRMED, and CLOSED"
                />
              </label>
              {saveError ? <p className="admin-error" role="alert">{saveError}</p> : null}
              {saveSuccess ? <p className="admin-muted">{saveSuccess}</p> : null}
              <div className="admin-form-row">
                <button type="button" className="admin-btn" disabled={saving} onClick={() => void submitStatus(selectedStatus)}>
                  {saving ? "Saving…" : "Save resolution"}
                </button>
                <button type="button" className="admin-btn admin-btn--ghost" disabled={saving} onClick={() => void submitStatus("FALSE_POSITIVE")}>
                  Mark false positive
                </button>
                <button type="button" className="admin-btn admin-btn--ghost" disabled={saving} onClick={() => void submitStatus("SECURITY_EVENT_CONFIRMED")}>
                  Confirm security event
                </button>
                <button type="button" className="admin-btn admin-btn--ghost" disabled={saving} onClick={() => void submitStatus("BREACH_CONFIRMED")}>
                  Confirm breach
                </button>
                <button type="button" className="admin-btn admin-btn--ghost" disabled={saving} onClick={() => void submitStatus("CLOSED")}>
                  Close investigation
                </button>
              </div>
              {data.resolvedAt ? (
                <p className="admin-muted" style={{ marginTop: "1rem" }}>
                  Resolved {formatDate(data.resolvedAt)}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  )
}
