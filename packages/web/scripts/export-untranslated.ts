/**
 * Writes scripts/data/untranslated-{lang}.json — keys where locale value equals English.
 * Run: yarn tsx scripts/export-untranslated.ts
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { en } from "../src/i18n/locales/en"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, "data")

const LOCALES = ["es", "fr", "de", "zh", "ja", "pt", "it", "ru", "ar", "ko", "hu"] as const

function leaves(obj: Record<string, unknown>, prefix = ""): [string, string][] {
  const out: [string, string][] = []
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...leaves(v as Record<string, unknown>, p))
    } else {
      out.push([p, String(v)])
    }
  }
  return out
}

const enLeaves = Object.fromEntries(leaves(en as unknown as Record<string, unknown>))

fs.mkdirSync(DATA, { recursive: true })

for (const code of LOCALES) {
  const mod = await import(`../src/i18n/locales/${code}.ts`)
  const tree = mod[code] as Record<string, unknown>
  const locLeaves = Object.fromEntries(leaves(tree))
  const untranslated: Record<string, string> = {}
  for (const [p, v] of Object.entries(enLeaves)) {
    if (locLeaves[p] === v) untranslated[p] = v
  }
  const outPath = path.join(DATA, `untranslated-${code}.json`)
  fs.writeFileSync(outPath, JSON.stringify(untranslated, null, 2), "utf8")
  console.log(`${code}: ${Object.keys(untranslated).length} untranslated → ${outPath}`)
}
