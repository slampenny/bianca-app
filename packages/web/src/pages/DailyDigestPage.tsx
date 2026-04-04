import { useCallback, useMemo, useState } from "react"
import {
  useGenerateCaregiverDailyDigestMutation,
  useListCaregiverDailyDigestsQuery,
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

function EntryCard({
  entry,
  labels,
}: {
  entry: CaregiverDailyDigestEntry
  labels: CaregiverDailyDigest["payload"]["labels"]
}) {
  return (
    <article
      style={{
        borderRadius: "0.75rem",
        border: "1px solid var(--va-slate-200)",
        padding: "1rem 1.25rem",
        background: "var(--va-white)",
      }}
    >
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", color: "var(--va-navy)" }}>{entry.clientName}</h3>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
        {labels.callsToday}: {entry.callsPlaced} · {entry.answeredCalls} answered
        {entry.lastCallAt ? ` · ${entry.lastCallAt.slice(11, 16)} UTC` : ""}
      </p>
      {entry.languageMismatch && entry.languageMismatchExplanation ? (
        <p
          style={{
            margin: "0 0 0.75rem",
            fontSize: "0.8125rem",
            lineHeight: 1.5,
            color: "var(--va-amber-800)",
            background: "var(--va-amber-50)",
            padding: "0.5rem 0.65rem",
            borderRadius: "0.5rem",
          }}
        >
          {entry.languageMismatchExplanation}
        </p>
      ) : null}
      {entry.conversationSummaryShort ? (
        <div style={{ marginBottom: "0.65rem" }}>
          <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 600, color: "var(--va-slate-500)", textTransform: "uppercase" }}>
            {labels.conversationSummary}
          </p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", lineHeight: 1.5, color: "var(--va-slate-700)" }}>
            {entry.conversationSummaryShort}
          </p>
        </div>
      ) : entry.callsPlaced === 0 ? (
        <p style={{ margin: "0 0 0.65rem", fontSize: "0.875rem", color: "var(--va-slate-500)" }}>{labels.noActivity}</p>
      ) : null}
      {entry.sentiment && Object.keys(entry.sentiment).length > 0 ? (
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 600, color: "var(--va-slate-500)", textTransform: "uppercase" }}>
            {labels.sentiment}
          </p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", lineHeight: 1.5, color: "var(--va-slate-700)" }}>
            {formatSentimentLine(entry.sentiment)}
          </p>
        </div>
      ) : null}
    </article>
  )
}

export function DailyDigestPage() {
  const currentUser = useAppSelector(getCurrentUser)
  const userId = currentUser?.id != null ? String(currentUser.id) : ""
  const isAdmin = canManageCaregivers(currentUser?.role)
  const [caregiverFilter, setCaregiverFilter] = useState<string>("")
  const [digestDate, setDigestDate] = useState(() => utcDateInputValue())
  const [shown, setShown] = useState<CaregiverDailyDigest | null>(null)

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

  const { data: selfCaregiver } = useGetCaregiverQuery({ id: userId }, { skip: !userId })

  const onGenerate = useCallback(async () => {
    const iso = `${digestDate}T12:00:00.000Z`
    const res = await generate({ digestDate: iso }).unwrap()
    setShown(res)
  }, [digestDate, generate])

  const digest = shown

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 720 }}>
      <div>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", color: "var(--va-navy)" }}>Daily digest</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-500)", lineHeight: 1.5 }}>
          Summaries and sentiment for your assigned residents for one calendar day (UTC). Text is generated in your profile
          language; when a resident&apos;s language differs, only sentiment is included for that row.
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
        <button type="button" className="va-btn-primary" disabled={genLoading} onClick={() => void onGenerate()}>
          {genLoading ? "Building…" : "Build / refresh digest"}
        </button>
      </div>

      {genError ? (
        <p style={{ color: "var(--va-red-600)", fontSize: "0.875rem" }} role="alert">
          Could not build digest. Check your connection and try again.
        </p>
      ) : null}

      {digest ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <header>
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", color: "var(--va-teal)" }}>{digest.payload.title}</h2>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)" }}>{digest.payload.subtitle}</p>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>{digest.payload.dateLabel}</p>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "var(--va-slate-400)", lineHeight: 1.45 }}>
              {digest.payload.labels.emailSoon}
            </p>
          </header>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {digest.payload.entries.map((e) => (
              <EntryCard key={e.clientId} entry={e} labels={digest.payload.labels} />
            ))}
          </div>
          {digest.payload.entries.length === 0 ? (
            <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>
              No assigned residents on your roster, so this digest is empty. Assign residents to see them here.
            </p>
          ) : null}
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
                  <span style={{ color: "var(--va-slate-500)", marginLeft: 8 }}>· {d.payload?.entries?.length ?? 0} residents</span>
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
