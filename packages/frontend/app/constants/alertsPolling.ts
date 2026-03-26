/**
 * US-4: Faster in-app refresh so new alerts surface without relying on push alone.
 * Playwright / tests use a shorter interval via URL or env.
 */
export function getAlertsPollingIntervalMs(): number {
  if (typeof window !== "undefined") {
    try {
      if (window.location.search.includes("playwright_test=1")) return 3000
      if (localStorage.getItem("playwright_test") === "1") return 3000
    } catch {
      /* localStorage unavailable */
    }
  }
  if (process.env.NODE_ENV === "test" || process.env.PLAYWRIGHT_TEST === "1") return 3000
  return 15000
}
