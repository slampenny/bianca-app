import { skipToken } from "@reduxjs/toolkit/query"
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { apiRecordId, mapApiAlertToFacilityAlert } from "../lib/liveData"
import { useGetAllAlertsQuery, useMarkAlertAsReadMutation } from "../services/api/alertApi"
import { useGetAllClientsQuery } from "../services/api/clientApi"
import { useDemo, useDemoActions } from "../state/DemoContext"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { formatAlertType, formatDetectedDate, formatDetectedTime } from "../lib/timeFormat"
import { AlertOctagonIcon, CheckIcon, ChevronLeftIcon, MessageIcon } from "../icons"
import type { Alert as FacilityAlert, TranscriptLine } from "../types"

const SENTIMENT_DOT: Record<string, string> = {
  neutral: "var(--va-slate-300)",
  positive: "var(--va-emerald-400)",
  anxious: "var(--va-amber-400)",
  confused: "#fb923c",
  distressed: "var(--va-red-500)",
}

const SENTIMENT_LABEL: Record<string, string> = {
  neutral: "Neutral",
  positive: "Positive",
  anxious: "Anxious",
  confused: "Confused",
  distressed: "Distressed",
}

export function AlertDetailPage() {
  const { alertId } = useParams()
  const navigate = useNavigate()
  const authed = useAppSelector((s) => !!s.auth.tokens)
  const currentUser = useAppSelector(getCurrentUser)
  const { state: demo } = useDemo()
  const { acknowledgeAlert } = useDemoActions()
  const [assigned, setAssigned] = useState<Set<number>>(() => new Set())
  const [markRead, { isLoading: marking }] = useMarkAlertAsReadMutation()

  const { data: apiAlerts } = useGetAllAlertsQuery(authed ? undefined : skipToken)
  const { data: clientPages } = useGetAllClientsQuery(authed ? { limit: 500, page: 1 } : skipToken)

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of clientPages?.results ?? []) {
      const id = apiRecordId(c as { id?: string; _id?: string })
      if (id) m.set(id, c.name)
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
  const transcript = demo.transcripts.find((t) => t.alertId === alertId)
  const fromApi = Boolean(facilityFromApi)

  const toggleAssign = (i: number) => {
    setAssigned((prev) => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  }

  const acknowledged = alert?.status === "acknowledged"

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
        <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>Alert not found.</p>
        <button type="button" className="va-btn-ghost" style={{ marginTop: 16, color: "var(--va-blue)" }} onClick={() => navigate("/alerts")}>
          Back to Alerts
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: 48 }}>
      {/* WEB_API_GAP: GET /alerts/:id returns 403 once read — detail uses GET /alerts?showRead=true list. */}
      {/* WEB_API_GAP: No transcript on alert; wire GET /conversations/:conversationId for live transcript. */}

      <button type="button" className="va-btn-ghost" onClick={() => navigate("/alerts")}>
        <ChevronLeftIcon size={16} />
        Back to Alerts
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
                <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--va-navy)" }}>{formatAlertType(alert.type)} Alert</h1>
                <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginTop: 4 }}>
                  {alert.residentName}
                  {fromApi ? ` · Client ${alert.residentId || "—"}` : " · Room 204A"}
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
                  <CheckIcon size={16} /> Acknowledged
                </>
              ) : (
                <>
                  <CheckIcon size={16} /> Acknowledge
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
              {acknowledged ? "Acknowledged" : "New"}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
              Detected {formatDetectedTime(alert.detectedAt)} · {formatDetectedDate(alert.detectedAt)}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>Confidence</span>
            <ConfidenceBar value={alert.confidence} />
          </div>
        </div>
      </div>

      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--va-red-500)" }}>⚠</span> Risk Summary
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
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Recommended actions</h2>
        <p style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", marginBottom: 12 }}>
          {fromApi ? "Checklist is local only (not persisted)." : "Toggle to mark assignment tracking (demo)."}
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

      {transcript ? (
        <TranscriptPanel transcript={transcript} />
      ) : (
        <TranscriptGapCard relatedConversationId={rawApi?.relatedConversation ? String(rawApi.relatedConversation) : undefined} />
      )}
    </div>
  )
}

function TranscriptGapCard({ relatedConversationId }: { relatedConversationId?: string }) {
  return (
    <div className="va-card va-card-pad">
      <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--va-blue)" }}>
          <MessageIcon size={18} />
        </span>
        Call Transcript
      </h2>
      <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.6 }}>
        <strong>WEB_API_GAP:</strong> Transcript UI is not wired to{" "}
        <code style={{ fontSize: "0.75rem" }}>GET /conversations/:conversationId</code> or client message
        endpoints.{" "}
        {relatedConversationId ? (
          <>
            This alert references conversation <code style={{ fontSize: "0.75rem" }}>{relatedConversationId}</code> — hook that
            fetch here when ready.
          </>
        ) : (
          "No relatedConversation on this alert."
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

function TranscriptPanel({ transcript }: { transcript: { callDate: string; callTime: string; duration: string; lines: TranscriptLine[] } }) {
  const legend = Object.keys(SENTIMENT_LABEL)

  return (
    <div className="va-card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--va-slate-100)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--va-blue)" }}>
              <MessageIcon size={18} />
            </span>
            Call Transcript
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
              {SENTIMENT_LABEL[k] ?? k}
            </span>
          ))}
        </div>
      </div>
      <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: 12 }}>
        {transcript.lines.map((line, idx) => (
          <TranscriptLineRow key={`${line.timestamp}-${idx}`} line={line} />
        ))}
      </div>
    </div>
  )
}

function TranscriptLineRow({ line }: { line: TranscriptLine }) {
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
            title={SENTIMENT_LABEL[line.sentiment] ?? line.sentiment}
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
