import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"
import { formatStoredAlertMessage } from "../storedAlertMessage"

const es: Record<string, string> = {
  "storedAlertMessages.wellnessVoicemail": "La llamada de bienestar fue al buzón de voz",
  "storedAlertMessages.scheduledCheckIn": "Llamada a {{name}} para su control programado a las {{time}}",
  "storedAlertMessages.wellnessFailedStatus": "La llamada de bienestar falló: {{status}}",
  "storedAlertMessages.urgencyCRITICAL": "🚨 CRÍTICO",
  "storedAlertMessages.urgencyHIGH": "⚠️ ALTA PRIORIDAD",
  "storedAlertMessages.urgencyMEDIUM": "📢 ALERTA",
  "storedAlertMessages.categoryMedical": "Médico",
  "storedAlertMessages.categorySafety": "Seguridad",
  "storedAlertMessages.categoryPhysical": "Físico",
  "storedAlertMessages.categoryRequest": "Solicitud",
  "storedAlertMessages.emergencyWord": "Emergencia",
  "storedAlertMessages.reported": "reportó",
  "storedAlertMessages.originalMessage": "Mensaje original",
  "storedAlertMessages.emergencyLine":
    '{{urgency}} {{category}} {{emergency}}: {{name}} {{reported}} "{{phrase}}". {{originalMessage}}: "{{text}}"',
}

const t = ((key: string, opts?: Record<string, string>) => {
  let value = es[key] ?? key
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v)
    }
  }
  return value
}) as TFunction

describe("formatStoredAlertMessage", () => {
  it("translates wellness voicemail", () => {
    expect(formatStoredAlertMessage("Wellness check call went to voicemail", t, "es")).toBe(
      "La llamada de bienestar fue al buzón de voz",
    )
  })

  it("translates scheduled check-in with formatted time", () => {
    const out = formatStoredAlertMessage(
      "Called Tester for their scheduled check-in at 2026-06-03T15:46:28.681Z",
      t,
      "es",
    )
    expect(out).toContain("Llamada a Tester")
    expect(out).not.toContain("2026-06-03T15:46:28.681Z")
  })

  it("translates wellness failed status", () => {
    expect(formatStoredAlertMessage("Wellness check call failed: busy", t, "es")).toBe(
      "La llamada de bienestar falló: busy",
    )
  })

  it("returns unknown messages unchanged", () => {
    expect(formatStoredAlertMessage("Custom caregiver note", t, "es")).toBe("Custom caregiver note")
  })

  it("translates emergency-format messages", () => {
    const out = formatStoredAlertMessage(
      '🚨 CRITICAL Medical Emergency: Jane reported "chest pain". Original message: "My chest hurts"',
      t,
      "es",
    )
    expect(out).toContain("CRÍTICO")
    expect(out).toContain("Médico")
    expect(out).toContain("Jane")
  })
})
