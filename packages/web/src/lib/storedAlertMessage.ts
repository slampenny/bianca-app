import type { TFunction } from "i18next"

const EMERGENCY_MESSAGE =
  /^(🚨 CRITICAL|⚠️ HIGH PRIORITY|📢 ALERT)\s+([A-Za-z]+)\s+Emergency:\s+(.+?)\s+reported\s+"([^"]+)"\.\s+Original message:\s+"(.+)"$/

const SCHEDULED_CHECK_IN = /^Called (.+?) for their scheduled check-in at (.+)$/
const SCHEDULED_CHECK_IN_ERROR =
  /^Call to (.+?) for their scheduled check-in at (.+?) generated an error: (.+)$/
const CONSENT_SKIPPED =
  /^Scheduled call to (.+?) was skipped because client consent is required but has not been obtained\. Please obtain consent from the client before the next scheduled call\.$/
const WELLNESS_FAILED_STATUS = /^Wellness check call failed: (.+)$/

function formatCheckInTime(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
}

function emergencySeverity(urgencyToken: string): "CRITICAL" | "HIGH" | "MEDIUM" {
  if (urgencyToken.includes("CRITICAL")) return "CRITICAL"
  if (urgencyToken.includes("HIGH")) return "HIGH"
  return "MEDIUM"
}

function categoryKey(category: string): string {
  const normalized = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
  const map: Record<string, string> = {
    Medical: "categoryMedical",
    Safety: "categorySafety",
    Physical: "categoryPhysical",
    Request: "categoryRequest",
  }
  return map[normalized] ?? "categoryMedical"
}

function translateEmergencyMessage(message: string, t: TFunction): string | null {
  const match = message.match(EMERGENCY_MESSAGE)
  if (!match) return null

  const severity = emergencySeverity(match[1])
  const category = match[2]
  const name = match[3].trim()
  const phrase = match[4]
  const text = match[5]
  const truncated = text.length > 100 ? `${text.slice(0, 100)}...` : text

  return t("storedAlertMessages.emergencyLine", {
    urgency: t(`storedAlertMessages.urgency${severity}`),
    category: t(`storedAlertMessages.${categoryKey(category)}`),
    emergency: t("storedAlertMessages.emergencyWord"),
    name,
    reported: t("storedAlertMessages.reported"),
    phrase,
    originalMessage: t("storedAlertMessages.originalMessage"),
    text: truncated,
  })
}

/**
 * Localize known system alert messages stored in English in the database.
 * Unrecognized messages are returned unchanged (e.g. free-text caregiver notes).
 */
export function formatStoredAlertMessage(message: string, t: TFunction, locale = "en"): string {
  const trimmed = String(message || "").trim()
  if (!trimmed) return trimmed

  const emergency = translateEmergencyMessage(trimmed, t)
  if (emergency) return emergency

  if (trimmed === "Wellness check call went to voicemail") {
    return t("storedAlertMessages.wellnessVoicemail")
  }
  if (trimmed === "Wellness check call received busy signal") {
    return t("storedAlertMessages.wellnessBusy")
  }
  if (trimmed === "Wellness check call was not answered") {
    return t("storedAlertMessages.wellnessNoAnswer")
  }
  if (trimmed === "Wellness check call failed to connect") {
    return t("storedAlertMessages.wellnessFailedConnect")
  }

  const failedStatus = trimmed.match(WELLNESS_FAILED_STATUS)
  if (failedStatus) {
    return t("storedAlertMessages.wellnessFailedStatus", { status: failedStatus[1] })
  }

  const checkIn = trimmed.match(SCHEDULED_CHECK_IN)
  if (checkIn) {
    return t("storedAlertMessages.scheduledCheckIn", {
      name: checkIn[1],
      time: formatCheckInTime(checkIn[2], locale),
    })
  }

  const checkInError = trimmed.match(SCHEDULED_CHECK_IN_ERROR)
  if (checkInError) {
    return t("storedAlertMessages.scheduledCheckInError", {
      name: checkInError[1],
      time: formatCheckInTime(checkInError[2], locale),
      error: checkInError[3],
    })
  }

  const consentSkipped = trimmed.match(CONSENT_SKIPPED)
  if (consentSkipped) {
    return t("storedAlertMessages.consentSkipped", { name: consentSkipped[1] })
  }

  return trimmed
}
