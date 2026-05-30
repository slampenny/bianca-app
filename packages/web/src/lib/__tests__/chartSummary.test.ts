import { describe, expect, it } from "vitest"
import { summarizeChartSeries } from "../chartSummary"

describe("summarizeChartSeries", () => {
  it("returns empty label when no rows", () => {
    expect(summarizeChartSeries([], "hour", "calls", (h, c) => `${h} ${c}`, "No data")).toBe("No data")
  })

  it("formats each row with the callback", () => {
    const summary = summarizeChartSeries(
      [
        { hour: "9am", calls: 3 },
        { hour: "10am", calls: 5 },
      ],
      "hour",
      "calls",
      (hour, count) => `${hour}: ${count}`,
      "No data",
    )
    expect(summary).toBe("9am: 3, 10am: 5")
  })
})
