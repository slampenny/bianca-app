import { skipToken } from "@reduxjs/toolkit/query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChartFigure } from "../components/ChartFigure"
import { summarizeChartSeries } from "../lib/chartSummary"
import { computeDashboardMetrics } from "../lib/dashboardMetrics"
import { isAlertUnreadForCaregiver, mapClientToResident } from "../lib/liveData"
import { formatActivityRowTime } from "../lib/timeFormat"
import { useGetCallsByHourTodayQuery, useGetRecentActivityQuery } from "../services/api/activityApi"
import { useGetAllAlertsQuery, liveAlertsQueryOptions } from "../services/api/alertApi"
import { useGetAllClientsQuery, useGetClientsOnboardingRollupsQuery } from "../services/api/clientApi"
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

const RECENT_ACTIVITY_LIMIT = 15

export function DashboardPage() {
  const { t } = useTranslation()
  const authed = useAppSelector((s) => !!s.auth.tokens)
  const currentUser = useAppSelector(getCurrentUser)
  const org = useAppSelector((s) => s.org)

  const superAdminNeedsOrg = currentUser?.role === "superAdmin"
  const skipHourlyChart = !authed || (superAdminNeedsOrg && !org?.id)
  const skipRecentActivity = !authed || (superAdminNeedsOrg && !org?.id)

  const { data: hourlyToday, isLoading: hourlyLoading, isError: hourlyError } = useGetCallsByHourTodayQuery(
    superAdminNeedsOrg && org?.id ? { orgId: org.id } : undefined,
    { skip: skipHourlyChart },
  )
  const { data: recentActivity, isLoading: activityLoading, isError: activityError } = useGetRecentActivityQuery(
    skipRecentActivity ? skipToken : superAdminNeedsOrg && org?.id ? { orgId: org.id, limit: RECENT_ACTIVITY_LIMIT, sinceDays: 30 } : { limit: RECENT_ACTIVITY_LIMIT, sinceDays: 30 },
  )

  const {
    data: clientPages,
    isLoading: clientsListLoading,
    isError: clientsListError,
    refetch: refetchClientsList,
  } = useGetAllClientsQuery(authed ? { limit: 500, page: 1 } : skipToken)
  const {
    data: onboardingRollupsRes,
    isLoading: onbRollLoading,
    isError: onbRollError,
  } = useGetClientsOnboardingRollupsQuery(undefined, { skip: !authed, refetchOnFocus: true })
  const { data: apiAlerts } = useGetAllAlertsQuery(undefined, {
    ...liveAlertsQueryOptions,
    skip: !authed,
  })

  const clients = clientPages?.results ?? []
  const totalFromApi = clientPages?.totalResults
  const metrics = useMemo(
    () => computeDashboardMetrics(clients, totalFromApi),
    [clients, totalFromApi],
  )
  const { totalResidents: c, activeToday, callsCompleted, answerRate: successRate } = {
    totalResidents: metrics.totalResidents,
    activeToday: metrics.activeToday,
    callsCompleted: metrics.callsCompleted24h,
    answerRate: metrics.answerRate24h,
  }

  /** Re-render periodically so rolling 24h client metrics update. */
  const [, force] = useState(0)
  const tick = useCallback(() => force((n) => n + 1), [])
  useEffect(() => {
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [tick])

  const liveUnread = useMemo(
    () => (apiAlerts ?? []).filter((a) => isAlertUnreadForCaregiver(a, currentUser?.id)).length,
    [apiAlerts, currentUser?.id],
  )
  const newCount = liveUnread

  const showAlertBanner = newCount > 0
  const recentRows = useMemo(
    () =>
      (recentActivity?.results ?? []).map((item) => ({
        id: item.id,
        type: item.type,
        residentName: item.residentName,
        timestamp: new Date(item.occurredAt),
        message: item.alertSummary ?? "",
      })),
    [recentActivity?.results],
  )

  const atRiskFromApi = useMemo(() => clients.filter((cl) => mapClientToResident(cl).status === "at_risk").length, [clients])

  const lastLiveActivityAt = recentActivity?.results?.[0]?.occurredAt
  const healthySubtitle = useMemo(() => {
    if (lastLiveActivityAt) {
      return t("dashboard.subAllOkWithActivity", {
        time: formatActivityRowTime(new Date(lastLiveActivityAt)),
      })
    }
    return t("dashboard.subAllOk")
  }, [lastLiveActivityAt, t])

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

  const hourlyChartSummary = useMemo(
    () =>
      summarizeChartSeries(
        hourlyChartData,
        "hour",
        "calls",
        (hour, count) => t("dashboard.chartSummaryItem", { hour, count }),
        t("dashboard.chartSummaryEmpty"),
      ),
    [hourlyChartData, t],
  )

  const onboardingCounts = useMemo(() => {
    const vals = Object.values(onboardingRollupsRes?.rollups ?? {})
    let complete = 0
    let active = 0
    let notStarted = 0
    for (const u of vals) {
      if (u.journeyComplete) complete += 1
      else if (u.hasAnyOnboardingActivity) active += 1
      else notStarted += 1
    }
    return { complete, active, notStarted, total: vals.length }
  }, [onboardingRollupsRes])

  if (authed && clientPages === undefined && clientsListLoading) {
    return (
      <div
        data-testid="dashboard-loading"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "4rem 1.5rem",
          gap: "1rem",
          minHeight: 320,
        }}
      >
        <div className="va-spinner" role="status" aria-busy="true" aria-label={t("dashboard.loadingAria")} />
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", margin: 0 }}>{t("dashboard.loading")}</p>
      </div>
    )
  }

  if (authed && clientPages === undefined && clientsListError) {
    return (
      <div style={{ padding: "3rem 1.5rem", textAlign: "center", maxWidth: 420, margin: "0 auto" }}>
        <p style={{ color: "var(--va-slate-600)", margin: "0 0 1rem" }}>{t("dashboard.loadError")}</p>
        <button type="button" className="va-btn-primary" onClick={() => void refetchClientsList()}>
          {t("dashboard.tryAgain")}
        </button>
      </div>
    )
  }

  if (authed && clientPages !== undefined && !clientsListLoading && c === 0) {
    return (
      <div data-testid="dashboard-empty-org" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", lineHeight: 1.45 }}>{t("dashboard.metricsNoteLive")}</p>
        <div className="va-card va-card-pad" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 600, color: "var(--va-navy)" }}>{t("dashboard.noResidentsTitle")}</p>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-500)", lineHeight: 1.5 }}>{t("dashboard.noResidentsBody")}</p>
          <Link to="/residents" className="va-btn-primary" style={{ display: "inline-flex", marginTop: "1.25rem", textDecoration: "none" }}>
            {t("dashboard.allResidents")}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="home-header" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <p style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", lineHeight: 1.45 }}>{t("dashboard.metricsNoteLive")}</p>

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
              ? newCount === 1
                ? t("dashboard.monitoringOneAlert", { count: c })
                : t("dashboard.monitoringManyAlerts", { count: c, alerts: newCount })
              : t("dashboard.monitoringOk", { count: c })}
          </p>
          <p
            style={{
              fontSize: "0.75rem",
              marginTop: 4,
              color: showAlertBanner ? "var(--va-red-600)" : "var(--va-teal)",
            }}
          >
            {showAlertBanner
              ? t("dashboard.subReviewAlerts")
              : atRiskFromApi > 0
                ? t("dashboard.subAtRisk", { count: atRiskFromApi })
                : healthySubtitle}
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
        <MetricCard icon={<UsersGlyph />} value={c} label={t("dashboard.totalResidents")} accent="rgba(37, 99, 235, 0.12)" iconC="var(--va-blue)" />
        <MetricCard icon={<ActivityGlyph />} value={activeToday} label={t("dashboard.activeToday")} accent="var(--va-emerald-100)" iconC="var(--va-emerald-600)" />
        <MetricCard icon={<PhoneIcon size={20} />} value={callsCompleted} label={t("dashboard.callsCompleted24h")} accent="rgba(20, 184, 166, 0.15)" iconC="var(--va-teal)" />
        <MetricCard icon={<ChartGlyph />} value={successRate} label={t("dashboard.answerRate24h")} accent="rgba(20, 184, 166, 0.15)" iconC="var(--va-teal)" />
      </div>

      {authed ? (
        <div className="va-card va-card-pad" data-testid="dashboard-onboarding-card">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--va-navy)", margin: 0 }}>{t("dashboard.onboardingTitle")}</h2>
              <p style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", marginTop: 4, maxWidth: 520 }}>
                {t("dashboard.onboardingSubtitle")}
              </p>
            </div>
          </div>
          {onbRollError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.8125rem", color: "var(--va-red-600)" }}>{t("dashboard.onboardingLoadError")}</p>
          ) : onbRollLoading ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>{t("dashboard.onboardingLoading")}</p>
          ) : (
            <>
              <div
                style={{
                  marginTop: "1rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: "0.75rem",
                }}
              >
                <OnboardingStat value={onboardingCounts.active} label={t("dashboard.onboardingInProgress")} accent="var(--va-amber-50)" border="var(--va-amber-200)" />
                <OnboardingStat value={onboardingCounts.notStarted} label={t("dashboard.onboardingNotStarted")} accent="var(--va-slate-50)" border="var(--va-slate-200)" />
                <OnboardingStat value={onboardingCounts.complete} label={t("dashboard.onboardingComplete")} accent="var(--va-emerald-50)" border="var(--va-emerald-200)" />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginTop: "1rem" }}>
                <Link to="/residents?onboarding=in_progress" className="va-btn-secondary" style={{ textDecoration: "none", fontSize: "0.8125rem", padding: "0.35rem 0.75rem" }}>
                  {t("dashboard.viewInProgress")}
                </Link>
                <Link to="/residents?onboarding=not_started" className="va-btn-secondary" style={{ textDecoration: "none", fontSize: "0.8125rem", padding: "0.35rem 0.75rem" }}>
                  {t("dashboard.viewNotStarted")}
                </Link>
                <Link to="/residents?onboarding=complete" className="va-btn-secondary" style={{ textDecoration: "none", fontSize: "0.8125rem", padding: "0.35rem 0.75rem" }}>
                  {t("dashboard.viewComplete")}
                </Link>
                <Link to="/residents" className="va-btn-ghost" style={{ textDecoration: "none", fontSize: "0.8125rem", padding: "0.35rem 0.75rem" }}>
                  {t("dashboard.allResidents")}
                </Link>
              </div>
              <p style={{ fontSize: "0.7rem", color: "var(--va-slate-400)", marginTop: "0.65rem", marginBottom: 0 }}>
                {onboardingCounts.total === 1
                  ? t("dashboard.onboardingMetaOne", { count: onboardingCounts.total })
                  : t("dashboard.onboardingMetaMany", { count: onboardingCounts.total })}
              </p>
            </>
          )}
        </div>
      ) : null}

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
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--va-navy)" }}>{t("dashboard.recentActivity")}</h2>
            <p style={{ fontSize: "0.7rem", color: "var(--va-slate-400)", marginTop: 4 }}>
              {skipRecentActivity
                ? t("dashboard.activityOrgHint")
                : activityError
                  ? t("dashboard.activityUnable")
                  : activityLoading
                    ? t("dashboard.activityLoadingFeed")
                    : t("dashboard.activityLiveFeed")}
            </p>
          </div>
          <div
            style={{
              maxHeight: 420,
              overflowY: "auto",
              padding: "0 1.5rem 1.5rem",
            }}
          >
            {recentRows.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--va-slate-400)", padding: "2rem" }}>
                {activityLoading
                  ? t("dashboard.activityLoading")
                  : activityError
                    ? t("dashboard.activityUnable")
                    : t("dashboard.activityNoData")}
              </p>
            ) : (
              recentRows.map((e) => (
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
                      {e.type === "alert"
                        ? e.message
                        : t("dashboard.callCompleted", { name: e.residentName })}
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
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--va-navy)" }}>{t("dashboard.todaySummary")}</h2>
              <p style={{ fontSize: "0.7rem", color: "var(--va-slate-400)", marginTop: 4 }}>
                {skipHourlyChart
                  ? t("dashboard.hourlyOrgHint")
                  : hourlyError
                    ? t("dashboard.hourlyLoadError")
                    : hourlyLoading
                      ? t("dashboard.hourlyLoading")
                      : hourlyToday
                        ? t("dashboard.hourlyLabel", {
                            date: hourlyToday.dateLabel,
                            timezone: hourlyToday.timezone,
                          })
                        : t("dashboard.hourlyNoData")}
              </p>
            </div>
            <ChartFigure
              title={t("dashboard.todaySummary")}
              summary={t("dashboard.chartSummary", { items: hourlyChartSummary })}
              chartStyle={{ height: 192, padding: "0 1rem 1rem" }}
            >
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
                    formatter={(value: number) => [
                      t("dashboard.chartTooltipCalls", { count: value }),
                      t("dashboard.chartCallsLabel"),
                    ]}
                  />
                  <Bar dataKey="calls" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFigure>
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
                    ? newCount === 1
                      ? t("dashboard.openItemsOne")
                      : t("dashboard.openItems", { count: newCount })
                    : t("dashboard.noConcerns")}
                </p>
                <p style={{ fontSize: "0.75rem", marginTop: 4, color: showAlertBanner ? "var(--va-red-600)" : "var(--va-slate-500)" }}>
                  {showAlertBanner ? t("dashboard.subOpenAlerts") : t("dashboard.subNoUnread", { count: c })}
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

function OnboardingStat({ value, label, accent, border }: { value: number; label: string; accent: string; border: string }) {
  return (
    <div
      style={{
        borderRadius: "0.65rem",
        border: `1px solid ${border}`,
        background: accent,
        padding: "0.65rem 0.75rem",
      }}
    >
      <p style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--va-navy)", lineHeight: 1.2 }}>{value}</p>
      <p style={{ margin: "0.2rem 0 0", fontSize: "0.7rem", fontWeight: 600, color: "var(--va-slate-600)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </p>
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
