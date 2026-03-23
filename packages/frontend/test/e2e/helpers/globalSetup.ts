import { FullConfig } from '@playwright/test'
import { API_URL, BACKEND_PORT } from './testConfig'

async function globalSetup(config: FullConfig) {
  // Set environment variables for test environment
  process.env.NODE_ENV = 'test'
  process.env.PLAYWRIGHT_TEST = '1'
  process.env.API_BASE_URL = process.env.API_BASE_URL || API_URL

  console.log('Global setup - Environment variables set:', {
    NODE_ENV: process.env.NODE_ENV,
    PLAYWRIGHT_TEST: process.env.PLAYWRIGHT_TEST,
    API_BASE_URL: process.env.API_BASE_URL,
    FRONTEND_URL: process.env.FRONTEND_URL || '(see testConfig — default http://localhost:8084; use 8082 for yarn web:staging)',
  })

  // Seed DB via backend test route (same as cucumber ensureBackendSeeded).
  // Without this, logins for fake@example.org / admin@example.org with Password1 fail.
  const apiBase = process.env.API_BASE_URL!.replace(/\/$/, '')
  const seedUrl = `${apiBase}/test/seed`

  const maxAttempts = 4
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(seedUrl, { method: 'POST' })
      const body = await res.text()
      if (res.ok) {
        console.log('[Playwright globalSetup] Backend test data seeded:', body.slice(0, 300))
        return
      }
      lastError = new Error(`HTTP ${res.status}: ${body.slice(0, 400)}`)
      console.warn(`[Playwright globalSetup] POST /test/seed attempt ${attempt}/${maxAttempts} failed:`, res.status)
    } catch (e: unknown) {
      lastError = e
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[Playwright globalSetup] POST /test/seed attempt ${attempt}/${maxAttempts} error:`, msg)
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError)
  console.warn(
    `[Playwright globalSetup] Could not POST ${seedUrl} after ${maxAttempts} attempts. ` +
      `Ensure the API is up (default BACKEND_URL http://localhost:${BACKEND_PORT}). E2E logins will fail. Last error: ${msg}`
  )
}

export default globalSetup 