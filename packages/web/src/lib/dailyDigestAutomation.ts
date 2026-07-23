import type { Caregiver, Org } from "../services/api/api.types"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_ORG_SEND_TIME = "18:00"

export type OrgSchedulingAvailability = "available" | "unavailable" | "loading" | "error"

export type AutomationCheckKey = "orgScheduling" | "email" | "account" | "preference"

export type AutomationCheck = {
  key: AutomationCheckKey
  pass: boolean
  unknown?: boolean
}

export type DailyDigestAutomationStatus = {
  manualSendReady: boolean
  automatedReady: boolean
  orgSchedulingAvailability: OrgSchedulingAvailability
  checks: AutomationCheck[]
  orgTimezone: string | null
  orgSendTime: string | null
  showPreferenceCta: boolean
  showVerifyEmailCta: boolean
  showAskAdminForScheduling: boolean
}

function isEmailValid(email: string | undefined | null): boolean {
  const trimmed = email?.trim() ?? ""
  return trimmed.length > 0 && EMAIL_RE.test(trimmed)
}

export function caregiverEmailVerified(caregiver: Caregiver | null | undefined): boolean {
  if (!caregiver) return false
  if (caregiver.ssoProvider) return true
  return caregiver.isEmailVerified === true
}

export function caregiverAccountActive(caregiver: Caregiver | null | undefined): boolean {
  if (!caregiver) return false
  if (Object.prototype.hasOwnProperty.call(caregiver, "active")) {
    return caregiver.active === true
  }
  return true
}

/** Caregiver-side digest eligibility for org roster (org scheduling is separate). */
export type DigestEligibilityKind = "ready" | "optedOut" | "unverifiedEmail" | "inactive"

export function resolveDigestEligibilityKind(
  caregiver: Caregiver | null | undefined,
): DigestEligibilityKind {
  if (!caregiverAccountActive(caregiver)) return "inactive"
  const emailValid = isEmailValid(caregiver?.email)
  const emailVerified = caregiverEmailVerified(caregiver)
  if (!emailValid || !emailVerified) return "unverifiedEmail"
  if (caregiver?.notificationPreferences?.dailyDigestEmail !== true) return "optedOut"
  return "ready"
}

export function resolveOrgSendTime(org: Org | null | undefined): string {
  const configured = org?.dailyDigestSettings?.sendTime?.trim()
  if (configured && /^\d{2}:\d{2}$/.test(configured)) return configured
  return DEFAULT_ORG_SEND_TIME
}

export function resolveOrgTimezone(org: Org | null | undefined): string | null {
  const tz = org?.timezone?.trim()
  return tz || null
}

export function buildDailyDigestAutomationStatus({
  caregiver,
  org,
  orgSchedulingAvailability,
}: {
  caregiver: Caregiver | null | undefined
  org: Org | null | undefined
  orgSchedulingAvailability: OrgSchedulingAvailability
}): DailyDigestAutomationStatus {
  const emailValid = isEmailValid(caregiver?.email)
  const emailVerified = caregiverEmailVerified(caregiver)
  const accountActive = caregiverAccountActive(caregiver)
  const preferenceEnabled = caregiver?.notificationPreferences?.dailyDigestEmail === true

  const emailPass = emailValid && emailVerified
  const orgSchedulingEnabled =
    orgSchedulingAvailability === "available" ? org?.dailyDigestSettings?.enabled === true : null
  const orgSchedulingPass = orgSchedulingEnabled === true
  const orgSchedulingUnknown = orgSchedulingAvailability !== "available"

  const checks: AutomationCheck[] = [
    {
      key: "orgScheduling",
      pass: orgSchedulingPass,
      unknown: orgSchedulingUnknown,
    },
    {
      key: "email",
      pass: emailPass,
      unknown: false,
    },
    {
      key: "account",
      pass: accountActive,
      unknown: false,
    },
    {
      key: "preference",
      pass: preferenceEnabled,
      unknown: false,
    },
  ]

  const manualSendReady = emailPass && accountActive
  const automatedReady =
    manualSendReady &&
    preferenceEnabled &&
    orgSchedulingAvailability === "available" &&
    orgSchedulingPass

  const showPreferenceCta = Boolean(caregiver) && !preferenceEnabled
  const showVerifyEmailCta = Boolean(caregiver) && emailValid && !emailVerified
  const showAskAdminForScheduling =
    orgSchedulingAvailability === "available" && orgSchedulingEnabled === false

  return {
    manualSendReady,
    automatedReady,
    orgSchedulingAvailability,
    checks,
    orgTimezone: resolveOrgTimezone(org),
    orgSendTime: orgSchedulingAvailability === "available" ? resolveOrgSendTime(org) : null,
    showPreferenceCta,
    showVerifyEmailCta,
    showAskAdminForScheduling,
  }
}
