import { describe, expect, it } from "vitest"
import { en } from "../locales/en"
import { ar } from "../locales/ar"
import { de } from "../locales/de"
import { es } from "../locales/es"
import { fr } from "../locales/fr"
import { hu } from "../locales/hu"
import { it as itLocale } from "../locales/it"
import { ja } from "../locales/ja"
import { ko } from "../locales/ko"
import { pt } from "../locales/pt"
import { ru } from "../locales/ru"
import { zh } from "../locales/zh"

const LOCALES: Record<string, { familyWeeklyDigest: Record<string, string> }> = {
  en: en as { familyWeeklyDigest: Record<string, string> },
  de: de as { familyWeeklyDigest: Record<string, string> },
  es: es as { familyWeeklyDigest: Record<string, string> },
  fr: fr as { familyWeeklyDigest: Record<string, string> },
  it: itLocale as { familyWeeklyDigest: Record<string, string> },
  pt: pt as { familyWeeklyDigest: Record<string, string> },
  ru: ru as { familyWeeklyDigest: Record<string, string> },
  ja: ja as { familyWeeklyDigest: Record<string, string> },
  ko: ko as { familyWeeklyDigest: Record<string, string> },
  zh: zh as { familyWeeklyDigest: Record<string, string> },
  ar: ar as { familyWeeklyDigest: Record<string, string> },
  hu: hu as { familyWeeklyDigest: Record<string, string> },
}

describe("familyWeeklyDigest locale copy", () => {
  for (const [code, locale] of Object.entries(LOCALES)) {
    it(`${code} familyWeeklyDigest strings do not mention UTC`, () => {
      const strings = Object.values(locale.familyWeeklyDigest)
      expect(strings.length).toBeGreaterThan(0)
      for (const value of strings) {
        expect(value).not.toMatch(/UTC/i)
      }
    })
  }
})
