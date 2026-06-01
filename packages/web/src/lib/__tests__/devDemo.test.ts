import { afterEach, describe, expect, it, vi } from "vitest"
import { isDevDemoEnabled } from "../devDemo"

describe("isDevDemoEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns false in production mode", () => {
    vi.stubEnv("DEV", false)
    expect(isDevDemoEnabled()).toBe(false)
  })

  it("returns true in development mode", () => {
    vi.stubEnv("DEV", true)
    expect(isDevDemoEnabled()).toBe(true)
  })
})
