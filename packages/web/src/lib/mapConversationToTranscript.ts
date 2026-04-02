import type { ConversationDetail, ConversationMessageApi } from "../services/api/api.types"
import type { TranscriptLine } from "../types"

function formatDurationSeconds(seconds: number | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—"
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r}s`
  return r ? `${m}m ${r}s` : `${m}m`
}

function mapRoleToSpeaker(role: string): string {
  switch (role) {
    case "assistant":
      return "bianca"
    case "client":
    case "debug-user":
      return "resident"
    default:
      return "system"
  }
}

function extractSentiment(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return "neutral"
  const s = metadata.sentiment
  return typeof s === "string" ? s : "neutral"
}

/** Map GET /conversations/:id payload → TranscriptPanel props. */
export function mapConversationToTranscript(conv: ConversationDetail): {
  callDate: string
  callTime: string
  duration: string
  lines: TranscriptLine[]
} {
  const startIso = conv.callStartTime || conv.startTime
  const d = startIso ? new Date(startIso) : null
  const callDate =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "—"
  const callTime =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : "—"
  const durSec = conv.callDuration ?? conv.duration
  const duration = formatDurationSeconds(typeof durSec === "number" ? durSec : undefined)

  const raw = conv.messages ?? []
  const lines: TranscriptLine[] = raw
    .filter((m) => m && typeof m.content === "string" && m.content.trim() !== "")
    .filter((m) => m.role !== "system")
    .map((m: ConversationMessageApi, idx) => {
      const ts = m.createdAt || m.updatedAt
      const td = ts ? new Date(ts) : null
      const timestamp =
        td && !Number.isNaN(td.getTime())
          ? td.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })
          : `#${idx + 1}`
      const meta = m.metadata && typeof m.metadata === "object" ? (m.metadata as Record<string, unknown>) : undefined
      return {
        speaker: mapRoleToSpeaker(m.role),
        text: m.content.trim(),
        timestamp,
        sentiment: extractSentiment(meta),
        annotations: [],
      }
    })

  return { callDate, callTime, duration, lines }
}
