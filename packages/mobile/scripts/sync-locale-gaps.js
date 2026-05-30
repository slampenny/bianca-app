#!/usr/bin/env node
/**
 * Merge flat gap JSON (dot keys) into a mobile locale .ts file.
 * Usage: node packages/mobile/scripts/sync-locale-gaps.js de [es fr ko ...]
 */
const fs = require("fs")
const path = require("path")

const I18N_DIR = path.join(__dirname, "../app/i18n")
const GAPS_DIR = path.join(I18N_DIR, "gaps")

function setPath(obj, dotPath, value) {
  const parts = dotPath.split(".")
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (!cur[p] || typeof cur[p] !== "object" || Array.isArray(cur[p])) cur[p] = {}
    cur = cur[p]
  }
  cur[parts[parts.length - 1]] = value
}

function stringifyValue(v) {
  if (typeof v === "string") {
    if (v.includes("\n")) {
      return "`" + v.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`"
    }
    return JSON.stringify(v)
  }
  return JSON.stringify(v)
}

function stringifyObject(obj, depth = 0) {
  const ind = "  ".repeat(depth)
  const ind2 = "  ".repeat(depth + 1)
  const lines = ["{"]
  for (const [k, v] of Object.entries(obj)) {
    const key = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : JSON.stringify(k)
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      lines.push(`${ind2}${key}: ${stringifyObject(v, depth + 1)},`)
    } else {
      lines.push(`${ind2}${key}: ${stringifyValue(v)},`)
    }
  }
  lines.push(`${ind}}`)
  return lines.join("\n")
}

function loadLocale(rel) {
  const src = fs.readFileSync(path.join(I18N_DIR, rel), "utf8")
  const m = src.match(/const \w+: LocaleTranslations = (\{[\s\S]*\})\n\nexport default/)
  if (!m) throw new Error(`Could not parse ${rel}`)
  return eval("(" + m[1] + ")")
}

function syncLang(code) {
  const gapPath = path.join(GAPS_DIR, `${code}.json`)
  if (!fs.existsSync(gapPath)) {
    console.warn(`skip ${code}: no ${gapPath}`)
    return
  }
  const gaps = JSON.parse(fs.readFileSync(gapPath, "utf8"))
  const locale = loadLocale(`${code}.ts`)
  let applied = 0
  for (const [k, v] of Object.entries(gaps)) {
    setPath(locale, k, v)
    applied++
  }
  const out = `import { LocaleTranslations } from "./en"\n\nconst ${code}: LocaleTranslations = ${stringifyObject(locale)}\n\nexport default ${code}\n`
  fs.writeFileSync(path.join(I18N_DIR, `${code}.ts`), out)
  console.log(`${code}: applied ${applied} gap strings`)
}

const langs = process.argv.slice(2)
if (!langs.length) {
  console.error("Usage: node sync-locale-gaps.js <lang> [lang...]")
  process.exit(1)
}
for (const code of langs) syncLang(code)
