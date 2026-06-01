import { describe, expect, it } from "vitest"
import { countOpenAlertsByClient } from "../residentReportLive"

describe("countOpenAlertsByClient", () => {
  it("counts unresolved alerts per client", () => {
    const counts = countOpenAlertsByClient([
      { message: "a", importance: "high", alertType: "x", relatedClient: "c1" },
      { message: "b", importance: "high", alertType: "x", relatedClient: "c1", resolvedAt: "2026-01-01" },
      { message: "c", importance: "low", alertType: "x", relatedClient: "c2" },
    ])
    expect(counts.get("c1")).toBe(1)
    expect(counts.get("c2")).toBe(1)
  })
})
