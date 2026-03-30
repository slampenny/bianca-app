const { setWorldConstructor, setDefaultTimeout } = require("@cucumber/cucumber")
const { chromium } = require("playwright")

setDefaultTimeout(3 * 60 * 1000)

class PlaywrightWorld {
  constructor({ attach, parameters }) {
    this.attach = attach
    this.parameters = parameters
    this.browser = null
    this._ownsBrowser = true
    this.context = null
    this.page = null
    this.baseURL =
      parameters.baseURL || process.env.FRONTEND_URL || process.env.BASE_URL || "http://localhost:5173"
    this.apiURL = (parameters.apiURL || process.env.API_URL || "http://localhost:3000").replace(/\/$/, "")
  }

  async init(sharedBrowserFromHook = null) {
    if (sharedBrowserFromHook) {
      this._ownsBrowser = false
      this.browser = sharedBrowserFromHook
    } else {
      this._ownsBrowser = true
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: !process.env.HEADED,
          slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : 0,
          timeout: 60000,
        })
      }
    }

    this.context = await this.browser.newContext({
      baseURL: this.baseURL,
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    })

    this.page = await this.context.newPage()
    this.page.on("pageerror", (err) => console.log("[Page Error]", err.message))
  }

  async cleanup() {
    try {
      if (this.page && !this.page.isClosed()) await this.page.close().catch(() => {})
    } catch {
      /* ignore */
    }
    this.page = null
    try {
      if (this.context) await this.context.close().catch(() => {})
    } catch {
      /* ignore */
    }
    this.context = null
    if (this._ownsBrowser) {
      try {
        if (this.browser) await this.browser.close().catch(() => {})
      } catch {
        /* ignore */
      }
      this.browser = null
    } else {
      this.browser = null
    }
  }

  async takeScreenshot(name) {
    if (!this.page) return
    const rel = `test/e2e/cucumber/screenshots/${name}.png`
    const screenshot = await this.page.screenshot({ path: rel })
    await this.attach(screenshot, "image/png")
  }

  async ensureBackendSeeded() {
    if (this._backendSeeded) return
    const base = this.apiURL || "http://localhost:3000"
    try {
      const res = await fetch(`${base}/v1/test/seed`, { method: "POST" })
      if (res.ok) console.log("[E2E] Backend seed OK")
    } catch (e) {
      console.warn("[E2E] Seed request failed:", e.message)
    }
    this._backendSeeded = true
  }
}

setWorldConstructor(PlaywrightWorld)
