import type { CSSProperties, ReactNode } from "react"
import { skipToken } from "@reduxjs/toolkit/query"
import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { apiRecordId, mapClientToResident } from "../lib/liveData"
import { CONSENT_BULLETS } from "../data/residentMock"
import { useGetAllAlertsQuery } from "../services/api/alertApi"
import { useGetClientQuery } from "../services/api/clientApi"
import { useGetConversationsByClientQuery } from "../services/api/conversationApi"
import { useGetSentimentSummaryQuery, useGetSentimentTrendQuery } from "../services/api/sentimentApi"
import type { Client, SentimentSummary, SentimentTrendPoint } from "../services/api/api.types"
import { useAppSelector } from "../store/store"
import { CheckIcon, ChevronLeftIcon, ClockIcon, MessageIcon, PhoneIcon } from "../icons"

function formatDurationSeconds(sec?: number | null): string {
  if (sec == null || Number.isNaN(sec)) return "—"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}m ${s}s`
}

function formatConsentTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

type SentimentTimeRange = "lastCall" | "month" | "lifetime"

export function ResidentDetailPage() {
  const { residentId } = useParams()
  const navigate = useNavigate()
  const [consentOpen, setConsentOpen] = useState(false)
  const [sentimentTimeRange, setSentimentTimeRange] = useState<SentimentTimeRange>("lastCall")

  const authed = useAppSelector((s) => !!s.auth.tokens)

  const {
    data: apiClient,
    isLoading: clientLoading,
    isError: clientError,
    refetch,
  } = useGetClientQuery(residentId ? { id: residentId } : skipToken)

  const { data: convPages, isLoading: convLoading } = useGetConversationsByClientQuery(
    apiClient?.id ? { clientId: apiClient.id, limit: 20 } : skipToken,
  )

  const { data: apiAlerts } = useGetAllAlertsQuery(authed ? undefined : skipToken)

  const clientIdForApi = apiClient?.id ?? ""
  const {
    data: sentimentTrend,
    isLoading: sentimentTrendLoading,
    isError: sentimentTrendError,
  } = useGetSentimentTrendQuery(
    { clientId: clientIdForApi, timeRange: sentimentTimeRange },
    { skip: !clientIdForApi },
  )
  const {
    data: sentimentSummary,
    isLoading: sentimentSummaryLoading,
    isError: sentimentSummaryError,
  } = useGetSentimentSummaryQuery({ clientId: clientIdForApi }, { skip: !clientIdForApi })

  const resident = useMemo(() => (apiClient ? mapClientToResident(apiClient) : null), [apiClient])

  const clientAlert = useMemo(
    () => (apiAlerts ?? []).find((a) => String(a.relatedClient) === residentId),
    [apiAlerts, residentId],
  )
  const alertLinkId = clientAlert ? apiRecordId(clientAlert as { id?: string; _id?: string }) : ""

  const atRisk = resident?.status === "at_risk"

  const sentimentChartData = useMemo(() => {
    const pts = sentimentTrend?.dataPoints ?? []
    return pts
      .map((p, i) => {
        const score = p.sentiment?.sentimentScore
        const t = p.date ? new Date(p.date) : null
        const dateLabel =
          t && !Number.isNaN(t.getTime())
            ? t.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : `Call ${i + 1}`
        return { idx: i + 1, dateLabel, score: typeof score === "number" ? score : null }
      })
      .filter((row): row is { idx: number; dateLabel: string; score: number } => row.score !== null)
  }, [sentimentTrend?.dataPoints])

  const timeline = useMemo(() => {
    const rows = convPages?.results ?? []
    return [...rows]
      .sort((a, b) => {
        const ta = new Date(a.startTime ?? 0).getTime()
        const tb = new Date(b.startTime ?? 0).getTime()
        return tb - ta
      })
      .map((c, idx) => {
        const t = c.startTime ? new Date(c.startTime) : null
        const outcome = c.callOutcome
        const type =
          outcome === "no_answer" || outcome === "failed" ? ("no_answer" as const) : ("call" as const)
        return {
          id: String(c.id ?? c.callSid ?? `conv-${idx}`),
          type,
          description:
            outcome === "answered"
              ? `Call answered — ${formatDurationSeconds(c.duration)}`
              : `Call — ${outcome ?? c.status ?? "completed"} (${formatDurationSeconds(c.duration)})`,
          date: t ? t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—",
          time: t ? t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "",
        }
      })
  }, [convPages?.results])

  if (clientLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--va-slate-500)" }}>Loading client…</div>
    )
  }

  if (clientError || !resident || !apiClient) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
        <p style={{ color: "var(--va-slate-500)" }}>Resident not found</p>
        <button type="button" className="va-btn-ghost" style={{ marginTop: "1rem" }} onClick={() => navigate("/residents")}>
          Back to Residents
        </button>
        <button type="button" className="va-btn-primary" style={{ marginTop: "1rem", display: "block", margin: "1rem auto 0" }} onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    )
  }

  const initials = `${resident.firstName[0] ?? "?"}${resident.lastName[0] ?? ""}`
  const displayName = `${resident.firstName} ${resident.lastName}`.trim()

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <button type="button" className="va-btn-ghost" onClick={() => navigate("/residents")}>
        <ChevronLeftIcon size={16} />
        Back to Residents
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(37, 99, 235, 0.12)",
            color: "#1d4ed8",
            fontSize: "1.25rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div>
          <h1 className="va-page-title" style={{ fontSize: "1.75rem" }}>
            {displayName}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: 6, alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--va-slate-500)" }}>Room {resident.room}</span>
            <StatusPill status={resident.status} />
            <span style={{ fontSize: "0.875rem", color: "var(--va-slate-500)" }}>
              Age {resident.age > 0 ? resident.age : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Resident Information</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "0 2rem",
          }}
          className="va-res-grid"
        >
          <div>
            <InfoRow icon={<PhoneIcon size={16} />} label="Phone" value={resident.phone} />
            <InfoRow icon={<MessageIcon size={16} />} label="Email" value={apiClient.email || "—"} />
            <InfoRow icon={<ClockIcon size={16} />} label="Move-in Date" value={resident.moveInDate} />
            <InfoRow
              icon={<MessageIcon size={16} />}
              label="Emergency Contact"
              value={
                <>
                  {resident.emergencyContact.name} ({resident.emergencyContact.relationship})
                  <br />
                  {resident.emergencyContact.phone}
                </>
              }
            />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "0.75rem 0", borderBottom: "1px solid var(--va-slate-100)" }}>
              <span style={{ marginTop: 2, color: "var(--va-slate-400)" }}>
                <CheckIcon size={16} />
              </span>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>Consent Status</p>
                <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {resident.consentOnFile ? (
                    <>
                      <span style={{ color: "var(--va-emerald-500)" }}>
                        <CheckIcon size={16} />
                      </span>
                      <span style={{ color: "var(--va-emerald-700)" }}>On file</span>
                      {apiClient.consentedAt ? (
                        <span style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>
                          · {formatConsentTimestamp(apiClient.consentedAt)}
                        </span>
                      ) : null}
                      <button type="button" className="va-link" style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }} onClick={() => setConsentOpen(true)}>
                        View details
                      </button>
                    </>
                  ) : apiClient.consented === false ? (
                    <>
                      <span style={{ color: "var(--va-red-600)" }}>Not on file</span>
                      <button type="button" className="va-link" style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }} onClick={() => setConsentOpen(true)}>
                        View details
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "var(--va-amber-700)" }}>Pending</span>
                      <button type="button" className="va-link" style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }} onClick={() => setConsentOpen(true)}>
                        View details
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <InfoRow
              icon={<ClockIcon size={16} />}
              label="Last Call"
              value={
                <>
                  {resident.lastCallDate} at {resident.lastCallTime}{" "}
                  <span style={{ fontSize: "0.75rem", color: "var(--va-slate-400)" }}>
                    (
                    {resident.lastCallStatus === "completed"
                      ? "Completed"
                      : resident.lastCallStatus === "no_answer"
                        ? "No answer"
                        : "Declined"}
                    )
                  </span>
                </>
              }
            />
            {(apiClient.latestOverallRiskScore != null || apiClient.sentimentTrendDirection) && (
              <InfoRow
                icon={<MessageIcon size={16} />}
                label="Scores"
                value={
                  <span style={{ fontSize: "0.875rem" }}>
                    {apiClient.latestOverallRiskScore != null && <>Risk score: {apiClient.latestOverallRiskScore}</>}
                    {apiClient.sentimentTrendDirection && (
                      <>
                        {apiClient.latestOverallRiskScore != null ? " · " : ""}
                        Sentiment trend: {apiClient.sentimentTrendDirection}
                      </>
                    )}
                  </span>
                }
              />
            )}
          </div>
        </div>
      </div>

      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Activity Timeline</h2>
        {convLoading ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>Loading conversations…</p>
        ) : timeline.length === 0 ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>No recent conversations.</p>
        ) : (
          <div style={{ position: "relative", paddingLeft: 24 }}>
            <div
              style={{
                position: "absolute",
                left: 7,
                top: 8,
                bottom: 8,
                width: 1,
                background: "var(--va-slate-200)",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {timeline.map((e) => (
                <div key={e.id} style={{ position: "relative", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: -24,
                      top: 6,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: "2px solid #fff",
                      background: e.type === "no_answer" ? "#fbbf24" : "var(--va-emerald-500)",
                    }}
                  />
                  <div>
                    <p style={{ fontSize: "0.875rem", color: "var(--va-navy)" }}>{e.description}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", marginTop: 4 }}>
                      {e.date} at {e.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.35rem" }}>Sentiment analysis</h2>
        <p style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", marginBottom: "1rem", lineHeight: 1.45 }}>
          Same timescales as the mobile app — powered by{" "}
          <code style={{ fontSize: "0.7rem" }}>/sentiment/client/:id/trend</code> and{" "}
          <code style={{ fontSize: "0.7rem" }}>/summary</code>.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "1rem" }}>
          {(
            [
              { id: "lastCall" as const, label: "Last call" },
              { id: "month" as const, label: "Past month" },
              { id: "lifetime" as const, label: "Lifetime" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSentimentTimeRange(tab.id)}
              className={sentimentTimeRange === tab.id ? "va-btn-primary" : "va-btn-ghost"}
              style={{
                fontSize: "0.8125rem",
                padding: "0.35rem 0.75rem",
                borderRadius: 999,
                ...(sentimentTimeRange === tab.id ? {} : { border: "1px solid var(--va-slate-200)" }),
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(sentimentTrendLoading || sentimentSummaryLoading) && (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>Loading sentiment…</p>
        )}

        {(sentimentTrendError || sentimentSummaryError) && !sentimentTrendLoading && !sentimentSummaryLoading && (
          <p style={{ color: "var(--va-red-600)", fontSize: "0.875rem" }}>
            Could not load sentiment for this resident.
          </p>
        )}

        {!sentimentTrendLoading &&
          !sentimentSummaryLoading &&
          !sentimentTrendError &&
          !sentimentSummaryError &&
          sentimentSummary &&
          sentimentTrend && (
            <>
              {sentimentTimeRange === "lastCall" ? (
                <SentimentLastCallPanel point={sentimentSummary.recentTrend?.[0]} formatDuration={formatDurationSeconds} />
              ) : (
                <>
                  <SentimentSummaryStrip summary={sentimentSummary} />
                  {sentimentSummary.recentTrend && sentimentSummary.recentTrend.length > 0 && (
                    <div style={{ marginTop: "1rem" }}>
                      <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--va-slate-600)", marginBottom: 8 }}>
                        Recent analyzed calls
                      </h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {sentimentSummary.recentTrend.slice(0, 8).map((pt) => (
                          <SentimentRecentChip key={pt.conversationId} point={pt} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                      <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--va-slate-600)", margin: 0 }}>
                        Sentiment trend ({sentimentTrend.timeRange})
                      </h3>
                      <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
                        Avg {sentimentTrend.summary.averageSentiment >= 0 ? "+" : ""}
                        {sentimentTrend.summary.averageSentiment.toFixed(2)} ·{" "}
                        <span style={trendDirectionStyle(sentimentTrend.summary.trendDirection)}>
                          {trendDirectionIcon(sentimentTrend.summary.trendDirection)}{" "}
                          {sentimentTrend.summary.trendDirection}
                        </span>
                        {sentimentTrend.summary.confidence < 0.5 && (
                          <span style={{ color: "var(--va-amber-700)", marginLeft: 6 }}>Low confidence</span>
                        )}
                      </span>
                    </div>
                    {sentimentChartData.length === 0 ? (
                      <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginTop: 12 }}>
                        {(sentimentTrend.analyzedConversations ?? 0) > 0
                          ? "Not enough scored conversations in this range to draw a trend line."
                          : "No sentiment analysis yet for conversations in this range."}
                      </p>
                    ) : sentimentChartData.length < 2 ? (
                      <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginTop: 12 }}>
                        At least two analyzed calls are needed to show a trend line.
                      </p>
                    ) : (
                      <div style={{ height: 220, marginTop: 12 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sentimentChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: "#94a3b8" }} interval="preserveStartEnd" />
                            <YAxis domain={[-1, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} width={32} />
                            <Tooltip
                              contentStyle={{ borderRadius: 8, fontSize: 12 }}
                              formatter={(v: number) => [`${v >= 0 ? "+" : ""}${v.toFixed(2)}`, "Sentiment"]}
                            />
                            <Line
                              type="monotone"
                              dataKey="score"
                              name="Sentiment"
                              stroke="#2563eb"
                              strokeWidth={2}
                              dot={{ r: 3, fill: "#2563eb" }}
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {sentimentTrend.summary.keyInsights && sentimentTrend.summary.keyInsights.length > 0 && (
                      <div
                        style={{
                          marginTop: "1rem",
                          padding: "0.75rem 1rem",
                          borderRadius: "0.75rem",
                          background: "var(--va-slate-50)",
                          fontSize: "0.8125rem",
                          color: "var(--va-slate-700)",
                        }}
                      >
                        <p style={{ fontWeight: 600, marginBottom: 8 }}>Key insights</p>
                        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                          {sentimentTrend.summary.keyInsights.map((line) => (
                            <li key={line} style={{ marginBottom: 4 }}>
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

        {atRisk && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              background: "var(--va-red-50)",
              border: "1px solid var(--va-red-100)",
              fontSize: "0.875rem",
              color: "var(--va-red-700)",
            }}
          >
            Resident is flagged at risk — review conversations and alerts.
          </div>
        )}
      </div>

      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Recent Conversations</h2>
        {convLoading ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>Loading…</p>
        ) : (convPages?.results ?? []).length === 0 ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>No conversations yet.</p>
        ) : (
          <div>
            {(convPages?.results ?? []).map((c) => {
              const t = c.startTime ? new Date(c.startTime) : null
              const dateStr = t
                ? t.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                : "—"
              return (
                <div key={c.id ?? c.callSid} style={{ padding: "0.75rem 0", borderBottom: "1px solid var(--va-slate-100)", display: "flex", gap: 12 }}>
                  <span style={{ marginTop: 4, color: "var(--va-slate-400)", flexShrink: 0 }}>
                    <MessageIcon size={16} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{dateStr}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--va-slate-400)" }}>{formatDurationSeconds(c.duration)}</span>
                      {c.callOutcome && (
                        <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>{c.callOutcome}</span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.875rem", marginTop: 4, color: "var(--va-slate-600)" }}>
                      {(c.messages?.length ?? 0) > 0
                        ? `${c.messages!.length} messages`
                        : "WEB_API_GAP: expand GET /conversations/:id to render transcript lines here."}
                    </p>
                  </div>
                </div>
              )
            })}
            {clientAlert && alertLinkId ? (
              <p style={{ marginTop: 12 }}>
                <Link to={`/alerts/${alertLinkId}`} className="va-link" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  View related alert
                  <span style={{ display: "inline-block", transform: "rotate(180deg)" }}>
                    <ChevronLeftIcon size={12} />
                  </span>
                </Link>
              </p>
            ) : null}
          </div>
        )}
      </div>

      {consentOpen && (
        <ConsentModal client={apiClient} displayName={displayName} onClose={() => setConsentOpen(false)} />
      )}

      <style>{`
        @media (min-width: 768px) {
          .va-res-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function trendDirectionIcon(dir: string): string {
  if (dir === "improving") return "↗"
  if (dir === "declining") return "↘"
  return "→"
}

function trendDirectionStyle(dir: string): CSSProperties {
  if (dir === "improving") return { color: "var(--va-emerald-600)" }
  if (dir === "declining") return { color: "var(--va-red-600)" }
  return { color: "var(--va-slate-500)" }
}

function SentimentSummaryStrip({ summary }: { summary: SentimentSummary }) {
  const dist = summary.sentimentDistribution || {}
  const parts = (["positive", "neutral", "negative", "mixed"] as const)
    .map((k) => ({ k, n: dist[k] ?? 0 }))
    .filter((x) => x.n > 0)
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 12,
        padding: "0.75rem 0",
        borderBottom: "1px solid var(--va-slate-100)",
      }}
    >
      <div>
        <p style={{ fontSize: "0.65rem", color: "var(--va-slate-400)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Analyzed
        </p>
        <p style={{ fontSize: "1rem", fontWeight: 600, marginTop: 4 }}>
          {summary.analyzedConversations} / {summary.totalConversations}
        </p>
      </div>
      <div>
        <p style={{ fontSize: "0.65rem", color: "var(--va-slate-400)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Average
        </p>
        <p style={{ fontSize: "1rem", fontWeight: 600, marginTop: 4 }}>
          {summary.averageSentiment >= 0 ? "+" : ""}
          {summary.averageSentiment.toFixed(2)}
        </p>
      </div>
      <div>
        <p style={{ fontSize: "0.65rem", color: "var(--va-slate-400)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Direction
        </p>
        <p style={{ fontSize: "1rem", fontWeight: 600, marginTop: 4, ...trendDirectionStyle(summary.trendDirection) }}>
          {trendDirectionIcon(summary.trendDirection)} {summary.trendDirection}
        </p>
      </div>
      <div>
        <p style={{ fontSize: "0.65rem", color: "var(--va-slate-400)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Confidence
        </p>
        <p style={{ fontSize: "1rem", fontWeight: 600, marginTop: 4 }}>{Math.round(summary.confidence * 100)}%</p>
      </div>
      {parts.length > 0 && (
        <div style={{ gridColumn: "1 / -1" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--va-slate-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Distribution
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {parts.map(({ k, n }) => (
              <span
                key={k}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.2rem 0.5rem",
                  borderRadius: 6,
                  background: "var(--va-slate-100)",
                  color: "var(--va-slate-700)",
                }}
              >
                {k}: {n}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function sentimentScoreStyles(score: number): { fg: string; bg: string } {
  if (score > 0.3) return { fg: "var(--va-emerald-600)", bg: "rgba(16, 185, 129, 0.12)" }
  if (score < -0.3) return { fg: "var(--va-red-600)", bg: "rgba(239, 68, 68, 0.1)" }
  return { fg: "var(--va-slate-600)", bg: "var(--va-slate-100)" }
}

function SentimentRecentChip({ point }: { point: SentimentTrendPoint }) {
  const s = point.sentiment
  const t = point.date ? new Date(point.date) : null
  const dateStr =
    t && !Number.isNaN(t.getTime()) ? t.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"
  if (!s) {
    return (
      <span
        style={{
          fontSize: "0.75rem",
          padding: "0.35rem 0.6rem",
          borderRadius: 8,
          border: "1px solid var(--va-slate-200)",
          color: "var(--va-slate-500)",
        }}
      >
        {dateStr} — pending
      </span>
    )
  }
  const { fg, bg } = sentimentScoreStyles(s.sentimentScore)
  return (
    <span
      style={{
        fontSize: "0.75rem",
        padding: "0.35rem 0.6rem",
        borderRadius: 8,
        border: `1px solid var(--va-slate-200)`,
        color: fg,
        background: bg,
      }}
    >
      {dateStr}: {s.overallSentiment} ({s.sentimentScore >= 0 ? "+" : ""}
      {s.sentimentScore.toFixed(1)})
    </span>
  )
}

function SentimentLastCallPanel({
  point,
  formatDuration,
}: {
  point?: SentimentTrendPoint
  formatDuration: (sec?: number | null) => string
}) {
  if (!point?.sentiment) {
    return (
      <div style={{ padding: "1rem 0", fontSize: "0.875rem", color: "var(--va-slate-500)" }}>
        <p style={{ fontWeight: 600, color: "var(--va-slate-700)", marginBottom: 8 }}>Last call</p>
        <p>
          No analyzed sentiment for the most recent call yet, or there are no qualifying conversations in the summary.
        </p>
      </div>
    )
  }
  const s = point.sentiment
  const scoreSt = sentimentScoreStyles(s.sentimentScore)
  const callDate = point.date ? new Date(point.date) : null
  return (
    <div>
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--va-slate-700)", marginBottom: 12 }}>Last call</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12, fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
        <span>
          {callDate && !Number.isNaN(callDate.getTime())
            ? callDate.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
            : "—"}
        </span>
        <span>Duration {formatDuration(point.duration)}</span>
        {point.sentimentAnalyzedAt && (
          <span style={{ color: "var(--va-slate-400)" }}>
            Analyzed{" "}
            {new Date(point.sentimentAnalyzedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
      <div
        style={{
          padding: "1rem",
          borderRadius: "0.75rem",
          background: "var(--va-slate-50)",
          border: "1px solid var(--va-slate-100)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              padding: "0.25rem 0.5rem",
              borderRadius: 6,
              background: scoreSt.bg,
              color: scoreSt.fg,
            }}
          >
            {s.overallSentiment}
          </span>
          <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--va-navy)" }}>
            Score {s.sentimentScore >= 0 ? "+" : ""}
            {s.sentimentScore.toFixed(2)}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
            Confidence {Math.round(s.confidence * 100)}%
          </span>
        </div>
        {s.clientMood && (
          <p style={{ fontSize: "0.875rem", marginBottom: 6 }}>
            <strong>Mood:</strong> {s.clientMood}
          </p>
        )}
        {s.concernLevel && (
          <p style={{ fontSize: "0.875rem", marginBottom: 6 }}>
            <strong>Concern:</strong> {s.concernLevel}
          </p>
        )}
        {s.keyEmotions && s.keyEmotions.length > 0 && (
          <p style={{ fontSize: "0.875rem", marginBottom: 6 }}>
            <strong>Emotions:</strong> {s.keyEmotions.join(", ")}
          </p>
        )}
        {s.summary && <p style={{ fontSize: "0.875rem", lineHeight: 1.5, color: "var(--va-slate-700)" }}>{s.summary}</p>}
        {s.recommendations && (
          <p style={{ fontSize: "0.8125rem", lineHeight: 1.5, color: "var(--va-slate-600)", marginTop: 8 }}>
            <strong>Recommendations:</strong> {s.recommendations}
          </p>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: "active" | "inactive" | "at_risk" }) {
  const map = {
    active: { bg: "var(--va-emerald-100)", fg: "var(--va-emerald-700)", label: "Active" },
    inactive: { bg: "var(--va-slate-100)", fg: "var(--va-slate-600)", label: "Inactive" },
    at_risk: { bg: "var(--va-red-100)", fg: "var(--va-red-700)", label: "At Risk" },
  }
  const s = map[status]
  return (
    <span style={{ display: "inline-flex", padding: "0.125rem 0.625rem", borderRadius: 999, fontSize: "0.75rem", fontWeight: 500, background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "0.75rem 0", borderBottom: "1px solid var(--va-slate-100)" }}>
      <span style={{ marginTop: 2, color: "var(--va-slate-400)" }}>{icon}</span>
      <div>
        <p style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{label}</p>
        <p style={{ fontSize: "0.875rem", color: "var(--va-navy)", marginTop: 4 }}>{value}</p>
      </div>
    </div>
  )
}

function ConsentModal({ client, displayName, onClose }: { client: Client; displayName: string; onClose: () => void }) {
  const statusLabel =
    client.consented === true ? "On file" : client.consented === false ? "Not on file" : "Pending"
  const statusColor =
    client.consented === true
      ? "var(--va-emerald-700)"
      : client.consented === false
        ? "var(--va-red-600)"
        : "var(--va-amber-700)"

  return (
    <div className="va-modal-backdrop" role="dialog" aria-modal onClick={onClose}>
      <div className="va-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "1.25rem 2rem", borderBottom: "1px solid var(--va-slate-200)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Client consent</h2>
            <p style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", marginTop: 4 }}>
              Status from Bianca (same field as email consent flow). Signed PDF storage is not attached yet.
            </p>
          </div>
          <button type="button" className="va-icon-btn" aria-label="Close" onClick={onClose} style={{ color: "var(--va-slate-400)" }}>
            ×
          </button>
        </div>
        <div style={{ padding: "1.5rem 2rem", fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.6 }}>
          <div style={{ background: "var(--va-slate-50)", borderRadius: 12, padding: "1rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase" }}>Resident</span>
                <p style={{ fontWeight: 600, color: "var(--va-slate-700)" }}>{displayName}</p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase" }}>Status</span>
                <p style={{ fontWeight: 600, color: statusColor }}>{statusLabel}</p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase" }}>Recorded</span>
                <p style={{ fontWeight: 600, color: "var(--va-slate-700)" }}>{formatConsentTimestamp(client.consentedAt)}</p>
              </div>
              {client.consentEmailVersion ? (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase" }}>Email version</span>
                  <p style={{ fontWeight: 600, color: "var(--va-slate-700)" }}>{client.consentEmailVersion}</p>
                </div>
              ) : null}
            </div>
          </div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Program scope (summary of what consent covers):</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {CONSENT_BULLETS.map((b) => (
              <li key={b} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <span style={{ color: "var(--va-teal)", flexShrink: 0 }}>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ padding: "1rem 2rem", borderTop: "1px solid var(--va-slate-200)", background: "var(--va-slate-50)", borderRadius: "0 0 1rem 1rem", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="va-btn-primary" style={{ background: "var(--va-navy)" }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
