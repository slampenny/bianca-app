import { useTranslation } from "react-i18next"
import { AuthSelectField } from "./AuthSelectField"
import { AuthTextField } from "./AuthTextField"
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
  const { t } = useTranslation()
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(130px, 1fr) minmax(130px, 1fr) auto", gap: 8, alignItems: "end" }}>
        <AuthSelectField
          label={t("residentDetail.scheduleFrequencyLabel")}
          selectTestId={`${testIdPrefix}-frequency`}
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
        >
          <option value="daily">{t("residentDetail.freqDaily")}</option>
          <option value="weekly">{t("residentDetail.freqWeekly")}</option>
          <option value="monthly">{t("residentDetail.freqMonthly")}</option>
        </AuthSelectField>
        <AuthTextField
          label={t("residentDetail.scheduleTimeLabel")}
          type="time"
          inputTestId={`${testIdPrefix}-time`}
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--va-slate-700)" }}>
          <input
            type="checkbox"
            data-testid={`${testIdPrefix}-active`}
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          {t("residentDetail.scheduleActive")}
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
          <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
            <AuthTextField
              label={t("residentDetail.repeatEvery")}
              type="number"
              min={1}
              inputTestId={`${testIdPrefix}-weeks`}
              value={weeklyWeeks}
              onChange={(e) => setWeeklyWeeks(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 120 }}
            />
            <span style={{ fontSize: "0.81rem", color: "var(--va-slate-700)", paddingBottom: 8 }}>{t("residentDetail.weeksSuffix")}</span>
          </div>
        </div>
      ) : null}
      {frequency === "monthly" ? (
        <AuthTextField
          label={t("residentDetail.monthDaysLabel")}
          inputTestId={`${testIdPrefix}-monthdays`}
          value={monthlyDaysRaw}
          onChange={(e) => setMonthlyDaysRaw(e.target.value)}
        />
      ) : null}
    </>
  )
}
