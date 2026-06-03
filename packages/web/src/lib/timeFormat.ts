import type { TFunction } from "i18next"

export function formatActivityRowTime(d: Date, t: TFunction): string {
  const elapsed = Date.now() - d.getTime()
  const sec = Math.floor(elapsed / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  if (sec < 30) return t("timeFormat.justNowTitle")
  if (sec < 60) return t("timeFormat.secondsAgo", { count: sec })
  if (min === 1) return t("timeFormat.oneMinuteAgo")
  if (min < 60) return t("timeFormat.minutesAgo", { count: min })
  if (hr === 1) return t("timeFormat.oneHourAgo")
  if (hr < 24) return t("timeFormat.hoursAgo", { count: hr })
  return t("timeFormat.daysAgo", { count: Math.floor(hr / 24) })
}

export function formatHeaderLastActivity(d: Date, t: TFunction): string {
  const elapsed = Date.now() - d.getTime()
  const sec = Math.floor(elapsed / 1000)
  if (sec < 10) return t("timeFormat.justNow")
  if (sec < 60) return t("timeFormat.secondsAgo", { count: sec })
  const min = Math.floor(sec / 60)
  if (min < 60) return t("timeFormat.minutesAgo", { count: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t("timeFormat.hoursAgoCompact", { count: hr })
  return t("timeFormat.daysAgo", { count: Math.floor(hr / 24) })
}

function detectedInstant(iso: string): Date | null {
  if (!iso?.trim()) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDetectedTime(iso: string): string {
  const d = detectedInstant(iso)
  if (!d) return "—"
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

export function formatDetectedDate(iso: string): string {
  const d = detectedInstant(iso)
  if (!d) return "—"
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatAlertType(type: string): string {
  return type.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
}
