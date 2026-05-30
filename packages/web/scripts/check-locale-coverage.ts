/**
 * Reports translation keys present in en but missing in other locale files.
 * Run: yarn workspace @bianca-app/web i18n:check
 */
import { en } from "../src/i18n/locales/en"
import { es } from "../src/i18n/locales/es"
import { fr } from "../src/i18n/locales/fr"
import { de } from "../src/i18n/locales/de"
import { zh } from "../src/i18n/locales/zh"
import { ja } from "../src/i18n/locales/ja"
import { pt } from "../src/i18n/locales/pt"
import { it } from "../src/i18n/locales/it"
import { ru } from "../src/i18n/locales/ru"
import { ar } from "../src/i18n/locales/ar"
import { ko } from "../src/i18n/locales/ko"
import { hu } from "../src/i18n/locales/hu"

const LOCALES: Record<string, Record<string, unknown>> = {
  es: es as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
  de: de as Record<string, unknown>,
  zh: zh as Record<string, unknown>,
  ja: ja as Record<string, unknown>,
  pt: pt as Record<string, unknown>,
  it: it as Record<string, unknown>,
  ru: ru as Record<string, unknown>,
  ar: ar as Record<string, unknown>,
  ko: ko as Record<string, unknown>,
  hu: hu as Record<string, unknown>,
}

function leafPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...leafPaths(v as Record<string, unknown>, path))
    } else {
      out.push(path)
    }
  }
  return out
}

function hasPath(obj: Record<string, unknown>, dotPath: string): boolean {
  let cur: unknown = obj
  for (const part of dotPath.split(".")) {
    if (cur == null || typeof cur !== "object") return false
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur !== undefined
}

const enPaths = leafPaths(en as unknown as Record<string, unknown>)
let failed = false

for (const [code, tree] of Object.entries(LOCALES)) {
  const missing = enPaths.filter((p) => !hasPath(tree, p))
  if (missing.length === 0) {
    console.log(`${code}: OK (${enPaths.length} keys)`)
  } else {
    failed = true
    console.log(`${code}: missing ${missing.length} / ${enPaths.length} keys`)
    for (const p of missing.slice(0, 15)) {
      console.log(`  - ${p}`)
    }
    if (missing.length > 15) console.log(`  ... and ${missing.length - 15} more`)
  }
}

if (failed) {
  process.exit(1)
}
