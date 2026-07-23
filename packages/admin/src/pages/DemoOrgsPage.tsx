import { type FormEvent, useMemo, useState } from "react"
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"
import {
  useLazySearchOrgsQuery,
  useListDemoOrgsQuery,
  useRefreshDemoOrgDataMutation,
  useSetOrgDemoFlagMutation,
} from "../services/api/adminApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import type { AdminOrgSearchRow } from "../services/api/api.types"
import { AdminPageHeader } from "../components/AdminPageHeader"

type HistoryDays = 7 | 30 | 90 | 180

function errMessage(error: unknown, fallback: string): string {
  const e = error as FetchBaseQueryError
  if (typeof e?.data === "object" && e.data && "message" in e.data) {
    return String((e.data as { message?: string }).message)
  }
  if (e?.status === 403) return "Forbidden — check super-admin role and demo eligibility."
  return fallback
}

export function DemoOrgsPage() {
  const authed = useAppSelector(isAuthenticated)

  const { data, isLoading, isFetching, isError, error, refetch } = useListDemoOrgsQuery(
    { limit: 50, page: 1 },
    { skip: !authed },
  )

  const [runSearch] = useLazySearchOrgsQuery()
  const [setDemoFlag, { isLoading: settingFlag }] = useSetOrgDemoFlagMutation()
  const [refreshDemo, { isLoading: refreshing }] = useRefreshDemoOrgDataMutation()

  const [searchQ, setSearchQ] = useState("")
  const [searchRows, setSearchRows] = useState<AdminOrgSearchRow[]>([])
  const [searchError, setSearchError] = useState("")
  const [markOrgId, setMarkOrgId] = useState<string | null>(null)
  const [markOrgName, setMarkOrgName] = useState("")
  const [setConfirm, setSetConfirm] = useState("")
  const [flagMessage, setFlagMessage] = useState("")

  const [selected, setSelected] = useState<AdminOrgSearchRow | null>(null)
  const [historyDays, setHistoryDays] = useState<HistoryDays>(90)
  const [refreshConfirm, setRefreshConfirm] = useState("")
  const [refreshMessage, setRefreshMessage] = useState("")
  const [refreshResult, setRefreshResult] = useState<string>("")

  const demoRows = useMemo(() => data?.results || [], [data])

  const handleSearch = async (e?: FormEvent) => {
    e?.preventDefault()
    setSearchError("")
    setFlagMessage("")
    const term = searchQ.trim()
    if (term.length < 2) {
      setSearchError("Enter at least 2 characters.")
      return
    }
    try {
      const res = await runSearch({ q: term, limit: 25 }).unwrap()
      setSearchRows(res.results)
      if (res.results.length === 0) setSearchError("No organizations matched.")
    } catch {
      setSearchError("Search failed.")
      setSearchRows([])
    }
  }

  const openMarkAsDemo = (row: AdminOrgSearchRow) => {
    if (!row.id) return
    setMarkOrgId(row.id)
    setMarkOrgName(row.name)
    setSetConfirm("")
    setFlagMessage("")
  }

  const handleSetAsDemo = async () => {
    if (!markOrgId || setConfirm !== "SET_AS_DEMO_ORG") return
    setFlagMessage("")
    try {
      await setDemoFlag({ orgId: markOrgId, isDemo: true, confirm: "SET_AS_DEMO_ORG" }).unwrap()
      setFlagMessage(`Marked “${markOrgName}” as demo.`)
      setMarkOrgId(null)
      setSetConfirm("")
      void refetch()
    } catch (err) {
      setFlagMessage(errMessage(err, "Could not mark org as demo."))
    }
  }

  const handleRefresh = async () => {
    if (!selected?.id || refreshConfirm !== "REFRESH_DEMO_DATA") return
    setRefreshMessage("")
    setRefreshResult("")
    try {
      const result = await refreshDemo({
        orgId: selected.id,
        confirm: "REFRESH_DEMO_DATA",
        historyDays,
      }).unwrap()
      setRefreshMessage(`Refreshed “${selected.name}” (${historyDays} days).`)
      setRefreshConfirm("")
      setRefreshResult(
        JSON.stringify(
          {
            historyDays: result.historyDays,
            conversationCount: result.conversationCount,
            analysisPointsPerClient: result.analysisPointsPerClient,
            clients: result.clients,
          },
          null,
          2,
        ),
      )
      void refetch()
    } catch (err) {
      setRefreshMessage(errMessage(err, "Refresh failed."))
    }
  }

  const listErr = (() => {
    if (!isError) return ""
    return errMessage(error, "Could not load demo orgs.")
  })()

  return (
    <>
      <AdminPageHeader
        title="Demo orgs"
        subtitle="Mark safe orgs as isDemo and refresh longitudinal demo data (super admin)."
        actions={
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Reload list"}
          </button>
        }
      />

      <main className="admin-main">
        {isLoading ? <p className="admin-muted">Loading…</p> : null}
        {listErr ? (
          <div className="admin-card admin-card--warn">
            <p className="admin-error" role="alert">
              {listErr}
            </p>
          </div>
        ) : null}

        <div className="admin-grid">
          <section className="admin-card admin-card--wide">
            <h2 className="admin-section-title">Demo organizations</h2>
            <p className="admin-muted">Only orgs with <code className="admin-code">isDemo=true</code> appear here.</p>
            {demoRows.length === 0 ? (
              <p className="admin-muted" style={{ marginTop: "0.75rem" }}>
                No demo orgs yet — mark one below.
              </p>
            ) : (
              <ul className="admin-list" style={{ marginTop: "0.75rem" }}>
                {demoRows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      style={{ display: "block", width: "100%", textAlign: "left" }}
                      onClick={() => {
                        setSelected(row)
                        setRefreshConfirm("")
                        setRefreshMessage("")
                        setRefreshResult("")
                      }}
                    >
                      <strong>{row.name}</strong> · {row.email}
                      {row.demoSeededAt ? (
                        <span className="admin-muted">
                          {" "}
                          · last seed {new Date(row.demoSeededAt).toLocaleString()} ({row.demoHistoryDays ?? "?"}d)
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-card admin-card--wide">
            <h2 className="admin-section-title">Mark org as demo</h2>
            <p className="admin-muted">
              Blocked if the org has a Stripe subscription, payment methods, or invoices. Type{" "}
              <code className="admin-code">SET_AS_DEMO_ORG</code> to confirm.
            </p>
            <form className="admin-form-row" onSubmit={(ev) => void handleSearch(ev)} style={{ marginTop: "0.75rem" }}>
              <input
                className="admin-input"
                value={searchQ}
                onChange={(ev) => setSearchQ(ev.target.value)}
                placeholder="Search org name / email / id"
              />
              <button type="submit" className="admin-btn">
                Search
              </button>
            </form>
            {searchError ? <p className="admin-error">{searchError}</p> : null}
            <ul className="admin-list" style={{ marginTop: "0.75rem" }}>
              {searchRows.map((row) => (
                <li key={row.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span>
                    {row.name} · {row.email}
                  </span>
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => openMarkAsDemo(row)}>
                    Mark as demo…
                  </button>
                </li>
              ))}
            </ul>
            {markOrgId ? (
              <div className="admin-card" style={{ marginTop: "1rem" }}>
                <p>
                  Confirm marking <strong>{markOrgName}</strong> as demo.
                </p>
                <label className="admin-muted" style={{ display: "block", marginTop: 8 }}>
                  Type <code className="admin-code">SET_AS_DEMO_ORG</code>
                </label>
                <input
                  className="admin-input"
                  value={setConfirm}
                  onChange={(ev) => setSetConfirm(ev.target.value)}
                  autoComplete="off"
                  style={{ marginTop: 6 }}
                />
                <div style={{ marginTop: 10, display: 8 }}>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={setConfirm !== "SET_AS_DEMO_ORG" || settingFlag}
                    onClick={() => void handleSetAsDemo()}
                  >
                    {settingFlag ? "Saving…" : "Confirm set as demo"}
                  </button>
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setMarkOrgId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            {flagMessage ? (
              <p className="admin-muted" role="status" style={{ marginTop: 10 }}>
                {flagMessage}
              </p>
            ) : null}
          </section>

          {selected ? (
            <section className="admin-card admin-card--wide">
              <h2 className="admin-section-title">Refresh demo data</h2>
              <p>
                Selected: <strong>{selected.name}</strong> ({selected.email})
              </p>
              <p className="admin-muted">
                Org-scoped wipe + reseed. Type <code className="admin-code">REFRESH_DEMO_DATA</code> to confirm.
              </p>
              <label className="admin-muted" style={{ display: "block", marginTop: 12 }}>
                History window
              </label>
              <select
                className="admin-input"
                value={historyDays}
                onChange={(ev) => setHistoryDays(Number(ev.target.value) as HistoryDays)}
                style={{ marginTop: 6, maxWidth: 200 }}
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days (default)</option>
                <option value={180}>180 days</option>
              </select>
              <label className="admin-muted" style={{ display: "block", marginTop: 12 }}>
                Type <code className="admin-code">REFRESH_DEMO_DATA</code>
              </label>
              <input
                className="admin-input"
                value={refreshConfirm}
                onChange={(ev) => setRefreshConfirm(ev.target.value)}
                autoComplete="off"
                style={{ marginTop: 6 }}
              />
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={refreshConfirm !== "REFRESH_DEMO_DATA" || refreshing}
                  onClick={() => void handleRefresh()}
                >
                  {refreshing ? "Refreshing…" : "Refresh demo data"}
                </button>
              </div>
              {refreshMessage ? (
                <p className="admin-muted" role="status" style={{ marginTop: 10 }}>
                  {refreshMessage}
                </p>
              ) : null}
              {refreshResult ? (
                <pre className="admin-code" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
                  {refreshResult}
                </pre>
              ) : null}
            </section>
          ) : null}
        </div>
      </main>
    </>
  )
}
