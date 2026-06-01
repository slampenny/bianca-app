import type { Client } from "../services/api/api.types"

const MS_DAY = 86_400_000

function withinMs(iso: string | null | undefined, ms: number): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && Date.now() - t < ms
}

export type DashboardMetrics = {
  totalResidents: number
  activeToday: number
  callsCompleted24h: number
  answerRate24h: string
}

/** Live client list metrics only — no demo or hardcoded fallbacks. */
export function computeDashboardMetrics(
  clients: Client[],
  totalFromApi: number | null | undefined,
): DashboardMetrics {
  const totalResidents = totalFromApi ?? clients.length
  const activeToday = clients.filter((cl) => withinMs(cl.lastCallAttemptAt, MS_DAY)).length
  const callsCompleted24h = clients.filter((cl) => withinMs(cl.lastAnsweredCallAt, MS_DAY)).length
  const attemptsToday = clients.filter((cl) => withinMs(cl.lastCallAttemptAt, MS_DAY)).length

  let answerRate24h = "—"
  if (clients.length > 0 && attemptsToday > 0) {
    answerRate24h = `${Math.min(100, (callsCompleted24h / attemptsToday) * 100).toFixed(1)}%`
  } else if (clients.length > 0 && attemptsToday === 0 && callsCompleted24h > 0) {
    answerRate24h = `${Math.min(100, (callsCompleted24h / Math.max(totalResidents, 1)) * 100).toFixed(1)}%`
  } else if (clients.length > 0 && attemptsToday === 0) {
    answerRate24h = "0.0%"
  }

  return { totalResidents, activeToday, callsCompleted24h, answerRate24h }
}
