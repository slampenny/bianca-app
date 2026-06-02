import { type FormEvent, useEffect, useState } from "react"
import { useGetOrgQuery, useLazySearchOrgsQuery, usePatchOrgMutation } from "../services/api/adminApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import type { AdminOrgSearchRow } from "../services/api/api.types"
import { AdminHeaderNav } from "../components/AdminHeaderNav"

export function OrgFlagsPage() {
  const authed = useAppSelector(isAuthenticated)

  const [q, setQ] = useState("")
  const [rows, setRows] = useState<AdminOrgSearchRow[]>([])
  const [searchError, setSearchError] = useState("")
  const [searching, setSearching] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [selectedOrgName, setSelectedOrgName] = useState("")

  const [runSearch] = useLazySearchOrgsQuery()
  const { data: orgDetail, isFetching: orgLoading } = useGetOrgQuery(selectedOrgId!, {
    skip: !authed || !selectedOrgId,
  })
  const [patchOrg, { isLoading: saving }] = usePatchOrgMutation()

  const [localDebugAudio, setLocalDebugAudio] = useState(false)
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    if (orgDetail) {
      setLocalDebugAudio(orgDetail.debugAudioUploadEnabled === true)
    }
  }, [orgDetail])

  const handleSearch = async (e?: FormEvent) => {
    e?.preventDefault()
    setSearchError("")
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
    setSaveError("")
  }

  const handleSave = async () => {
    if (!selectedOrgId) return
    setSaveError("")
    try {
      await patchOrg({ orgId: selectedOrgId, body: { debugAudioUploadEnabled: localDebugAudio } }).unwrap()
    } catch {
      setSaveError("Could not update organization. Ensure you are a super administrator.")
    }
  }

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div>
          <span className="admin-badge">Admin</span>
          <h1 className="admin-header-title">Organization flags</h1>
          <p className="admin-header-sub">Per-organization feature toggles (super admin).</p>
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

            {orgLoading && !orgDetail ? (
              <p className="admin-muted">Loading organization…</p>
            ) : (
              <div style={{ maxWidth: 640 }}>
                <p className="admin-muted" style={{ fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "1rem" }}>
                  <strong>Debug audio (S3)</strong> — When enabled, after each Realtime call the backend writes debug ulaw/PCM
                  and uploads it to the configured debug S3 prefix (requires IAM on the app instance). Off by default; use for
                  targeted support investigations. Developers can also set <code className="admin-code">OPENAI_DEBUG_AUDIO=true</code>{" "}
                  in the API environment to record all calls.
                </p>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                    cursor: "pointer",
                    marginBottom: "1rem",
                    fontSize: "0.95rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localDebugAudio}
                    onChange={(e) => setLocalDebugAudio(e.target.checked)}
                  />
                  <span>Enable debug audio upload for this organization</span>
                </label>
                {saveError ? (
                  <p className="admin-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                    {saveError}
                  </p>
                ) : null}
                <button type="button" className="admin-btn admin-btn--primary" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}
