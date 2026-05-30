#!/usr/bin/env node
/**
 * Writes gap-translations-six-locales.js with all 251 union keys × 6 locales.
 */
const fs = require("fs")
const path = require("path")

const OUT = path.join(__dirname, "gap-translations-six-locales.js")

const zh = require("./gap-six/zh.json")
const ja = require("./gap-six/ja.json")
const pt = require("./gap-six/pt.json")
const it = require("./gap-six/it.json")
const ru = require("./gap-six/ru.json")
const ar = require("./gap-six/ar.json")

const LANGS = ["zh", "ja", "pt", "it", "ru", "ar"]
const data = { zh, ja, pt, it, ru, ar }

for (const lang of LANGS) {
  const n = Object.keys(data[lang]).length
  if (n !== 251) throw new Error(`${lang}.json has ${n} keys, expected 251`)
}

fs.writeFileSync(OUT, "module.exports = " + JSON.stringify(data, null, 2) + "\n")
console.log("Wrote", OUT)
