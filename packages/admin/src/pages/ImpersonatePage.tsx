import { type FormEvent, useCallback, useState } from "react"
import { Link } from "react-router-dom"
import { SESSION_HANDOFF_MESSAGE_TYPE } from "../sessionHandoff"
import { useImpersonateCaregiverMutation, useLazySearchCaregiversQuery } from "../services/api/adminApi"
import type { AdminCaregiverSearchRow } from "../services/api/api.types"

function facilityAppUrl(): string {
  const u = import.meta.env.VITE_FACILITY_APP_URL || "http://localhost:5173/"
  return u.endsWith("/") ? u : `${u}/`
}

function facilityAppOrigin(): string {
  return new URL(facilityAppUrl()).origin
}

export function ImpersonatePage() {
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<AdminCaregiverSearchRow[]>([])
  const [searchError, setSearchError] = useState("")
  const [handoffError, setHandoffError] = useState("")
  const [searching, setSearching] = useState(false)

  const [runSearch] = useLazySearchCaregiversQuery()
  const [impersonate, { isLoading: impersonating }] = useImpersonateCaregiverMutation()

  const handleSearch = async (e?: FormEvent) => {
    e?.preventDefault()
    setSearchError("")
    setHandoffError("")
    const term = q.trim()
    if (term.length < 2) {
      setSearchError("Enter at least 2 characters (name, email, or caregiver id).")
      return
    }
    setSearching(true)
    try {
      const res = await runSearch({ q: term, limit: 25 }).unwrap()
      setRows(res.results)
      if (res.results.length === 0) {
        setSearchError("No caregivers matched.")
      }
    } catch {
      setSearchError("Search failed. Check your session and API URL.")
      setRows([])
    } finally {
      setSearching(false)
    }
  }

  const openFacilityAs = useCallback(
    async (caregiverId: string) => {
      setHandoffError("")
      try {
        const data = await impersonate({ caregiverId }).unwrap()
        const url = facilityAppUrl()
        const origin = facilityAppOrigin()
        const win = window.open(url, "_blank")
        if (!win) {
          setHandoffError("Popup was blocked. Allow popups for this site, then try again.")
          return
        }
        const payload = {
          tokens: data.tokens,
          caregiver: data.caregiver,
          org: data.org ?? undefined,
        }
        const sendHandoff = () => {
          try {
            win.postMessage({ type: SESSION_HANDOFF_MESSAGE_TYPE, payload }, origin)
          } catch {
            /* window may not be ready */
          }
        }
        sendHandoff()
        let tries = 0
        const id = window.setInterval(() => {
          tries += 1
          if (!win || win.closed || tries > 60) {
            window.clearInterval(id)
            return
          }
          sendHandoff()
        }, 200)
      } catch {
        setHandoffError("Impersonation failed. You cannot impersonate super admins or locked accounts.")
      }
    },
    [impersonate],
  )

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div>
          <span className="admin-badge">Admin</span>
          <h1 className="admin-header-title">Sign in as user</h1>
          <p className="admin-header-sub">
            Search for a caregiver, then open the facility app with their session. Audited as IMPERSONATION. Facility app must
            allow this admin origin (dev: <code className="admin-code">localhost:5174</code> is accepted automatically; prod: set{" "}
            <code className="admin-code">VITE_ADMIN_APP_ORIGIN</code>).
          </p>
        </div>
        <div className="admin-header-actions">
          <Link to="/" className="admin-btn admin-btn--ghost">
            Observability
          </Link>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-card admin-card--wide" style={{ marginBottom: "1rem" }}>
          <form className="admin-form" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }} onSubmit={(e) => void handleSearch(e)}>
            <label className="admin-label" style={{ flex: "1 1 240px" }}>
              Search
              <input
                className="admin-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Email, name, or MongoDB id"
                autoComplete="off"
              />
            </label>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {searchError ? (
            <p className="admin-error" role="alert" style={{ marginTop: "0.75rem" }}>
              {searchError}
            </p>
          ) : null}
          {handoffError ? (
            <p className="admin-error" role="alert" style={{ marginTop: "0.75rem" }}>
              {handoffError}
            </p>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div className="admin-card admin-card--wide">
            <h2 className="admin-section-title">Results</h2>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Org</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id || r.email}>
                      <td>{r.name}</td>
                      <td>{r.email}</td>
                      <td>
                        <code className="admin-code">{r.role}</code>
                      </td>
                      <td>{r.orgName ?? "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-btn admin-btn--primary"
                          disabled={impersonating || !r.id}
                          onClick={() => r.id && void openFacilityAs(r.id)}
                        >
                          Open facility app as…
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
