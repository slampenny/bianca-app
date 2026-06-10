import { type FormEvent, useEffect, useState } from "react"
import { useGetOrgQuery, useLazySearchOrgsQuery, usePatchOrgMutation } from "../services/api/adminApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import type { AdminOrgSearchRow, RequiredCallQuestion } from "../services/api/api.types"
import { AdminPageHeader } from "../components/AdminPageHeader"

const MAX_QUESTIONS = 10

function cloneQuestions(questions: RequiredCallQuestion[]): RequiredCallQuestion[] {
  return (questions || []).map((q) => ({ id: q.id, prompt: q.prompt }))
}

function nextQuestionId(questions: { id: string }[]): string {
  const used = new Set(questions.map((q) => q.id))
  let n = 1
  while (used.has(`q_${n}`)) n += 1
  return `q_${n}`
}

export function OrgRequiredQuestionsPage() {
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

  const [enabled, setEnabled] = useState(false)
  const [questions, setQuestions] = useState<RequiredCallQuestion[]>([])
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    if (!orgDetail) return
    const rcq = orgDetail.requiredCallQuestions
    setEnabled(rcq?.enabled === true)
    setQuestions(cloneQuestions(rcq?.questions || []))
  }, [orgDetail])

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    setSearchError("")
    setSearching(true)
    try {
      const result = await runSearch({ q: q.trim(), limit: 20 }).unwrap()
      setRows(result.results || [])
      if (!result.results?.length) setSearchError("No organizations found.")
    } catch {
      setSearchError("Search failed.")
      setRows([])
    } finally {
      setSearching(false)
    }
  }

  const selectOrg = (row: AdminOrgSearchRow) => {
    if (!row.id) return
    setSelectedOrgId(row.id)
    setSelectedOrgName(row.name)
    setSaveError("")
  }

  const addQuestion = () => {
    if (questions.length >= MAX_QUESTIONS) return
    setQuestions((prev) => [...prev, { id: nextQuestionId(prev), prompt: "" }])
    setEnabled(true)
  }

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, patch: Partial<RequiredCallQuestion>) => {
    setQuestions((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const handleSave = async () => {
    if (!selectedOrgId) return
    setSaveError("")
    const trimmed = questions
      .map((item) => ({ id: item.id.trim(), prompt: item.prompt.trim() }))
      .filter((item) => item.id && item.prompt)
    if (enabled && trimmed.length === 0) {
      setSaveError("Add at least one question before enabling, or turn off required questions.")
      return
    }
    try {
      await patchOrg({
        orgId: selectedOrgId,
        body: {
          requiredCallQuestions: {
            enabled: enabled && trimmed.length > 0,
            questions: trimmed,
          },
        },
      }).unwrap()
    } catch {
      setSaveError("Could not save. Each question needs a unique id and prompt.")
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Required call questions"
        subtitle="Questions Bianca asks on every wellness call (super admin)."
      />

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

            {orgLoading ? <p className="admin-muted">Loading organization…</p> : null}

            <p className="admin-muted" style={{ marginBottom: "1rem", lineHeight: 1.5 }}>
              Bianca will exchange pleasantries, then ask these standard questions on each wellness call. She asks only
              the question — not which medication or clinical details. Answers are recorded in call summaries and
              digests.
            </p>

            <label className="admin-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Require these questions on every wellness call
            </label>

            <div style={{ marginTop: "1rem", marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={addQuestion} disabled={questions.length >= MAX_QUESTIONS}>
                Add question
              </button>
            </div>

            {questions.map((question, index) => (
              <div key={`${question.id}-${index}`} className="admin-plan-day" style={{ marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <span className="admin-muted">Question {index + 1}</span>
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => removeQuestion(index)}>
                    Remove
                  </button>
                </div>
                <label className="admin-label" style={{ marginTop: "0.5rem", display: "block" }}>
                  Id
                  <input
                    className="admin-input"
                    value={question.id}
                    onChange={(e) => updateQuestion(index, { id: e.target.value })}
                    placeholder="e.g. medication"
                  />
                </label>
                <label className="admin-label" style={{ marginTop: "0.5rem", display: "block" }}>
                  What Bianca should ask
                  <textarea
                    className="admin-input admin-textarea"
                    rows={2}
                    value={question.prompt}
                    onChange={(e) => updateQuestion(index, { prompt: e.target.value })}
                    placeholder="e.g. Have you taken your medication today?"
                    style={{ width: "100%", minHeight: "auto" }}
                  />
                </label>
              </div>
            ))}

            {saveError ? (
              <p className="admin-error" role="alert" style={{ marginTop: "0.75rem" }}>
                {saveError}
              </p>
            ) : null}

            <button
              type="button"
              className="admin-btn admin-btn--primary"
              style={{ marginTop: "1rem" }}
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Save required questions"}
            </button>
          </div>
        ) : null}
      </main>
    </>
  )
}
