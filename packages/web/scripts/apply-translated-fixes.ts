/**
 * Applies translated-{lang}.json dot-path fixes into locales/{lang}.ts
 * Run: yarn tsx scripts/apply-translated-fixes.ts [es fr ...]
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, "data")
const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales")

const DEFAULT_LANGS = ["es", "fr", "de", "zh", "ja", "pt", "it", "ru", "ar", "ko", "hu"] as const

function setByPath(obj: Record<string, unknown>, dotPath: string, value: string) {
  const parts = dotPath.split(".")
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!cur[key] || typeof cur[key] !== "object") {
      cur[key] = {}
    }
    cur = cur[key] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

async function main() {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : [...DEFAULT_LANGS]

  for (const code of langs) {
    const fixPath = path.join(DATA, `translated-${code}.json`)
    if (!fs.existsSync(fixPath)) {
      console.warn(`skip ${code}: missing ${fixPath}`)
      continue
    }
    const fixes = JSON.parse(fs.readFileSync(fixPath, "utf8")) as Record<string, string>
    const mod = await import(`../src/i18n/locales/${code}.ts`)
    const tree = structuredClone(mod[code] as Record<string, unknown>)

    for (const [dotPath, value] of Object.entries(fixes)) {
      setByPath(tree, dotPath, value)
    }

    const banner = `/** ${code.toUpperCase()} UI strings for the web app. */\n`
    const body = JSON.stringify(tree, null, 2)
    fs.writeFileSync(path.join(LOCALES_DIR, `${code}.ts`), `${banner}export const ${code} = ${body} as const\n`, "utf8")
    console.log(`${code}: applied ${Object.keys(fixes).length} fixes`)
  }

  console.log("Run: yarn tsx scripts/apply-manual-overrides.ts (after machine translation)")
}

void main()
