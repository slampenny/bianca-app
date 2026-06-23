/** Invert a 0–100 risk score into a 0–100 wellness score for mental/cognitive sections. */
export function invertRiskScore(riskScore: number | undefined): number | undefined {
  if (riskScore === undefined || riskScore === null) return undefined
  return Math.round(100 - riskScore)
}

export function getHealthLevel(invertedScore: number): "good" | "fair" | "poor" {
  if (invertedScore >= 70) return "good"
  if (invertedScore >= 40) return "fair"
  return "poor"
}

export function getRiskLevel(score: number | undefined): "critical" | "high" | "medium" | "low" {
  const s = score != null ? Number(score) : 0
  if (s >= 70) return "critical"
  if (s >= 50) return "high"
  if (s >= 30) return "medium"
  return "low"
}

export function formatRiskScore(value: number | undefined): string {
  return value != null && Number.isFinite(value) ? String(Math.round(value)) : "—"
}

export function formatMetricPercent(value: number | undefined): string {
  return `${Math.round(value ?? 0)}%`
}
