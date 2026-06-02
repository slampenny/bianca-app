import { Link } from "react-router-dom"
import { useState } from "react"
import { useListBreachLogsQuery } from "../services/api/adminApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import type { BreachLogStatus } from "../services/api/api.types"
import { AdminHeaderNav } from "../components/AdminHeaderNav"

const STATUS_OPTIONS: BreachLogStatus[] = [
  "INVESTIGATING",
  "FALSE_POSITIVE",
  "SECURITY_EVENT_CONFIRMED",
  "BREACH_CONFIRMED",
  "CLOSED",
]

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function statusClass(status: string) {
  if (status === "INVESTIGATING") return "admin-badge admin-badge--warn"
  if (status === "FALSE_POSITIVE") return "admin-badge"
  if (status === "BREACH_CONFIRMED") return "admin-badge admin-badge--danger"
  if (status === "SECURITY_EVENT_CONFIRMED") return "admin-badge admin-badge--warn"
  return "admin-badge"
}

export function SecurityEventsPage() {
  const authed = useAppSelector(isAuthenticated)

  const [status, setStatus] = useState<string>("")
  const [type, setType] = useState<string>("")
  const [severity, setSeverity] = useState<string>("")
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching, isError, refetch } = useListBreachLogsQuery(
    {
      page,
      limit: 20,
      status: status || undefined,
      type: type || undefined,
      severity: severity || undefined,
    },
    { skip: !authed },
  )

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div>
          <span className="admin-badge">Admin</span>
          <h1 className="admin-header-title">Security events</h1>
          <p className="admin-header-sub">Triage automated HIPAA / security detector alerts</p>
        </div>
        <div className="admin-header-actions">
          <AdminHeaderNav>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </AdminHeaderNav>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-card admin-card--wide">
          <div className="admin-form-row" style={{ marginBottom: "1rem" }}>
            <label className="admin-label">
              Status
              <select className="admin-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
                <option value="">All</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="admin-label">
              Type
              <input className="admin-input" value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} placeholder="off_hours_access" />
            </label>
            <label className="admin-label">
              Severity
              <select className="admin-input" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1) }}>
                <option value="">All</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </label>
          </div>

          {isLoading ? <p className="admin-muted">Loading…</p> : null}
          {isError ? <p className="admin-error" role="alert">Could not load security events.</p> : null}

          {data ? (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Detected</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Jurisdiction</th>
                    <th>Org</th>
                    <th>User</th>
                    <th>IP</th>
                    <th>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link to={`/security-events/${row.id}`} className="admin-link">
                          {formatDate(row.detectedAt)}
                        </Link>
                      </td>
                      <td><span className={statusClass(row.status)}>{row.status}</span></td>
                      <td><code className="admin-code">{row.type}</code></td>
                      <td>{row.severity}</td>
                      <td>{row.jurisdiction}</td>
                      <td>{row.orgName || "—"}</td>
                      <td>{row.userName || row.userEmail || "—"}</td>
                      <td>{row.ipAddress || "—"}</td>
                      <td>{formatDate(row.notificationDeadline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.results.length === 0 ? <p className="admin-muted">No security events matched.</p> : null}
              <div className="admin-form-row" style={{ marginTop: "1rem" }}>
                <button type="button" className="admin-btn admin-btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span className="admin-muted">Page {data.page} of {data.totalPages} ({data.totalResults} total)</span>
                <button type="button" className="admin-btn admin-btn--ghost" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  )
}
