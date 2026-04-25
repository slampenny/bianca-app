import { useState, type CSSProperties } from "react"
import type { MedicalAnalysisResult, MedicalAnalysisSummaryResponse } from "../services/api/medicalAnalysisApi"

const MIN_DATA_POINTS = 5

const MEDICAL_DISCLAIMER =
  "This analysis is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for medical concerns."

function invertRiskScore(riskScore: number | undefined): number | undefined {
  if (riskScore === undefined || riskScore === null) return undefined
  return Math.round(100 - riskScore)
}

function getHealthLevel(invertedScore: number): { level: string; color: string } {
  if (invertedScore >= 70) return { level: "Good", color: "var(--va-emerald-700)" }
  if (invertedScore >= 40) return { level: "Fair", color: "var(--va-amber-700)" }
  return { level: "Poor", color: "var(--va-red-600)" }
}

function getRiskLabel(score: number): { level: string; color: string } {
  if (score >= 70) return { level: "High", color: "var(--va-red-600)" }
  if (score >= 40) return { level: "Medium", color: "var(--va-amber-700)" }
  return { level: "Low", color: "var(--va-emerald-700)" }
}

function getCognitiveInterpretation(metrics: MedicalAnalysisResult["cognitiveMetrics"]): string {
  if (!metrics) return "No data available for this section."
  const riskScore = metrics.riskScore ?? 0
  if (riskScore < 30) return "Communication patterns appear normal with no significant cognitive concerns detected."
  if (riskScore < 50) return "Some mild changes in communication patterns detected. Monitor for progression."
  if (riskScore < 70) return "Moderate changes in communication patterns observed. Consider professional evaluation."
  return "Significant changes in communication patterns detected. Professional evaluation strongly recommended."
}

function getPsychiatricInterpretation(metrics: MedicalAnalysisResult["psychiatricMetrics"]): string {
  if (!metrics) return "No data available for this section."
  const overallRisk = metrics.overallRiskScore ?? 0
  const hasCrisis = metrics.crisisIndicators?.hasCrisisIndicators
  if (hasCrisis) {
    return "Crisis indicators detected. Immediate professional intervention is strongly recommended."
  }
  if (overallRisk < 40) return "Mental health indicators appear stable with no significant concerns."
  if (overallRisk < 60) return "Some mild mental health indicators detected. Continue monitoring."
  if (overallRisk < 80) return "Moderate mental health indicators observed. Consider professional consultation."
  return "Significant mental health indicators detected. Professional consultation recommended."
}

function getVocabularyInterpretation(metrics: MedicalAnalysisResult["vocabularyMetrics"]): string {
  if (!metrics) return "No data available for this section."
  const complexity = metrics.complexityScore ?? 0
  if (complexity >= 70) return "Language complexity and vocabulary usage appear strong and well-maintained."
  if (complexity >= 50) return "Language complexity and vocabulary usage are within normal ranges."
  return "Language complexity and vocabulary usage appear limited. Monitor for changes."
}

function getConfidenceStyles(conf: string | undefined): { bg: string; fg: string; dot: string } {
  switch (conf) {
    case "high":
      return { bg: "var(--va-emerald-50)", fg: "var(--va-emerald-800)", dot: "var(--va-emerald-500)" }
    case "medium":
      return { bg: "var(--va-amber-50)", fg: "var(--va-amber-900)", dot: "var(--va-amber-500)" }
    case "low":
    case "none":
      return { bg: "var(--va-red-50)", fg: "var(--va-red-800)", dot: "var(--va-red-500)" }
    default:
      return { bg: "var(--va-slate-100)", fg: "var(--va-slate-700)", dot: "var(--va-slate-400)" }
  }
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
  summary: MedicalAnalysisSummaryResponse | undefined
  latestResult: MedicalAnalysisResult | undefined
  isLoading: boolean
  isError: boolean
}

export function MedicalAnalysisReportPanel({ summary, latestResult, isLoading, isError }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["cognitive", "psychiatric", "vocabulary"]))

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  if (isLoading) {
    return <p style={{ marginTop: "0.9rem", color: "var(--va-slate-500)", fontSize: "0.875rem" }}>Loading medical analysis…</p>
  }
  if (isError) {
    return (
      <p style={{ marginTop: "0.9rem", color: "var(--va-red-600)", fontSize: "0.875rem" }}>
        Could not load medical analysis for this resident.
      </p>
    )
  }
  const hasData = Boolean(summary?.data?.hasData || latestResult)
  if (!hasData) {
    return <p style={{ marginTop: "0.9rem", color: "var(--va-slate-500)", fontSize: "0.875rem" }}>No medical analysis available yet.</p>
  }

  const latest = latestResult
  const overallHealth = summary?.data?.summary?.overallHealthScore
  const conversationCount = summary?.data?.conversationCount ?? summary?.data?.summary?.totalConversations ?? latest?.conversationCount
  const messageCount = summary?.data?.messageCount ?? latest?.messageCount
  const totalWords = latest?.totalWords
  const lastDate = summary?.data?.lastAnalysisDate ?? summary?.data?.summary?.lastAnalysisDate ?? latest?.analysisDate
  const riskIndicators = summary?.data?.summary?.riskIndicators ?? []
  const concerns = summary?.data?.summary?.concerns ?? []
  const recommendations = latest?.recommendations ?? []
  const confidence = latest?.confidence
  const confStyles = getConfidenceStyles(confidence)

  const hasInsufficientData = latest && (latest.conversationCount || 0) < MIN_DATA_POINTS

  const cognitiveInv = invertRiskScore(latest?.cognitiveMetrics?.riskScore)
  const psychiatricInv = invertRiskScore(latest?.psychiatricMetrics?.overallRiskScore)
  const complexity = latest?.vocabularyMetrics?.complexityScore
  const c0 = complexity ?? 0
  const vocabLabel = c0 >= 70 ? "Good" : c0 >= 40 ? "Fair" : "Poor"
  const vocabColor = c0 >= 70 ? "var(--va-emerald-700)" : c0 >= 40 ? "var(--va-amber-700)" : "var(--va-red-600)"

  return (
    <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.75rem", maxWidth: 720 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: "0.65rem 0.75rem",
          borderRadius: "0.75rem",
          background: "var(--va-amber-50)",
          border: "1px solid var(--va-amber-100)",
        }}
      >
        <span style={{ fontSize: "1rem" }} aria-hidden>
          ⚕
        </span>
        <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.5, color: "var(--va-slate-700)" }}>{MEDICAL_DISCLAIMER}</p>
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
            Limited data: {latest?.conversationCount ?? 0} call(s) analyzed. For more reliable results, {MIN_DATA_POINTS} or more calls over a longer period are recommended.
          </p>
        </div>
      ) : null}

      {/* Overview */}
      <div style={reportCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <h3 style={sectionTitle}>Overview</h3>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0.25rem 0.5rem",
              borderRadius: 999,
              background: confStyles.bg,
              color: confStyles.fg,
              fontSize: "0.7rem",
              fontWeight: 700,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: confStyles.dot }} />
            {(confidence ?? "none").toUpperCase()} confidence
          </span>
        </div>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "var(--va-slate-500)" }}>
          {lastDate ? new Date(lastDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
        </p>
        {overallHealth != null ? (
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
            <strong>Overall health score:</strong>{" "}
            <span
              style={{
                fontWeight: 700,
                color: overallHealth < 50 ? "var(--va-red-600)" : overallHealth < 70 ? "var(--va-amber-700)" : "var(--va-emerald-700)",
              }}
            >
              {Math.round(overallHealth)}%
            </span>
          </p>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, textAlign: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--va-navy)" }}>{conversationCount ?? "—"}</p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.68rem", color: "var(--va-slate-500)" }}>Conversations</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--va-navy)" }}>{messageCount ?? "—"}</p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.68rem", color: "var(--va-slate-500)" }}>Messages</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--va-navy)" }}>{totalWords != null ? totalWords : "—"}</p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.68rem", color: "var(--va-slate-500)" }}>Total words</p>
          </div>
        </div>
      </div>

      {latest ? (
        <>
          {/* Cognitive */}
          <div style={reportCard}>
            <button
              type="button"
              className="va-btn-ghost"
              onClick={() => toggle("cognitive")}
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
                  🧠
                </span>
                <span style={sectionTitle}>Cognitive health</span>
              </span>
              <span style={{ color: "var(--va-slate-400)", fontSize: "0.75rem" }}>{expanded.has("cognitive") ? "▲" : "▼"}</span>
            </button>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--va-teal-700, #0f766e)" }}>
                  {cognitiveInv != null ? cognitiveInv : "—"}
                </span>
                <span style={{ fontSize: "1rem", color: "var(--va-slate-500)" }}>%</span>
              </div>
              {cognitiveInv != null ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: getHealthLevel(cognitiveInv).color,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: getHealthLevel(cognitiveInv).color }} />
                  {getHealthLevel(cognitiveInv).level}
                </span>
              ) : null}
            </div>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", lineHeight: 1.5, color: "var(--va-slate-600)" }}>
              {getCognitiveInterpretation(latest.cognitiveMetrics)}
            </p>
            {expanded.has("cognitive") && latest.cognitiveMetrics ? (
              <div style={{ paddingTop: 4 }}>
                <MetricRow
                  label="Filler words"
                  value={`${((latest.cognitiveMetrics.fillerWordDensity ?? 0) * 100).toFixed(1)}%`}
                />
                <MetricRow
                  label="Vague references"
                  value={`${((latest.cognitiveMetrics.vagueReferenceDensity ?? 0) * 100).toFixed(1)}%`}
                />
                {latest.cognitiveMetrics.temporalConfusionCount !== undefined ? (
                  <MetricRow label="Temporal confusion" value={String(latest.cognitiveMetrics.temporalConfusionCount)} />
                ) : null}
                {latest.cognitiveMetrics.wordFindingDifficultyCount !== undefined ? (
                  <MetricRow label="Word-finding difficulty" value={String(latest.cognitiveMetrics.wordFindingDifficultyCount)} />
                ) : null}
                {latest.cognitiveMetrics.repetitionScore !== undefined ? (
                  <MetricRow label="Repetition" value={`${latest.cognitiveMetrics.repetitionScore.toFixed(1)}%`} />
                ) : null}
                {latest.cognitiveMetrics.informationDensity?.score !== undefined ? (
                  <MetricRow
                    label="Information density"
                    value={`${latest.cognitiveMetrics.informationDensity.score.toFixed(1)}%`}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Mental health */}
          <div style={reportCard}>
            <button
              type="button"
              className="va-btn-ghost"
              onClick={() => toggle("psychiatric")}
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
                  ❤️
                </span>
                <span style={sectionTitle}>Mental health</span>
              </span>
              <span style={{ color: "var(--va-slate-400)", fontSize: "0.75rem" }}>{expanded.has("psychiatric") ? "▲" : "▼"}</span>
            </button>
            {latest.psychiatricMetrics?.crisisIndicators?.hasCrisisIndicators ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0.5rem 0.65rem",
                  borderRadius: 8,
                  background: "var(--va-red-50)",
                  border: "1px solid var(--va-red-100)",
                  marginBottom: 8,
                }}
              >
                <span style={{ color: "var(--va-red-600)" }} aria-hidden>
                  ⚠
                </span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--va-red-800)" }}>Crisis indicators present</span>
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--va-teal-700, #0f766e)" }}>
                  {psychiatricInv != null ? psychiatricInv : "—"}
                </span>
                <span style={{ fontSize: "1rem", color: "var(--va-slate-500)" }}>%</span>
              </div>
              {psychiatricInv != null ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: getHealthLevel(psychiatricInv).color,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: getHealthLevel(psychiatricInv).color }} />
                  {getHealthLevel(psychiatricInv).level}
                </span>
              ) : null}
            </div>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", lineHeight: 1.5, color: "var(--va-slate-600)" }}>
              {getPsychiatricInterpretation(latest.psychiatricMetrics)}
            </p>
            {expanded.has("psychiatric") && latest.psychiatricMetrics ? (
              <div style={{ paddingTop: 4 }}>
                <MetricRow
                  label="Depression score"
                  value={`${(latest.psychiatricMetrics.depressionScore ?? 0).toFixed(0)}%`}
                  valueColor={getRiskLabel(latest.psychiatricMetrics.depressionScore ?? 0).color}
                />
                <MetricRow
                  label="Anxiety score"
                  value={`${(latest.psychiatricMetrics.anxietyScore ?? 0).toFixed(0)}%`}
                  valueColor={getRiskLabel(latest.psychiatricMetrics.anxietyScore ?? 0).color}
                />
                {latest.psychiatricMetrics.emotionalTone ? (
                  <>
                    <MetricRow
                      label="Emotional tone"
                      value={latest.psychiatricMetrics.emotionalTone.dominantTone ?? "neutral"}
                    />
                    {latest.psychiatricMetrics.emotionalTone.negativeRatio != null ? (
                      <MetricRow
                        label="Negative ratio"
                        value={`${(latest.psychiatricMetrics.emotionalTone.negativeRatio * 100).toFixed(1)}%`}
                      />
                    ) : null}
                  </>
                ) : null}
                {latest.psychiatricMetrics.protectiveFactors !== undefined && latest.psychiatricMetrics.protectiveFactors !== "" ? (
                  <MetricRow
                    label="Protective factors"
                    value={String(latest.psychiatricMetrics.protectiveFactors)}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Language */}
          <div style={reportCard}>
            <button
              type="button"
              className="va-btn-ghost"
              onClick={() => toggle("vocabulary")}
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
                  💬
                </span>
                <span style={sectionTitle}>Language & vocabulary</span>
              </span>
              <span style={{ color: "var(--va-slate-400)", fontSize: "0.75rem" }}>{expanded.has("vocabulary") ? "▲" : "▼"}</span>
            </button>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--va-teal-700, #0f766e)" }}>
                  {latest.vocabularyMetrics?.complexityScore != null ? Math.round(latest.vocabularyMetrics.complexityScore) : "—"}
                </span>
                <span style={{ fontSize: "1rem", color: "var(--va-slate-500)" }}>%</span>
              </div>
              {complexity != null ? (
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: vocabColor,
                  }}
                >
                  {vocabLabel}
                </span>
              ) : null}
            </div>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", lineHeight: 1.5, color: "var(--va-slate-600)" }}>
              {getVocabularyInterpretation(latest.vocabularyMetrics)}
            </p>
            {expanded.has("vocabulary") && latest.vocabularyMetrics ? (
              <div style={{ paddingTop: 4 }}>
                {latest.vocabularyMetrics.typeTokenRatio != null ? (
                  <MetricRow
                    label="Type–token ratio"
                    value={`${(latest.vocabularyMetrics.typeTokenRatio * 100).toFixed(1)}%`}
                  />
                ) : null}
                {latest.vocabularyMetrics.avgWordLength != null ? (
                  <MetricRow label="Avg. word length" value={latest.vocabularyMetrics.avgWordLength.toFixed(1)} />
                ) : null}
                {latest.vocabularyMetrics.avgSentenceLength != null ? (
                  <MetricRow label="Avg. sentence length" value={latest.vocabularyMetrics.avgSentenceLength.toFixed(1)} />
                ) : null}
                {latest.vocabularyMetrics.uniqueWords != null ? (
                  <MetricRow label="Unique words" value={String(latest.vocabularyMetrics.uniqueWords)} />
                ) : null}
              </div>
            ) : null}
          </div>

          {latest.cognitiveMetrics?.indicators && latest.cognitiveMetrics.indicators.length > 0 ? (
            <div
              style={{
                ...reportCard,
                background: "var(--va-amber-50)",
                borderColor: "var(--va-amber-100)",
              }}
            >
              <h3 style={{ ...sectionTitle, marginBottom: 8 }}>Key indicators</h3>
              {latest.cognitiveMetrics.indicators.map((indicator, index) => (
                <div key={index} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: "0.8125rem", color: "var(--va-slate-700)" }}>
                  <span style={{ color: indicator.severity === "high" ? "var(--va-red-500)" : "var(--va-amber-600)" }} aria-hidden>
                    ●
                  </span>
                  <span>{indicator.message ?? String(indicator)}</span>
                </div>
              ))}
            </div>
          ) : null}

          {latest.warnings && latest.warnings.length > 0 ? (
            <div
              style={{
                ...reportCard,
                background: "var(--va-amber-50)",
                borderColor: "var(--va-amber-200)",
              }}
            >
              <h3 style={{ ...sectionTitle, marginBottom: 8 }}>Warnings & insights</h3>
              {latest.warnings.map((w, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: "0.8125rem", color: "var(--va-amber-950)" }}>
                  <span aria-hidden>⚠</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {riskIndicators.length > 0 ? (
        <div style={{ ...reportCard, background: "var(--va-red-50)", borderColor: "var(--va-red-100)" }}>
          <h3 style={{ ...sectionTitle, color: "var(--va-red-800)", marginBottom: 8 }}>Risk indicators (summary)</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--va-red-800)" }}>
            {riskIndicators.map((r, i) => (
              <li key={`${r.category}-${i}`}>{r.description}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div style={reportCard}>
          <h3 style={{ ...sectionTitle, marginBottom: 8 }}>Recommendations</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--va-slate-700)" }}>
            {recommendations.map((r, i) => (
              <li key={`${r.title || "rec"}-${i}`}>{r.title || r.description || "Recommendation"}</li>
            ))}
          </ul>
        </div>
      ) : concerns.length > 0 ? (
        <div style={reportCard}>
          <h3 style={{ ...sectionTitle, marginBottom: 8 }}>Concerns (summary)</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--va-slate-700)" }}>
            {concerns.map((c, i) => (
              <li key={`${c.category}-${i}`}>{c.description}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
