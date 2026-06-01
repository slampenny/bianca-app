import { describe, expect, it } from "vitest"
import { computeDashboardMetrics } from "../dashboardMetrics"
import type { Client } from "../../services/api/api.types"

describe("computeDashboardMetrics", () => {
  it("returns zeros and em dash when there are no clients", () => {
    const result = computeDashboardMetrics([], 0)
    expect(result).toEqual({
      totalResidents: 0,
      activeToday: 0,
      callsCompleted24h: 0,
      answerRate24h: "—",
    })
  })

  it("does not use hardcoded fallback counts", () => {
    const result = computeDashboardMetrics([], undefined)
    expect(result.totalResidents).toBe(0)
    expect(result.activeToday).toBe(0)
    expect(result.answerRate24h).toBe("—")
  })

  it("computes 24h metrics from client timestamps", () => {
    const now = Date.now()
    const recent = new Date(now - 60_000).toISOString()
    const clients = [
      { id: "1", lastCallAttemptAt: recent, lastAnsweredCallAt: recent },
      { id: "2", lastCallAttemptAt: recent, lastAnsweredCallAt: null },
    ] as Client[]

    const result = computeDashboardMetrics(clients, 2)
    expect(result.totalResidents).toBe(2)
    expect(result.activeToday).toBe(2)
    expect(result.callsCompleted24h).toBe(1)
    expect(result.answerRate24h).toBe("50.0%")
  })
})
