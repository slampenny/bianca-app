import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ReportDocumentBody } from "../components/ReportDocumentBody"
import {
  downloadFacilitySnapshotCsv,
  downloadResidentDigestCsv,
  facilityReportStats,
  getResidentDigestPayload,
  printResidentDigest,
  recentReportActivity,
  reportTemplates,
  residentReportSnapshots,
  staffVersusFamilyDigestCopy,
  weeklyReportRuns,
  type ReportDeliveryChannel,
  type ReportTemplateId,
  type ResidentReportSnapshot,
} from "../data/reportsMock"
import { BellIcon, ChartBarIcon, DownloadIcon, FileTextIcon, PhoneIcon, PrintIcon, UsersIcon } from "../icons"
import "../app.css"

type ReportsTab = "library" | "activity" | "resident"

const templateIcon: Record<ReportTemplateId, typeof FileTextIcon> = {
  wellness_daily: UsersIcon,
  call_log: PhoneIcon,
  alert_audit: BellIcon,
  consent_roster: FileTextIcon,
  family_weekly_digest: FileTextIcon,
  risk_sentiment: ChartBarIcon,
}

const THUMB_BARS = [42, 68, 36, 88, 52, 74, 48]

function ReportThumb({ id }: { id: ReportTemplateId }) {
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
          <p style={{ margin: 0, fontSize: 10, color: "var(--va-slate-400)", textAlign: "center" }}>Mood mix · sample</p>
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
            ALT-1048
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
            Reviewed
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
            Consent coverage
          </p>
        </div>
      )
    case "family_weekly_digest":
      return (
        <div className="va-report-thumb" aria-hidden style={{ justifyContent: "center", padding: "0.75rem", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "var(--va-slate-500)" }}>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
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
          <p style={{ margin: 0, fontSize: 9, color: "var(--va-slate-400)", textAlign: "center" }}>Calls · connected</p>
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

function riskStyles(label: ResidentReportSnapshot["riskLabel"]): { bg: string; color: string } {
  switch (label) {
    case "High":
      return { bg: "var(--va-red-50)", color: "var(--va-red-700)" }
    case "Medium":
      return { bg: "var(--va-amber-50)", color: "var(--va-amber-700)" }
    default:
      return { bg: "var(--va-emerald-100)", color: "var(--va-emerald-700)" }
  }
}

function sentimentStyles(label: ResidentReportSnapshot["sentimentLabel"]): { bg: string; color: string } {
  switch (label) {
    case "Declining":
      return { bg: "var(--va-red-50)", color: "var(--va-red-700)" }
    case "Improving":
      return { bg: "var(--va-emerald-100)", color: "var(--va-emerald-700)" }
    default:
      return { bg: "var(--va-slate-100)", color: "var(--va-slate-600)" }
  }
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
  const [tab, setTab] = useState<ReportsTab>("library")
  const [residentId, setResidentId] = useState(residentReportSnapshots[0]?.id ?? "")

  const selectedResident = useMemo(
    () => residentReportSnapshots.find((r) => r.id === residentId) ?? residentReportSnapshots[0],
    [residentId],
  )

  const residentPayload = useMemo(
    () => (selectedResident ? getResidentDigestPayload(selectedResident) : null),
    [selectedResident],
  )

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
            <h1 className="va-page-title">Reports</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginTop: 6, maxWidth: 600, lineHeight: 1.55 }}>
              Read each report on screen first. Print and CSV use the same underlying content. The weekly family digest is
              scoped to one authorized recipient; the care-team daily digest stays in the facility boundary. Sample data only.
            </p>
          </div>
          <button type="button" className="va-btn-secondary" onClick={() => downloadFacilitySnapshotCsv()}>
            <DownloadIcon size={18} />
            Combined facility data (CSV)
          </button>
        </div>
        <p className="va-reports-muted" style={{ margin: 0 }}>Figures and narratives below are sample content for layout review.</p>
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

      <div className="va-reports-stat-grid">
        <div className="va-reports-stat">
          <div className="va-reports-stat-value">{facilityReportStats.generatedThisMonth}</div>
          <div className="va-reports-stat-label">Report views generated this month</div>
        </div>
        <div className="va-reports-stat">
          <div className="va-reports-stat-value">{facilityReportStats.scheduledDeliveries}</div>
          <div className="va-reports-stat-label">Scheduled report deliveries</div>
        </div>
        <div className="va-reports-stat">
          <div className="va-reports-stat-value">{facilityReportStats.residentsFlaggedInReports}</div>
          <div className="va-reports-stat-label">Residents with open follow-ups</div>
        </div>
        <div className="va-reports-stat">
          <div className="va-reports-stat-value" style={{ fontSize: "1.125rem", paddingTop: 4 }}>
            {facilityReportStats.lastFacilityReportLabel}
          </div>
          <div className="va-reports-stat-label">Last facility report run · {facilityReportStats.complianceScoreLabel} posture</div>
        </div>
      </div>

      <div
        className="va-card va-card-pad"
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}
      >
        <div className="va-reports-tabs" role="tablist" aria-label="Report views">
          {(
            [
              ["library", "Report library"],
              ["activity", "Facility activity"],
              ["resident", "Per resident"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`va-reports-tab${tab === key ? " va-reports-tab--active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-500)", maxWidth: 400, lineHeight: 1.45 }}>
          Open a report to see the full layout. Use print for a PDF copy; CSV pulls the same tables.
        </p>
      </div>

      {tab === "library" ? (
        <div className="va-reports-template-grid">
          {reportTemplates.map((t) => {
            const Icon = templateIcon[t.id]
            return (
              <article key={t.id} className="va-reports-template-card" style={{ padding: 0, overflow: "hidden" }}>
                <ReportThumb id={t.id} />
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
                      <h3>{t.title}</h3>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", fontWeight: 600, color: "var(--va-teal)" }}>
                        {t.subtitle}
                      </p>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.55, flex: 1 }}>
                    {t.description}
                  </p>
                  <div className="va-reports-tag-row">
                    <span className="va-reports-tag va-reports-tag--teal">{t.cadence}</span>
                    {t.tags.map((tag) => (
                      <span key={tag} className="va-reports-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link
                    to={t.id === "wellness_daily" ? "/reports/daily-digest" : `/reports/${t.id}`}
                    className="va-btn-primary"
                    data-testid={`report-open-${t.id}`}
                    style={{ alignSelf: "stretch", justifyContent: "center", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                  >
                    {t.id === "wellness_daily" ? "Open live digest" : "View report"}
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="va-card va-card-pad" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <h2 style={{ fontSize: "1.0625rem", fontWeight: 600, color: "var(--va-navy)", margin: 0 }}>Automated report volume</h2>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "var(--va-slate-500)", lineHeight: 1.5 }}>
              How often report jobs ran this week (sample). Helps you plan before turning on daily digests for every wing.
            </p>
          </div>
          <div style={{ width: "100%", height: 260 }}>
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
          </div>
        </div>
      ) : null}

      {tab === "resident" && selectedResident && residentPayload ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 360 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--va-slate-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Resident
            </span>
            <select className="va-reports-select" value={selectedResident.id} onChange={(e) => setResidentId(e.target.value)}>
              {residentReportSnapshots.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName} · Room {r.room}
                </option>
              ))}
            </select>
          </label>

          <div className="va-card" style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: "1.25rem 1.5rem",
                background: "linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, var(--va-slate-50) 100%)",
                borderBottom: "1px solid var(--va-slate-100)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--va-navy)", margin: 0 }}>{selectedResident.displayName}</h2>
                  <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "var(--va-slate-500)" }}>
                    Room {selectedResident.room} · Last digest {selectedResident.lastDigest}
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span
                    style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: 999,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      ...riskStyles(selectedResident.riskLabel),
                    }}
                  >
                    Risk · {selectedResident.riskLabel}
                  </span>
                  <span
                    style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: 999,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      ...sentimentStyles(selectedResident.sentimentLabel),
                    }}
                  >
                    Sentiment · {selectedResident.sentimentLabel}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: "1.25rem", height: 72, display: "flex", alignItems: "flex-end", gap: 6 }}>
                {[32, 48, 40, 62, 55, 70, 44].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${h}%`,
                      borderRadius: "6px 6px 2px 2px",
                      background: i >= 4 ? "var(--va-teal)" : "var(--va-slate-200)",
                      opacity: i === 5 ? 1 : 0.85,
                    }}
                  />
                ))}
              </div>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.6875rem", color: "var(--va-slate-400)" }}>Engagement signal · illustrative week</p>
            </div>
            <div className="va-card-pad" style={{ paddingTop: "1.25rem" }}>
              <p style={{ margin: "0 0 1rem", fontSize: "0.8125rem", color: "var(--va-slate-500)", lineHeight: 1.5 }}>
                This is a <strong style={{ color: "var(--va-navy)" }}>care-team snapshot</strong> (risk, sentiment, internal queue). It is not the same document as the{" "}
                <strong>weekly family call digest</strong>, which stays high-level and is addressed to one verified contact at a time.
              </p>
              <ReportDocumentBody payload={residentPayload} />
              <div className="va-report-modal-actions" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
                <button type="button" className="va-btn-secondary" onClick={() => printResidentDigest(selectedResident)}>
                  <PrintIcon size={18} />
                  Print / Save as PDF
                </button>
                <button type="button" className="va-btn-secondary" onClick={() => downloadResidentDigestCsv(selectedResident)}>
                  <DownloadIcon size={18} />
                  Download data (CSV)
                </button>
                <Link
                  to="/residents"
                  className="va-btn-secondary"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                  Residents list
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 600, color: "var(--va-navy)", margin: "0 0 0.75rem" }}>Recent activity</h2>
        <div className="va-card va-table-wrap" style={{ borderRadius: "1rem", overflow: "hidden" }}>
          <table className="va-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Scope</th>
                <th>When</th>
                <th>Last delivery</th>
                <th>By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentReportActivity.map((row) => (
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
                      {row.lastDelivery}
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
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
