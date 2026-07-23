import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  useGenerateCaregiverDailyDigestMutation,
  useListCaregiverDailyDigestsQuery,
  useSendCaregiverDailyDigestMutation,
  type CaregiverDailyDigest,
  type CaregiverDailyDigestEntry,
} from "../services/api/dailyDigestApi"
import { useGetOrgQuery } from "../services/api/orgApi"
import { useAppSelector } from "../store/store"
import { getCurrentUser } from "../store/authSlice"
import { canManageCaregivers } from "../lib/roleAccess"
import { buildDailyDigestAutomationStatus } from "../lib/dailyDigestAutomation"
import { useGetCaregiverQuery } from "../services/api/caregiverApi"
import { AutomatedDigestStatusIndicator } from "../components/AutomatedDigestStatusIndicator"
import "../app.css"

function utcDateInputValue(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isDigestRedacted(digest: CaregiverDailyDigest): boolean {
  return digest.phiRedactedAt != null || digest.payload?.phiRedacted === true
}

function digestDayMeta(digest: CaregiverDailyDigest) {
  return {
    localDateKey: digest.localDateKey ?? digest.payload.localDateKey ?? null,
    timezone: digest.timezoneAtBuild ?? digest.payload.timezone ?? null,
    digestDayStartIso:
      digest.payload.digestDayStartIso ?? digest.payload.digestDateUtc ?? null,
  }
}

function formatSentimentLine(s: Record<string, unknown>): string {
  const parts: string[] = []
  if (typeof s.overallSentiment === "string") parts.push(String(s.overallSentiment))
  if (typeof s.summary === "string" && s.summary) parts.push(String(s.summary))
  else if (typeof s.patientMood === "string" && s.patientMood) parts.push(String(s.patientMood))
  return parts.join(" — ") || "—"
}

function formatRequiredQuestions(entry: CaregiverDailyDigestEntry, labels: CaregiverDailyDigest["payload"]["labels"]): string {
  const rows = entry.requiredQuestionAnswers
  if (!rows?.length) return ""
  const label = labels.requiredQuestions || "Standard questions"
  return rows
    .map((r) => `${label}: ${r.question} — ${r.answer || "(not answered)"}`)
    .join("\n")
}

function entryNotes(entry: CaregiverDailyDigestEntry, labels: CaregiverDailyDigest["payload"]["labels"]): string {
  if (entry.languageMismatch && entry.languageMismatchExplanation) {
    return entry.languageMismatchExplanation
  }
  const parts: string[] = []
  if (entry.conversationSummaryShort) {
    parts.push(entry.conversationSummaryShort)
  }
  const req = formatRequiredQuestions(entry, labels)
  if (req) parts.push(req)
  if (parts.length > 0) {
    return parts.join("\n")
  }
  if (entry.callsPlaced === 0) {
    return labels.noActivity
  }
  return "—"
}

function hasNoCallsForDay(entries: CaregiverDailyDigestEntry[]): boolean {
  return entries.length > 0 && entries.every((entry) => entry.callsPlaced === 0)
}

function PhiRedactedBanner({ t }: { t: (key: string) => string }) {
  return (
    <p
      data-testid="daily-digest-phi-redacted-banner"
      role="note"
      style={{
        margin: 0,
        padding: "0.65rem 0.85rem",
        borderRadius: 8,
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: "var(--va-slate-700)",
        background: "var(--va-slate-100)",
        border: "1px solid var(--va-slate-300)",
        lineHeight: 1.45,
      }}
    >
      {t("dailyDigest.phiRedactedBanner")}
    </p>
  )
}

function DigestDayMeta({
  digest,
  t,
}: {
  digest: CaregiverDailyDigest
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const { localDateKey, timezone, digestDayStartIso } = digestDayMeta(digest)
  if (!localDateKey && !timezone && !digestDayStartIso) return null

  return (
    <div
      data-testid="daily-digest-day-meta"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.35rem 1rem",
        marginTop: "0.35rem",
        fontSize: "0.75rem",
        color: "var(--va-slate-500)",
        lineHeight: 1.45,
      }}
    >
      {localDateKey ? <span>{t("dailyDigest.localDateKeyLabel", { date: localDateKey })}</span> : null}
      {timezone ? <span>{t("dailyDigest.timezoneLabel", { timezone })}</span> : null}
      {digestDayStartIso ? (
        <span>{t("dailyDigest.digestDayStartLabel", { iso: digestDayStartIso })}</span>
      ) : null}
    </div>
  )
}

function DigestTable({
  entries,
  labels,
  t,
}: {
  entries: CaregiverDailyDigestEntry[]
  labels: CaregiverDailyDigest["payload"]["labels"]
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  return (
    <div style={{ overflowX: "auto", borderRadius: "0.5rem", border: "1px solid var(--va-slate-200)" }}>
      <div className="va-report-doc-table-cap" style={{ padding: "0.65rem 1rem 0", margin: 0 }}>
        {t("dailyDigest.tableCaption")}
      </div>
      <table className="va-report-doc-table" data-testid="daily-digest-table">
        <thead>
          <tr>
            <th>{t("dailyDigest.colResident")}</th>
            <th>{t("dailyDigest.colCalls")}</th>
            <th>{t("dailyDigest.colMood")}</th>
            <th>{t("dailyDigest.colSummary")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.clientId}>
              <td style={{ fontWeight: 600, color: "var(--va-navy)", whiteSpace: "nowrap" }}>{entry.clientName}</td>
              <td style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", whiteSpace: "nowrap" }}>
                {t("dailyDigest.callsPlacedAnswered", { placed: entry.callsPlaced, answered: entry.answeredCalls })}
                {entry.lastCallAt
                  ? t("dailyDigest.callsTimeUtc", { time: entry.lastCallAt.slice(11, 16) })
                  : ""}
              </td>
              <td style={{ fontSize: "0.875rem", lineHeight: 1.45 }}>
                {entry.sentiment && Object.keys(entry.sentiment).length > 0
                  ? formatSentimentLine(entry.sentiment)
                  : "—"}
              </td>
              <td style={{ fontSize: "0.875rem", lineHeight: 1.45 }}>{entryNotes(entry, labels)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DigestDetail({ digest, t }: { digest: CaregiverDailyDigest; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const redacted = isDigestRedacted(digest)
  const entries = digest.payload.entries ?? []
  const noCalls = !redacted && hasNoCallsForDay(entries)

  return (
    <div data-testid="daily-digest-detail" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {redacted ? <PhiRedactedBanner t={t} /> : null}

      {digest.status === "sent" ? (
        <p
          data-testid="daily-digest-sent-immutable-banner"
          role="note"
          style={{
            margin: 0,
            padding: "0.65rem 0.85rem",
            borderRadius: 8,
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--va-teal-900, var(--va-navy))",
            background: "rgba(20, 184, 166, 0.1)",
            border: "1px solid rgba(20, 184, 166, 0.35)",
            lineHeight: 1.45,
          }}
        >
          {t("dailyDigest.sentImmutableBanner")}
        </p>
      ) : null}

      <header>
        {!redacted ? (
          <>
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", color: "var(--va-teal)" }}>{digest.payload.title}</h2>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)" }}>{digest.payload.subtitle}</p>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>{digest.payload.dateLabel}</p>
          </>
        ) : digest.payload.dateLabel ? (
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>{digest.payload.dateLabel}</p>
        ) : null}

        <DigestDayMeta digest={digest} t={t} />

        <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", fontWeight: 600, color: "var(--va-slate-600)" }}>
          {digest.status === "sent" ? t("dailyDigest.statusEmailed") : t("dailyDigest.statusDraft")}
          {digest.version != null ? ` · ${t("dailyDigest.versionLabel", { version: digest.version })}` : ""}
          {digest.sentAt ? ` · ${new Date(digest.sentAt).toLocaleString()}` : ""}
        </p>

        {digest.status === "sent" ? (
          <p
            data-testid="daily-digest-sent-immutable-note"
            style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "var(--va-slate-500)", lineHeight: 1.45 }}
          >
            {t("dailyDigest.sentImmutableNote")}
          </p>
        ) : digest.supersedesDigestMeta?.status === "sent" ? (
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "var(--va-slate-500)", lineHeight: 1.45 }}>
            {t("dailyDigest.listSupersedesSent", { version: digest.supersedesDigestMeta.version })}
          </p>
        ) : null}

        {!redacted ? (
          <>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "var(--va-slate-400)", lineHeight: 1.45 }}>
              {t("dailyDigest.aiDisclaimer")}
            </p>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "var(--va-slate-400)", lineHeight: 1.45 }}>
              {digest.payload.labels.emailScreenHint}
            </p>
          </>
        ) : null}
      </header>

      {redacted ? null : entries.length === 0 ? (
        <p data-testid="daily-digest-empty-roster" style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>
          {t("dailyDigest.emptyRoster")}
        </p>
      ) : (
        <>
          {noCalls ? (
            <p data-testid="daily-digest-empty-no-calls" style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", margin: 0 }}>
              {t("dailyDigest.emptyNoCalls")}
            </p>
          ) : null}
          <DigestTable entries={entries} labels={digest.payload.labels} t={t} />
        </>
      )}
    </div>
  )
}

export function DailyDigestPage() {
  const { t } = useTranslation()
  const currentUser = useAppSelector(getCurrentUser)
  const userId = currentUser?.id != null ? String(currentUser.id) : ""
  const orgId = currentUser?.org != null ? String(currentUser.org) : ""
  const isAdmin = canManageCaregivers(currentUser?.role)
  const canFetchOrgSettings = isAdmin && Boolean(orgId)
  const [caregiverFilter, setCaregiverFilter] = useState<string>("")
  const [digestDate, setDigestDate] = useState(() => utcDateInputValue())
  const [emailWhenBuild, setEmailWhenBuild] = useState(false)
  const [includeAllVersions, setIncludeAllVersions] = useState(false)
  const [shown, setShown] = useState<CaregiverDailyDigest | null>(null)
  const [sendMessage, setSendMessage] = useState<string | null>(null)

  const listArgs = useMemo(() => {
    const base: {
      caregiverId?: string
      includeAllVersions?: boolean
      limit: number
      page: number
      sortBy: string
    } = {
      limit: 20,
      page: 1,
      sortBy: "digestDate:desc",
    }
    if (isAdmin && caregiverFilter.trim()) {
      base.caregiverId = caregiverFilter.trim()
    }
    if (isAdmin && includeAllVersions) {
      base.includeAllVersions = true
    }
    return base
  }, [isAdmin, caregiverFilter, includeAllVersions])

  const { data: listData, isLoading: listLoading, isError: listError, refetch: refetchList } =
    useListCaregiverDailyDigestsQuery(listArgs)
  const [generate, { isLoading: genLoading, error: genError }] = useGenerateCaregiverDailyDigestMutation()
  const [sendDigest, { isLoading: sendLoading, error: sendError }] = useSendCaregiverDailyDigestMutation()

  const { data: selfCaregiver } = useGetCaregiverQuery({ id: userId }, { skip: !userId })
  const {
    data: orgData,
    isLoading: orgLoading,
    isError: orgError,
  } = useGetOrgQuery({ orgId }, { skip: !canFetchOrgSettings })

  const caregiverProfile = useMemo(() => selfCaregiver ?? currentUser ?? null, [selfCaregiver, currentUser])

  const orgSchedulingAvailability = useMemo(() => {
    if (!canFetchOrgSettings) return "unavailable" as const
    if (orgLoading) return "loading" as const
    if (orgError) return "error" as const
    return "available" as const
  }, [canFetchOrgSettings, orgLoading, orgError])

  const automationStatus = useMemo(
    () =>
      buildDailyDigestAutomationStatus({
        caregiver: caregiverProfile,
        org: orgData ?? null,
        orgSchedulingAvailability,
      }),
    [caregiverProfile, orgData, orgSchedulingAvailability],
  )

  const digest = shown

  const onGenerate = useCallback(async () => {
    setSendMessage(null)
    const iso = `${digestDate}T12:00:00.000Z`
    const res = await generate({ digestDate: iso, sendEmail: emailWhenBuild }).unwrap()
    setShown(res)
    if (emailWhenBuild && res.status === "sent") {
      setSendMessage(t("dailyDigest.emailedSuccess"))
    }
  }, [digestDate, emailWhenBuild, generate, t])

  const onSendEmail = useCallback(async () => {
    if (!digest?.id) return
    setSendMessage(null)
    const res = await sendDigest({ digestId: digest.id }).unwrap()
    setShown(res)
    setSendMessage(t("dailyDigest.emailedSuccess"))
  }, [digest?.id, sendDigest, t])

  return (
    <div
      data-testid="daily-digest-page"
      className="va-page-wrap"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      <div>
        <Link
          to="/reports"
          className="va-btn-ghost"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: "0.75rem",
            fontSize: "0.8125rem",
            textDecoration: "none",
            padding: "0.35rem 0",
          }}
        >
          {t("dailyDigest.backToReports")}
        </Link>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", color: "var(--va-navy)" }}>{t("dailyDigest.title")}</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-500)", lineHeight: 1.5 }}>{t("dailyDigest.intro")}</p>
        <p
          data-testid="daily-digest-scheduled-email-hint"
          style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "var(--va-slate-500)", lineHeight: 1.45 }}
        >
          {t("dailyDigest.scheduledEmailHint")}{" "}
          <Link to="/settings" style={{ color: "var(--va-teal)" }}>
            {t("nav.settings")}
          </Link>
        </p>
      </div>

      <AutomatedDigestStatusIndicator status={automationStatus} />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "flex-end",
          padding: "1rem",
          borderRadius: "0.75rem",
          border: "1px solid var(--va-slate-200)",
          background: "var(--va-slate-50)",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "var(--va-slate-600)" }}>
          {t("dailyDigest.digestDateLabel")}
          <input
            type="date"
            className="va-input"
            value={digestDate}
            onChange={(e) => setDigestDate(e.target.value)}
            style={{ padding: "0.5rem 0.65rem", borderRadius: 6, border: "1px solid var(--va-slate-200)" }}
          />
          <span style={{ fontSize: "0.6875rem", color: "var(--va-slate-400)", lineHeight: 1.4 }}>
            {t("dailyDigest.digestDateHelper")}
          </span>
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.8125rem",
              color: "var(--va-slate-600)",
              cursor: "pointer",
            }}
          >
            <input type="checkbox" checked={emailWhenBuild} onChange={(e) => setEmailWhenBuild(e.target.checked)} />
            {t("dailyDigest.emailWhenBuild")}
          </label>
          <span
            data-testid="daily-digest-email-when-build-helper"
            style={{ fontSize: "0.6875rem", color: "var(--va-slate-400)", lineHeight: 1.4, maxWidth: 280 }}
          >
            {t("dailyDigest.emailWhenBuildHelper")}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button type="button" className="va-btn-primary" disabled={genLoading} onClick={() => void onGenerate()}>
            {genLoading ? t("dailyDigest.building") : t("dailyDigest.buildRefresh")}
          </button>
          <span
            data-testid="daily-digest-refresh-draft-note"
            style={{ fontSize: "0.6875rem", color: "var(--va-slate-400)", lineHeight: 1.4, maxWidth: 280 }}
          >
            {t("dailyDigest.refreshDraftNote")}
          </span>
        </div>
      </div>

      {genError ? (
        <p style={{ color: "var(--va-red-600)", fontSize: "0.875rem" }} role="alert">
          {t("dailyDigest.buildError")}
        </p>
      ) : null}

      {sendError ? (
        <p style={{ color: "var(--va-red-600)", fontSize: "0.875rem" }} role="alert">
          {t("dailyDigest.sendError")}
        </p>
      ) : null}

      {sendMessage ? (
        <p style={{ color: "var(--va-teal)", fontSize: "0.875rem" }} role="status">
          {sendMessage}
        </p>
      ) : null}

      {digest ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <DigestDetail digest={digest} t={t} />
          {digest.status === "draft" && !isDigestRedacted(digest) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
              <button
                type="button"
                className="va-btn-secondary"
                data-testid="daily-digest-email-button"
                disabled={sendLoading}
                onClick={() => void onSendEmail()}
              >
                {sendLoading ? t("dailyDigest.sending") : t("dailyDigest.emailDigest")}
              </button>
              <span
                data-testid="daily-digest-manual-email-hint"
                style={{ fontSize: "0.6875rem", color: "var(--va-slate-400)", lineHeight: 1.4 }}
              >
                {t("dailyDigest.manualEmailHint")}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <section>
        <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem", color: "var(--va-navy)" }}>{t("dailyDigest.recentTitle")}</h2>
        {isAdmin ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", marginBottom: "0.75rem", maxWidth: 320 }}>
            {t("dailyDigest.filterCaregiver")}
            <input
              className="va-input"
              placeholder={selfCaregiver?.id ?? t("dailyDigest.caregiverPlaceholder")}
              value={caregiverFilter}
              onChange={(e) => setCaregiverFilter(e.target.value)}
              style={{ padding: "0.5rem 0.65rem", borderRadius: 6, border: "1px solid var(--va-slate-200)" }}
            />
          </label>
        ) : null}
        {isAdmin ? (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.8125rem",
              color: "var(--va-slate-600)",
              cursor: "pointer",
              marginBottom: "0.75rem",
            }}
          >
            <input type="checkbox" checked={includeAllVersions} onChange={(e) => setIncludeAllVersions(e.target.checked)} />
            {t("dailyDigest.showAllVersions")}
          </label>
        ) : null}
        {listLoading ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("dailyDigest.loading")}</p>
        ) : listError ? (
          <div data-testid="daily-digest-list-error" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <p style={{ color: "var(--va-red-600)", fontSize: "0.875rem", margin: 0 }} role="alert">
              {t("dailyDigest.listLoadError")}
            </p>
            <button type="button" className="va-btn-secondary" onClick={() => void refetchList()}>
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {(listData?.results ?? []).map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setShown(d)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.65rem 0.85rem",
                    borderRadius: 8,
                    border: "1px solid var(--va-slate-200)",
                    background: shown?.id === d.id ? "rgba(20, 184, 166, 0.12)" : "var(--va-white)",
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                  }}
                >
                  <strong style={{ color: "var(--va-navy)" }}>
                    {isDigestRedacted(d)
                      ? digestDayMeta(d).localDateKey ?? d.payload?.dateLabel ?? d.digestDate
                      : d.payload?.dateLabel ?? d.digestDate}
                  </strong>
                  <span style={{ color: "var(--va-slate-500)", marginLeft: 8 }}>
                    {d.version != null ? `v${d.version} · ` : ""}
                    {isDigestRedacted(d)
                      ? d.status === "sent"
                        ? t("dailyDigest.statusEmailedShort")
                        : t("dailyDigest.statusDraftShort")
                      : t("dailyDigest.listResidents", {
                          count: d.payload?.entries?.length ?? 0,
                          status:
                            d.status === "sent" ? t("dailyDigest.statusEmailedShort") : t("dailyDigest.statusDraftShort"),
                        })}
                    {d.supersedesDigestMeta?.status === "sent"
                      ? ` ${t("dailyDigest.listSupersedesSent", { version: d.supersedesDigestMeta.version })}`
                      : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!listLoading && !listError && (listData?.results?.length ?? 0) === 0 ? (
          <p data-testid="daily-digest-no-saved" style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>
            {t("dailyDigest.noSavedDigests")}
          </p>
        ) : null}
      </section>
    </div>
  )
}
