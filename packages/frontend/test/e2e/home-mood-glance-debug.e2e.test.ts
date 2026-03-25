/**
 * Debug harness for home "Mood" (sentiment glance) on client cards.
 *
 * Captures GET /v1/caregivers/:id/clients and asserts the API returns
 * sentimentAnalyzedConversations / sentimentTrendDirection, then checks the UI
 * shows a non-placeholder mood value.
 *
 * Prereqs: backend on BACKEND_URL (default http://localhost:3000), POST /v1/test/seed
 * (Playwright globalSetup). Frontend: reuse dev server or let Playwright start serve.
 *
 * Run (from packages/frontend):
 *   yarn test:web:e2e test/e2e/home-mood-glance-debug.e2e.test.ts --reporter=list
 */
import { expect } from "@playwright/test"
import { test } from "./helpers/testHelpers"
import { navigateToHome } from "./helpers/navigation"

type ClientRow = {
  id?: string
  name?: string
  sentimentAnalyzedConversations?: number | null
  sentimentTrendDirection?: string | null
}

function isCaregiverClientsListUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname
    return /\/v1\/caregivers\/[^/]+\/clients$/.test(pathname)
  } catch {
    return false
  }
}

function summarizeClientsForLog(rows: ClientRow[]) {
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    sentimentAnalyzedConversations: c.sentimentAnalyzedConversations,
    sentimentTrendDirection: c.sentimentTrendDirection,
  }))
}

test.describe("Home mood glance (debug)", () => {
  test("API returns sentiment fields and UI shows mood value (not em dash)", async ({ page }) => {
    const captures: { url: string; rows: ClientRow[] }[] = []
    const nonOkClientsResponses: { url: string; status: number }[] = []

    page.on("response", async (response) => {
      const url = response.url()
      if (!isCaregiverClientsListUrl(url)) return
      const status = response.status()
      if (status !== 200) {
        nonOkClientsResponses.push({ url, status })
        return
      }
      try {
        const body = (await response.json()) as unknown
        if (!Array.isArray(body)) {
          console.warn("[home-mood-debug] Expected JSON array from clients list, got:", typeof body)
          return
        }
        captures.push({ url, rows: body as ClientRow[] })
        console.log("[home-mood-debug] Captured clients list from:", url)
        console.log("[home-mood-debug] Mood fields:", JSON.stringify(summarizeClientsForLog(body as ClientRow[]), null, 2))
      } catch (e) {
        console.warn("[home-mood-debug] Failed to read clients response JSON:", e)
      }
    })

    await navigateToHome(page)

    await page.locator('[data-testid="home-header"]').waitFor({ state: "visible", timeout: 20000 })
    await page.locator('[data-testid^="client-card-"]').first().waitFor({ state: "visible", timeout: 40000 })

    const lastCapture = captures[captures.length - 1]
    expect(
      lastCapture,
      `No successful GET /v1/caregivers/:id/clients response captured. ` +
        `non-OK responses: ${JSON.stringify(nonOkClientsResponses)}. ` +
        `Is the app calling a different API host than ${process.env.API_BASE_URL ?? "http://localhost:3000/v1"}?`,
    ).toBeTruthy()

    const rows = lastCapture!.rows
    const withMoodData = rows.filter((c) => (c.sentimentAnalyzedConversations ?? 0) > 0)

    expect(
      withMoodData.length,
      `Expected at least one client with sentimentAnalyzedConversations > 0 after seed. ` +
        `Captured URL: ${lastCapture!.url}. ` +
        `Clients: ${JSON.stringify(summarizeClientsForLog(rows))}`,
    ).toBeGreaterThan(0)

    const firstCard = page.locator('[data-testid^="client-card-"]').first()
    const cardTestId = await firstCard.getAttribute("data-testid")
    expect(cardTestId, "client card should have data-testid").toBeTruthy()
    const clientId = cardTestId!.replace(/^client-card-/, "")

    const moodLocator = page.locator(`[data-testid="client-glance-mood-${clientId}"]`)
    await expect(moodLocator, `Mood value node missing (testID client-glance-mood-${clientId})`).toBeVisible({
      timeout: 15000,
    })

    const moodText = (await moodLocator.textContent())?.trim() ?? ""
    expect(
      moodText,
      `UI mood should not be the empty-data placeholder. API had mood for ${withMoodData.length} client(s). ` +
        `First card clientId=${clientId} moodText=${JSON.stringify(moodText)}`,
    ).not.toBe("—")

    expect(moodText.length, `Unexpected empty mood text for client ${clientId}`).toBeGreaterThan(0)
  })
})
