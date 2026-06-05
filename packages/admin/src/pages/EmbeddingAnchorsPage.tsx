import { useState } from "react"
import {
  useCreateEmbeddingAnchorPhraseMutation,
  useDeleteEmbeddingAnchorPhraseMutation,
  useGetEmbeddingAnchorPhrasesQuery,
  useMergeEmbeddingAnchorDefaultsMutation,
  useUpdateEmbeddingAnchorPhraseMutation,
} from "../services/api/adminApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import type { EmbeddingAnchorDetector, EmbeddingAnchorPhraseRow } from "../services/api/api.types"
import { AdminPageHeader } from "../components/AdminPageHeader"

const DETECTORS: { value: EmbeddingAnchorDetector; label: string }[] = [
  { value: "emergencyDetector", label: "Emergency" },
  { value: "abuseNeglectDetector", label: "Abuse / neglect" },
  { value: "financialExploitationDetector", label: "Financial exploitation" },
  { value: "relationshipPatternDetector", label: "Relationship patterns" },
]

const ABUSE_CATS = ["physical", "emotional", "neglect"] as const

export function EmbeddingAnchorsPage() {
  const authed = useAppSelector(isAuthenticated)

  const [filterDetector, setFilterDetector] = useState<string>("")
  const { data: rows = [], isLoading, error, refetch } = useGetEmbeddingAnchorPhrasesQuery(
    filterDetector ? { detector: filterDetector } : undefined,
    { skip: !authed }
  )

  const [createRow, { isLoading: creating }] = useCreateEmbeddingAnchorPhraseMutation()
  const [updateRow, { isLoading: updating }] = useUpdateEmbeddingAnchorPhraseMutation()
  const [deleteRow, { isLoading: deleting }] = useDeleteEmbeddingAnchorPhraseMutation()
  const [mergeDefaults, { isLoading: merging }] = useMergeEmbeddingAnchorDefaultsMutation()

  const [editing, setEditing] = useState<EmbeddingAnchorPhraseRow | null>(null)
  const [form, setForm] = useState({
    detector: "financialExploitationDetector" as EmbeddingAnchorDetector,
    category: "" as string,
    bucket: "",
    phrase: "",
    emergencySeverity: "HIGH" as "CRITICAL" | "HIGH" | "MEDIUM",
    emergencyCategory: "",
  })

  const resetForm = () => {
    setForm({
      detector: "financialExploitationDetector",
      category: "",
      bucket: "",
      phrase: "",
      emergencySeverity: "HIGH",
      emergencyCategory: "",
    })
  }

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.bucket.trim() || !form.phrase.trim()) return
    const body: Record<string, unknown> = {
      detector: form.detector,
      bucket: form.bucket.trim(),
      phrase: form.phrase.trim(),
    }
    if (form.detector === "abuseNeglectDetector") {
      if (!form.category) {
        window.alert("Category is required for abuse/neglect")
        return
      }
      body.category = form.category
    }
    if (form.detector === "emergencyDetector") {
      body.emergencySeverity = form.emergencySeverity
      body.emergencyCategory = form.emergencyCategory.trim() || "medical_emergency"
    }
    try {
      await createRow(body as never).unwrap()
      resetForm()
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "data" in err ? String((err as { data?: { message?: string } }).data?.message) : "Create failed"
      window.alert(msg)
    }
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const body: Record<string, unknown> = {
      bucket: editing.bucket,
      phrase: editing.phrase,
      isActive: editing.isActive,
    }
    if (editing.detector === "abuseNeglectDetector" && editing.category) {
      body.category = editing.category
    }
    if (editing.detector === "emergencyDetector") {
      if (editing.emergencySeverity) body.emergencySeverity = editing.emergencySeverity
      if (editing.emergencyCategory) body.emergencyCategory = editing.emergencyCategory
    }
    try {
      await updateRow({ phraseId: editing._id, body: body as never }).unwrap()
      setEditing(null)
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "data" in err ? String((err as { data?: { message?: string } }).data?.message) : "Update failed"
      window.alert(msg)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this anchor phrase? Detection will reload on the API server.")) return
    try {
      await deleteRow(id).unwrap()
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "data" in err ? String((err as { data?: { message?: string } }).data?.message) : "Delete failed"
      window.alert(msg)
    }
  }

  const handleMerge = async () => {
    if (!window.confirm("Add any default phrases that are missing? Existing custom phrases are kept.")) return
    try {
      const r = await mergeDefaults().unwrap()
      window.alert(`Merged ${r.merged} missing default phrase(s).`)
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "data" in err ? String((err as { data?: { message?: string } }).data?.message) : "Merge failed"
      window.alert(msg)
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Embedding anchor phrases"
        subtitle="OpenAI text-embedding-3-large — edit phrases used for similarity in fraud & safety detectors"
        actions={
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--refresh"
            onClick={() => void refetch()}
            disabled={isLoading}
          >
            Refresh
          </button>
        }
      />

      <main className="admin-main">
        {error && (
          <p className="admin-muted" style={{ marginBottom: "1rem" }}>
            Could not load phrases. Ensure you are a super administrator and the API is running.
          </p>
        )}

        <div className="admin-card admin-card--wide" style={{ marginBottom: "1.25rem" }}>
          <h2 className="admin-title" style={{ fontSize: "1.1rem" }}>
            Add phrase
          </h2>
          <form onSubmit={submitCreate} className="ea-form">
            <div className="ea-form-row">
              <label>
                <span>Detector</span>
                <select
                  className="admin-input"
                  value={form.detector}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, detector: e.target.value as EmbeddingAnchorDetector }))
                  }
                >
                  {DETECTORS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.detector === "abuseNeglectDetector" && (
                <label>
                  <span>Abuse category</span>
                  <select
                    className="admin-input"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    required
                  >
                    <option value="">—</option>
                    {ABUSE_CATS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {form.detector === "emergencyDetector" && (
                <>
                  <label>
                    <span>Severity</span>
                    <select
                      className="admin-input"
                      value={form.emergencySeverity}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          emergencySeverity: e.target.value as "CRITICAL" | "HIGH" | "MEDIUM",
                        }))
                      }
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                    </select>
                  </label>
                  <label className="ea-form-grow">
                    <span>Emergency category (e.g. medical_emergency, Request)</span>
                    <input
                      className="admin-input"
                      value={form.emergencyCategory}
                      onChange={(e) => setForm((f) => ({ ...f, emergencyCategory: e.target.value }))}
                      placeholder="medical_emergency"
                      required
                    />
                  </label>
                </>
              )}
              <label>
                <span>Bucket</span>
                <input
                  className="admin-input"
                  value={form.bucket}
                  onChange={(e) => setForm((f) => ({ ...f, bucket: e.target.value }))}
                  placeholder="e.g. scamIndicators"
                  required
                />
              </label>
            </div>
            <label className="ea-form-grow" style={{ display: "block", width: "100%" }}>
              <span>Phrase text</span>
              <textarea
                className="admin-input"
                style={{ minHeight: "4rem", width: "100%" }}
                value={form.phrase}
                onChange={(e) => setForm((f) => ({ ...f, phrase: e.target.value }))}
                placeholder="Anchor text embedded with OpenAI (max 8000 chars)"
                maxLength={8000}
                required
              />
            </label>
            <div className="ea-form-actions">
              <button type="submit" className="admin-btn admin-btn--primary" disabled={creating}>
                {creating ? "Adding…" : "Add phrase"}
              </button>
            </div>
          </form>
        </div>

        <div
          className="admin-card admin-card--wide"
          style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}
        >
          <label>
            Filter
            <select
              className="admin-input"
              style={{ marginLeft: "0.5rem" }}
              value={filterDetector}
              onChange={(e) => setFilterDetector(e.target.value)}
            >
              <option value="">All detectors</option>
              {DETECTORS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => void handleMerge()}
            disabled={merging}
          >
            {merging ? "Merging…" : "Merge missing default phrases"}
          </button>
        </div>

        <div className="admin-card admin-card--wide" style={{ marginTop: "1rem" }}>
          <h2 className="admin-title" style={{ fontSize: "1.1rem" }}>
            Phrases ({rows.length})
          </h2>
          {isLoading && <p className="admin-muted">Loading…</p>}
          {!isLoading && rows.length === 0 && <p className="admin-muted">No rows (seed runs when the collection is empty).</p>}
          {rows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Detector</th>
                    <th>Category</th>
                    <th>Bucket</th>
                    <th>Phrase</th>
                    <th>Order</th>
                    <th>Emergency</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id}>
                      <td>
                        <code className="ea-mono">{r.detector}</code>
                      </td>
                      <td>{r.category ?? "—"}</td>
                      <td>
                        <code className="ea-mono">{r.bucket}</code>
                      </td>
                      <td style={{ maxWidth: "28rem", whiteSpace: "pre-wrap" }}>{r.phrase}</td>
                      <td>{r.order}</td>
                      <td>
                        {r.detector === "emergencyDetector"
                          ? `${r.emergencySeverity ?? "—"} / ${r.emergencyCategory ?? "—"}`
                          : "—"}
                      </td>
                      <td>{r.isActive ? "yes" : "no"}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          onClick={() => setEditing({ ...r })}
                        >
                          Edit
                        </button>{" "}
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          disabled={deleting}
                          onClick={() => void handleDelete(r._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {editing && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit phrase">
          <div className="admin-card admin-card--narrow admin-modal" style={{ maxWidth: "min(32rem, 100vw - 2rem)" }}>
            <h2 className="admin-title" style={{ fontSize: "1.1rem" }}>
              Edit phrase
            </h2>
            <form onSubmit={saveEdit}>
              <label style={{ display: "block", marginBottom: "0.75rem" }}>
                Bucket
                <input
                  className="admin-input"
                  style={{ width: "100%" }}
                  value={editing.bucket}
                  onChange={(e) => setEditing((v) => (v ? { ...v, bucket: e.target.value } : v))}
                  required
                />
              </label>
              <label style={{ display: "block", marginBottom: "0.75rem" }}>
                Phrase
                <textarea
                  className="admin-input"
                  style={{ width: "100%", minHeight: "5rem" }}
                  value={editing.phrase}
                  onChange={(e) => setEditing((v) => (v ? { ...v, phrase: e.target.value } : v))}
                  required
                />
              </label>
              {editing.detector === "emergencyDetector" && (
                <div className="ea-form-row" style={{ marginBottom: "0.75rem" }}>
                  <label>
                    Severity
                    <select
                      className="admin-input"
                      value={editing.emergencySeverity || "HIGH"}
                      onChange={(e) =>
                        setEditing((v) =>
                          v
                            ? {
                                ...v,
                                emergencySeverity: e.target.value as "CRITICAL" | "HIGH" | "MEDIUM",
                              }
                            : v
                        )
                      }
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                    </select>
                  </label>
                  <label className="ea-form-grow">
                    Category
                    <input
                      className="admin-input"
                      value={editing.emergencyCategory || ""}
                      onChange={(e) =>
                        setEditing((v) => (v ? { ...v, emergencyCategory: e.target.value } : v))
                      }
                    />
                  </label>
                </div>
              )}
              <label style={{ display: "block", marginBottom: "0.75rem" }}>
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(e) => setEditing((v) => (v ? { ...v, isActive: e.target.checked } : v))}
                />{" "}
                Active
              </label>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={updating}>
                  {updating ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .ea-form { display: flex; flex-direction: column; gap: 0.75rem; }
        .ea-form-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; }
        .ea-form-row label, .ea-form > label { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
        .ea-form-grow { flex: 1 1 12rem; }
        .ea-form-actions { display: flex; justify-content: flex-end; }
        .ea-mono { font-size: 0.75rem; }
        .admin-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .admin-table th, .admin-table td { border: 1px solid rgba(148, 163, 184, 0.15); padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
        .admin-input { background: #0f172a; color: #e2e8f0; border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 6px; padding: 0.35rem 0.5rem; font: inherit; }
        .admin-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
        .admin-modal { z-index: 101; }
      `}</style>
    </>
  )
}
