import { Tabs, TabsContent, TabsList, TabsTrigger } from "@bianca-app/ui"
import { skipToken } from "@reduxjs/toolkit/query"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChartFigure } from "../components/ChartFigure"
import { MockDataBanner } from "../components/MockDataBanner"
import { isDevDemoEnabled } from "../lib/devDemo"
import { downloadLiveFacilityReportsCsv, residentsForLiveCsv } from "../lib/facilityReportsCsv"
import { countOpenAlertsByClient, formatClientLastCall } from "../lib/residentReportLive"
import { formatActivityRowTime } from "../lib/timeFormat"
import { summarizeChartSeries } from "../lib/chartSummary"
import { useGetRecentActivityQuery } from "../services/api/activityApi"
import type { ActivityFeedItem } from "../services/api/activityApi"
import { useGetAllAlertsQuery, liveAlertsQueryOptions } from "../services/api/alertApi"
import { useGetAllClientsQuery } from "../services/api/clientApi"
import { useGetReportsSummaryQuery } from "../services/api/facilityReportsApi"
import { isAuthenticated, getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { BellIcon, ChartBarIcon, DownloadIcon, FileTextIcon, PhoneIcon, UsersIcon } from "../icons"
import { localizedReportTemplates, localizedStaffVersusFamily } from "../lib/reportI18n"
import type { ReportTemplateId } from "../data/reportCatalog"
import { ReportsResidentTab } from "./ReportsResidentTab"
import "../app.css"

type ReportsTab = "library" | "activity" | "resident"

type ReportDeliveryChannel = "Viewed" | "Printed" | "CSV" | "PDF"

type RecentReportActivityRow = {
  id: string
  reportName: string
  scope: string
  whenLabel: string
  lastDelivery: ReportDeliveryChannel
  requestedBy: string
  status: "Ready" | "Scheduled"
}

const templateIcon: Record<ReportTemplateId, typeof FileTextIcon> = {
  wellness_daily: UsersIcon,
  call_log: PhoneIcon,
  alert_audit: BellIcon,
  consent_roster: FileTextIcon,
  family_weekly_digest: FileTextIcon,
  risk_sentiment: ChartBarIcon,
}

const THUMB_BARS = [42, 68, 36, 88, 52, 74, 48]

function ReportThumb({ id, t }: { id: ReportTemplateId; t: (key: string) => string }) {
  switch (id) {
    case "call_log":
    case "risk_sentiment":
      return (
        <div className="va-report-thumb" aria-hidden>
          <div className="va-report-thumb-bars">
            {THUMB_BARS.slice(0, 5).map((pct, i) => (
              <div key={i} className="va-report-thumb-bar" style={{ height: `${pct}%` }} />
            ))}
          </div>
        </div>
      )
    case "wellness_daily":
      return (
        <div className="va-report-thumb" aria-hidden style={{ gap: 8, justifyContent: "center" }}>
          {["#14b8a6", "#5eead4", "#0d9488"].map((c, i) => (
            <div
              key={i}
              style={{
                height: 8,
                borderRadius: 4,
                background: c,
                opacity: 1 - i * 0.15,
              }}
            />
          ))}
          <p style={{ margin: 0, fontSize: 10, color: "var(--va-slate-400)", textAlign: "center" }}>{t("reports.thumbMood")}</p>
        </div>
      )
    case "alert_audit":
      return (
        <div className="va-report-thumb" aria-hidden style={{ justifyContent: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "4px 8px",
              borderRadius: 6,
              background: "var(--va-red-50)",
              color: "var(--va-red-700)",
            }}
          >
            ALT
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "4px 8px",
              borderRadius: 6,
              background: "var(--va-amber-50)",
              color: "var(--va-amber-700)",
            }}
          >
            {t("reports.thumbReviewed")}
          </span>
        </div>
      )
    case "consent_roster":
      return (
        <div className="va-report-thumb" aria-hidden style={{ justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <CheckDot ok />
            <CheckDot ok />
            <CheckDot ok />
            <CheckDot ok={false} />
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 10, color: "var(--va-slate-400)", textAlign: "center" }}>
            {t("reports.thumbConsent")}
          </p>
        </div>
      )
    case "family_weekly_digest":
      return (
        <div className="va-report-thumb" aria-hidden style={{ justifyContent: "center", padding: "0.75rem", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "var(--va-slate-500)" }}>
            <span>{t("reports.chartDayMon")}</span>
            <span>{t("reports.chartDayTue")}</span>
            <span>{t("reports.chartDayWed")}</span>
            <span>{t("reports.chartDayThu")}</span>
            <span>{t("reports.chartDayFri")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 4, height: 48 }}>
            {[1, 1, 0, 1, 1].map((ok, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: ok ? "85%" : "28%",
                  borderRadius: 4,
                  background: ok ? "var(--va-teal)" : "var(--va-slate-200)",
                }}
              />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 9, color: "var(--va-slate-400)", textAlign: "center" }}>{t("reports.thumbCallsConnected")}</p>
        </div>
      )
    default:
      return (
        <div className="va-report-thumb" aria-hidden>
          <div className="va-report-thumb-bars">
            {[55, 40, 70].map((pct, i) => (
              <div key={i} className="va-report-thumb-bar" style={{ height: `${pct}%` }} />
            ))}
          </div>
        </div>
      )
  }
}

function CheckDot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: ok ? "var(--va-emerald-500)" : "var(--va-slate-200)",
        display: "inline-block",
      }}
    />
  )
}

function mapActivityToReportRow(item: ActivityFeedItem, t: (key: string, opts?: Record<string, unknown>) => string): RecentReportActivityRow {
  const whenLabel = formatActivityRowTime(new Date(item.occurredAt))
  if (item.type === "alert") {
    return {
      id: item.id,
      reportName: t("reports.activityFacilityAlert"),
      scope: item.residentName || "—",
      whenLabel,
      lastDelivery: "Viewed",
      requestedBy: t("reports.activitySystem"),
      status: "Ready",
    }
  }
  const callLabel = item.callType ? String(item.callType).replace(/_/g, " ") : t("reports.activityCheckIn")
  return {
    id: item.id,
    reportName: t("reports.activityCall", { type: callLabel }),
    scope: item.residentName || "—",
    whenLabel,
    lastDelivery: "Viewed",
    requestedBy: t("reports.activitySystem"),
    status: "Ready",
  }
}

function localizedStatusLabel(t: (key: string) => string, status: RecentReportActivityRow["status"]): string {
  return status === "Ready" ? t("reports.statusReady") : t("reports.statusScheduled")
}

function localizedDeliveryLabel(t: (key: string) => string, kind: ReportDeliveryChannel): string {
  const map: Record<ReportDeliveryChannel, string> = {
    Viewed: t("reports.deliveryViewed"),
    Printed: t("reports.deliveryPrinted"),
    CSV: t("reports.deliveryCsv"),
    PDF: t("reports.deliveryPdf"),
  }
  return map[kind] ?? kind
}

function deliveryChipStyle(kind: ReportDeliveryChannel): { bg: string; color: string } {
  switch (kind) {
    case "Printed":
      return { bg: "var(--va-slate-100)", color: "var(--va-slate-700)" }
    case "Viewed":
      return { bg: "rgba(20, 184, 166, 0.15)", color: "var(--va-emerald-700)" }
    case "PDF":
      return { bg: "#e0e7ff", color: "#3730a3" }
    default:
      return { bg: "var(--va-slate-100)", color: "var(--va-slate-600)" }
  }
}

export function ReportsPage() {
  const { t } = useTranslation()
  const devDemo = isDevDemoEnabled()
  const authed = useAppSelector(isAuthenticated)
  const reportTemplates = useMemo(() => localizedReportTemplates(t), [t])
  const staffVersusFamilyDigestCopy = useMemo(() => localizedStaffVersusFamily(t), [t])
  const org = useAppSelector((s) => s.org)
  const currentUser = useAppSelector(getCurrentUser)
  const superAdminNeedsOrg = currentUser?.role === "superAdmin"
  const skipLive = !authed || (superAdminNeedsOrg && !org?.id)

  const { data: summary, isLoading: summaryLoading } = useGetReportsSummaryQuery(
    skipLive ? skipToken : superAdminNeedsOrg && org?.id ? { orgId: org.id } : undefined,
  )
  const { data: recentActivity } = useGetRecentActivityQuery(
    skipLive ? skipToken : superAdminNeedsOrg && org?.id ? { orgId: org.id, limit: 12, sinceDays: 30 } : { limit: 12, sinceDays: 30 },
  )
  const {
    data: clientPages,
    isLoading: clientsLoading,
    isError: clientsError,
  } = useGetAllClientsQuery(skipLive ? skipToken : { limit: 500, page: 1 })
  const { data: apiAlerts } = useGetAllAlertsQuery(undefined, {
    ...liveAlertsQueryOptions,
    skip: skipLive,
  })

  const clients = clientPages?.results ?? []
  const alerts = apiAlerts ?? []

  const weeklyReportRuns = summary?.weeklyReportRuns ?? []
  const weeklyReportChartSummary = useMemo(
    () =>
      summarizeChartSeries(
        weeklyReportRuns,
        "day",
        "runs",
        (day, count) => t("reports.activityChartSummaryItem", { day, count }),
        t("reports.activityChartSummaryEmpty"),
      ),
    [weeklyReportRuns, t],
  )
  const recentReportRows = useMemo(
    () => (recentActivity?.results ?? []).map((item) => mapActivityToReportRow(item, t)),
    [recentActivity?.results, t],
  )

  const [tab, setTab] = useState<ReportsTab>("library")
  const [selectedClientId, setSelectedClientId] = useState("")

  const liveSummaryReady = authed && !skipLive && !summaryLoading && summary != null
  const liveClientsReady = authed && !skipLive && !clientsLoading && clientPages != null
  const canExportLiveCsv = liveSummaryReady && liveClientsReady

  const openAlertsByClient = useMemo(() => countOpenAlertsByClient(alerts), [alerts])

  const csvResidentRows = useMemo(() => {
    const notAvailable = t("reports.notAvailable")
    return residentsForLiveCsv(clients, openAlertsByClient, {
      notAvailable,
      status: (status) => {
        switch (status) {
          case "active":
            return t("reports.residentStatusActive")
          case "at_risk":
            return t("reports.residentStatusAtRisk")
          default:
            return t("reports.residentStatusInactive")
        }
      },
      lastCall: (client) => formatClientLastCall(client, notAvailable),
      risk: (level) => {
        switch (level) {
          case "high":
            return t("reports.riskHigh")
          case "medium":
            return t("reports.riskMedium")
          case "low":
            return t("reports.riskLow")
          case "none":
            return null
          default:
            return null
        }
      },
      sentiment: (dir) => {
        if (dir === "improving") return t("reports.sentimentImproving")
        if (dir === "declining") return t("reports.sentimentDeclining")
        if (dir === "stable") return t("reports.sentimentStable")
        return null
      },
    })
  }, [clients, openAlertsByClient, t])

  const onDownloadLiveCsv = useCallback(() => {
    if (!summary || !canExportLiveCsv) return
    downloadLiveFacilityReportsCsv({
      orgName: org?.name?.trim() || t("appShell.defaultFacility"),
      summary,
      residents: csvResidentRows,
      recentActivity: recentActivity?.results ?? [],
    })
  }, [summary, canExportLiveCsv, org?.name, t, csvResidentRows, recentActivity?.results])

  const tabOptions = useMemo((): [ReportsTab, string][] => {
    return [
      ["library", t("reports.tabLibrary")],
      ["activity", t("reports.tabActivity")],
      ["resident", t("reports.tabResident")],
    ]
  }, [t])

  return (
    <div data-testid="reports-page" style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <h1 className="va-page-title">{t("reports.title")}</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginTop: 6, maxWidth: 600, lineHeight: 1.55 }}>
              {t("reports.introLive")}
            </p>
          </div>
          {devDemo ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem", maxWidth: 280 }}>
              <button
                type="button"
                className="va-btn-secondary"
                onClick={() => {
                  void import("../data/reportsMock").then((m) => m.downloadFacilitySnapshotCsv())
                }}
              >
                <DownloadIcon size={18} />
                {t("reports.downloadCsv")}
              </button>
              <MockDataBanner testId="reports-facility-csv-mock-banner" />
            </div>
          ) : (
            <button
              type="button"
              className="va-btn-secondary"
              data-testid="reports-live-csv-export"
              disabled={!canExportLiveCsv}
              title={canExportLiveCsv ? undefined : t("reports.csvExportDisabled")}
              onClick={() => onDownloadLiveCsv()}
            >
              <DownloadIcon size={18} />
              {t("reports.downloadCsv")}
            </button>
          )}
        </div>
        <p className="va-reports-muted" style={{ margin: 0 }}>{t("reports.liveMetricsNote")}</p>
      </div>

      <div
        className="va-card va-card-pad"
        style={{
          background: "linear-gradient(135deg, rgba(20, 184, 166, 0.06) 0%, #fff 55%)",
          border: "1px solid var(--va-slate-100)",
        }}
      >
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--va-navy)", margin: "0 0 0.75rem", lineHeight: 1.35 }}>
          {staffVersusFamilyDigestCopy.title}
        </h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--va-slate-600)", fontSize: "0.875rem", lineHeight: 1.65 }}>
          {staffVersusFamilyDigestCopy.body.map((p) => (
            <li key={p} style={{ marginBottom: "0.5rem" }}>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="va-reports-stat-grid" aria-busy={summaryLoading}>
        <div className="va-reports-stat">
          <div className="va-reports-stat-value">{summaryLoading ? "—" : (summary?.generatedThisMonth ?? 0)}</div>
          <div className="va-reports-stat-label">{t("reports.statDigestsMonth")}</div>
        </div>
        <div className="va-reports-stat">
          <div className="va-reports-stat-value">{summaryLoading ? "—" : (summary?.scheduledDeliveries ?? 0)}</div>
          <div className="va-reports-stat-label">{t("reports.statActiveSchedules")}</div>
        </div>
        <div className="va-reports-stat">
          <div className="va-reports-stat-value">{summaryLoading ? "—" : (summary?.residentsWithOpenFollowUps ?? 0)}</div>
          <div className="va-reports-stat-label">{t("reports.statResidentsFollowups")}</div>
        </div>
        <div className="va-reports-stat">
          <div className="va-reports-stat-value" style={{ fontSize: "1.125rem", paddingTop: 4 }}>
            {summaryLoading ? "—" : (summary?.lastFacilityReportLabel ?? "—")}
          </div>
          <div className="va-reports-stat-label">
            {t("reports.lastDigestLine", {
              posture: summaryLoading ? "—" : (summary?.complianceScoreLabel ?? "—"),
            })}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as ReportsTab)}>
        <div
          className="va-card va-card-pad"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}
        >
          <TabsList aria-label={t("reports.tabListAria")} variant="pills">
            {tabOptions.map(([key, label]) => (
              <TabsTrigger key={key} value={key} variant="pill">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-500)", maxWidth: 400, lineHeight: 1.45 }}>
            {t("reports.tabHint")}
          </p>
        </div>

        <TabsContent value="library" style={{ marginTop: "1.75rem" }}>
          <div className="va-reports-template-grid">
            {reportTemplates.map((tm) => {
              const Icon = templateIcon[tm.id]
              return (
                <article key={tm.id} className="va-reports-template-card" style={{ padding: 0, overflow: "hidden" }}>
                  <ReportThumb id={tm.id} t={t} />
                  <div style={{ padding: "0 1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "0.65rem",
                          background: "rgba(20, 184, 166, 0.12)",
                          color: "var(--va-teal)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3>{tm.title}</h3>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", fontWeight: 600, color: "var(--va-teal)" }}>
                          {tm.subtitle}
                        </p>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.55, flex: 1 }}>
                      {tm.description}
                    </p>
                    <div className="va-reports-tag-row">
                      <span className="va-reports-tag va-reports-tag--teal">{tm.cadence}</span>
                      {tm.tags.map((tag) => (
                        <span key={tag} className="va-reports-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <Link
                      to={tm.id === "wellness_daily" ? "/reports/daily-digest" : `/reports/${tm.id}`}
                      className="va-btn-primary"
                      data-testid={`report-open-${tm.id}`}
                      style={{ alignSelf: "stretch", justifyContent: "center", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                    >
                      {tm.id === "wellness_daily" ? t("reports.openLiveDigest") : t("reports.viewReport")}
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="activity" style={{ marginTop: "1.75rem" }}>
          <div className="va-card va-card-pad" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.0625rem", fontWeight: 600, color: "var(--va-navy)", margin: 0 }}>{t("reports.activityTitle")}</h2>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "var(--va-slate-500)", lineHeight: 1.5 }}>
                {t("reports.activitySubtitle")}
              </p>
            </div>
            <ChartFigure
              title={t("reports.activityTitle")}
              summary={t("reports.activityChartSummary", { items: weeklyReportChartSummary })}
              chartStyle={{ width: "100%", height: 260 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyReportRuns} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--va-slate-500)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--va-slate-500)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "var(--va-slate-50)" }}
                    contentStyle={{
                      borderRadius: "0.5rem",
                      border: "1px solid var(--va-slate-200)",
                      fontSize: "0.8125rem",
                    }}
                  />
                  <Bar dataKey="runs" fill="var(--va-teal)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFigure>
          </div>
        </TabsContent>

        <TabsContent value="resident" style={{ marginTop: "1.75rem" }}>
          <ReportsResidentTab
            clients={clients}
            alerts={alerts}
            clientsLoading={clientsLoading}
            clientsError={clientsError}
            selectedClientId={selectedClientId}
            onSelectClientId={setSelectedClientId}
          />
        </TabsContent>
      </Tabs>

      <div>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 600, color: "var(--va-navy)", margin: "0 0 0.75rem" }}>{t("reports.recentActivity")}</h2>
        <div className="va-card va-table-wrap" style={{ borderRadius: "1rem", overflow: "hidden" }}>
          <table className="va-table">
            <thead>
              <tr>
                <th>{t("reports.thReport")}</th>
                <th>{t("reports.thScope")}</th>
                <th>{t("reports.thWhen")}</th>
                <th>{t("reports.thDelivery")}</th>
                <th>{t("reports.thBy")}</th>
                <th>{t("reports.thStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {recentReportRows.length === 0 ? (
                <tr className="va-table-row--static">
                  <td colSpan={6} style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", padding: "1.25rem 1rem" }}>
                    {t("reports.noRecentActivity")}
                  </td>
                </tr>
              ) : (
                recentReportRows.map((row) => (
                  <tr key={row.id} className="va-table-row--static">
                    <td style={{ fontWeight: 500, color: "var(--va-navy)" }}>{row.reportName}</td>
                    <td style={{ color: "var(--va-slate-600)" }}>{row.scope}</td>
                    <td style={{ color: "var(--va-slate-500)", fontSize: "0.8125rem" }}>{row.whenLabel}</td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "0.2rem 0.55rem",
                          borderRadius: 999,
                          ...deliveryChipStyle(row.lastDelivery),
                        }}
                      >
                        {localizedDeliveryLabel(t, row.lastDelivery)}
                      </span>
                    </td>
                    <td style={{ color: "var(--va-slate-600)" }}>{row.requestedBy}</td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "0.25rem 0.6rem",
                          borderRadius: 999,
                          ...(row.status === "Ready"
                            ? { background: "var(--va-emerald-100)", color: "var(--va-emerald-700)" }
                            : { background: "var(--va-slate-100)", color: "var(--va-slate-600)" }),
                        }}
                      >
                        {localizedStatusLabel(t, row.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
