import { useTranslation } from "react-i18next"
import type { SentimentTrendPoint } from "../services/api/api.types"

function scoresFromPoints(points: SentimentTrendPoint[]): number[] {
  const out: number[] = []
  for (const p of points) {
    const s = p.sentiment?.sentimentScore
    if (typeof s === "number" && !Number.isNaN(s)) out.push(s)
  }
  return out
}

type Props = {
  points: SentimentTrendPoint[]
  width?: number
  height?: number
}

/** Compact line chart of sentiment scores (e.g. GET /sentiment/client/:id/trend?timeRange=month). */
export function SentimentTrendSparkline({ points, width = 88, height = 36 }: Props) {
  const { t } = useTranslation()
  const scores = scoresFromPoints(points)
  if (scores.length === 0) {
    return (
      <span style={{ color: "var(--va-slate-400)", fontSize: "0.75rem" }} title={t("residentDetail.sparklineEmpty")}>
        —
      </span>
    )
  }
  const pad = 2
  const w = Math.max(1, width - pad * 2)
  const h = Math.max(1, height - pad * 2)
  const min = Math.min(...scores, -0.05)
  const max = Math.max(...scores, 0.05)
  const range = max - min || 1

  if (scores.length === 1) {
    const cx = pad + w / 2
    const cy = pad + h - ((scores[0] - min) / range) * h
    return (
      <svg width={width} height={height} style={{ display: "block" }} aria-hidden>
        <circle cx={cx} cy={cy} r={2.5} fill="#2563eb" />
      </svg>
    )
  }

  const d = scores
    .map((s, i) => {
      const x = pad + (i / (scores.length - 1)) * w
      const y = pad + h - ((s - min) / range) * h
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")

  return (
    <svg width={width} height={height} style={{ display: "block" }} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="#2563eb"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
