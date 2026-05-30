/**
 * Copies missing leaf keys from en into each locale file (English placeholder).
 * Run: yarn tsx scripts/sync-missing-keys.ts
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { en } from "../src/i18n/locales/en"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales")
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

function setByPath(obj: Record<string, unknown>, dotPath: string, value: string) {
  const parts = dotPath.split(".")
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!cur[key] || typeof cur[key] !== "object") cur[key] = {}
    cur = cur[key] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

function hasPath(obj: Record<string, unknown>, dotPath: string): boolean {
  let cur: unknown = obj
  for (const part of dotPath.split(".")) {
    if (cur == null || typeof cur !== "object") return false
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur !== undefined
}

const enLeaves = leaves(en as unknown as Record<string, unknown>)

for (const code of LOCALES) {
  const mod = await import(`../src/i18n/locales/${code}.ts`)
  const tree = structuredClone(mod[code] as Record<string, unknown>)
  let added = 0
  for (const [p, v] of enLeaves) {
    if (!hasPath(tree, p)) {
      setByPath(tree, p, v)
      added++
    }
  }
  if (added > 0) {
    const banner = `/** ${code.toUpperCase()} UI strings for the web app. */\n`
    fs.writeFileSync(
      path.join(LOCALES_DIR, `${code}.ts`),
      `${banner}export const ${code} = ${JSON.stringify(tree, null, 2)} as const\n`,
      "utf8",
    )
  }
  console.log(`${code}: added ${added} keys`)
}
