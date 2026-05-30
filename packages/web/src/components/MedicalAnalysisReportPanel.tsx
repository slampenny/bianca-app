import { useState, type CSSProperties } from "react"
import { useTranslation, type TFunction } from "react-i18next"
import type { MedicalAnalysisResult, MedicalAnalysisSummaryResponse } from "../services/api/medicalAnalysisApi"

const MIN_DATA_POINTS = 5

function invertRiskScore(riskScore: number | undefined): number | undefined {
  if (riskScore === undefined || riskScore === null) return undefined
  return Math.round(100 - riskScore)
}

function getHealthLevel(invertedScore: number, t: (key: string) => string): { level: string; color: string } {
  if (invertedScore >= 70) return { level: t("medicalAnalysis.healthGood"), color: "var(--va-emerald-700)" }
  if (invertedScore >= 40) return { level: t("medicalAnalysis.healthFair"), color: "var(--va-amber-700)" }
  return { level: t("medicalAnalysis.healthPoor"), color: "var(--va-red-600)" }
}

function getRiskLabel(score: number, t: (key: string) => string): { level: string; color: string } {
  if (score >= 70) return { level: t("medicalAnalysis.riskHigh"), color: "var(--va-red-600)" }
  if (score >= 40) return { level: t("medicalAnalysis.riskMedium"), color: "var(--va-amber-700)" }
  return { level: t("medicalAnalysis.riskLow"), color: "var(--va-emerald-700)" }
}

function getCognitiveInterpretation(metrics: MedicalAnalysisResult["cognitiveMetrics"], t: TFunction): string {
  if (!metrics) return t("medicalAnalysis.noSectionData")
  const riskScore = metrics.riskScore ?? 0
  if (riskScore < 30) return t("medicalAnalysis.cognitiveInterpNormal")
  if (riskScore < 50) return t("medicalAnalysis.cognitiveInterpMild")
  if (riskScore < 70) return t("medicalAnalysis.cognitiveInterpModerate")
  return t("medicalAnalysis.cognitiveInterpSignificant")
}

function getPsychiatricInterpretation(metrics: MedicalAnalysisResult["psychiatricMetrics"], t: TFunction): string {
  if (!metrics) return t("medicalAnalysis.noSectionData")
  const overallRisk = metrics.overallRiskScore ?? 0
  const hasCrisis = metrics.crisisIndicators?.hasCrisisIndicators
  if (hasCrisis) return t("medicalAnalysis.psychiatricInterpCrisis")
  if (overallRisk < 40) return t("medicalAnalysis.psychiatricInterpStable")
  if (overallRisk < 60) return t("medicalAnalysis.psychiatricInterpMild")
  if (overallRisk < 80) return t("medicalAnalysis.psychiatricInterpModerate")
  return t("medicalAnalysis.psychiatricInterpSignificant")
}

function getVocabularyInterpretation(metrics: MedicalAnalysisResult["vocabularyMetrics"], t: TFunction): string {
  if (!metrics) return t("medicalAnalysis.noSectionData")
  const complexity = metrics.complexityScore ?? 0
  if (complexity >= 70) return t("medicalAnalysis.vocabInterpStrong")
  if (complexity >= 50) return t("medicalAnalysis.vocabInterpNormal")
  return t("medicalAnalysis.vocabInterpLimited")
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
  const { t } = useTranslation()
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
    return <p style={{ marginTop: "0.9rem", color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("medicalAnalysis.loading")}</p>
  }
  if (isError) {
    return (
      <p style={{ marginTop: "0.9rem", color: "var(--va-red-600)", fontSize: "0.875rem" }}>{t("medicalAnalysis.loadError")}</p>
    )
  }
  const hasData = Boolean(summary?.data?.hasData || latestResult)
  if (!hasData) {
    return <p style={{ marginTop: "0.9rem", color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("medicalAnalysis.noData")}</p>
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
  const vocabLabel = c0 >= 70 ? t("medicalAnalysis.healthGood") : c0 >= 40 ? t("medicalAnalysis.healthFair") : t("medicalAnalysis.healthPoor")
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
        <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.5, color: "var(--va-slate-700)" }}>{t("medicalAnalysis.disclaimer")}</p>
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
            {t("medicalAnalysis.insufficientData", { count: latest?.conversationCount ?? 0, min: MIN_DATA_POINTS })}
          </p>
        </div>
      ) : null}

      {/* Overview */}
      <div style={reportCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <h3 style={sectionTitle}>{t("common.analysisOverview")}</h3>
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
            {t("common.confidenceBadge", { level: (confidence ?? "none").toUpperCase() })}
          </span>
        </div>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "var(--va-slate-500)" }}>
          {lastDate ? new Date(lastDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
        </p>
        {overallHealth != null ? (
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
            <strong>{t("medicalAnalysis.overallHealthScore")}</strong>{" "}
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
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.68rem", color: "var(--va-slate-500)" }}>{t("common.statConversations")}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--va-navy)" }}>{messageCount ?? "—"}</p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.68rem", color: "var(--va-slate-500)" }}>{t("common.statMessages")}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--va-navy)" }}>{totalWords != null ? totalWords : "—"}</p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.68rem", color: "var(--va-slate-500)" }}>{t("common.statTotalWords")}</p>
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
                <span style={sectionTitle}>{t("medicalAnalysis.sectionCognitive")}</span>
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
                    color: getHealthLevel(cognitiveInv, t).color,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: getHealthLevel(cognitiveInv, t).color }} />
                  {getHealthLevel(cognitiveInv, t).level}
                </span>
              ) : null}
            </div>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", lineHeight: 1.5, color: "var(--va-slate-600)" }}>
              {getCognitiveInterpretation(latest.cognitiveMetrics, t)}
            </p>
            {expanded.has("cognitive") && latest.cognitiveMetrics ? (
              <div style={{ paddingTop: 4 }}>
                <MetricRow
                  label={t("medicalAnalysis.metricFillerWords")}
                  value={`${((latest.cognitiveMetrics.fillerWordDensity ?? 0) * 100).toFixed(1)}%`}
                />
                <MetricRow
                  label={t("medicalAnalysis.metricVagueReferences")}
                  value={`${((latest.cognitiveMetrics.vagueReferenceDensity ?? 0) * 100).toFixed(1)}%`}
                />
                {latest.cognitiveMetrics.temporalConfusionCount !== undefined ? (
                  <MetricRow label={t("medicalAnalysis.metricTemporalConfusion")} value={String(latest.cognitiveMetrics.temporalConfusionCount)} />
                ) : null}
                {latest.cognitiveMetrics.wordFindingDifficultyCount !== undefined ? (
                  <MetricRow label={t("medicalAnalysis.metricWordFindingDifficulty")} value={String(latest.cognitiveMetrics.wordFindingDifficultyCount)} />
                ) : null}
                {latest.cognitiveMetrics.repetitionScore !== undefined ? (
                  <MetricRow label={t("medicalAnalysis.metricRepetition")} value={`${latest.cognitiveMetrics.repetitionScore.toFixed(1)}%`} />
                ) : null}
                {latest.cognitiveMetrics.informationDensity?.score !== undefined ? (
                  <MetricRow
                    label={t("medicalAnalysis.metricInformationDensity")}
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
                <span style={sectionTitle}>{t("medicalAnalysis.sectionMentalHealth")}</span>
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
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--va-red-800)" }}>{t("medicalAnalysis.crisisIndicatorsPresent")}</span>
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
                    color: getHealthLevel(psychiatricInv, t).color,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: getHealthLevel(psychiatricInv, t).color }} />
                  {getHealthLevel(psychiatricInv, t).level}
                </span>
              ) : null}
            </div>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", lineHeight: 1.5, color: "var(--va-slate-600)" }}>
              {getPsychiatricInterpretation(latest.psychiatricMetrics, t)}
            </p>
            {expanded.has("psychiatric") && latest.psychiatricMetrics ? (
              <div style={{ paddingTop: 4 }}>
                <MetricRow
                  label={t("medicalAnalysis.metricDepressionScore")}
                  value={`${(latest.psychiatricMetrics.depressionScore ?? 0).toFixed(0)}%`}
                  valueColor={getRiskLabel(latest.psychiatricMetrics.depressionScore ?? 0, t).color}
                />
                <MetricRow
                  label={t("medicalAnalysis.metricAnxietyScore")}
                  value={`${(latest.psychiatricMetrics.anxietyScore ?? 0).toFixed(0)}%`}
                  valueColor={getRiskLabel(latest.psychiatricMetrics.anxietyScore ?? 0, t).color}
                />
                {latest.psychiatricMetrics.emotionalTone ? (
                  <>
                    <MetricRow
                      label={t("medicalAnalysis.metricEmotionalTone")}
                      value={latest.psychiatricMetrics.emotionalTone.dominantTone ?? "neutral"}
                    />
                    {latest.psychiatricMetrics.emotionalTone.negativeRatio != null ? (
                      <MetricRow
                        label={t("medicalAnalysis.metricNegativeRatio")}
                        value={`${(latest.psychiatricMetrics.emotionalTone.negativeRatio * 100).toFixed(1)}%`}
                      />
                    ) : null}
                  </>
                ) : null}
                {latest.psychiatricMetrics.protectiveFactors !== undefined && latest.psychiatricMetrics.protectiveFactors !== "" ? (
                  <MetricRow
                    label={t("medicalAnalysis.metricProtectiveFactors")}
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
                <span style={sectionTitle}>{t("medicalAnalysis.sectionLanguageVocabulary")}</span>
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
              {getVocabularyInterpretation(latest.vocabularyMetrics, t)}
            </p>
            {expanded.has("vocabulary") && latest.vocabularyMetrics ? (
              <div style={{ paddingTop: 4 }}>
                {latest.vocabularyMetrics.typeTokenRatio != null ? (
                  <MetricRow
                    label={t("medicalAnalysis.metricTypeTokenRatio")}
                    value={`${(latest.vocabularyMetrics.typeTokenRatio * 100).toFixed(1)}%`}
                  />
                ) : null}
                {latest.vocabularyMetrics.avgWordLength != null ? (
                  <MetricRow label={t("medicalAnalysis.metricAvgWordLength")} value={latest.vocabularyMetrics.avgWordLength.toFixed(1)} />
                ) : null}
                {latest.vocabularyMetrics.avgSentenceLength != null ? (
                  <MetricRow label={t("medicalAnalysis.metricAvgSentenceLength")} value={latest.vocabularyMetrics.avgSentenceLength.toFixed(1)} />
                ) : null}
                {latest.vocabularyMetrics.uniqueWords != null ? (
                  <MetricRow label={t("medicalAnalysis.metricUniqueWords")} value={String(latest.vocabularyMetrics.uniqueWords)} />
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
              <h3 style={{ ...sectionTitle, marginBottom: 8 }}>{t("medicalAnalysis.keyIndicators")}</h3>
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
              <h3 style={{ ...sectionTitle, marginBottom: 8 }}>{t("medicalAnalysis.warningsAndInsights")}</h3>
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
          <h3 style={{ ...sectionTitle, color: "var(--va-red-800)", marginBottom: 8 }}>{t("medicalAnalysis.riskIndicatorsSummary")}</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--va-red-800)" }}>
            {riskIndicators.map((r, i) => (
              <li key={`${r.category}-${i}`}>{r.description}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div style={reportCard}>
          <h3 style={{ ...sectionTitle, marginBottom: 8 }}>{t("medicalAnalysis.recommendations")}</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--va-slate-700)" }}>
            {recommendations.map((r, i) => (
              <li key={`${r.title || "rec"}-${i}`}>{r.title || r.description || t("common.recommendationFallback")}</li>
            ))}
          </ul>
        </div>
      ) : concerns.length > 0 ? (
        <div style={reportCard}>
          <h3 style={{ ...sectionTitle, marginBottom: 8 }}>{t("medicalAnalysis.concernsSummary")}</h3>
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
