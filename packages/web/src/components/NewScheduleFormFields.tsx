import { weekdayShortLabel } from "../lib/scheduleDraft"

export type ScheduleFrequency = "daily" | "weekly" | "monthly"

export type NewScheduleFormFieldsProps = {
  testIdPrefix: string
  frequency: ScheduleFrequency
  setFrequency: (v: ScheduleFrequency) => void
  time: string
  setTime: (v: string) => void
  active: boolean
  setActive: (v: boolean) => void
  weeklyDays: number[]
  toggleWeeklyDay: (d: number) => void
  weeklyWeeks: number
  setWeeklyWeeks: (n: number) => void
  monthlyDaysRaw: string
  setMonthlyDaysRaw: (s: string) => void
}

export function NewScheduleFormFields({
  testIdPrefix,
  frequency,
  setFrequency,
  time,
  setTime,
  active,
  setActive,
  weeklyDays,
  toggleWeeklyDay,
  weeklyWeeks,
  setWeeklyWeeks,
  monthlyDaysRaw,
  setMonthlyDaysRaw,
}: NewScheduleFormFieldsProps) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(130px, 180px) minmax(130px, 180px) auto", gap: 8, alignItems: "center" }}>
        <select
          data-testid={`${testIdPrefix}-frequency`}
          className="va-login-input"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <input data-testid={`${testIdPrefix}-time`} className="va-login-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--va-slate-700)" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      </div>
      {frequency === "weekly" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => {
              const isOn = weeklyDays.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  data-testid={`${testIdPrefix}-day-${d}`}
                  style={{
                    padding: "0.25rem 0.58rem",
                    fontSize: "0.75rem",
                    borderRadius: 999,
                    border: isOn ? "1px solid #14b8a6" : "1px solid #cbd5e1",
                    background: isOn ? "#14b8a6" : "#ffffff",
                    color: isOn ? "#ffffff" : "#334155",
                  }}
                  onClick={() => toggleWeeklyDay(d)}
                >
                  {weekdayShortLabel(d)}
                </button>
              )
            })}
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.81rem", color: "var(--va-slate-700)" }}>
            Repeat every
            <input
              data-testid={`${testIdPrefix}-weeks`}
              className="va-login-input"
              type="number"
              min={1}
              value={weeklyWeeks}
              onChange={(e) => setWeeklyWeeks(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 86 }}
            />
            week(s)
          </label>
        </div>
      ) : null}
      {frequency === "monthly" ? (
        <label style={{ display: "grid", gap: 6, fontSize: "0.81rem", color: "var(--va-slate-700)" }}>
          Days of month (comma-separated, 1-31)
          <input data-testid={`${testIdPrefix}-monthdays`} className="va-login-input" value={monthlyDaysRaw} onChange={(e) => setMonthlyDaysRaw(e.target.value)} />
        </label>
      ) : null}
    </>
  )
}
