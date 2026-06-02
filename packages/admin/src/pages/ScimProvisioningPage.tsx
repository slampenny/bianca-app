import { type FormEvent, useState } from "react"
import {
  useDisableOrgScimMutation,
  useGetOrgScimStatusQuery,
  useIssueOrgScimTokenMutation,
  useLazySearchOrgsQuery,
} from "../services/api/adminApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import type { AdminOrgSearchRow } from "../services/api/api.types"
import { AdminHeaderNav } from "../components/AdminHeaderNav"

export function ScimProvisioningPage() {
  const authed = useAppSelector(isAuthenticated)

  const [q, setQ] = useState("")
  const [rows, setRows] = useState<AdminOrgSearchRow[]>([])
  const [searchError, setSearchError] = useState("")
  const [searching, setSearching] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [selectedOrgName, setSelectedOrgName] = useState("")
  const [actionError, setActionError] = useState("")
  const [revealedToken, setRevealedToken] = useState<string | null>(null)

  const [runSearch] = useLazySearchOrgsQuery()
  const { data: scimStatus, isFetching: statusLoading } = useGetOrgScimStatusQuery(selectedOrgId!, {
    skip: !authed || !selectedOrgId,
  })
  const [issueToken, { isLoading: issuing }] = useIssueOrgScimTokenMutation()
  const [disableScim, { isLoading: disabling }] = useDisableOrgScimMutation()

  const handleSearch = async (e?: FormEvent) => {
    e?.preventDefault()
    setSearchError("")
    setRevealedToken(null)
    const term = q.trim()
    if (term.length < 2) {
      setSearchError("Enter at least 2 characters (org name, email, or organization id).")
      return
    }
    setSearching(true)
    try {
      const res = await runSearch({ q: term, limit: 25 }).unwrap()
      setRows(res.results)
      if (res.results.length === 0) {
        setSearchError("No organizations matched.")
      }
    } catch {
      setSearchError("Search failed. Check your session and API URL.")
      setRows([])
    } finally {
      setSearching(false)
    }
  }

  const selectOrg = (row: AdminOrgSearchRow) => {
    const id = row.id
    if (!id) return
    setSelectedOrgId(id)
    setSelectedOrgName(row.name)
    setRevealedToken(null)
    setActionError("")
  }

  const handleIssueToken = async () => {
    if (!selectedOrgId) return
    setActionError("")
    setRevealedToken(null)
    try {
      const out = await issueToken(selectedOrgId).unwrap()
      setRevealedToken(out.token)
    } catch {
      setActionError("Could not issue token. Ensure the organization exists.")
    }
  }

  const handleDisable = async () => {
    if (!selectedOrgId) return
    setActionError("")
    setRevealedToken(null)
    try {
      await disableScim(selectedOrgId).unwrap()
    } catch {
      setActionError("Could not disable SCIM for this organization.")
    }
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setActionError("Clipboard copy failed.")
    }
  }

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div>
          <span className="admin-badge">Admin</span>
          <h1 className="admin-header-title">SCIM provisioning</h1>
          <p className="admin-header-sub">
            Enable SCIM 2.0 for an organization so their IdP can provision facility users (caregivers).
          </p>
        </div>
        <div className="admin-header-actions">
          <AdminHeaderNav />
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-card admin-card--wide" style={{ marginBottom: "1rem" }}>
          <h2 className="admin-section-title">Find organization</h2>
          <form
            className="admin-form"
            style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}
            onSubmit={(e) => void handleSearch(e)}
          >
            <label className="admin-label" style={{ flex: "1 1 240px" }}>
              Search
              <input
                className="admin-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, email, or MongoDB id"
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
        </div>

        {rows.length > 0 ? (
          <div className="admin-card admin-card--wide" style={{ marginBottom: "1rem" }}>
            <h2 className="admin-section-title">Results</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Id</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="admin-muted">{r.email}</td>
                    <td>
                      <code className="admin-code">{r.id}</code>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn--primary"
                        onClick={() => selectOrg(r)}
                        disabled={!r.id}
                      >
                        {selectedOrgId === r.id ? "Selected" : "Select"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {selectedOrgId ? (
          <div className="admin-card admin-card--wide">
            <h2 className="admin-section-title">{selectedOrgName || "Organization"}</h2>
            <p className="admin-muted" style={{ marginBottom: "1rem" }}>
              Org id <code className="admin-code">{selectedOrgId}</code>
            </p>

            {statusLoading && !scimStatus ? (
              <p className="admin-muted">Loading status…</p>
            ) : scimStatus ? (
              <ul className="admin-kv" style={{ marginBottom: "1rem" }}>
                <li>
                  <span>SCIM enabled</span>
                  <strong>{scimStatus.enabled ? "Yes" : "No"}</strong>
                </li>
                <li>
                  <span>Token hint</span>
                  <strong>{scimStatus.tokenHint ? `…${scimStatus.tokenHint}` : "—"}</strong>
                </li>
                <li style={{ flexDirection: "column", alignItems: "stretch", gap: "0.35rem" }}>
                  <span>Base URL (for IdP)</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                    <code className="admin-code" style={{ wordBreak: "break-all" }}>
                      {scimStatus.scimBaseUrl}
                    </code>
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      onClick={() => void copyText(scimStatus.scimBaseUrl)}
                    >
                      Copy
                    </button>
                  </div>
                </li>
              </ul>
            ) : null}

            {revealedToken ? (
              <div
                className="admin-card admin-card--warn"
                style={{ marginBottom: "1rem", border: "1px solid rgba(251, 191, 36, 0.35)" }}
              >
                <p className="admin-section-title" style={{ marginTop: 0 }}>
                  Bearer token (copy now)
                </p>
                <p className="admin-muted" style={{ fontSize: "0.8125rem", marginBottom: "0.5rem" }}>
                  This value is shown only once. Store it in your IdP; you cannot retrieve it again without rotating.
                </p>
                <pre className="admin-pre" style={{ marginBottom: "0.5rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {revealedToken}
                </pre>
                <button type="button" className="admin-btn admin-btn--primary" onClick={() => void copyText(revealedToken)}>
                  Copy token
                </button>
              </div>
            ) : null}

            {actionError ? (
              <p className="admin-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                {actionError}
              </p>
            ) : null}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <button type="button" className="admin-btn admin-btn--primary" disabled={issuing} onClick={() => void handleIssueToken()}>
                {scimStatus?.enabled ? "Rotate token" : "Enable SCIM & issue token"}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={disabling || !scimStatus?.enabled}
                onClick={() => void handleDisable()}
              >
                Disable SCIM
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
