const { Before, After, BeforeAll, AfterAll } = require("@cucumber/cucumber")
const { chromium } = require("playwright")

let sharedBrowser = null

BeforeAll(async function () {
  sharedBrowser = await chromium.launch({
    headless: !process.env.HEADED,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : 0,
    timeout: 60000,
  })
})

AfterAll(async function () {
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {})
    sharedBrowser = null
  }
})

Before(async function () {
  await this.init(sharedBrowser)
})

After(async function () {
  await this.cleanup()
})
