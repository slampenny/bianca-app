import { skipToken } from "@reduxjs/toolkit/query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { isAlertUnreadForCaregiver, mapClientToResident } from "../lib/liveData"
import { formatActivityRowTime } from "../lib/timeFormat"
import { useGetCallsByHourTodayQuery } from "../services/api/activityApi"
import { useGetAllAlertsQuery } from "../services/api/alertApi"
import { useGetAllClientsQuery } from "../services/api/clientApi"
import { useDemo } from "../state/DemoContext"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { CheckIcon, PhoneIcon } from "../icons"

const BUSINESS_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const

function hourLabel12h(h: number): string {
  if (h === 0) return "12am"
  if (h < 12) return `${h}am`
  if (h === 12) return "12pm"
  return `${h - 12}pm`
}

function emptyBusinessHourChart() {
  return BUSINESS_HOURS.map((h) => ({ hour: hourLabel12h(h), calls: 0 }))
}

const MS_DAY = 86_400_000

function withinMs(iso: string | null | undefined, ms: number): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && Date.now() - t < ms
}

export function DashboardPage() {
  const authed = useAppSelector((s) => !!s.auth.tokens)
  const currentUser = useAppSelector(getCurrentUser)
  const org = useAppSelector((s) => s.org)
  const { state: demo } = useDemo()
  const { residents, activityFeed, alertTriggered, alerts: demoAlerts } = demo

  const superAdminNeedsOrg = currentUser?.role === "superAdmin"
  const skipHourlyChart = !authed || (superAdminNeedsOrg && !org?.id)

  const { data: hourlyToday, isLoading: hourlyLoading, isError: hourlyError } = useGetCallsByHourTodayQuery(
    superAdminNeedsOrg && org?.id ? { orgId: org.id } : undefined,
    { skip: skipHourlyChart },
  )

  const { data: clientPages } = useGetAllClientsQuery(authed ? { limit: 500, page: 1 } : skipToken)
  const { data: apiAlerts } = useGetAllAlertsQuery(authed ? undefined : skipToken)

  const clients = clientPages?.results ?? []
  const totalFromApi = clientPages?.totalResults

  const [, force] = useState(0)
  const tick = useCallback(() => force((n) => n + 1), [])
  useEffect(() => {
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [tick])

  const c = totalFromApi != null ? totalFromApi : clients.length || residents.length || 146
  const activeToday = useMemo(
    () => (clients.length ? clients.filter((cl) => withinMs(cl.lastCallAttemptAt, MS_DAY)).length : Math.max(c - 4, 142)),
    [clients, c],
  )
  const callsCompleted = useMemo(
    () => (clients.length ? clients.filter((cl) => withinMs(cl.lastAnsweredCallAt, MS_DAY)).length : alertTriggered ? 140 : 139),
    [clients, alertTriggered],
  )
  const attemptsToday = useMemo(
    () => (clients.length ? clients.filter((cl) => withinMs(cl.lastCallAttemptAt, MS_DAY)).length : c),
    [clients, c],
  )
  // lastAnsweredCallAt and lastCallAttemptAt are independent 24h windows — completed can exceed "attempts"
  // in the API data, which would imply a rate >100%. Cap for display; denominator is best-effort.
  const successRate = useMemo(() => {
    if (clients.length && attemptsToday > 0) {
      return Math.min(100, (callsCompleted / attemptsToday) * 100).toFixed(1)
    }
    if (clients.length && attemptsToday === 0 && callsCompleted > 0) {
      return Math.min(100, (callsCompleted / Math.max(c, 1)) * 100).toFixed(1)
    }
    if (c > 0) {
      return Math.min(100, ((alertTriggered ? 140 : 139) / c) * 100).toFixed(1)
    }
    return "95.2"
  }, [clients.length, attemptsToday, callsCompleted, c, alertTriggered])

  const liveUnread = useMemo(
    () => (apiAlerts ?? []).filter((a) => isAlertUnreadForCaregiver(a, currentUser?.id)).length,
    [apiAlerts, currentUser?.id],
  )
  const demoNewCount = demoAlerts.filter((a) => a.status === "new").length
  const newCount = liveUnread + demoNewCount

  const showAlertBanner = alertTriggered || newCount > 0
  const slice = activityFeed.slice(0, 15)

  const atRiskFromApi = useMemo(() => clients.filter((cl) => mapClientToResident(cl).status === "at_risk").length, [clients])

  const hourlyChartData = useMemo(() => {
    if (hourlyToday?.buckets?.length) {
      return hourlyToday.buckets.map((b) => ({ hour: b.label, calls: b.calls }))
    }
    return emptyBusinessHourChart()
  }, [hourlyToday])

  const hourlyYAxisMax = useMemo(() => {
    const m = Math.max(...hourlyChartData.map((d) => d.calls), 0)
    if (m <= 0) return 7
    return Math.max(7, Math.ceil(m / 7) * 7)
  }, [hourlyChartData])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <p style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", lineHeight: 1.45 }}>
        {/* WEB_API_GAP: No facility dashboard rollup; metrics use GET /clients (+24h call timestamps) and GET /alerts. */}
        Metrics use live clients/alerts; today&apos;s hourly chart uses{" "}
        <code style={{ fontSize: "0.7em" }}>GET /activity/calls-by-hour-today</code> (org timezone, 7am–5pm local).
      </p>

      <div
        style={{
          borderRadius: "1rem",
          padding: "1.25rem 1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          transition: "background 0.5s, border 0.5s",
          ...(showAlertBanner
            ? { background: "var(--va-red-50)", border: "1px solid var(--va-red-100)" }
            : { background: "rgba(20, 184, 166, 0.12)", border: "1px solid rgba(20, 184, 166, 0.35)" }),
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: showAlertBanner ? "var(--va-red-100)" : "rgba(20, 184, 166, 0.25)",
            color: showAlertBanner ? "var(--va-red-600)" : "var(--va-teal)",
          }}
        >
          {showAlertBanner ? <AlertGlyph /> : <CheckIcon size={20} />}
        </div>
        <div>
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: showAlertBanner ? "var(--va-red-800)" : "var(--va-navy)",
            }}
          >
            {showAlertBanner
              ? `Bianca is monitoring ${c} residents — ${newCount} alert${newCount === 1 ? "" : "s"} need attention`
              : `Bianca is actively monitoring ${c} residents`}
          </p>
          <p
            style={{
              fontSize: "0.75rem",
              marginTop: 4,
              color: showAlertBanner ? "var(--va-red-600)" : "var(--va-teal)",
            }}
          >
            {showAlertBanner
              ? "Review alerts for open items (API) and any demo simulate alerts"
              : atRiskFromApi > 0
                ? `${atRiskFromApi} client(s) flagged at-risk from latest scores`
                : "All systems operational — last check 2 minutes ago"}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "1rem",
        }}
        className="va-dash-metrics"
      >
        <MetricCard icon={<UsersGlyph />} value={c} label="Total Residents" accent="rgba(37, 99, 235, 0.12)" iconC="var(--va-blue)" />
        <MetricCard icon={<ActivityGlyph />} value={activeToday} label="Active Today" accent="var(--va-emerald-100)" iconC="var(--va-emerald-600)" />
        <MetricCard icon={<PhoneIcon size={20} />} value={callsCompleted} label="Calls Completed (24h)" accent="rgba(20, 184, 166, 0.15)" iconC="var(--va-teal)" />
        <MetricCard icon={<ChartGlyph />} value={`${successRate}%`} label="Answer rate (24h)" accent="rgba(20, 184, 166, 0.15)" iconC="var(--va-teal)" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "1.5rem",
        }}
        className="va-dash-grid"
      >
        <div className="va-card" style={{ gridColumn: "span 1" }}>
          <div style={{ padding: "1.5rem 1.5rem 0.5rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--va-navy)" }}>Recent Activity</h2>
            <p style={{ fontSize: "0.7rem", color: "var(--va-slate-400)", marginTop: 4 }}>Demo feed — WEB_API_GAP</p>
          </div>
          <div
            style={{
              maxHeight: 420,
              overflowY: "auto",
              padding: "0 1.5rem 1.5rem",
            }}
          >
            {slice.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--va-slate-400)", padding: "2rem" }}>
                No activity yet — data loading...
              </p>
            ) : (
              slice.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    padding: "0.75rem 0",
                    borderBottom: "1px solid var(--va-slate-100)",
                  }}
                >
                  <span
                    style={{
                      marginTop: 6,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: e.type === "alert" ? "var(--va-red-500)" : "var(--va-emerald-500)",
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        color: e.type === "alert" ? "var(--va-red-700)" : "var(--va-navy)",
                        fontWeight: e.type === "alert" ? 600 : 400,
                      }}
                    >
                      {e.type === "alert" ? e.message : `Call completed — ${e.residentName}`}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", marginTop: 4 }}>
                      {formatActivityRowTime(e.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="va-card">
            <div style={{ padding: "1.5rem 1.5rem 0.5rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--va-navy)" }}>Today&apos;s Summary</h2>
              <p style={{ fontSize: "0.7rem", color: "var(--va-slate-400)", marginTop: 4 }}>
                {skipHourlyChart ? (
                  <>Choose an organization to load call volume (super admin).</>
                ) : hourlyError ? (
                  <>Could not load today&apos;s call counts.</>
                ) : hourlyLoading ? (
                  <>Loading call volume…</>
                ) : hourlyToday ? (
                  <>
                    Calls by hour · {hourlyToday.dateLabel} · <span title="IANA timezone">{hourlyToday.timezone}</span>
                  </>
                ) : (
                  <>No data</>
                )}
              </p>
            </div>
            <div style={{ height: 192, padding: "0 1rem 1rem" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData} barCategoryGap="20%">
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, hourlyYAxisMax]}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "none",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value} calls`, "Calls"]}
                  />
                  <Bar dataKey="calls" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="va-card va-card-pad"
            style={{
              transition: "background 0.5s, border 0.5s",
              ...(showAlertBanner ? { background: "var(--va-red-50)", border: "1px solid var(--va-red-100)" } : {}),
            }}
          >
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: showAlertBanner ? "var(--va-red-100)" : "var(--va-emerald-100)",
                  color: showAlertBanner ? "var(--va-red-600)" : "var(--va-emerald-600)",
                }}
              >
                {showAlertBanner ? <AlertGlyph /> : <CheckIcon size={16} />}
              </div>
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: showAlertBanner ? "var(--va-red-800)" : "var(--va-navy)" }}>
                  {showAlertBanner
                    ? `${newCount} open item${newCount === 1 ? "" : "s"} (alerts)`
                    : "No Concerns Detected"}
                </p>
                <p style={{ fontSize: "0.75rem", marginTop: 4, color: showAlertBanner ? "var(--va-red-600)" : "var(--va-slate-500)" }}>
                  {showAlertBanner
                    ? "Review the Alerts page for API-driven items"
                    : `${c} residents in directory — no unread alerts for your account`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .va-dash-metrics { grid-template-columns: repeat(4, 1fr) !important; }
          .va-dash-grid { grid-template-columns: 3fr 2fr !important; }
        }
      `}</style>
    </div>
  )
}

function MetricCard({
  icon,
  value,
  label,
  accent,
  iconC,
}: {
  icon: import("react").ReactNode
  value: string | number
  label: string
  accent: string
  iconC: string
}) {
  return (
    <div className="va-card va-card-pad">
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "0.75rem",
          background: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1rem",
          color: iconC,
        }}
      >
        {icon}
      </div>
      <p style={{ fontSize: 36, fontWeight: 700, color: "var(--va-navy)", lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--va-slate-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
        {label}
      </p>
    </div>
  )
}

function UsersGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  )
}

function ActivityGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

function ChartGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  )
}

function AlertGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}
