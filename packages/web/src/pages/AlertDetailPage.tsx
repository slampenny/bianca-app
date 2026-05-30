import { skipToken } from "@reduxjs/toolkit/query"
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { AuthTextAreaField } from "../components/AuthTextAreaField"
import { mapConversationToTranscript } from "../lib/mapConversationToTranscript"
import { clientDisplayName } from "../lib/clientDisplayName"
import { apiRecordId, mapApiAlertToFacilityAlert } from "../lib/liveData"
import {
  useGetAllAlertsQuery,
  useMarkAlertAsReadMutation,
  useResolveAlertMutation,
  liveAlertsQueryOptions,
} from "../services/api/alertApi"
import { useGetAllClientsQuery } from "../services/api/clientApi"
import { useGetConversationByIdQuery } from "../services/api/conversationApi"
import { useDemo, useDemoActions } from "../state/DemoContext"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { formatAlertType, formatDetectedDate, formatDetectedTime } from "../lib/timeFormat"
import { AlertOctagonIcon, CheckIcon, ChevronLeftIcon, MessageIcon } from "../icons"
import type { Alert as FacilityAlert, Transcript, TranscriptLine } from "../types"

const SENTIMENT_DOT: Record<string, string> = {
  neutral: "var(--va-slate-300)",
  positive: "var(--va-emerald-400)",
  anxious: "var(--va-amber-400)",
  confused: "#fb923c",
  distressed: "var(--va-red-500)",
}

function sentimentLabel(t: (key: string) => string, key: string): string {
  const map: Record<string, string> = {
    neutral: t("alertDetail.sentimentNeutral"),
    positive: t("alertDetail.sentimentPositive"),
    anxious: t("alertDetail.sentimentAnxious"),
    confused: t("alertDetail.sentimentConfused"),
    distressed: t("alertDetail.sentimentDistressed"),
  }
  return map[key] ?? key
}

export function AlertDetailPage() {
  const { t } = useTranslation()
  const { alertId } = useParams()
  const navigate = useNavigate()
  const authed = useAppSelector((s) => !!s.auth.tokens)
  const currentUser = useAppSelector(getCurrentUser)
  const { state: demo } = useDemo()
  const { acknowledgeAlert } = useDemoActions()
  const [assigned, setAssigned] = useState<Set<number>>(() => new Set())
  const [markRead, { isLoading: marking }] = useMarkAlertAsReadMutation()
  const [resolveAlert, { isLoading: resolving }] = useResolveAlertMutation()
  const [resolutionNote, setResolutionNote] = useState("")
  const [resolveError, setResolveError] = useState("")

  const { data: apiAlerts } = useGetAllAlertsQuery(undefined, {
    ...liveAlertsQueryOptions,
    skip: !authed,
  })
  const { data: clientPages } = useGetAllClientsQuery(authed ? { limit: 500, page: 1 } : skipToken)

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of clientPages?.results ?? []) {
      const id = apiRecordId(c as { id?: string; _id?: string })
      if (id) m.set(id, clientDisplayName(c))
    }
    return m
  }, [clientPages?.results])

  const rawApi = useMemo(
    () => (apiAlerts ?? []).find((a) => apiRecordId(a as { id?: string; _id?: string }) === alertId),
    [apiAlerts, alertId],
  )

  const facilityFromApi = useMemo(
    () =>
      rawApi
        ? mapApiAlertToFacilityAlert(rawApi, clientNameById, currentUser?.id)
        : null,
    [rawApi, clientNameById, currentUser?.id],
  )

  const demoAlert = demo.alerts.find((a) => a.id === alertId)
  const alert: FacilityAlert | null = facilityFromApi ?? demoAlert ?? null
  const demoTranscript = demo.transcripts.find((t) => t.alertId === alertId)
  const fromApi = Boolean(facilityFromApi)

  const linkedConversationId = useMemo(() => {
    if (!rawApi) return undefined
    const rc = rawApi.relatedConversation
    if (rc != null && String(rc).trim() !== "") return String(rc).trim()
    const ev = rawApi.evidence?.conversationId
    if (ev != null && String(ev).trim() !== "") return String(ev).trim()
    return undefined
  }, [rawApi])

  const skipLiveTranscript =
    !authed || !fromApi || !linkedConversationId || Boolean(demoTranscript)

  const {
    data: conversationDetail,
    isLoading: transcriptLoading,
    isError: transcriptError,
    error: transcriptFetchError,
  } = useGetConversationByIdQuery(linkedConversationId!, { skip: skipLiveTranscript })

  const liveTranscript = useMemo(() => {
    if (!conversationDetail) return null
    return mapConversationToTranscript(conversationDetail)
  }, [conversationDetail])

  const toggleAssign = (i: number) => {
    setAssigned((prev) => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  }

  const acknowledged = alert?.status === "acknowledged"
  const apiResolved = Boolean(rawApi?.resolvedAt)

  const handleResolve = async () => {
    if (!rawApi || !alertId || apiResolved) return
    const note = resolutionNote.trim()
    if (note.length < 1) {
      setResolveError(t("alertDetail.resolveNoteRequired"))
      return
    }
    setResolveError("")
    try {
      await resolveAlert({ alertId, resolutionNote: note }).unwrap()
      setResolutionNote("")
    } catch {
      setResolveError(t("alertDetail.resolveSaveError"))
    }
  }

  const handleAcknowledge = async () => {
    if (!alert || acknowledged) return
    if (rawApi && alertId) {
      try {
        await markRead({ alertId }).unwrap()
      } catch {
        /* refetch via invalidatesTags or show error — keep UI stable */
      }
    } else {
      acknowledgeAlert(alert.id)
    }
  }

  if (!alertId || !alert) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
        <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("alertDetail.notFound")}</p>
        <button type="button" className="va-btn-ghost" style={{ marginTop: 16, color: "var(--va-blue)" }} onClick={() => navigate("/alerts")}>
          {t("alertDetail.back")}
        </button>
      </div>
    )
  }

  return (
    <div
      data-testid="alert-detail-page"
      style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: 48 }}
    >
      {/* GET /alerts/:id returns 403 once read — detail uses GET /alerts?showRead=true list. */}

      <button type="button" className="va-btn-ghost" data-testid="alert-detail-back" onClick={() => navigate("/alerts")}>
        <ChevronLeftIcon size={16} />
        {t("alertDetail.back")}
      </button>

      <div className="va-card va-card-pad">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "var(--va-red-100)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--va-red-600)",
                  flexShrink: 0,
                }}
              >
                <AlertOctagonIcon size={20} />
              </div>
              <div>
                <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--va-navy)" }}>
                  {formatAlertType(alert.type)}
                  {t("alertDetail.alertTitleSuffix")}
                </h1>
                <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginTop: 4 }}>
                  {alert.residentName}
                  {fromApi
                    ? t("alertDetail.clientIdLine", { id: alert.residentId || "—" })
                    : t("alertDetail.roomDemo")}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="va-btn-primary"
              disabled={acknowledged || marking}
              onClick={() => void handleAcknowledge()}
              style={
                acknowledged
                  ? { background: "var(--va-slate-100)", color: "var(--va-slate-400)" }
                  : undefined
              }
            >
              {acknowledged ? (
                <>
                  <CheckIcon size={16} /> {t("alertDetail.acknowledged")}
                </>
              ) : (
                <>
                  <CheckIcon size={16} /> {t("alertDetail.acknowledge")}
                </>
              )}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <span
              style={{
                padding: "0.25rem 0.625rem",
                borderRadius: 999,
                fontSize: "0.75rem",
                fontWeight: 600,
                background: acknowledged ? "var(--va-amber-50)" : "var(--va-red-50)",
                color: acknowledged ? "var(--va-amber-700)" : "var(--va-red-700)",
              }}
            >
              {acknowledged ? t("alertDetail.statusAck") : t("alertDetail.statusNew")}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
              {t("alertDetail.detectedLine", {
                time: formatDetectedTime(alert.detectedAt),
                date: formatDetectedDate(alert.detectedAt),
              })}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>{t("alertDetail.confidence")}</span>
            <ConfidenceBar value={alert.confidence} />
          </div>
        </div>
      </div>

      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--va-red-500)" }}>⚠</span> {t("alertDetail.riskSummary")}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.6, marginBottom: 16 }}>{alert.summary}</p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {alert.riskIndicators.map((line) => (
            <li key={line} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: "0.875rem", color: "var(--va-slate-700)" }}>
              <span style={{ color: "var(--va-amber-500)", flexShrink: 0 }}>▸</span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>{t("alertDetail.recommended")}</h2>
        <p style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", marginBottom: 12 }}>
          {fromApi ? t("alertDetail.checklistApi") : t("alertDetail.checklistDemo")}
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {alert.recommendedActions.map((act, i) => (
            <li key={act.action} style={{ marginBottom: 10 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: "0.875rem" }}>
                <input type="checkbox" checked={assigned.has(i)} onChange={() => toggleAssign(i)} />
                <span>
                  <strong>{act.action}</strong>
                  <span style={{ color: "var(--va-slate-500)" }}>
                    {" "}
                    — {act.priority} · {act.assignTo}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {fromApi && rawApi ? (
        <div className="va-card va-card-pad">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>{t("alertDetail.resolutionTitle")}</h2>
          {apiResolved ? (
            <div style={{ fontSize: "0.875rem", color: "var(--va-slate-700)", lineHeight: 1.5 }}>
              <p style={{ margin: "0 0 8px" }}>
                <strong>{t("alertDetail.resolutionResolved")}</strong>
                {rawApi.resolvedAt ? ` · ${new Date(rawApi.resolvedAt).toLocaleString()}` : null}
              </p>
              {typeof rawApi.resolvedBy === "object" && rawApi.resolvedBy?.name ? (
                <p style={{ margin: "0 0 8px", color: "var(--va-slate-500)" }}>
                  {t("alertDetail.resolutionBy", { name: rawApi.resolvedBy.name })}
                </p>
              ) : null}
              {rawApi.resolutionNote ? (
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{rawApi.resolutionNote}</p>
              ) : null}
            </div>
          ) : (
            <>
              <AuthTextAreaField
                label={t("alertDetail.resolutionHint")}
                rows={4}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder={t("alertDetail.resolvePlaceholder")}
                style={{ width: "100%", resize: "vertical", marginBottom: 8 }}
              />
              {resolveError ? (
                <p className="va-login-error" style={{ marginBottom: 8 }} role="alert">
                  {resolveError}
                </p>
              ) : null}
              <button type="button" className="va-btn-primary" disabled={resolving} onClick={() => void handleResolve()}>
                {resolving ? t("alertDetail.saving") : t("alertDetail.markResolved")}
              </button>
            </>
          )}
        </div>
      ) : null}

      <AlertTranscriptBlock
        t={t}
        demoTranscript={demoTranscript}
        fromApi={fromApi}
        linkedConversationId={linkedConversationId}
        liveTranscript={liveTranscript}
        transcriptLoading={transcriptLoading}
        transcriptError={transcriptError}
        transcriptFetchError={transcriptFetchError}
      />
    </div>
  )
}

function transcriptErrorMessage(t: (key: string) => string, err: unknown): string {
  const e = err as FetchBaseQueryError | undefined
  const status = typeof e?.status === "number" ? e.status : null
  if (status === 403) return t("alertDetail.transcriptForbidden")
  if (status === 404) return t("alertDetail.transcriptNotFound")
  return t("alertDetail.transcriptLoadError")
}

function AlertTranscriptBlock({
  t,
  demoTranscript,
  fromApi,
  linkedConversationId,
  liveTranscript,
  transcriptLoading,
  transcriptError,
  transcriptFetchError,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string
  demoTranscript: Transcript | undefined
  fromApi: boolean
  linkedConversationId: string | undefined
  liveTranscript: ReturnType<typeof mapConversationToTranscript> | null
  transcriptLoading: boolean
  transcriptError: boolean
  transcriptFetchError: unknown
}) {
  if (demoTranscript) {
    return <TranscriptPanel transcript={demoTranscript} t={t} />
  }

  if (fromApi && linkedConversationId) {
    if (transcriptLoading) {
      return (
        <div className="va-card va-card-pad">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--va-blue)" }}>
              <MessageIcon size={18} />
            </span>
            {t("alertDetail.transcriptTitle")}
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", margin: 0 }}>{t("alertDetail.transcriptLoading")}</p>
        </div>
      )
    }
    if (transcriptError) {
      return (
        <div className="va-card va-card-pad">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--va-blue)" }}>
              <MessageIcon size={18} />
            </span>
            {t("alertDetail.transcriptTitle")}
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.6, margin: 0 }} role="alert">
            {transcriptErrorMessage(t, transcriptFetchError)}
          </p>
        </div>
      )
    }
    if (liveTranscript) {
      if (liveTranscript.lines.length === 0) {
        return (
          <div className="va-card va-card-pad">
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--va-blue)" }}>
                <MessageIcon size={18} />
              </span>
              {t("alertDetail.transcriptTitle")}
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.6, margin: 0 }}>
              {t("alertDetail.transcriptEmpty")}
            </p>
          </div>
        )
      }
      return <TranscriptPanel transcript={liveTranscript} t={t} />
    }

    return (
      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--va-blue)" }}>
            <MessageIcon size={18} />
          </span>
          {t("alertDetail.transcriptTitle")}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.6, margin: 0 }}>
          {t("alertDetail.transcriptLoadFailed")}
        </p>
      </div>
    )
  }

  return <TranscriptGapCard t={t} linkedConversationId={linkedConversationId} fromApi={fromApi} />
}

function TranscriptGapCard({
  t,
  linkedConversationId,
  fromApi,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string
  linkedConversationId?: string
  fromApi: boolean
}) {
  return (
    <div className="va-card va-card-pad">
      <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--va-blue)" }}>
          <MessageIcon size={18} />
        </span>
        {t("alertDetail.transcriptTitle")}
      </h2>
      <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.6, margin: 0 }}>
        {fromApi ? (
          linkedConversationId ? (
            t("alertDetail.transcriptLinkedRefresh", { id: linkedConversationId })
          ) : (
            t("alertDetail.transcriptNoConversation")
          )
        ) : (
          t("alertDetail.transcriptNoDemo")
        )}
      </p>
    </div>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "var(--va-red-500)" : value >= 60 ? "var(--va-amber-500)" : "var(--va-slate-400)"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 96, height: 8, background: "var(--va-slate-200)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 999, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--va-navy)" }}>{value}%</span>
    </div>
  )
}

function TranscriptPanel({
  transcript,
  t,
}: {
  transcript: { callDate: string; callTime: string; duration: string; lines: TranscriptLine[] }
  t: (key: string) => string
}) {
  const legend = ["neutral", "positive", "anxious", "confused", "distressed"]

  return (
    <div className="va-card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--va-slate-100)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--va-blue)" }}>
              <MessageIcon size={18} />
            </span>
            {t("alertDetail.transcriptTitle")}
          </h2>
          <div style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", display: "flex", gap: 16 }}>
            <span>{transcript.callDate}</span>
            <span>{transcript.duration}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          {legend.map((k) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--va-slate-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: SENTIMENT_DOT[k] ?? "var(--va-slate-300)" }} />
              {sentimentLabel(t, k)}
            </span>
          ))}
        </div>
      </div>
      <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: 12 }}>
        {transcript.lines.map((line, idx) => (
          <TranscriptLineRow key={`${line.timestamp}-${idx}`} line={line} t={t} />
        ))}
      </div>
    </div>
  )
}

function TranscriptLineRow({ line, t }: { line: TranscriptLine; t: (key: string) => string }) {
  const bianca = line.speaker === "bianca"
  const hasAnn = line.annotations.length > 0
  const critical = line.annotations.some((a) => a.type === "critical")

  return (
    <div style={{ display: "flex", justifyContent: bianca ? "flex-start" : "flex-end" }}>
      <div
        style={{
          maxWidth: "75%",
          borderRadius: 16,
          padding: "0.75rem 1rem",
          background: bianca ? "var(--va-slate-100)" : "rgba(37, 99, 235, 0.08)",
          borderTopLeftRadius: bianca ? 4 : 16,
          borderTopRightRadius: bianca ? 16 : 4,
          ...(hasAnn
            ? {
                borderLeft: critical ? "2px solid var(--va-red-400)" : "2px solid var(--va-amber-400)",
                background: critical ? "rgba(254, 242, 242, 0.5)" : "rgba(255, 251, 235, 0.6)",
                paddingLeft: "1rem",
              }
            : {}),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: SENTIMENT_DOT[line.sentiment] ?? "var(--va-slate-300)",
            }}
            title={sentimentLabel(t, line.sentiment)}
          />
          <span style={{ fontSize: "0.65rem", color: "var(--va-slate-400)", textTransform: "uppercase" }}>{line.timestamp}</span>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-800)", lineHeight: 1.5 }}>{line.text}</p>
        {line.annotations.map((a) => (
          <p key={a.label} style={{ fontSize: "0.75rem", marginTop: 8, padding: 8, borderRadius: 8, background: a.type === "critical" ? "var(--va-red-50)" : "var(--va-amber-50)", color: a.type === "critical" ? "var(--va-red-800)" : "var(--va-amber-900)" }}>
            <strong>{a.label}:</strong> {a.detail}
          </p>
        ))}
      </div>
    </div>
  )
}
