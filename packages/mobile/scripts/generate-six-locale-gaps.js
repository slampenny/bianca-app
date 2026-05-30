#!/usr/bin/env node
/**
 * Generate mobile i18n gap JSON files for zh, ja, pt, it, ru, ar.
 * Compares each locale .ts to en.ts, omits privacyScreen.pipedaContent.
 */
const fs = require("fs")
const path = require("path")

const I18N_DIR = path.join(__dirname, "../app/i18n")
const GAPS_DIR = path.join(I18N_DIR, "gaps")
const OMIT = "privacyScreen.pipedaContent"
const LANGS = ["zh", "ja", "pt", "it", "ru", "ar"]

function loadLocale(rel) {
  const src = fs.readFileSync(path.join(I18N_DIR, rel), "utf8")
  let m = src.match(/const \w+: LocaleTranslations = (\{[\s\S]*\})\n\nexport default/)
  if (!m) m = src.match(/const \w+ = (\{[\s\S]*\})\n\nexport default/)
  if (!m) throw new Error(`Could not parse ${rel}`)
  return eval("(" + m[1] + ")")
}

function flatten(obj, prefix = "") {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v, key))
    else out[key] = v
  }
  return out
}

// eslint-disable-next-line import/no-unresolved
const T = require("./gap-translations-six-locales")

function main() {
  const en = flatten(loadLocale("en.ts"))
  const counts = {}

  for (const lang of LANGS) {
    const loc = flatten(loadLocale(`${lang}.ts`))
    const missing = Object.keys(en)
      .filter((k) => k !== OMIT && !(k in loc))
      .sort()
    const gaps = {}
    for (const k of missing) {
      const v = T[lang]?.[k]
      if (v === undefined) {
        throw new Error(`Missing translation: ${lang}.${k}`)
      }
      gaps[k] = v
    }
    fs.writeFileSync(path.join(GAPS_DIR, `${lang}.json`), JSON.stringify(gaps, null, 2) + "\n")
    counts[lang] = missing.length
    console.log(`${lang}.json: ${missing.length} keys`)
  }

  return counts
}

main()
