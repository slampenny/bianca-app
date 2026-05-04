import { useCallback, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  useGenerateCaregiverDailyDigestMutation,
  useListCaregiverDailyDigestsQuery,
  useSendCaregiverDailyDigestMutation,
  type CaregiverDailyDigest,
  type CaregiverDailyDigestEntry,
} from "../services/api/dailyDigestApi"
import { useAppSelector } from "../store/store"
import { getCurrentUser } from "../store/authSlice"
import { canManageCaregivers } from "../lib/roleAccess"
import { useGetCaregiverQuery } from "../services/api/caregiverApi"
import "../app.css"

function utcDateInputValue(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatSentimentLine(s: Record<string, unknown>): string {
  const parts: string[] = []
  if (typeof s.overallSentiment === "string") parts.push(String(s.overallSentiment))
  if (typeof s.summary === "string" && s.summary) parts.push(String(s.summary))
  else if (typeof s.patientMood === "string" && s.patientMood) parts.push(String(s.patientMood))
  return parts.join(" — ") || "—"
}

function entryNotes(entry: CaregiverDailyDigestEntry, labels: CaregiverDailyDigest["payload"]["labels"]): string {
  if (entry.languageMismatch && entry.languageMismatchExplanation) {
    return entry.languageMismatchExplanation
  }
  if (entry.conversationSummaryShort) {
    return entry.conversationSummaryShort
  }
  if (entry.callsPlaced === 0) {
    return labels.noActivity
  }
  return "—"
}

function DigestTable({
  entries,
  labels,
}: {
  entries: CaregiverDailyDigestEntry[]
  labels: CaregiverDailyDigest["payload"]["labels"]
}) {
  return (
    <div style={{ overflowX: "auto", borderRadius: "0.5rem", border: "1px solid var(--va-slate-200)" }}>
      <div className="va-report-doc-table-cap" style={{ padding: "0.65rem 1rem 0", margin: 0 }}>
        Residents · digest day (UTC)
      </div>
      <table className="va-report-doc-table" data-testid="daily-digest-table">
        <thead>
          <tr>
            <th>Resident</th>
            <th>Calls</th>
            <th>Mood / tone</th>
            <th>Summary & notes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.clientId}>
              <td style={{ fontWeight: 600, color: "var(--va-navy)", whiteSpace: "nowrap" }}>{entry.clientName}</td>
              <td style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", whiteSpace: "nowrap" }}>
                {entry.callsPlaced} placed · {entry.answeredCalls} answered
                {entry.lastCallAt ? ` · ${entry.lastCallAt.slice(11, 16)} UTC` : ""}
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

export function DailyDigestPage() {
  const currentUser = useAppSelector(getCurrentUser)
  const userId = currentUser?.id != null ? String(currentUser.id) : ""
  const isAdmin = canManageCaregivers(currentUser?.role)
  const [caregiverFilter, setCaregiverFilter] = useState<string>("")
  const [digestDate, setDigestDate] = useState(() => utcDateInputValue())
  const [emailWhenBuild, setEmailWhenBuild] = useState(false)
  const [shown, setShown] = useState<CaregiverDailyDigest | null>(null)
  const [sendMessage, setSendMessage] = useState<string | null>(null)

  const listArgs = useMemo(() => {
    const base: { caregiverId?: string; limit: number; page: number; sortBy: string } = {
      limit: 20,
      page: 1,
      sortBy: "digestDate:desc",
    }
    if (isAdmin && caregiverFilter.trim()) {
      base.caregiverId = caregiverFilter.trim()
    }
    return base
  }, [isAdmin, caregiverFilter])

  const { data: listData, isLoading: listLoading } = useListCaregiverDailyDigestsQuery(listArgs)
  const [generate, { isLoading: genLoading, error: genError }] = useGenerateCaregiverDailyDigestMutation()
  const [sendDigest, { isLoading: sendLoading, error: sendError }] = useSendCaregiverDailyDigestMutation()

  const { data: selfCaregiver } = useGetCaregiverQuery({ id: userId }, { skip: !userId })

  const digest = shown

  const onGenerate = useCallback(async () => {
    setSendMessage(null)
    const iso = `${digestDate}T12:00:00.000Z`
    const res = await generate({ digestDate: iso, sendEmail: emailWhenBuild }).unwrap()
    setShown(res)
    if (emailWhenBuild && res.status === "sent") {
      setSendMessage("Digest emailed to your account address.")
    }
  }, [digestDate, emailWhenBuild, generate])

  const onSendEmail = useCallback(async () => {
    if (!digest?.id) return
    setSendMessage(null)
    const res = await sendDigest({ digestId: digest.id }).unwrap()
    setShown(res)
    setSendMessage("Digest emailed to your account address.")
  }, [digest?.id, sendDigest])

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
          ← Back to Reports
        </Link>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", color: "var(--va-navy)" }}>Daily digest</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-500)", lineHeight: 1.5 }}>
          Summaries and sentiment for your assigned residents for one calendar day (UTC). Text is generated in your profile
          language; when a resident&apos;s language differs, conversation summaries are omitted and sentiment is shown when
          it&apos;s available for that row.
        </p>
      </div>

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
          Digest date (UTC)
          <input
            type="date"
            className="va-input"
            value={digestDate}
            onChange={(e) => setDigestDate(e.target.value)}
            style={{ padding: "0.5rem 0.65rem", borderRadius: 6, border: "1px solid var(--va-slate-200)" }}
          />
        </label>
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
          Email me when I build
        </label>
        <button type="button" className="va-btn-primary" disabled={genLoading} onClick={() => void onGenerate()}>
          {genLoading ? "Building…" : "Build / refresh digest"}
        </button>
      </div>

      {genError ? (
        <p style={{ color: "var(--va-red-600)", fontSize: "0.875rem" }} role="alert">
          Could not build digest. Check your connection and try again.
        </p>
      ) : null}

      {sendError ? (
        <p style={{ color: "var(--va-red-600)", fontSize: "0.875rem" }} role="alert">
          Could not send email. Confirm your profile has a valid email, then try again.
        </p>
      ) : null}

      {sendMessage ? (
        <p style={{ color: "var(--va-teal)", fontSize: "0.875rem" }} role="status">
          {sendMessage}
        </p>
      ) : null}

      {digest ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <header>
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", color: "var(--va-teal)" }}>{digest.payload.title}</h2>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)" }}>{digest.payload.subtitle}</p>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>{digest.payload.dateLabel}</p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", fontWeight: 600, color: "var(--va-slate-600)" }}>
              {digest.status === "sent" ? "Emailed" : "Draft"}
              {digest.sentAt ? ` · ${new Date(digest.sentAt).toLocaleString()}` : ""}
            </p>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "var(--va-slate-400)", lineHeight: 1.45 }}>
              {digest.payload.labels.emailScreenHint}
            </p>
            {digest.status === "draft" ? (
              <button
                type="button"
                className="va-btn-secondary"
                style={{ marginTop: "0.75rem", alignSelf: "flex-start" }}
                disabled={sendLoading}
                onClick={() => void onSendEmail()}
              >
                {sendLoading ? "Sending…" : "Email digest"}
              </button>
            ) : null}
          </header>
          {digest.payload.entries.length > 0 ? (
            <DigestTable entries={digest.payload.entries} labels={digest.payload.labels} />
          ) : (
            <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>
              No assigned residents on your roster, so this digest is empty. Assign residents to see them here.
            </p>
          )}
        </div>
      ) : null}

      <section>
        <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem", color: "var(--va-navy)" }}>Recent digests</h2>
        {isAdmin ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", marginBottom: "0.75rem", maxWidth: 320 }}>
            Filter by caregiver ID (org admin)
            <input
              className="va-input"
              placeholder={selfCaregiver?.id ?? "Caregiver ObjectId"}
              value={caregiverFilter}
              onChange={(e) => setCaregiverFilter(e.target.value)}
              style={{ padding: "0.5rem 0.65rem", borderRadius: 6, border: "1px solid var(--va-slate-200)" }}
            />
          </label>
        ) : null}
        {listLoading ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>Loading…</p>
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
                  <strong style={{ color: "var(--va-navy)" }}>{d.payload?.dateLabel ?? d.digestDate}</strong>
                  <span style={{ color: "var(--va-slate-500)", marginLeft: 8 }}>
                    · {d.payload?.entries?.length ?? 0} residents · {d.status === "sent" ? "emailed" : "draft"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!listLoading && (listData?.results?.length ?? 0) === 0 ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>No saved digests yet. Build one above.</p>
        ) : null}
      </section>
    </div>
  )
}
