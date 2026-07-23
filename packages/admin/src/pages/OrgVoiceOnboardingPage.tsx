import { type FormEvent, useEffect, useMemo, useState } from "react"
import {
  useGetDefaultVoiceOnboardingPlanQuery,
  useGetOrgQuery,
  useLazySearchOrgsQuery,
  usePatchOrgMutation,
} from "../services/api/adminApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import type { AdminOrgDetail, AdminOrgSearchRow, VoiceOnboardingDay } from "../services/api/api.types"
import { AdminPageHeader } from "../components/AdminPageHeader"
import { VoiceOnboardingPlanEditor } from "../components/VoiceOnboardingPlanEditor"

function cloneDays(days: VoiceOnboardingDay[]): VoiceOnboardingDay[] {
  return days.map((day, index) => ({
    dayNumber: day.dayNumber != null ? day.dayNumber : index + 1,
    theme: day.theme || "",
    opening: day.opening || "",
    questions: (day.questions || []).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      compressionPriority: q.compressionPriority === true,
    })),
  }))
}

const FACILITY_TYPE_OPTIONS: { value: "" | NonNullable<AdminOrgDetail["facilityType"]>; label: string }[] = [
  { value: "", label: "Unset (global default)" },
  { value: "assisted_living", label: "Assisted living" },
  { value: "skilled_nursing", label: "Skilled nursing / care home" },
  { value: "home_care", label: "Home care" },
  { value: "other", label: "Other" },
]

function nextQuestionId(dayNumber: number, questions: { id: string }[]): string {
  const prefix = `day${dayNumber}_topic_`
  const used = new Set(questions.map((q) => q.id))
  let n = 1
  while (used.has(`${prefix}${n}`)) n += 1
  return `${prefix}${n}`
}

function emptyDay(dayNumber: number): VoiceOnboardingDay {
  return {
    dayNumber,
    theme: "",
    opening: "",
    questions: [{ id: nextQuestionId(dayNumber, []), prompt: "", compressionPriority: false }],
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
  const { data: defaultPlanData, isLoading: defaultPlanLoading } = useGetDefaultVoiceOnboardingPlanQuery(undefined, {
    skip: !authed,
  })
  const [patchOrg, { isLoading: saving }] = usePatchOrgMutation()

  const [useDefault, setUseDefault] = useState(true)
  const [days, setDays] = useState<VoiceOnboardingDay[]>([])
  const [facilityType, setFacilityType] = useState<AdminOrgDetail["facilityType"] | "">("")
  const [saveError, setSaveError] = useState("")
  const [privacyWarnings, setPrivacyWarnings] = useState<{ path: string; phrase: string }[]>([])

  const defaultDays = useMemo(() => defaultPlanData?.plan?.days ?? [], [defaultPlanData?.plan?.days])
  const defaultDayCount = defaultPlanData?.plan?.totalDays ?? (defaultDays.length || 0)
  const onboardingDisabled = !useDefault && days.length === 0

  useEffect(() => {
    if (!orgDetail) return
    const vo = orgDetail.voiceOnboarding
    const orgUsesDefault = vo?.useDefault !== false
    setFacilityType(orgDetail.facilityType || "")

    if (!orgUsesDefault && vo?.days && vo.days.length > 0) {
      setUseDefault(false)
      setDays(cloneDays(vo.days))
      return
    }

    if (!orgUsesDefault) {
      setUseDefault(false)
      setDays([])
      return
    }

    setUseDefault(true)
    if (defaultDays.length > 0) {
      setDays(cloneDays(defaultDays))
    }
  }, [orgDetail, defaultPlanData])

  const markCustomized = () => {
    if (useDefault) setUseDefault(false)
  }

  const resetToDefault = () => {
    if (!defaultDays.length) return
    setUseDefault(true)
    setDays(cloneDays(defaultDays))
  }

  const disableOnboarding = () => {
    setUseDefault(false)
    setDays([])
  }

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

  const updateDay = (index: number, patch: Partial<VoiceOnboardingDay>) => {
    markCustomized()
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  const updateQuestion = (dayIndex: number, qIndex: number, patch: Partial<VoiceOnboardingDay["questions"][0]>) => {
    markCustomized()
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
    markCustomized()
    setDays((prev) => [...prev, emptyDay(prev.length + 1)])
  }

  const removeDay = (index: number) => {
    markCustomized()
    setDays((prev) => cloneDays(prev.filter((_, i) => i !== index)))
  }

  const addQuestion = (dayIndex: number) => {
    markCustomized()
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d
        const dayNumber = d.dayNumber || i + 1
        return {
          ...d,
          questions: [
            ...d.questions,
            { id: nextQuestionId(dayNumber, d.questions), prompt: "", compressionPriority: false },
          ],
        }
      })
    )
  }

  const removeQuestion = (dayIndex: number, qIndex: number) => {
    markCustomized()
    setDays((prev) =>
      prev.map((d, i) =>
        i !== dayIndex ? d : { ...d, questions: d.questions.filter((_, qi) => qi !== qIndex) }
      )
    )
  }

  const handleUseDefaultChange = (checked: boolean) => {
    if (checked) {
      resetToDefault()
      return
    }
    setUseDefault(false)
  }

  const applyTemplate = () => {
    // Presets are inert today — every facility type clones the global default (incl. Day 0).
    if (!defaultDays.length) return
    setUseDefault(true)
    setDays(cloneDays(defaultDays))
    setPrivacyWarnings([])
  }

  const handleSave = async () => {
    if (!selectedOrgId) return
    setSaveError("")
    setPrivacyWarnings([])
    try {
      const body: {
        facilityType: AdminOrgDetail["facilityType"] | null
        voiceOnboarding: { useDefault: boolean; days: VoiceOnboardingDay[] }
      } = {
        facilityType: facilityType || null,
        voiceOnboarding: useDefault
          ? { useDefault: true, days: [] }
          : { useDefault: false, days: cloneDays(days) },
      }
      const res = await patchOrg({ orgId: selectedOrgId, body }).unwrap()
      const warnings = (res as AdminOrgDetail & { voiceOnboardingPrivacyWarnings?: { path: string; phrase: string }[] })
        .voiceOnboardingPrivacyWarnings
      if (warnings?.length) {
        setPrivacyWarnings(warnings)
      }
    } catch {
      setSaveError("Could not save voice onboarding. Check the plan (each day needs questions with unique ids).")
    }
  }

  const planStatusBanner = (() => {
    if (onboardingDisabled) {
      return (
        <div className="admin-plan-banner admin-plan-banner--disabled" role="status">
          <strong>Onboarding disabled.</strong> Saving will skip voice onboarding for this organization. New calls use
          the regular wellness format only.
        </div>
      )
    }
    if (useDefault) {
      return (
        <div className="admin-plan-banner admin-plan-banner--default" role="status">
          <strong>Built-in default plan.</strong> This org uses the shared {defaultDayCount}-day plan. You can review
          and edit it below — any change saves as a custom plan for this organization.
        </div>
      )
    }
    return (
      <div className="admin-plan-banner admin-plan-banner--custom" role="status">
        <strong>Custom plan.</strong> Changes apply only to this organization.
      </div>
    )
  })()

  return (
    <>
      <AdminPageHeader
        title="Voice onboarding"
        subtitle="Per-organization resident call onboarding plans (super admin)."
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

            {orgLoading && !orgDetail ? (
              <p className="admin-muted">Loading organization…</p>
            ) : (
              <div style={{ maxWidth: 920 }}>
                <p className="admin-muted" style={{ fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "1rem" }}>
                  The built-in default is a {defaultDayCount}-day plan (safety, routine, emotional, preferences). Review
                  each day&apos;s theme, opening script, and questions below. To turn off onboarding entirely, use
                  &quot;Disable onboarding&quot; or remove all days.
                </p>

                {planStatusBanner}

                <label className="admin-label" style={{ display: "block", marginBottom: "0.75rem" }}>
                  Facility type
                  <select
                    className="admin-input"
                    value={facilityType || ""}
                    onChange={(e) => setFacilityType((e.target.value || "") as AdminOrgDetail["facilityType"] | "")}
                    style={{ marginTop: "0.35rem" }}
                  >
                    {FACILITY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value || "unset"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="admin-muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
                  Type presets are not shipped yet — all types use the shared Day 0–4 default until product supplies
                  content. &quot;Apply template&quot; clones that default into the editor (Day 0 stays shared across
                  types).
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={applyTemplate}
                    disabled={defaultPlanLoading || defaultDays.length === 0}
                  >
                    Apply template
                  </button>
                </div>

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
                    onChange={(e) => handleUseDefaultChange(e.target.checked)}
                    disabled={defaultPlanLoading || defaultDays.length === 0}
                  />
                  <span>Use built-in default {defaultDayCount}-day plan</span>
                </label>

                {defaultPlanLoading && days.length === 0 ? (
                  <p className="admin-muted">Loading default plan…</p>
                ) : onboardingDisabled ? (
                  <div style={{ marginBottom: "1rem" }}>
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={resetToDefault}>
                      Re-enable with default plan
                    </button>
                  </div>
                ) : (
                  <VoiceOnboardingPlanEditor
                    days={days}
                    onUpdateDay={updateDay}
                    onUpdateQuestion={updateQuestion}
                    onAddDay={addDay}
                    onRemoveDay={removeDay}
                    onAddQuestion={addQuestion}
                    onRemoveQuestion={removeQuestion}
                    onResetToDefault={resetToDefault}
                    onDisable={disableOnboarding}
                    showResetToDefault={!useDefault}
                  />
                )}

                {privacyWarnings.length > 0 ? (
                  <div
                    className="admin-plan-banner admin-plan-banner--custom"
                    role="status"
                    style={{ marginBottom: "0.75rem", borderColor: "var(--va-amber-600, #d97706)" }}
                  >
                    <strong>Privacy wording warnings (save succeeded).</strong> These phrases may conflict with
                    resident-facing privacy rules — consider editing before go-live:
                    <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
                      {privacyWarnings.map((w, i) => (
                        <li key={`${w.path}-${w.phrase}-${i}`}>
                          {w.path}: &quot;{w.phrase}&quot;
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
    </>
  )
}
