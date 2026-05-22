export function formatActivityRowTime(d: Date): string {
  const t = Date.now() - d.getTime()
  const sec = Math.floor(t / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  if (sec < 30) return "Just now"
  if (sec < 60) return `${sec}s ago`
  if (min === 1) return "1 min ago"
  if (min < 60) return `${min} min ago`
  if (hr === 1) return "1 hr ago"
  if (hr < 24) return `${hr} hr ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function formatHeaderLastActivity(d: Date): string {
  const t = Date.now() - d.getTime()
  const sec = Math.floor(t / 1000)
  if (sec < 10) return "just now"
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
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
