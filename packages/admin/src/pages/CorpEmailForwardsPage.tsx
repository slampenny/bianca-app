import { type FormEvent, useEffect, useMemo, useState } from "react"
import {
  useGetCorpEmailForwardsQuery,
  useSaveCorpEmailForwardsMutation,
} from "../services/api/adminApi"
import type { CorpEmailForwardStaffRow, SaveCorpEmailForwardsResult } from "../services/api/api.types"
import { AdminHeaderNav } from "../components/AdminHeaderNav"

type EditableRow = CorpEmailForwardStaffRow & {
  forwardToDraft: string
}

function rowsFromPayload(staff: CorpEmailForwardStaffRow[]): EditableRow[] {
  return staff.map((s) => ({
    ...s,
    forwardToDraft: s.forwardToEmail || "",
  }))
}

export function CorpEmailForwardsPage() {
  const { data, isLoading, isError, refetch } = useGetCorpEmailForwardsQuery()
  const [save, { isLoading: saving }] = useSaveCorpEmailForwardsMutation()

  const [rows, setRows] = useState<EditableRow[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [saveResults, setSaveResults] = useState<SaveCorpEmailForwardsResult[] | null>(null)

  useEffect(() => {
    if (data?.staff) {
      setRows(rowsFromPayload(data.staff))
    }
  }, [data])

  const dirty = useMemo(() => {
    if (!data?.staff) return false
    const initial = rowsFromPayload(data.staff)
    if (initial.length !== rows.length) return true
    return rows.some((r, i) => {
      const a = initial[i]
      if (!a) return true
      const draft = r.forwardToDraft.trim().toLowerCase() || null
      const saved = (a.forwardToEmail || "").trim().toLowerCase() || null
      return draft !== saved || r.corpEmail !== a.corpEmail
    })
  }, [data, rows])

  const updateRow = (index: number, patch: Partial<EditableRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    setMessage("")
    setError("")
    setSaveResults(null)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setMessage("")
    setError("")
    setSaveResults(null)

    const forwards = rows
      .filter((r) => r.corpEmail.trim())
      .map((r) => ({
        caregiverId: r.caregiverId || undefined,
        corpEmail: r.corpEmail.trim().toLowerCase(),
        forwardToEmail: r.forwardToDraft.trim() || null,
      }))

    if (forwards.length === 0) {
      setError("No staff rows with a corp email address.")
      return
    }

    try {
      const res = await save({ forwards }).unwrap()
      setSaveResults(res.results)
      const changed = res.results.filter((r) => r.forwardChanged)
      if (changed.length === 0) {
        setMessage("No forwarding changes detected — nothing to sync.")
      } else {
        const notified = changed.filter((r) => r.notificationSent).length
        const zohoOk = changed.filter((r) => r.zoho?.synced).length
        setMessage(
          `Saved ${changed.length} forwarding change(s). Zoho sync: ${zohoOk}/${changed.length}. Setup emails sent: ${notified}/${changed.length}.`,
        )
      }
      await refetch()
    } catch {
      setError("Save failed. Check your session and API URL.")
    }
  }

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div>
          <span className="admin-badge">Admin</span>
          <h1 className="admin-header-title">Corp email forwarding</h1>
          <p className="admin-header-sub">
            Forward <code className="admin-code">@{data?.domain || "biancatechnologies.com"}</code> mailboxes to
            personal inboxes (Gmail, etc.)
          </p>
        </div>
        <div className="admin-header-actions">
          <AdminHeaderNav />
        </div>
      </header>

      <main className="admin-main">
        {isLoading ? <p className="admin-muted">Loading staff…</p> : null}
        {isError ? (
          <div className="admin-card admin-card--warn">
            <p className="admin-error" role="alert">
              Could not load corp email forwards.
            </p>
          </div>
        ) : null}

        {data ? (
          <section className="admin-card admin-card--wide">
            <p className="admin-muted" style={{ marginBottom: "1rem" }}>
              Zoho Mail API:{" "}
              <strong>{data.zohoConfigured ? "configured" : "not configured"}</strong>
              {!data.zohoConfigured ? (
                <>
                  {" "}
                  — forwarding rules are stored in the database only until Zoho credentials are set on the API.
                </>
              ) : null}
            </p>

            <form onSubmit={(ev) => void handleSave(ev)}>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Login email</th>
                      <th>Corp mailbox</th>
                      <th>Forward to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.caregiverId || row.corpEmail}>
                        <td>{row.name}</td>
                        <td className="admin-muted">{row.loginEmail || "—"}</td>
                        <td>
                          <input
                            type="email"
                            className="admin-input"
                            value={row.corpEmail}
                            onChange={(e) => updateRow(index, { corpEmail: e.target.value })}
                            required
                            aria-label={`Corp mailbox for ${row.name}`}
                          />
                        </td>
                        <td>
                          <input
                            type="email"
                            className="admin-input"
                            placeholder="e.g. you@gmail.com"
                            value={row.forwardToDraft}
                            onChange={(e) => updateRow(index, { forwardToDraft: e.target.value })}
                            aria-label={`Forward destination for ${row.corpEmail}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {message ? (
                <p className="admin-success" role="status" style={{ marginTop: "1rem" }}>
                  {message}
                </p>
              ) : null}
              {error ? (
                <p className="admin-error" role="alert" style={{ marginTop: "1rem" }}>
                  {error}
                </p>
              ) : null}

              {saveResults?.length ? (
                <details style={{ marginTop: "1rem" }}>
                  <summary className="admin-muted">Save details</summary>
                  <ul className="admin-kv" style={{ marginTop: "0.5rem" }}>
                    {saveResults.map((r) => (
                      <li key={r.corpEmail}>
                        <span>{r.corpEmail}</span>
                        <strong>
                          {r.ok
                            ? r.forwardChanged
                              ? `changed${r.notificationSent ? ", notified" : ""}${r.zoho?.synced ? ", zoho ok" : r.zoho?.reason ? `, zoho: ${r.zoho.reason}` : ""}`
                              : "unchanged"
                            : r.error || "failed"}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={saving || !dirty}
                >
                  {saving ? "Saving…" : "Save forwarding"}
                </button>
                {!dirty ? (
                  <span className="admin-muted">Edit a forward address, then save.</span>
                ) : (
                  <span className="admin-muted">
                    Changed rows will sync to Zoho (if configured) and send a setup email to the corp mailbox.
                  </span>
                )}
              </div>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  )
}