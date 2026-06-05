import { useState } from "react"
import {
  useListBackupsQuery,
  useRestoreBackupMutation,
  useTriggerBackupMutation,
} from "../services/api/adminApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"
import type { HipaaBackupRow } from "../services/api/api.types"
import { AdminPageHeader } from "../components/AdminPageHeader"

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

export function BackupsPage() {
  const authed = useAppSelector(isAuthenticated)

  const [prefix, setPrefix] = useState("")
  const [restoreKey, setRestoreKey] = useState<string | null>(null)
  const [restoreConfirmText, setRestoreConfirmText] = useState("")
  const [triggerMessage, setTriggerMessage] = useState("")

  const { data, isLoading, isFetching, isError, error, refetch } = useListBackupsQuery(
    { prefix: prefix || undefined, limit: 200 },
    { skip: !authed },
  )

  const [triggerBackup, { isLoading: triggering }] = useTriggerBackupMutation()
  const [restoreBackup, { isLoading: restoring, isError: restoreError, error: restoreErr }] =
    useRestoreBackupMutation()

  const errMsg = (() => {
    if (!isError) return ""
    const e = error as FetchBaseQueryError
    if (e.status === 403) return "Forbidden — your account is not a super administrator."
    if (e.status === "FETCH_ERROR") return "Network error — is the API running?"
    return "Could not load backups."
  })()

  const restoreErrMsg = (() => {
    if (!restoreError) return ""
    const e = restoreErr as FetchBaseQueryError
    if (typeof e.data === "object" && e.data && "message" in e.data) {
      return String((e.data as { message?: string }).message)
    }
    return "Restore failed."
  })()

  const handleTrigger = async (backupType: "daily" | "weekly" | "monthly") => {
    setTriggerMessage("")
    try {
      const result = await triggerBackup({ backupType }).unwrap()
      setTriggerMessage(
        result.s3Key
          ? `Backup started/completed: ${result.s3Key}${result.sizeMB ? ` (${result.sizeMB} MB)` : ""}`
          : `${backupType} backup request submitted.`,
      )
      void refetch()
    } catch {
      setTriggerMessage("Backup trigger failed — check API logs.")
    }
  }

  const handleRestore = async (row: HipaaBackupRow) => {
    if (restoreConfirmText !== "YES_I_WANT_TO_RESTORE") return
    try {
      await restoreBackup({ backupKey: row.key, confirmRestore: "YES_I_WANT_TO_RESTORE" }).unwrap()
      setRestoreKey(null)
      setRestoreConfirmText("")
      void refetch()
    } catch {
      /* error shown via restoreErrMsg */
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Database backups"
        subtitle="HIPAA encrypted MongoDB backups (S3) — list, trigger, and restore"
        actions={
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--refresh"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      <main className="admin-main">
        {isLoading ? <p className="admin-muted">Loading…</p> : null}
        {isError ? (
          <div className="admin-card admin-card--warn">
            <p className="admin-error" role="alert">
              {errMsg}
            </p>
          </div>
        ) : null}

        {data ? (
          <div className="admin-grid">
            <section className="admin-card admin-card--wide">
              <h2 className="admin-section-title">Environment</h2>
              <p className="admin-muted">
                <code className="admin-code">{data.environment}</code> · bucket{" "}
                <code className="admin-code">{data.bucket}</code> · {data.total} backup(s)
              </p>
              <div className="admin-form-row" style={{ marginTop: "1rem" }}>
                <label className="admin-label">
                  Filter prefix
                  <input
                    className="admin-input"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="daily/ weekly/ monthly/ safety/"
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={triggering}
                  onClick={() => void handleTrigger("daily")}
                >
                  {triggering ? "Running…" : "Run daily backup"}
                </button>
                <button type="button" className="admin-btn admin-btn--ghost" disabled={triggering} onClick={() => void handleTrigger("weekly")}>
                  Weekly
                </button>
                <button type="button" className="admin-btn admin-btn--ghost" disabled={triggering} onClick={() => void handleTrigger("monthly")}>
                  Monthly
                </button>
              </div>
              {triggerMessage ? (
                <p className="admin-muted" style={{ marginTop: "0.75rem" }}>
                  {triggerMessage}
                </p>
              ) : null}
            </section>

            <section className="admin-card admin-card--wide">
              <h2 className="admin-section-title">Backup archives</h2>
              <p className="admin-muted" style={{ marginBottom: "1rem" }}>
                Restore overwrites the live database. A safety backup runs automatically before restore.
              </p>
              {data.backups.length === 0 ? (
                <p className="admin-muted">No backups found yet. Run a daily backup or wait for the scheduled job.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Key</th>
                        <th>Size</th>
                        <th>Modified</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.backups.map((row) => (
                        <tr key={row.key}>
                          <td>
                            <span className="admin-badge">{row.backupType}</span>
                          </td>
                          <td>
                            <code className="admin-code">{row.key}</code>
                          </td>
                          <td>{formatBytes(row.sizeBytes)}</td>
                          <td>{formatDate(row.lastModified)}</td>
                          <td>
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              onClick={() => {
                                setRestoreKey(row.key)
                                setRestoreConfirmText("")
                              }}
                            >
                              Restore…
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : null}

        {restoreKey ? (
          <div className="admin-modal-backdrop" role="presentation" onClick={() => setRestoreKey(null)}>
            <div
              className="admin-card admin-card--warn"
              role="dialog"
              aria-labelledby="restore-title"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "32rem", margin: "2rem auto" }}
            >
              <h2 id="restore-title" className="admin-section-title">
                Confirm database restore
              </h2>
              <p className="admin-error">
                This will replace the current MongoDB data with the selected backup. The application may be unavailable
                during restore.
              </p>
              <p className="admin-muted">
                Backup: <code className="admin-code">{restoreKey}</code>
              </p>
              <label className="admin-label" style={{ display: "block", marginTop: "1rem" }}>
                Type <code className="admin-code">YES_I_WANT_TO_RESTORE</code> to confirm
                <input
                  className="admin-input"
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </label>
              {restoreErrMsg ? (
                <p className="admin-error" role="alert" style={{ marginTop: "0.75rem" }}>
                  {restoreErrMsg}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
                <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setRestoreKey(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={restoreConfirmText !== "YES_I_WANT_TO_RESTORE" || restoring}
                  onClick={() => {
                    const row = data?.backups.find((b) => b.key === restoreKey)
                    if (row) void handleRestore(row)
                  }}
                >
                  {restoring ? "Restoring…" : "Restore database"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </>
  )
}
