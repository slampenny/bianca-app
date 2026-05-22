import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  formatActivityRowTime,
  formatAlertType,
  formatDetectedDate,
  formatDetectedTime,
  formatHeaderLastActivity,
} from "../timeFormat"

describe("formatActivityRowTime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-27T12:00:00.000Z"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns Just now within 30s", () => {
    expect(formatActivityRowTime(new Date("2026-03-27T11:59:40.000Z"))).toBe("Just now")
  })

  it("returns seconds ago under a minute", () => {
    expect(formatActivityRowTime(new Date("2026-03-27T11:59:15.000Z"))).toMatch(/s ago/)
  })

  it("returns minutes ago under an hour", () => {
    expect(formatActivityRowTime(new Date("2026-03-27T11:30:00.000Z"))).toMatch(/min ago/)
  })
})

describe("formatHeaderLastActivity", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-27T12:00:00.000Z"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns just now for very recent", () => {
    expect(formatHeaderLastActivity(new Date("2026-03-27T11:59:55.000Z"))).toBe("just now")
  })
})

describe("formatDetectedTime / formatDetectedDate", () => {
  it("formats ISO strings", () => {
    const iso = "2026-03-27T15:30:00.000Z"
    expect(formatDetectedTime(iso)).toBeTruthy()
    expect(formatDetectedDate(iso)).toMatch(/March/)
  })

  it("returns em dash when timestamp is missing or invalid", () => {
    expect(formatDetectedTime("")).toBe("—")
    expect(formatDetectedDate("")).toBe("—")
    expect(formatDetectedTime("not-a-date")).toBe("—")
    expect(formatDetectedDate("not-a-date")).toBe("—")
  })
})

describe("formatAlertType", () => {
  it("title-cases snake_case segments", () => {
    expect(formatAlertType("financial_exploitation")).toBe("Financial Exploitation")
  })
})
