import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import type { ClientOnboardingFlags, ClientOnboardingResponseRow } from "../services/api/api.types"
import { useGetClientOnboardingQuery } from "../services/api/clientApi"

function humanizeQuestionId(id: string): string {
  return id
    .replace(/^day\d+_/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatResponseValue(v: unknown, emDash: string): string {
  if (v == null) return emDash
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function responsesForDay(rows: ClientOnboardingResponseRow[], day: number): ClientOnboardingResponseRow[] {
  const byQ = new Map<string, ClientOnboardingResponseRow>()
  for (const r of rows) {
    if (r.dayNumber !== day) continue
    const prev = byQ.get(r.questionId)
    if (!prev || (r.capturedAt && prev.capturedAt && new Date(r.capturedAt) > new Date(prev.capturedAt))) {
      byQ.set(r.questionId, r)
    }
  }
  return [...byQ.values()].sort((a, b) => a.questionId.localeCompare(b.questionId))
}

const FLAG_KEYS: (keyof ClientOnboardingFlags)[] = ["safety", "memory", "mood", "distress", "confusion"]

export function ClientOnboardingSection({ clientId, residentPathId }: { clientId: string; residentPathId: string }) {
  const { t } = useTranslation()
  const { data, isLoading, isError, error } = useGetClientOnboardingQuery({ clientId }, { skip: !clientId })
  const [openDay, setOpenDay] = useState<number | null>(null)
  const journeyComplete = !!data?.journey.journeyComplete
  const [showFull, setShowFull] = useState(!journeyComplete)
  const emDash = t("common.emDash")

  useEffect(() => {
    setShowFull(!journeyComplete)
    setOpenDay(null)
  }, [clientId, journeyComplete])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hash === "#voice-onboarding") {
      setShowFull(true)
    }
  }, [clientId])

  const byDay = useMemo(() => {
    if (!data?.responses) return new Map<number, ClientOnboardingResponseRow[]>()
    const m = new Map<number, ClientOnboardingResponseRow[]>()
    for (const d of data.journey.days) {
      m.set(d.dayNumber, responsesForDay(data.responses, d.dayNumber))
    }
    return m
  }, [data])

  const flagLabel = (key: keyof ClientOnboardingFlags) => {
    const map: Record<keyof ClientOnboardingFlags, string> = {
      safety: t("clientOnboarding.flagSafety"),
      memory: t("clientOnboarding.flagMemory"),
      mood: t("clientOnboarding.flagMood"),
      distress: t("clientOnboarding.flagDistress"),
      confusion: t("clientOnboarding.flagConfusion"),
    }
    return map[key]
  }

  if (!clientId) return null

  if (isLoading) {
    return (
      <div
        className="va-card va-card-pad"
        style={{ padding: "0.55rem 0.75rem", background: "var(--va-slate-50)" }}
        data-testid="resident-onboarding-section"
      >
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--va-slate-500)" }}>{t("clientOnboarding.loading")}</p>
      </div>
    )
  }

  if (isError || !data) {
    const msg = (error as { data?: { message?: string } })?.data?.message
    return (
      <div className="va-card va-card-pad" data-testid="resident-onboarding-section">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>{t("clientOnboarding.title")}</h2>
        <p style={{ marginTop: 8, fontSize: "0.8125rem", color: "var(--va-red-600)" }}>
          {typeof msg === "string" ? msg : t("clientOnboarding.loadError")}
        </p>
      </div>
    )
  }

  const { journey, flags } = data
  const onboardingDisabled = journey.enabled === false

  if (onboardingDisabled) {
    return (
      <div
        id="voice-onboarding"
        className="va-card va-card-pad"
        style={{
          padding: "0.55rem 0.75rem",
          background: "var(--va-slate-50)",
          border: "1px solid var(--va-slate-200)",
        }}
        data-testid="resident-onboarding-section"
      >
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--va-slate-600)" }}>
          <span style={{ fontWeight: 600, color: "var(--va-slate-700)" }}>{t("clientOnboarding.title")}</span>
          {" — "}
          {t("clientOnboarding.disabledLine")}
        </p>
      </div>
    )
  }

  const activeFlags = FLAG_KEYS.filter((k) => flags[k])
  const callWorkspaceLink = (
    <Link
      to={`/residents/${residentPathId}/call`}
      className="va-btn-ghost"
      style={{ textDecoration: "none", fontSize: "0.78rem", padding: "0.25rem 0.5rem", alignSelf: "flex-start" }}
    >
      {t("clientOnboarding.openCallWorkspace")}
    </Link>
  )

  if (journeyComplete && !showFull) {
    return (
      <div
        id="voice-onboarding"
        className="va-card va-card-pad"
        style={{
          padding: "0.55rem 0.75rem",
          background: "var(--va-slate-50)",
          border: "1px solid var(--va-slate-200)",
        }}
        data-testid="resident-onboarding-section"
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem 1rem", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--va-slate-600)" }}>
            <span style={{ fontWeight: 600, color: "var(--va-slate-700)" }}>{t("clientOnboarding.title")}</span>
            {" — "}
            {t("clientOnboarding.completedSummary", { total: journey.totalDays })}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
            {callWorkspaceLink}
            <button type="button" className="va-btn-secondary" style={{ fontSize: "0.78rem", padding: "0.25rem 0.55rem" }} onClick={() => setShowFull(true)}>
              {t("clientOnboarding.showDetails")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const daysLabel = journey.totalDays === 1 ? t("clientOnboarding.day") : t("clientOnboarding.days")

  return (
    <div id="voice-onboarding" className="va-card va-card-pad" data-testid="resident-onboarding-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>{t("clientOnboarding.title")}</h2>
          <p style={{ marginTop: 4, fontSize: "0.8125rem", color: "var(--va-slate-500)", maxWidth: 520 }}>
            {t("clientOnboarding.guidedIntro", { days: journey.totalDays, daysLabel })}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <Link
            to={`/residents/${residentPathId}/call`}
            className="va-btn-primary"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            {t("clientOnboarding.openCallWorkspace")}
          </Link>
          {journeyComplete ? (
            <button type="button" className="va-btn-ghost" style={{ fontSize: "0.78rem" }} onClick={() => setShowFull(false)}>
              {t("clientOnboarding.hideDetails")}
            </button>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginTop: "0.85rem",
          padding: "0.55rem 0.65rem",
          borderRadius: "0.65rem",
          background: journey.journeyComplete ? "var(--va-emerald-50)" : "var(--va-amber-50)",
          border: `1px solid ${journey.journeyComplete ? "var(--va-emerald-200)" : "var(--va-amber-200)"}`,
        }}
      >
        <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: journey.journeyComplete ? "var(--va-emerald-800)" : "var(--va-amber-800)" }}>
          {journey.journeyComplete ? t("clientOnboarding.journeyComplete") : t("clientOnboarding.inProgress")}
        </p>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: journey.journeyComplete ? "var(--va-emerald-800)" : "var(--va-amber-800)" }}>
          {t("clientOnboarding.sessionsLine", { completed: journey.sessionsCompletedCount, total: journey.totalDays })}
          {!journey.journeyComplete && journey.currentDay != null
            ? t("clientOnboarding.nextFocus", { day: journey.currentDay })
            : ""}
        </p>
      </div>

      {activeFlags.length > 0 ? (
        <p style={{ marginTop: "0.65rem", fontSize: "0.75rem", color: "var(--va-red-700)" }}>
          {t("clientOnboarding.flagsPrefix")} {activeFlags.map((k) => flagLabel(k)).join(", ")}
        </p>
      ) : null}

      <div style={{ marginTop: "1rem", display: "grid", gap: 8 }}>
        {journey.days.map((d) => {
          const answers = byDay.get(d.dayNumber) ?? []
          const expanded = openDay === d.dayNumber
          return (
            <div
              key={d.dayNumber}
              style={{
                border: "1px solid var(--va-slate-200)",
                borderRadius: 10,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenDay(expanded ? null : d.dayNumber)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "0.65rem 0.75rem",
                  background: "var(--va-slate-50)",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  font: "inherit",
                }}
                data-testid={`resident-onboarding-day-${d.dayNumber}`}
              >
                <span style={{ fontWeight: 600, fontSize: "0.86rem", color: "var(--va-navy)" }}>
                  {t("clientOnboarding.dayLabel", { day: d.dayNumber })}
                  <span style={{ fontWeight: 500, color: "var(--va-slate-500)", marginLeft: 8 }}>
                    {t("clientOnboarding.topicsMeta", {
                      captured: d.capturedCount,
                      total: d.totalQuestions,
                      session: d.sessionCompleted ? t("clientOnboarding.sessionDone") : t("clientOnboarding.sessionOpen"),
                    })}
                  </span>
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
                  {expanded ? t("clientOnboarding.hideAnswers") : t("clientOnboarding.showAnswers")}
                </span>
              </button>
              {expanded ? (
                <div style={{ padding: "0.65rem 0.75rem", borderTop: "1px solid var(--va-slate-100)" }}>
                  {answers.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>{t("clientOnboarding.noAnswersDay")}</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: 10 }}>
                      {answers.map((r) => (
                        <li key={r.questionId} style={{ fontSize: "0.8125rem", color: "var(--va-slate-700)" }}>
                          <span style={{ fontWeight: 600, color: "var(--va-navy)" }}>{humanizeQuestionId(r.questionId)}</span>
                          <div style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>{formatResponseValue(r.responseValue, emDash)}</div>
                          {r.verbatimTranscript ? (
                            <div style={{ marginTop: 4, fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
                              {t("clientOnboarding.transcriptPrefix")} {r.verbatimTranscript}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
