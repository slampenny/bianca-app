import { type FormEvent, useCallback, useState } from "react"
import { Link } from "react-router-dom"
import { SESSION_HANDOFF_MESSAGE_TYPE } from "../sessionHandoff"
import {
  useImpersonateCaregiverMutation,
  useLazySearchCaregiversQuery,
  useUpdateCaregiverRoleMutation,
} from "../services/api/adminApi"
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
  const [updateRole, { isLoading: roleUpdating }] = useUpdateCaregiverRoleMutation()

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
          <h1 className="admin-header-title">Users &amp; impersonation</h1>
          <p className="admin-header-sub">
            Search for a caregiver by name or email, then open the facility app as them (audited as IMPERSONATION) or change
            super-admin access (audited as SUPERADMIN_ROLE_CHANGE). Facility app must allow this admin origin (dev:{" "}
            <code className="admin-code">localhost:5174</code>; prod: <code className="admin-code">VITE_ADMIN_APP_ORIGIN</code>).
          </p>
        </div>
        <div className="admin-header-actions">
          <Link to="/scim" className="admin-btn admin-btn--ghost">
            SCIM
          </Link>
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
                    <th>Super admin</th>
                    <th>Facility app</th>
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
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                          {r.role !== "superAdmin" ? (
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              disabled={roleUpdating || !r.id || r.role === "invited"}
                              title={r.role === "invited" ? "Complete invite before promoting" : "Grant super-admin access"}
                              onClick={() => {
                                if (!r.id || r.role === "invited") return
                                void (async () => {
                                  setHandoffError("")
                                  try {
                                    await updateRole({ caregiverId: r.id, role: "superAdmin" }).unwrap()
                                    await handleSearch()
                                  } catch {
                                    setHandoffError("Could not promote to super admin.")
                                  }
                                })()
                              }}
                            >
                              Promote
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              disabled={roleUpdating || !r.id}
                              title="Remove super-admin access (becomes org admin)"
                              onClick={() => {
                                if (!r.id) return
                                if (!window.confirm("Demote this user from super admin to org admin?")) return
                                void (async () => {
                                  setHandoffError("")
                                  try {
                                    await updateRole({ caregiverId: r.id, role: "orgAdmin" }).unwrap()
                                    await handleSearch()
                                  } catch {
                                    setHandoffError(
                                      "Could not demote (e.g. last super admin, or network error).",
                                    )
                                  }
                                })()
                              }}
                            >
                              Demote
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-btn admin-btn--primary"
                          disabled={impersonating || !r.id || r.role === "superAdmin"}
                          title={r.role === "superAdmin" ? "Cannot impersonate other super admins" : undefined}
                          onClick={() => r.id && void openFacilityAs(r.id)}
                        >
                          Open as…
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
