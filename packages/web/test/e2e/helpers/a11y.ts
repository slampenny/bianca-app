import { expect, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const

export async function expectNoSeriousViolations(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState("networkidle")
  const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze()
  const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious")
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
}

export async function expectCurrentPageAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze()
  const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious")
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
}
