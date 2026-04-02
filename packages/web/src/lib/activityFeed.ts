import type { ActivityItem, Resident } from "../types"

const CALL_MESSAGES = [
  "Call completed — wellness check normal",
  "Call completed — no concerns reported",
  "Call completed — routine check-in",
  "Call completed — resident in good spirits",
  "Call completed — all indicators within baseline",
  "Call completed — standard wellness review",
] as const

function randomId(): string {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function generateActivityFeed(residents: Resident[]): ActivityItem[] {
  const pool = residents.map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName }))
  const now = Date.now()
  const windowMs = 4 * 60 * 60 * 1000
  const items: ActivityItem[] = []
  for (let i = 0; i < 20; i++) {
    const r = pool[Math.floor(Math.random() * pool.length)]
    const ago = Math.floor(Math.random() * windowMs)
    items.push({
      id: randomId(),
      type: "call_completed",
      residentName: `${r.firstName} ${r.lastName}`,
      residentId: r.id,
      timestamp: new Date(now - ago),
      message: CALL_MESSAGES[Math.floor(Math.random() * CALL_MESSAGES.length)],
    })
  }
  return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

export function randomCallActivity(residents: Resident[]): ActivityItem {
  const r = residents[Math.floor(Math.random() * residents.length)]
  return {
    id: randomId(),
    type: "call_completed",
    residentName: `${r.firstName} ${r.lastName}`,
    residentId: r.id,
    timestamp: new Date(),
    message: CALL_MESSAGES[Math.floor(Math.random() * CALL_MESSAGES.length)],
  }
}
