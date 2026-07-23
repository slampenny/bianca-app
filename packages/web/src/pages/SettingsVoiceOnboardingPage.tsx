import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { canManageCaregivers } from "../lib/roleAccess"
import {
  useGetDefaultVoiceOnboardingPlanQuery,
  useGetOrgQuery,
  useUpdateOrgMutation,
} from "../services/api/orgApi"
import type { VoiceOnboardingDay } from "../services/api/api.types"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { AuthTextField } from "../components/AuthTextField"
import "../app.css"

function cloneDays(days: VoiceOnboardingDay[]): VoiceOnboardingDay[] {
  return days.map((day, index) => ({
    dayNumber: day.dayNumber != null ? day.dayNumber : index,
    theme: day.theme || "",
    opening: day.opening || "",
    questions: (day.questions || []).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      compressionPriority: q.compressionPriority === true,
    })),
  }))
}

function dayLabel(day: VoiceOnboardingDay, index: number): number {
  return day.dayNumber != null ? day.dayNumber : index
}

export function SettingsVoiceOnboardingPage() {
  const { t } = useTranslation()
  const user = useAppSelector(getCurrentUser)
  const orgId = user?.org != null ? String(user.org) : ""
  const canManage = canManageCaregivers(user?.role) && Boolean(orgId)

  const { data: orgData, isLoading: orgLoading } = useGetOrgQuery({ orgId }, { skip: !canManage })
  const { data: defaultPlanData, isLoading: defaultPlanLoading } = useGetDefaultVoiceOnboardingPlanQuery(undefined, {
    skip: !canManage,
  })
  const [updateOrg, { isLoading: saving }] = useUpdateOrgMutation()

  const [useDefault, setUseDefault] = useState(true)
  const [days, setDays] = useState<VoiceOnboardingDay[]>([])
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [privacyWarnings, setPrivacyWarnings] = useState<{ path: string; phrase: string }[]>([])

  const defaultDays = useMemo(() => defaultPlanData?.plan?.days ?? [], [defaultPlanData?.plan?.days])
  const defaultDayCount = defaultPlanData?.plan?.totalDays ?? defaultDays.length

  useEffect(() => {
    if (!orgData || dirty) return
    const vo = orgData.voiceOnboarding
    const orgUsesDefault = vo?.useDefault !== false

    if (!orgUsesDefault && vo?.days && vo.days.length > 0) {
      setUseDefault(false)
      setDays(cloneDays(vo.days))
      return
    }

    setUseDefault(true)
    if (defaultDays.length > 0) {
      setDays(cloneDays(defaultDays))
    }
  }, [orgData, defaultDays, dirty])

  const statusKey = useDefault ? "statusDefault" : "statusCustom"

  const customizeFromDefault = () => {
    if (!defaultDays.length) return
    setUseDefault(false)
    setDays(cloneDays(defaultDays))
    setDirty(true)
    setSaveError("")
    setSaveSuccess(false)
    setPrivacyWarnings([])
  }

  const resetToDefault = async () => {
    if (!canManage || !orgId) return
    setSaveError("")
    setSaveSuccess(false)
    setPrivacyWarnings([])
    try {
      await updateOrg({
        orgId,
        org: { voiceOnboarding: { useDefault: true, days: [] } },
      }).unwrap()
      setUseDefault(true)
      setDays(cloneDays(defaultDays))
      setDirty(false)
      setSaveSuccess(true)
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setSaveError(typeof msg === "string" ? msg : t("voiceOnboardingSettings.saveFailed"))
    }
  }

  const updateDay = (dayIndex: number, patch: Partial<VoiceOnboardingDay>) => {
    setDirty(true)
    setUseDefault(false)
    setDays((prev) => prev.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d)))
  }

  const updateQuestion = (
    dayIndex: number,
    qIndex: number,
    patch: Partial<VoiceOnboardingDay["questions"][0]>,
  ) => {
    setDirty(true)
    setUseDefault(false)
    setDays((prev) =>
      prev.map((d, i) =>
        i !== dayIndex
          ? d
          : {
              ...d,
              questions: d.questions.map((q, qi) => (qi === qIndex ? { ...q, ...patch } : q)),
            },
      ),
    )
  }

  const handleSave = async () => {
    if (!canManage || !orgId) return
    setSaveError("")
    setSaveSuccess(false)
    setPrivacyWarnings([])
    try {
      const res = await updateOrg({
        orgId,
        org: {
          voiceOnboarding: useDefault
            ? { useDefault: true, days: [] }
            : { useDefault: false, days: cloneDays(days) },
        },
      }).unwrap()
      const warnings = res.voiceOnboardingPrivacyWarnings
      if (warnings?.length) {
        setPrivacyWarnings(warnings)
      }
      setDirty(false)
      setSaveSuccess(true)
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setSaveError(typeof msg === "string" && msg.trim() ? msg : t("voiceOnboardingSettings.saveFailed"))
    }
  }

  if (!canManage) {
    return (
      <div data-testid="settings-voice-onboarding-page" className="va-page-wrap">
        <Link to="/settings" className="va-link" style={{ fontSize: "0.875rem" }} data-testid="settings-back-link">
          ← {t("settings.backToSettings")}
        </Link>
        <h1 className="va-page-title" style={{ marginTop: "1rem" }}>
          {t("voiceOnboardingSettings.title")}
        </h1>
        <div className="va-page-section">
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("voiceOnboardingSettings.noPermission")}</p>
        </div>
      </div>
    )
  }

  const loading = (orgLoading && !orgData) || (defaultPlanLoading && defaultDays.length === 0)

  return (
    <div data-testid="settings-voice-onboarding-page" className="va-page-wrap">
      <Link to="/settings" className="va-link" style={{ fontSize: "0.875rem" }} data-testid="settings-back-link">
        ← {t("settings.backToSettings")}
      </Link>
      <h1 className="va-page-title" style={{ marginTop: "1rem" }}>
        {t("voiceOnboardingSettings.title")}
      </h1>
      <p style={{ color: "var(--va-slate-500)", marginTop: 8, marginBottom: "1.5rem", fontSize: "0.875rem", lineHeight: 1.45 }}>
        {t("voiceOnboardingSettings.subtitle", { days: defaultDayCount || 5 })}
      </p>

      {loading ? (
        <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("voiceOnboardingSettings.loading")}</p>
      ) : (
        <>
          <div
            className="va-page-section"
            role="status"
            style={{
              borderColor: useDefault ? "var(--va-slate-200)" : "var(--va-amber-700)",
              background: useDefault ? undefined : "var(--va-amber-50)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.45 }}>
              <strong>{t(`voiceOnboardingSettings.${statusKey}`)}</strong>
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "var(--va-slate-600)", lineHeight: 1.45 }}>
              {useDefault
                ? t("voiceOnboardingSettings.statusDefaultDetail", { days: defaultDayCount || 5 })
                : t("voiceOnboardingSettings.statusCustomDetail")}
            </p>
          </div>

          <div className="va-page-section" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {useDefault ? (
              <button
                type="button"
                className="va-btn-primary"
                data-testid="voice-onboarding-customize"
                disabled={!defaultDays.length || saving}
                onClick={customizeFromDefault}
              >
                {t("voiceOnboardingSettings.customize")}
              </button>
            ) : (
              <button
                type="button"
                className="va-btn-secondary"
                data-testid="voice-onboarding-reset"
                disabled={saving}
                onClick={() => void resetToDefault()}
              >
                {t("voiceOnboardingSettings.resetDefault")}
              </button>
            )}
          </div>

          {!useDefault || dirty ? (
            <div className="va-page-section">
              {days.map((day, dayIndex) => (
                <section
                  key={`day-${dayLabel(day, dayIndex)}-${dayIndex}`}
                  data-testid={`voice-onboarding-day-${dayIndex}`}
                  style={{
                    marginBottom: dayIndex < days.length - 1 ? "1.75rem" : 0,
                    paddingBottom: dayIndex < days.length - 1 ? "1.5rem" : 0,
                    borderBottom: dayIndex < days.length - 1 ? "1px solid var(--va-slate-200)" : undefined,
                  }}
                >
                  <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                    {t("voiceOnboardingSettings.dayLabel", { day: dayLabel(day, dayIndex) })}
                  </h2>
                  <AuthTextField
                    label={t("voiceOnboardingSettings.themeLabel")}
                    value={day.theme || ""}
                    onChange={(ev) => updateDay(dayIndex, { theme: ev.target.value })}
                    disabled={saving}
                  />
                  <label style={{ display: "block", marginTop: "0.75rem", fontSize: "0.875rem", fontWeight: 500 }}>
                    {t("voiceOnboardingSettings.openingLabel")}
                    <textarea
                      className="va-input"
                      data-testid={`voice-onboarding-opening-${dayIndex}`}
                      rows={2}
                      value={day.opening || ""}
                      disabled={saving}
                      onChange={(ev) => updateDay(dayIndex, { opening: ev.target.value })}
                      style={{ display: "block", width: "100%", marginTop: 6, resize: "vertical" }}
                    />
                  </label>

                  <p style={{ margin: "1rem 0 0.5rem", fontSize: "0.8125rem", fontWeight: 600, color: "var(--va-slate-600)" }}>
                    {t("voiceOnboardingSettings.questionsTitle")}
                  </p>
                  {day.questions.map((question, qIndex) => (
                    <div
                      key={question.id || `q-${dayIndex}-${qIndex}`}
                      style={{
                        marginBottom: "1rem",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        background: "var(--va-slate-50, #f8fafc)",
                      }}
                    >
                      <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
                        {t("voiceOnboardingSettings.questionId", { id: question.id })}
                      </p>
                      <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}>
                        {t("voiceOnboardingSettings.promptLabel")}
                        <textarea
                          className="va-input"
                          data-testid={`voice-onboarding-prompt-${dayIndex}-${qIndex}`}
                          rows={2}
                          value={question.prompt}
                          disabled={saving}
                          onChange={(ev) => updateQuestion(dayIndex, qIndex, { prompt: ev.target.value })}
                          style={{ display: "block", width: "100%", marginTop: 6, resize: "vertical" }}
                        />
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginTop: "0.65rem",
                          fontSize: "0.8125rem",
                          cursor: saving ? "wait" : "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={question.compressionPriority === true}
                          disabled={saving}
                          onChange={(ev) =>
                            updateQuestion(dayIndex, qIndex, { compressionPriority: ev.target.checked })
                          }
                        />
                        {t("voiceOnboardingSettings.compressionPriorityLabel")}
                      </label>
                    </div>
                  ))}
                </section>
              ))}

              <button
                type="button"
                className="va-btn-primary va-login-submit"
                data-testid="voice-onboarding-save"
                disabled={saving || days.length === 0}
                onClick={() => void handleSave()}
                style={{ marginTop: "0.5rem" }}
              >
                {saving ? t("voiceOnboardingSettings.saving") : t("voiceOnboardingSettings.save")}
              </button>
            </div>
          ) : null}

          {saveError ? (
            <div className="va-login-error" role="alert" data-testid="voice-onboarding-save-error" style={{ marginTop: "1rem" }}>
              {saveError}
            </div>
          ) : null}
          {privacyWarnings.length > 0 ? (
            <div
              role="status"
              data-testid="voice-onboarding-privacy-warnings"
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.75rem",
                background: "var(--va-amber-50)",
                border: "1px solid var(--va-amber-700)",
                fontSize: "0.875rem",
                color: "var(--va-amber-700)",
              }}
            >
              <strong>{t("voiceOnboardingSettings.privacyWarningsTitle")}</strong>
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
                {privacyWarnings.map((w, i) => (
                  <li key={`${w.path}-${w.phrase}-${i}`}>
                    {w.path}: &quot;{w.phrase}&quot;
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {saveSuccess && !saveError ? (
            <div className="va-login-success" role="status" data-testid="voice-onboarding-save-success" style={{ marginTop: "1rem" }}>
              {t("voiceOnboardingSettings.saved")}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
