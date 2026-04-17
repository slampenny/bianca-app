export function weekdayShortLabel(day?: number): string {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  if (day == null || day < 0 || day > 6) return "?"
  return labels[day]
}

export function parseMonthlyDays(raw: string): number[] {
  const nums = raw
    .split(",")
    .map((t) => Number(t.trim()))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 31)
  return [...new Set(nums)].sort((a, b) => a - b)
}

export function intervalsForDraft(
  frequency: "daily" | "weekly" | "monthly",
  weeklyDays: number[],
  weeklyWeeks: number,
  monthlyDaysRaw: string,
): Array<{ day?: number; weeks?: number }> {
  if (frequency === "daily") return []
  if (frequency === "weekly") {
    const days = [...new Set(weeklyDays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b)
    return days.map((day) => ({ day, weeks: Math.max(1, Number(weeklyWeeks) || 1) }))
  }
  return parseMonthlyDays(monthlyDaysRaw).map((day) => ({ day }))
}
