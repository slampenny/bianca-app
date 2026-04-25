import { useMemo, useState } from "react"
import type { FraudAbuseAnalysisResult } from "../services/api/fraudAbuseAnalysisApi"
import { useGetFraudAbuseAnalysisQuery, useTriggerFraudAbuseAnalysisMutation } from "../services/api/fraudAbuseAnalysisApi"

const MIN_DATA_POINTS = 5

function getRiskLevel(score: number | undefined, labels: { critical: string; high: string; medium: string; low: string }) {
  const s = score != null ? Number(score) : 0
  if (s >= 70) return { level: labels.critical, color: "var(--va-red-700)", bg: "var(--va-red-50)" }
  if (s >= 50) return { level: labels.high, color: "var(--va-red-600)", bg: "var(--va-red-50)" }
  if (s >= 30) return { level: labels.medium, color: "var(--va-amber-700)", bg: "var(--va-amber-50)" }
  return { level: labels.low, color: "var(--va-emerald-700)", bg: "var(--va-emerald-50)" }
}

function formatScore(value: number | undefined): string {
  return value != null && Number.isFinite(value) ? String(Math.round(value)) : "—"
}

type Props = {
  clientId: string
}

export function FraudAbuseAnalysisPanel({ clientId }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["financial", "abuse", "relationship"]))

  const {
    data: analysisResponse,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useGetFraudAbuseAnalysisQuery({ clientId, timeRange: "month" }, { skip: !clientId })

  const [triggerAnalysis, { isLoading: triggerLoading }] = useTriggerFraudAbuseAnalysisMutation()

  const latest = analysisResponse?.data?.analysis as FraudAbuseAnalysisResult | undefined
  const data = analysisResponse?.data
  const recommendations = data?.recommendations ?? []
  const conversationCount = data?.conversationCount ?? latest?.conversationCount ?? 0
  const hasInsufficientData = Boolean(latest && conversationCount > 0 && conversationCount < MIN_DATA_POINTS)

  const riskLabels = useMemo(
    () => ({
      critical: "Critical",
      high: "High",
      medium: "Medium",
      low: "Low",
    }),
    [],
  )

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  if (!clientId) {
    return <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)" }}>Select a resident to view fraud and abuse analysis.</p>
  }

  if (isLoading && !analysisResponse) {
    return <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)" }}>Loading fraud and abuse analysis…</p>
  }

  if (isError) {
    const msg =
      error && typeof error === "object" && "data" in error
        ? String((error as { data?: { message?: string } }).data?.message ?? "")
        : ""
    return (
      <p style={{ fontSize: "0.875rem", color: "var(--va-red-600)" }}>
        Could not load fraud and abuse analysis{msg ? `: ${msg}` : ""}.
      </p>
    )
  }

  if (!latest) {
    return <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)" }}>No fraud and abuse analysis available yet.</p>
  }

  const overall = getRiskLevel(latest.overallRiskScore, riskLabels)
  const fin = latest.financialRisk
  const abs = latest.abuseRisk
  const rel = latest.relationshipRisk

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
          Same analysis as the mobile app — <code style={{ fontSize: "0.68rem" }}>GET /fraud-abuse-analysis/:clientId</code> (past month).
        </p>
        <button
          type="button"
          className="va-btn-ghost"
          style={{ fontSize: "0.8125rem", border: "1px solid var(--va-slate-200)", borderRadius: 8, padding: "0.35rem 0.75rem" }}
          disabled={triggerLoading || isFetching}
          onClick={async () => {
            try {
              await triggerAnalysis({ clientId }).unwrap()
              await refetch()
            } catch {
              /* RTK already surfaces; refetch on success */
            }
          }}
        >
          {triggerLoading || isFetching ? "Running…" : "Refresh analysis"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          padding: "0.65rem 0.75rem",
          borderRadius: "0.75rem",
          background: "var(--va-red-50)",
          border: "1px solid var(--va-red-100)",
        }}
      >
        <span style={{ color: "var(--va-red-600)", fontSize: "0.9rem" }} aria-hidden>
          ⚠
        </span>
        <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.45, color: "var(--va-slate-700)" }}>
          This report uses automated models and is not a clinical or legal finding. Use it to prioritize follow-up only.
        </p>
      </div>

      {hasInsufficientData ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            padding: "0.65rem 0.75rem",
            borderRadius: "0.75rem",
            background: "var(--va-amber-50)",
            border: "1px solid var(--va-amber-100)",
          }}
        >
          <span style={{ color: "var(--va-amber-700)" }} aria-hidden>
            ℹ
          </span>
          <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.45, color: "var(--va-amber-900)" }}>
            Only {conversationCount} conversation(s) in range; analysis is more reliable with at least {MIN_DATA_POINTS}.
          </p>
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid var(--va-slate-200)",
          borderRadius: "0.75rem",
          background: "var(--va-slate-50)",
          padding: "0.85rem 1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--va-slate-800)" }}>Overview</h3>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0.2rem 0.5rem",
              borderRadius: 999,
              background: overall.bg,
              color: overall.color,
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            {overall.level}
          </span>
        </div>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
          {latest.analysisDate ? new Date(latest.analysisDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--va-navy)" }}>{data?.conversationCount ?? 0}</p>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.7rem", color: "var(--va-slate-500)" }}>Conversations</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--va-navy)" }}>{data?.messageCount ?? 0}</p>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.7rem", color: "var(--va-slate-500)" }}>Messages</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: overall.color }}>{formatScore(latest.overallRiskScore)}</p>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.7rem", color: "var(--va-slate-500)" }}>Overall risk</p>
          </div>
          {data?.totalWords != null ? (
            <div>
              <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--va-navy)" }}>{data.totalWords}</p>
              <p style={{ margin: "0.15rem 0 0", fontSize: "0.7rem", color: "var(--va-slate-500)" }}>Words</p>
            </div>
          ) : null}
        </div>
      </div>

      <section
        style={{
          border: "1px solid var(--va-slate-200)",
          borderRadius: "0.75rem",
          background: "var(--va-slate-50)",
          padding: "0.75rem 0.9rem",
        }}
      >
        <button
          type="button"
          onClick={() => toggle("financial")}
          className="va-btn-ghost"
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", border: "none", padding: 0 }}
        >
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--va-slate-800)" }}>Financial risk</span>
          <span style={{ color: "var(--va-slate-400)" }}>{expanded.has("financial") ? "▼" : "▶"}</span>
        </button>
        {fin ? (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: getRiskLevel(fin.riskScore, riskLabels).color }}>
              {formatScore(fin.riskScore)}%
            </span>
            <span style={{ fontSize: "0.75rem", color: getRiskLevel(fin.riskScore, riskLabels).color, fontWeight: 600 }}>
              {getRiskLevel(fin.riskScore, riskLabels).level}
            </span>
          </div>
        ) : null}
        {expanded.has("financial") && fin ? (
          <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--va-slate-700)" }}>
            <li>Large amount mentions: {fin.largeAmountMentions ?? 0}</li>
            <li>Transfer method mentions: {fin.transferMethodMentions ?? 0}</li>
            <li>Scam indicators: {fin.scamIndicatorMentions ?? 0}</li>
            <li>Urgency mentions: {fin.urgencyMentions ?? 0}</li>
            <li>Help requests: {fin.helpRequestMentions ?? 0}</li>
            <li>Relationship / money: {fin.relationshipMoneyMentions ?? 0}</li>
          </ul>
        ) : null}
      </section>

      <section
        style={{
          border: "1px solid var(--va-slate-200)",
          borderRadius: "0.75rem",
          background: "var(--va-slate-50)",
          padding: "0.75rem 0.9rem",
        }}
      >
        <button
          type="button"
          onClick={() => toggle("abuse")}
          className="va-btn-ghost"
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", border: "none", padding: 0 }}
        >
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--va-slate-800)" }}>Abuse & neglect risk</span>
          <span style={{ color: "var(--va-slate-400)" }}>{expanded.has("abuse") ? "▼" : "▶"}</span>
        </button>
        {abs ? (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: getRiskLevel(abs.riskScore, riskLabels).color }}>
              {formatScore(abs.riskScore)}%
            </span>
            <span style={{ fontSize: "0.75rem", color: getRiskLevel(abs.riskScore, riskLabels).color, fontWeight: 600 }}>
              {getRiskLevel(abs.riskScore, riskLabels).level}
            </span>
          </div>
        ) : null}
        {expanded.has("abuse") && abs ? (
          <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--va-slate-700)" }}>
            <li>Physical abuse score: {formatScore(abs.physicalAbuseScore)}</li>
            <li>Emotional abuse score: {formatScore(abs.emotionalAbuseScore)}</li>
            <li>Neglect score: {formatScore(abs.neglectScore)}</li>
            <li>Injury mentions: {abs.injuryMentions ?? 0}</li>
            <li>Isolation mentions: {abs.isolationMentions ?? 0}</li>
            <li>Fear mentions: {abs.fearMentions ?? 0}</li>
            <li>Basic needs: {abs.basicNeedsMentions ?? 0}</li>
          </ul>
        ) : null}
      </section>

      <section
        style={{
          border: "1px solid var(--va-slate-200)",
          borderRadius: "0.75rem",
          background: "var(--va-slate-50)",
          padding: "0.75rem 0.9rem",
        }}
      >
        <button
          type="button"
          onClick={() => toggle("relationship")}
          className="va-btn-ghost"
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", border: "none", padding: 0 }}
        >
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--va-slate-800)" }}>Relationship risk</span>
          <span style={{ color: "var(--va-slate-400)" }}>{expanded.has("relationship") ? "▼" : "▶"}</span>
        </button>
        {rel ? (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: getRiskLevel(rel.riskScore, riskLabels).color }}>
              {formatScore(rel.riskScore)}%
            </span>
            <span style={{ fontSize: "0.75rem", color: getRiskLevel(rel.riskScore, riskLabels).color, fontWeight: 600 }}>
              {getRiskLevel(rel.riskScore, riskLabels).level}
            </span>
          </div>
        ) : null}
        {expanded.has("relationship") && rel ? (
          <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--va-slate-700)" }}>
            <li>New people: {rel.newPeopleCount ?? 0}</li>
            <li>Isolation: {rel.isolationCount ?? 0}</li>
            <li>Control: {rel.controlCount ?? 0}</li>
            <li>Dependency: {rel.dependencyCount ?? 0}</li>
            <li>Suspicious behavior: {rel.suspiciousBehaviorCount ?? 0}</li>
          </ul>
        ) : null}
      </section>

      {latest.warnings && latest.warnings.length > 0 ? (
        <div
          style={{
            border: "1px solid var(--va-red-100)",
            borderRadius: "0.75rem",
            background: "var(--va-red-50)",
            padding: "0.75rem 0.9rem",
          }}
        >
          <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "var(--va-red-800)" }}>Warnings</h4>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--va-red-800)" }}>
            {latest.warnings.map((w, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div
          style={{
            border: "1px solid var(--va-amber-100)",
            borderRadius: "0.75rem",
            background: "var(--va-amber-50)",
            padding: "0.75rem 0.9rem",
          }}
        >
          <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "var(--va-slate-800)" }}>Recommendations</h4>
          <ul style={{ margin: "0.5rem 0 0", padding: 0, listStyle: "none", fontSize: "0.8125rem", color: "var(--va-slate-800)" }}>
            {recommendations.map((r, i) => (
              <li key={i} style={{ marginBottom: 10, paddingLeft: 0 }}>
                <strong style={{ color: "var(--va-amber-900)" }}>{r.action}</strong>
                {r.description ? <p style={{ margin: "0.25rem 0 0", color: "var(--va-slate-700)" }}>{r.description}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
