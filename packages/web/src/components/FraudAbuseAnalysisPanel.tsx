import { useState, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import type { FraudAbuseAnalysisResult } from "../services/api/fraudAbuseAnalysisApi"
import { useGetFraudAbuseAnalysisQuery, useTriggerFraudAbuseAnalysisMutation } from "../services/api/fraudAbuseAnalysisApi"

const MIN_DATA_POINTS = 5

function getRiskLevel(
  score: number | undefined,
  labels: { critical: string; high: string; medium: string; low: string },
) {
  const s = score != null ? Number(score) : 0
  if (s >= 70) return { level: labels.critical, color: "var(--va-red-700)", bg: "var(--va-red-50)" }
  if (s >= 50) return { level: labels.high, color: "var(--va-red-600)", bg: "var(--va-red-50)" }
  if (s >= 30) return { level: labels.medium, color: "var(--va-amber-700)", bg: "var(--va-amber-50)" }
  return { level: labels.low, color: "var(--va-emerald-700)", bg: "var(--va-emerald-50)" }
}

function formatScore(value: number | undefined): string {
  return value != null && Number.isFinite(value) ? String(Math.round(value)) : "—"
}

const reportCard: CSSProperties = {
  border: "1px solid var(--va-slate-200)",
  borderRadius: "0.75rem",
  background: "var(--va-slate-50)",
  padding: "0.9rem 1rem",
}

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: "0.9375rem",
  fontWeight: 600,
  color: "var(--va-slate-800)",
}

function MetricRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "0.4rem 0",
        borderBottom: "1px solid var(--va-slate-100)",
        fontSize: "0.8125rem",
      }}
    >
      <span style={{ color: "var(--va-slate-600)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor ?? "var(--va-navy)" }}>{value}</span>
    </div>
  )
}

type Props = {
  clientId: string
}

export function FraudAbuseAnalysisPanel({ clientId }: Props) {
  const { t } = useTranslation()
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

  const riskLabels = {
    critical: t("fraudAbuse.riskCritical"),
    high: t("fraudAbuse.riskHigh"),
    medium: t("fraudAbuse.riskMedium"),
    low: t("fraudAbuse.riskLow"),
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  if (!clientId) {
    return <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)" }}>{t("fraudAbuse.selectResident")}</p>
  }

  if (isLoading && !analysisResponse) {
    return <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)" }}>{t("fraudAbuse.loading")}</p>
  }

  if (isError) {
    const msg =
      error && typeof error === "object" && "data" in error
        ? String((error as { data?: { message?: string } }).data?.message ?? "")
        : ""
    return (
      <p style={{ fontSize: "0.875rem", color: "var(--va-red-600)" }}>
        {msg ? t("fraudAbuse.loadErrorSuffix", { message: msg }) : t("fraudAbuse.loadError")}
      </p>
    )
  }

  if (!latest) {
    return <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)" }}>{t("fraudAbuse.noData")}</p>
  }

  const overall = getRiskLevel(latest.overallRiskScore, riskLabels)
  const fin = latest.financialRisk
  const abs = latest.abuseRisk
  const rel = latest.relationshipRisk

  return (
    <div style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--va-slate-500)" }}>{t("fraudAbuse.pastMonthNote")}</p>
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
              /* refetch on success; errors surface via RTK */
            }
          }}
        >
          {triggerLoading || isFetching ? t("fraudAbuse.running") : t("fraudAbuse.refreshAnalysis")}
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
          borderLeftWidth: 3,
          borderLeftColor: "var(--va-red-400)",
        }}
      >
        <span style={{ color: "var(--va-red-600)", fontSize: "0.9rem" }} aria-hidden>
          ⚠
        </span>
        <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.5, color: "var(--va-slate-700)" }}>{t("fraudAbuse.disclaimer")}</p>
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
            border: "1px solid var(--va-amber-200)",
            borderLeftWidth: 3,
            borderLeftColor: "var(--va-amber-500)",
          }}
        >
          <span style={{ color: "var(--va-amber-700)" }} aria-hidden>
            ℹ
          </span>
          <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.45, color: "var(--va-amber-900)" }}>
            {t("fraudAbuse.insufficientData", { count: conversationCount, min: MIN_DATA_POINTS })}
          </p>
        </div>
      ) : null}

      <div style={reportCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <h3 style={sectionTitle}>{t("common.analysisOverview")}</h3>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0.2rem 0.55rem",
              borderRadius: 999,
              background: overall.bg,
              color: overall.color,
              fontSize: "0.7rem",
              fontWeight: 700,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: overall.color }} />
            {overall.level}
          </span>
        </div>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "var(--va-slate-500)" }}>
          {latest.analysisDate ? new Date(latest.analysisDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, textAlign: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--va-navy)" }}>{data?.conversationCount ?? 0}</p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.68rem", color: "var(--va-slate-500)" }}>{t("common.statConversations")}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--va-navy)" }}>{data?.messageCount ?? 0}</p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.68rem", color: "var(--va-slate-500)" }}>{t("common.statMessages")}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: overall.color }}>{formatScore(latest.overallRiskScore)}</p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.68rem", color: "var(--va-slate-500)" }}>{t("fraudAbuse.overallRisk")}</p>
          </div>
        </div>
        {data?.totalWords != null ? (
          <p style={{ margin: "0.75rem 0 0", textAlign: "center", fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
            {t("common.wordsAnalyzed", { count: data.totalWords })}
          </p>
        ) : null}
      </div>

      <div style={reportCard}>
        <button
          type="button"
          onClick={() => toggle("financial")}
          className="va-btn-ghost"
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "none",
            padding: 0,
            marginBottom: 4,
            cursor: "pointer",
            background: "transparent",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.1rem" }} aria-hidden>
              💵
            </span>
            <span style={sectionTitle}>{t("fraudAbuse.sectionFinancial")}</span>
          </span>
          <span style={{ color: "var(--va-slate-400)", fontSize: "0.75rem" }}>{expanded.has("financial") ? "▲" : "▼"}</span>
        </button>
        {fin ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 700, color: getRiskLevel(fin.riskScore, riskLabels).color }}>
                {formatScore(fin.riskScore)}
              </span>
              <span style={{ fontSize: "1rem", color: "var(--va-slate-500)" }}>%</span>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.8rem",
                fontWeight: 600,
                color: getRiskLevel(fin.riskScore, riskLabels).color,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: getRiskLevel(fin.riskScore, riskLabels).color,
                }}
              />
              {getRiskLevel(fin.riskScore, riskLabels).level}
            </span>
          </div>
        ) : null}
        {expanded.has("financial") && fin ? (
          <div style={{ paddingTop: 2 }}>
            <MetricRow label={t("fraudAbuse.metricLargeAmountMentions")} value={String(fin.largeAmountMentions ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricTransferMethodMentions")} value={String(fin.transferMethodMentions ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricScamIndicators")} value={String(fin.scamIndicatorMentions ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricUrgencyMentions")} value={String(fin.urgencyMentions ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricHelpRequests")} value={String(fin.helpRequestMentions ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricRelationshipMoney")} value={String(fin.relationshipMoneyMentions ?? 0)} />
          </div>
        ) : null}
      </div>

      <div style={reportCard}>
        <button
          type="button"
          onClick={() => toggle("abuse")}
          className="va-btn-ghost"
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "none",
            padding: 0,
            marginBottom: 4,
            cursor: "pointer",
            background: "transparent",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.1rem" }} aria-hidden>
              ⚠️
            </span>
            <span style={sectionTitle}>{t("fraudAbuse.sectionAbuse")}</span>
          </span>
          <span style={{ color: "var(--va-slate-400)", fontSize: "0.75rem" }}>{expanded.has("abuse") ? "▲" : "▼"}</span>
        </button>
        {abs ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 700, color: getRiskLevel(abs.riskScore, riskLabels).color }}>
                {formatScore(abs.riskScore)}
              </span>
              <span style={{ fontSize: "1rem", color: "var(--va-slate-500)" }}>%</span>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.8rem",
                fontWeight: 600,
                color: getRiskLevel(abs.riskScore, riskLabels).color,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: getRiskLevel(abs.riskScore, riskLabels).color,
                }}
              />
              {getRiskLevel(abs.riskScore, riskLabels).level}
            </span>
          </div>
        ) : null}
        {expanded.has("abuse") && abs ? (
          <div style={{ paddingTop: 2 }}>
            <MetricRow label={t("fraudAbuse.metricPhysicalAbuseScore")} value={formatScore(abs.physicalAbuseScore)} />
            <MetricRow label={t("fraudAbuse.metricEmotionalAbuseScore")} value={formatScore(abs.emotionalAbuseScore)} />
            <MetricRow label={t("fraudAbuse.metricNeglectScore")} value={formatScore(abs.neglectScore)} />
            <MetricRow label={t("fraudAbuse.metricInjuryMentions")} value={String(abs.injuryMentions ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricIsolationMentions")} value={String(abs.isolationMentions ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricFearMentions")} value={String(abs.fearMentions ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricBasicNeeds")} value={String(abs.basicNeedsMentions ?? 0)} />
          </div>
        ) : null}
      </div>

      <div style={reportCard}>
        <button
          type="button"
          onClick={() => toggle("relationship")}
          className="va-btn-ghost"
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "none",
            padding: 0,
            marginBottom: 4,
            cursor: "pointer",
            background: "transparent",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.1rem" }} aria-hidden>
              👥
            </span>
            <span style={sectionTitle}>{t("fraudAbuse.sectionRelationship")}</span>
          </span>
          <span style={{ color: "var(--va-slate-400)", fontSize: "0.75rem" }}>{expanded.has("relationship") ? "▲" : "▼"}</span>
        </button>
        {rel ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 700, color: getRiskLevel(rel.riskScore, riskLabels).color }}>
                {formatScore(rel.riskScore)}
              </span>
              <span style={{ fontSize: "1rem", color: "var(--va-slate-500)" }}>%</span>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.8rem",
                fontWeight: 600,
                color: getRiskLevel(rel.riskScore, riskLabels).color,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: getRiskLevel(rel.riskScore, riskLabels).color,
                }}
              />
              {getRiskLevel(rel.riskScore, riskLabels).level}
            </span>
          </div>
        ) : null}
        {expanded.has("relationship") && rel ? (
          <div style={{ paddingTop: 2 }}>
            <MetricRow label={t("fraudAbuse.metricNewPeople")} value={String(rel.newPeopleCount ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricIsolation")} value={String(rel.isolationCount ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricControl")} value={String(rel.controlCount ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricDependency")} value={String(rel.dependencyCount ?? 0)} />
            <MetricRow label={t("fraudAbuse.metricSuspiciousBehavior")} value={String(rel.suspiciousBehaviorCount ?? 0)} />
          </div>
        ) : null}
      </div>

      {latest.warnings && latest.warnings.length > 0 ? (
        <div
          style={{
            ...reportCard,
            background: "var(--va-amber-50)",
            borderColor: "var(--va-amber-200)",
          }}
        >
          <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--va-amber-950)", marginBottom: 8 }}>{t("common.warningsHeading")}</h4>
          {latest.warnings.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: "0.8125rem", color: "var(--va-amber-950)" }}>
              <span style={{ color: "var(--va-amber-600)" }} aria-hidden>
                ●
              </span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div
          style={{
            ...reportCard,
            background: "var(--va-slate-50)",
            borderColor: "var(--va-amber-100)",
          }}
        >
          <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--va-slate-800)", marginBottom: 8 }}>Recommendations</h4>
          {recommendations.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, fontSize: "0.8125rem" }}>
              <span
                style={{ color: r.priority === "high" ? "var(--va-red-500)" : "var(--va-amber-600)" }}
                aria-hidden
              >
                ●
              </span>
              <div>
                <strong style={{ color: "var(--va-slate-800)" }}>{r.action}</strong>
                {r.description ? <p style={{ margin: "0.25rem 0 0", color: "var(--va-slate-600)", lineHeight: 1.45 }}>{r.description}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
