import { type FormEvent, useEffect, useState } from "react"
import {
  useGetDefaultVoiceOnboardingPlanQuery,
  useGetOrgQuery,
  useLazySearchOrgsQuery,
  usePatchOrgMutation,
} from "../services/api/adminApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import type { AdminOrgSearchRow, VoiceOnboardingDay } from "../services/api/api.types"
import { AdminHeaderNav } from "../components/AdminHeaderNav"

function cloneDays(days: VoiceOnboardingDay[]): VoiceOnboardingDay[] {
  return days.map((day, index) => ({
    dayNumber: index + 1,
    theme: day.theme || "",
    opening: day.opening || "",
    questions: (day.questions || []).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      compressionPriority: q.compressionPriority === true,
    })),
  }))
}

function emptyDay(dayNumber: number): VoiceOnboardingDay {
  return {
    dayNumber,
    theme: "",
    opening: "",
    questions: [{ id: `day${dayNumber}_topic_1`, prompt: "", compressionPriority: false }],
  }
}

export function OrgVoiceOnboardingPage() {
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
  const { data: defaultPlanData } = useGetDefaultVoiceOnboardingPlanQuery(undefined, { skip: !authed })
  const [patchOrg, { isLoading: saving }] = usePatchOrgMutation()

  const [useDefault, setUseDefault] = useState(true)
  const [days, setDays] = useState<VoiceOnboardingDay[]>([])
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    if (!orgDetail) return
    const vo = orgDetail.voiceOnboarding
    setUseDefault(vo?.useDefault !== false)
    if (vo?.useDefault === false && vo.days && vo.days.length > 0) {
      setDays(cloneDays(vo.days))
    } else {
      setDays([])
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

  const loadDefaultAsCustom = () => {
    const template = defaultPlanData?.plan
    if (!template?.days?.length) return
    setUseDefault(false)
    setDays(cloneDays(template.days))
  }

  const disableOnboarding = () => {
    setUseDefault(false)
    setDays([])
  }

  const updateDay = (index: number, patch: Partial<VoiceOnboardingDay>) => {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  const updateQuestion = (dayIndex: number, qIndex: number, patch: Partial<VoiceOnboardingDay["questions"][0]>) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i !== dayIndex
          ? d
          : {
              ...d,
              questions: d.questions.map((question, qi) => (qi === qIndex ? { ...question, ...patch } : question)),
            }
      )
    )
  }

  const addDay = () => {
    setDays((prev) => [...prev, emptyDay(prev.length + 1)])
    setUseDefault(false)
  }

  const removeDay = (index: number) => {
    setDays((prev) => cloneDays(prev.filter((_, i) => i !== index)))
    setUseDefault(false)
  }

  const addQuestion = (dayIndex: number) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d
        const n = d.questions.length + 1
        return {
          ...d,
          questions: [...d.questions, { id: `day${d.dayNumber || i + 1}_topic_${n}`, prompt: "", compressionPriority: false }],
        }
      })
    )
  }

  const removeQuestion = (dayIndex: number, qIndex: number) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i !== dayIndex ? d : { ...d, questions: d.questions.filter((_, qi) => qi !== qIndex) }
      )
    )
  }

  const handleSave = async () => {
    if (!selectedOrgId) return
    setSaveError("")
    try {
      const body = useDefault
        ? { voiceOnboarding: { useDefault: true, days: [] } }
        : { voiceOnboarding: { useDefault: false, days: cloneDays(days) } }
      await patchOrg({ orgId: selectedOrgId, body }).unwrap()
    } catch {
      setSaveError("Could not save voice onboarding. Check the plan (each day needs questions with unique ids).")
    }
  }

  const defaultDayCount = defaultPlanData?.plan?.totalDays ?? 4

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div>
          <span className="admin-badge">Admin</span>
          <h1 className="admin-header-title">Voice onboarding</h1>
          <p className="admin-header-sub">Per-organization resident call onboarding plans (super admin).</p>
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
              <div style={{ maxWidth: 920 }}>
                <p className="admin-muted" style={{ fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "1rem" }}>
                  The built-in default is a {defaultDayCount}-day plan (safety, routine, emotional, preferences). Custom
                  plans can add or remove days and change questions. To turn off onboarding entirely, uncheck the default
                  plan and remove all custom days — outbound calls will go straight to wellness checks.
                </p>

                {!useDefault && days.length === 0 ? (
                  <div
                    style={{
                      marginBottom: "1rem",
                      padding: "0.75rem 1rem",
                      borderRadius: 8,
                      background: "#fef3c7",
                      border: "1px solid #fcd34d",
                      fontSize: "0.9rem",
                    }}
                  >
                    <strong>Onboarding disabled.</strong> Saving will skip voice onboarding for this organization. New
                    calls use the regular wellness format only.
                  </div>
                ) : null}

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
                    checked={useDefault}
                    onChange={(e) => setUseDefault(e.target.checked)}
                  />
                  <span>Use default {defaultDayCount}-day onboarding plan</span>
                </label>

                {!useDefault ? (
                  <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={addDay}>
                      Add day
                    </button>
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={loadDefaultAsCustom}>
                      Copy default plan as starting point
                    </button>
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={disableOnboarding}>
                      Disable onboarding (remove all days)
                    </button>
                  </div>
                ) : (
                  <div style={{ marginBottom: "1rem" }}>
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={disableOnboarding}>
                      Disable onboarding for this org
                    </button>
                  </div>
                )}

                {!useDefault
                  ? days.map((day, dayIndex) => (
                      <div
                        key={`day-${dayIndex}`}
                        style={{
                          border: "1px solid var(--admin-border, #d1d5db)",
                          borderRadius: 8,
                          padding: "1rem",
                          marginBottom: "1rem",
                          background: "#fafafa",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                          <strong>Day {dayIndex + 1}</strong>
                          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => removeDay(dayIndex)}>
                            Remove day
                          </button>
                        </div>

                        <label className="admin-label" style={{ marginTop: "0.75rem", display: "block" }}>
                          Theme
                          <input
                            className="admin-input"
                            value={day.theme || ""}
                            onChange={(e) => updateDay(dayIndex, { theme: e.target.value })}
                            placeholder="e.g. Safety & Orientation"
                          />
                        </label>

                        <label className="admin-label" style={{ marginTop: "0.75rem", display: "block" }}>
                          Opening script (optional)
                          <textarea
                            className="admin-input"
                            rows={2}
                            value={day.opening || ""}
                            onChange={(e) => updateDay(dayIndex, { opening: e.target.value })}
                            placeholder="Hi {resident_name}, it's Bianca from {facility_name}…"
                            style={{ width: "100%", resize: "vertical" }}
                          />
                        </label>

                        <p style={{ marginTop: "1rem", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>
                          Questions
                        </p>
                        {day.questions.map((question, qIndex) => (
                          <div
                            key={`q-${dayIndex}-${qIndex}`}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 6,
                              padding: "0.75rem",
                              marginBottom: "0.5rem",
                              background: "#fff",
                            }}
                          >
                            <label className="admin-label" style={{ display: "block" }}>
                              Question id
                              <input
                                className="admin-input"
                                value={question.id}
                                onChange={(e) => updateQuestion(dayIndex, qIndex, { id: e.target.value })}
                                placeholder="day1_fall_history"
                              />
                            </label>
                            <label className="admin-label" style={{ display: "block", marginTop: "0.5rem" }}>
                              Prompt (what Bianca asks)
                              <textarea
                                className="admin-input"
                                rows={2}
                                value={question.prompt}
                                onChange={(e) => updateQuestion(dayIndex, qIndex, { prompt: e.target.value })}
                                style={{ width: "100%", resize: "vertical" }}
                              />
                            </label>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                marginTop: "0.5rem",
                                fontSize: "0.85rem",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={question.compressionPriority === true}
                                onChange={(e) =>
                                  updateQuestion(dayIndex, qIndex, { compressionPriority: e.target.checked })
                                }
                              />
                              Priority if call runs long
                            </label>
                            {day.questions.length > 1 ? (
                              <button
                                type="button"
                                className="admin-btn admin-btn--ghost"
                                style={{ marginTop: "0.5rem" }}
                                onClick={() => removeQuestion(dayIndex, qIndex)}
                              >
                                Remove question
                              </button>
                            ) : null}
                          </div>
                        ))}
                        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => addQuestion(dayIndex)}>
                          Add question
                        </button>
                      </div>
                    ))
                  : null}

                {saveError ? (
                  <p className="admin-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                    {saveError}
                  </p>
                ) : null}
                <button type="button" className="admin-btn admin-btn--primary" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? "Saving…" : "Save voice onboarding"}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}
