import { describe, expect, it } from "vitest"
import { countryLabel, timezoneLabel } from "../geoLabels"

describe("geoLabels", () => {
  it("localizes country names via Intl", () => {
    expect(countryLabel("US", "en")).toMatch(/United States|U\.S\./i)
    expect(countryLabel("DE", "de")).toBe("Deutschland")
    expect(countryLabel("OTHER", "es", ((k) => (k === "geo.countries.OTHER" ? "Otro" : k)) as never)).toBe("Otro")
  })

  it("localizes timezone names via Intl", () => {
    const en = timezoneLabel("America/New_York", "en")
    const es = timezoneLabel("America/New_York", "es")
    expect(en.length).toBeGreaterThan(0)
    expect(es).not.toBe(en)
  })
})
