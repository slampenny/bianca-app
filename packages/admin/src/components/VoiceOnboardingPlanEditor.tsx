import type { VoiceOnboardingDay } from "../services/api/api.types"

type VoiceOnboardingPlanEditorProps = {
  days: VoiceOnboardingDay[]
  onUpdateDay: (dayIndex: number, patch: Partial<VoiceOnboardingDay>) => void
  onUpdateQuestion: (
    dayIndex: number,
    qIndex: number,
    patch: Partial<VoiceOnboardingDay["questions"][0]>
  ) => void
  onAddDay: () => void
  onRemoveDay: (dayIndex: number) => void
  onAddQuestion: (dayIndex: number) => void
  onRemoveQuestion: (dayIndex: number, qIndex: number) => void
  onResetToDefault: () => void
  onDisable: () => void
  showResetToDefault?: boolean
}

export function VoiceOnboardingPlanEditor({
  days,
  onUpdateDay,
  onUpdateQuestion,
  onAddDay,
  onRemoveDay,
  onAddQuestion,
  onRemoveQuestion,
  onResetToDefault,
  onDisable,
  showResetToDefault = true,
}: VoiceOnboardingPlanEditorProps) {
  return (
    <>
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="admin-btn admin-btn--ghost" onClick={onAddDay}>
          Add day
        </button>
        {showResetToDefault ? (
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onResetToDefault}>
            Reset to default plan
          </button>
        ) : null}
        <button type="button" className="admin-btn admin-btn--ghost" onClick={onDisable}>
          Disable onboarding
        </button>
      </div>

      {days.map((day, dayIndex) => (
        <section key={`day-${dayIndex}`} className="admin-plan-day">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h3 className="admin-plan-day-title">Day {dayIndex + 1}</h3>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => onRemoveDay(dayIndex)}>
              Remove day
            </button>
          </div>

          <label className="admin-label" style={{ marginTop: "0.75rem", display: "block" }}>
            Theme
            <input
              className="admin-input"
              value={day.theme || ""}
              onChange={(e) => onUpdateDay(dayIndex, { theme: e.target.value })}
              placeholder="e.g. Safety & Orientation"
            />
          </label>

          <label className="admin-label" style={{ marginTop: "0.75rem", display: "block" }}>
            Opening script (optional)
            <textarea
              className="admin-input admin-textarea"
              rows={2}
              value={day.opening || ""}
              onChange={(e) => onUpdateDay(dayIndex, { opening: e.target.value })}
              placeholder="Hi {resident_name}, it's Bianca from {facility_name}…"
              style={{ width: "100%", minHeight: "auto" }}
            />
          </label>

          <p className="admin-plan-questions-title">Questions</p>
          {day.questions.map((question, qIndex) => (
            <div key={`q-${dayIndex}-${qIndex}`} className="admin-plan-question">
              <p className="admin-muted" style={{ margin: "0 0 0.5rem", fontSize: "0.75rem" }}>
                Id <code className="admin-code">{question.id}</code>
              </p>
              <label className="admin-label" style={{ display: "block" }}>
                Prompt (what Bianca asks)
                <textarea
                  className="admin-input admin-textarea"
                  rows={2}
                  value={question.prompt}
                  onChange={(e) => onUpdateQuestion(dayIndex, qIndex, { prompt: e.target.value })}
                  style={{ width: "100%", minHeight: "auto" }}
                />
              </label>
              <label className="admin-plan-check">
                <input
                  type="checkbox"
                  checked={question.compressionPriority === true}
                  onChange={(e) => onUpdateQuestion(dayIndex, qIndex, { compressionPriority: e.target.checked })}
                />
                Priority if call runs long
              </label>
              {day.questions.length > 1 ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  style={{ marginTop: "0.5rem" }}
                  onClick={() => onRemoveQuestion(dayIndex, qIndex)}
                >
                  Remove question
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => onAddQuestion(dayIndex)}>
            Add question
          </button>
        </section>
      ))}
    </>
  )
}
