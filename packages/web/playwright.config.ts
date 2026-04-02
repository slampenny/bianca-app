import { defineConfig } from "@playwright/test"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const configDir = path.dirname(fileURLToPath(import.meta.url))
const logsDir = path.join(configDir, "test-logs")
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const frontendUrl =
  process.env.FRONTEND_URL ||
  process.env.BASE_URL ||
  (process.env.CODEBUILD_BUILD_ID ? "http://localhost:8081" : "http://localhost:5173")

export default defineConfig({
  timeout: 60_000,
  testDir: "./test/e2e",
  testMatch: "**/*.e2e.test.ts",
  use: {
    screenshot: "only-on-failure",
    baseURL: frontendUrl,
    headless: true,
    browserName: "chromium",
    viewport: { width: 1280, height: 720 },
    trace: "on-first-retry",
    video: "retain-on-failure",
    testIdAttribute: "data-testid",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
})
