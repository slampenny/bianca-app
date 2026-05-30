/**
 * Applies scripts/data/manual-overrides.json on top of locale files.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, "data/manual-overrides.json")
const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales")

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

const overrides = JSON.parse(fs.readFileSync(DATA, "utf8")) as Record<string, Record<string, string>>

for (const [code, fixes] of Object.entries(overrides)) {
  const mod = await import(`../src/i18n/locales/${code}.ts`)
  const tree = structuredClone(mod[code] as Record<string, unknown>)
  for (const [p, v] of Object.entries(fixes)) {
    setByPath(tree, p, v)
  }
  const banner = `/** ${code.toUpperCase()} UI strings for the web app. */\n`
  fs.writeFileSync(
    path.join(LOCALES_DIR, `${code}.ts`),
    `${banner}export const ${code} = ${JSON.stringify(tree, null, 2)} as const\n`,
    "utf8",
  )
  console.log(`${code}: ${Object.keys(fixes).length} manual overrides`)
}
