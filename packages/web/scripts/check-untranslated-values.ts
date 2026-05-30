/**
 * Fails if any non-English locale leaf value is identical to English.
 * Run: yarn i18n:untranslated
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

/** Keys that may legitimately match English (brands, acronyms, cognates). */
const ALLOW_IDENTICAL = new Set([
  "sso.google",
  "sso.microsoft",
  "nav.simulateAlert",
  "demo.toastFinancialRisk",
  "appShell.defaultFacility",
  "appShell.locationLine",
  "login.apiLabel",
  "reports.templateRiskSentiment",
  "residentDetail.biancaLabel",
  "residentDetail.patientLabel",
  "reports.deliveryCsv",
  "reports.deliveryPdf",
  "reports.templates.consent_roster.tag1",
  "reports.templates.call_log.tag1",
  "residents.onboardingProgress",
  "fraudAbuse.loadErrorSuffix",
  "fraudAbuse.metricControl",
  "alertDetail.sentimentNeutral",
  "caregivers.colRole",
  "profile.photo",
  "profile.sessionTitle",
  "profile.name",
  "profile.privacyTitle",
  "login.password",
  "register.password",
  "invite.password",
  "register.individual",
  "residents.colStatus",
  "reports.thStatus",
  "reports.activityCheckIn",
  "residentDetail.chartSentiment",
  "residentDetail.sentimentChartSummaryItem",
  "residentDetail.stripDirection",
  "residentDetail.stripDistribution",
  "residentDetail.tabConversations",
  "residentDetail.tabSentiment",
  "reports.sentimentChip",
  "alertDetail.sentimentDistressed",
  "residents.colOnboarding",
  "residents.colName",
  "residentDetail.consentStatusLabel",
  "residentDetail.distChip",
  "profile.legalTitle",
  "onboarding.registration.no",
  "settingsBilling.methodIdPlaceholder",
  "clientOnboarding.flagConfusion",
  "reports.activitySystem",
  "reports.templates.consent_roster.tag0",
  "reports.templates.risk_sentiment.tag1",
])

const ALLOW_VALUE_MATCH = new Set([
  "CSV",
  "PDF",
  "PII",
  "QA",
  "MFA:",
  "MFA :",
  "API:",
  "—",
  "-",
  "Bianca",
  "HIPAA",
  "Neutral",
  "Individual",
  "Legal",
  "Role",
  "Status",
  "Name",
  "Email",
  "Photo",
  "Session",
  "Privacy",
  "Password",
  "Onboarding",
  "Sentiment",
  "Direction",
  "Distribution",
  "Conversations",
  "Check-in",
  "Distressed",
  "No",
  "pm_...",
  "Confusion",
  "Medium",
  "System",
  "Admin",
  "Trend",
  "Messages",
  "Control",
])

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
let failed = false

for (const [code, tree] of Object.entries(LOCALES)) {
  const locLeaves = Object.fromEntries(leaves(tree))
  const same = Object.entries(enLeaves).filter(([p, v]) => {
    if (ALLOW_IDENTICAL.has(p)) return false
    const lv = locLeaves[p]
    if (lv !== v) return false
    if (ALLOW_VALUE_MATCH.has(lv)) return false
    if (/^\{\{[^}]+\}\}(\s+\{\{[^}]+\}\})*$/.test(lv)) return false
    if (lv === ": {{message}}") return false
    return true
  })
  if (same.length === 0) {
    console.log(`${code}: no untranslated values`)
  } else {
    failed = true
    console.log(`${code}: ${same.length} values still match English`)
    for (const [p] of same.slice(0, 10)) {
      console.log(`  - ${p}: ${JSON.stringify(enLeaves[p])}`)
    }
    if (same.length > 10) console.log(`  ... and ${same.length - 10} more`)
  }
}

if (failed) process.exit(1)
