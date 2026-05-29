import { skipToken } from "@reduxjs/toolkit/query"
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { clientInitialsFromClient } from "../lib/clientDisplayName"
import { mapClientToResident } from "../lib/liveData"
import type { ClientOnboardingRollup } from "../services/api/api.types"
import { useGetAllClientsQuery, useGetClientsOnboardingRollupsQuery } from "../services/api/clientApi"
import { useAppSelector } from "../store/store"
import { getCurrentUser, isAuthenticated } from "../store/authSlice"
import type { Resident } from "../types"
import { SearchIcon } from "../icons"
import { canAddResidents } from "../lib/roleAccess"

const ONBOARDING_PARAM_TO_FILTER: Record<string, string> = {
  in_progress: "onboarding_in_progress",
  complete: "onboarding_complete",
  not_started: "onboarding_not_started",
}

const FILTER_TO_ONBOARDING_PARAM: Record<string, string> = {
  onboarding_in_progress: "in_progress",
  onboarding_complete: "complete",
  onboarding_not_started: "not_started",
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "at_risk", label: "At Risk" },
  { key: "missing_consent", label: "Missing Consent" },
  { key: "onboarding_in_progress", label: "Onboarding · Active" },
  { key: "onboarding_complete", label: "Onboarding · Complete" },
  { key: "onboarding_not_started", label: "Onboarding · Not started" },
]

function defaultOnboardingRollup(): ClientOnboardingRollup {
  return {
    totalDays: 4,
    enabled: true,
    sessionsCompletedCount: 0,
    journeyComplete: false,
    currentDay: 1,
    hasAnyOnboardingActivity: false,
    flags: { safety: false, memory: false, mood: false, distress: false, confusion: false },
    questionCount: 0,
  }
}

function OnboardingStatusCell({ rollup, loading }: { rollup: ClientOnboardingRollup; loading: boolean }) {
  if (loading) {
    return <span style={{ color: "var(--va-slate-400)", fontSize: "0.8125rem" }}>…</span>
  }
  if (rollup.enabled === false) {
    return (
      <span style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>Disabled</span>
    )
  }
  if (rollup.journeyComplete) {
    return (
      <span
        style={{
          display: "inline-flex",
          padding: "0.125rem 0.5rem",
          borderRadius: 999,
          fontSize: "0.75rem",
          fontWeight: 500,
          background: "var(--va-emerald-100)",
          color: "var(--va-emerald-700)",
        }}
      >
        Complete
      </span>
    )
  }
  if (!rollup.hasAnyOnboardingActivity) {
    return (
      <span style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>Not started</span>
    )
  }
  return (
    <span style={{ fontSize: "0.8125rem", color: "var(--va-amber-800)" }}>
      {rollup.sessionsCompletedCount}/{rollup.totalDays ?? 4}
      {rollup.currentDay != null ? ` · Next: Day ${rollup.currentDay}` : ""}
    </span>
  )
}

export function ResidentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const authed = useAppSelector(isAuthenticated)
  const user = useAppSelector(getCurrentUser)
  const showAdd = canAddResidents(user?.role)
  const { data: pages, isLoading, isError, refetch, error } = useGetAllClientsQuery(
    authed ? { limit: 200, page: 1 } : skipToken,
    { refetchOnMountOrArgChange: true, refetchOnFocus: true, refetchOnReconnect: true },
  )
  const { data: rollupsPayload, isLoading: rollupsLoading } = useGetClientsOnboardingRollupsQuery(undefined, {
    skip: !authed,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  })
  const rollups = rollupsPayload?.rollups ?? {}

  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<string>(() => {
    const p = searchParams.get("onboarding")
    return p && ONBOARDING_PARAM_TO_FILTER[p] ? ONBOARDING_PARAM_TO_FILTER[p] : "all"
  })
  const [onboardingSortFirst, setOnboardingSortFirst] = useState(false)

  useEffect(() => {
    const p = searchParams.get("onboarding")
    if (p && ONBOARDING_PARAM_TO_FILTER[p]) setFilter(ONBOARDING_PARAM_TO_FILTER[p])
  }, [searchParams])

  const residents = useMemo(
    () =>
      (pages?.results ?? []).map((c) => ({
        resident: mapClientToResident(c),
        avatar: c.avatar || "",
      })),
    [pages?.results],
  )

  const rows = useMemo(() => {
    let list = [...residents]
    switch (filter) {
      case "active":
        list = list.filter(({ resident: r }) => r.status === "active")
        break
      case "at_risk":
        list = list.filter(({ resident: r }) => r.status === "at_risk")
        break
      case "missing_consent":
        list = list.filter(({ resident: r }) => !r.consentOnFile)
        break
      case "onboarding_in_progress":
        list = list.filter(({ resident: r }) => {
          const u = rollups[r.id] ?? defaultOnboardingRollup()
          return !u.journeyComplete && u.hasAnyOnboardingActivity
        })
        break
      case "onboarding_complete":
        list = list.filter(({ resident: r }) => (rollups[r.id] ?? defaultOnboardingRollup()).journeyComplete)
        break
      case "onboarding_not_started":
        list = list.filter(({ resident: r }) => {
          const u = rollups[r.id] ?? defaultOnboardingRollup()
          return !u.journeyComplete && !u.hasAnyOnboardingActivity
        })
        break
      default:
        break
    }
    const t = q.trim().toLowerCase()
    if (t) {
      list = list.filter(({ resident: r }) => {
        const pref = (r.preferredName || "").toLowerCase()
        return (
          r.displayName.toLowerCase().includes(t) ||
          r.firstName.toLowerCase().includes(t) ||
          r.lastName.toLowerCase().includes(t) ||
          pref.includes(t)
        )
      })
    }
    list.sort((a, b) => {
      const ar = a.resident
      const br = b.resident
      if (onboardingSortFirst) {
        const ua = rollups[ar.id] ?? defaultOnboardingRollup()
        const ub = rollups[br.id] ?? defaultOnboardingRollup()
        const ca = ua.journeyComplete ? 1 : 0
        const cb = ub.journeyComplete ? 1 : 0
        if (ca !== cb) return ca - cb
        if (ua.sessionsCompletedCount !== ub.sessionsCompletedCount) {
          return ua.sessionsCompletedCount - ub.sessionsCompletedCount
        }
      }
      const ln = ar.lastName.localeCompare(br.lastName)
      return ln !== 0 ? ln : ar.firstName.localeCompare(br.firstName)
    })
    return list
  }, [residents, filter, q, rollups, onboardingSortFirst])

  const initialsFor = (r: Resident) =>
    clientInitialsFromClient({
      preferredName: r.preferredName,
      firstName: r.firstName,
      lastName: r.lastName,
    })

  if (!authed) {
    return null
  }

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--va-slate-500)" }}>Loading residents…</div>
    )
  }

  if (isError) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
        <p style={{ color: "var(--va-red-600)", marginBottom: 12 }}>Could not load clients.</p>
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginBottom: 16 }}>
          {(error as { data?: { message?: string } })?.data?.message ?? "Check your connection and API URL."}
        </p>
        <button type="button" className="va-btn-primary" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div data-testid="residents-page" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          alignItems: "stretch",
        }}
        className="va-res-head"
      >
        <div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.65rem",
              rowGap: "0.5rem",
            }}
          >
            <h1 className="va-page-title" style={{ margin: 0 }}>
              Residents
            </h1>
            {showAdd ? (
              <Link
                to="/residents/new"
                className="va-btn-primary"
                aria-label="Add resident"
                data-testid="residents-add"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", flexShrink: 0 }}
              >
                Add
              </Link>
            ) : null}
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginTop: 4 }}>
            {rows.length} resident{rows.length === 1 ? "" : "s"}
            {pages?.totalResults != null ? ` (${pages.totalResults} in directory)` : ""}
          </p>
        </div>
        <div className="va-search">
          <SearchIcon size={16} />
          <input
            type="search"
            placeholder="Search by name..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search residents"
            data-testid="residents-search"
          />
        </div>
      </div>

      <div className="va-chip-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`va-chip ${filter === f.key ? "va-chip--on" : ""}`}
            onClick={() => {
              setFilter(f.key)
              if (FILTER_TO_ONBOARDING_PARAM[f.key]) {
                setSearchParams({ onboarding: FILTER_TO_ONBOARDING_PARAM[f.key] })
              } else {
                setSearchParams({})
              }
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="va-chip-row" style={{ marginTop: "-0.25rem" }}>
        <button
          type="button"
          className={`va-chip ${onboardingSortFirst ? "va-chip--on" : ""}`}
          onClick={() => setOnboardingSortFirst((v) => !v)}
          data-testid="residents-sort-onboarding"
        >
          Sort: onboarding first
        </button>
      </div>

      <div className="va-card va-table-wrap">
        <table className="va-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Room</th>
              <th>Status</th>
              <th>Onboarding</th>
              <th>Last Call</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ resident: r, avatar }) => (
              <tr
                key={r.id}
                data-testid="resident-row"
                data-resident-id={r.id}
                onClick={() => navigate(`/residents/${r.id}`)}
              >
                <td style={{ fontWeight: 600, color: "var(--va-navy)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        background: "rgba(37, 99, 235, 0.12)",
                        color: "#1d4ed8",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                      }}
                    >
                      {avatar ? (
                        <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
                      ) : (
                        initialsFor(r)
                      )}
                    </span>
                    <span>{r.displayName}</span>
                  </span>
                </td>
                <td>{r.room}</td>
                <td>
                  <StatusPill status={r.status} />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <OnboardingStatusCell rollup={rollups[r.id] ?? defaultOnboardingRollup()} loading={rollupsLoading} />
                </td>
                <td style={{ color: "var(--va-slate-600)" }}>
                  {r.lastCallDate} {r.lastCallTime}
                </td>
                <td style={{ textTransform: "capitalize" }}>{r.riskLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .va-res-head {
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
          }
        }
      `}</style>
    </div>
  )
}

function StatusPill({ status }: { status: Resident["status"] }) {
  const map = {
    active: { bg: "var(--va-emerald-100)", fg: "var(--va-emerald-700)", label: "Active" },
    inactive: { bg: "var(--va-slate-100)", fg: "var(--va-slate-600)", label: "Inactive" },
    at_risk: { bg: "var(--va-red-100)", fg: "var(--va-red-700)", label: "At Risk" },
  }
  const s = map[status] ?? map.inactive
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "0.125rem 0.625rem",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 500,
        background: s.bg,
        color: s.fg,
      }}
    >
      {s.label}
    </span>
  )
}
