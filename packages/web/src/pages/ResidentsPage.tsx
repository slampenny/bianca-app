import { skipToken } from "@reduxjs/toolkit/query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { mapClientToResident } from "../lib/liveData"
import { useGetAllClientsQuery } from "../services/api/clientApi"
import { useAppSelector } from "../store/store"
import { getCurrentUser, isAuthenticated } from "../store/authSlice"
import type { Resident } from "../types"
import { SearchIcon } from "../icons"
import { canAddResidents } from "../lib/roleAccess"

const FILTERS = [
  { key: "all" as const, label: "All" },
  { key: "active" as const, label: "Active" },
  { key: "at_risk" as const, label: "At Risk" },
  { key: "missing_consent" as const, label: "Missing Consent" },
]

export function ResidentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const authed = useAppSelector(isAuthenticated)
  const user = useAppSelector(getCurrentUser)
  const showAdd = canAddResidents(user?.role)
  const { data: pages, isLoading, isError, refetch, error } = useGetAllClientsQuery(
    authed ? { limit: 200, page: 1 } : skipToken,
  )

  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all")

  const residents = useMemo(() => (pages?.results ?? []).map(mapClientToResident), [pages?.results])

  const rows = useMemo(() => {
    let list: Resident[] = [...residents]
    switch (filter) {
      case "active":
        list = list.filter((r) => r.status === "active")
        break
      case "at_risk":
        list = list.filter((r) => r.status === "at_risk")
        break
      case "missing_consent":
        list = list.filter((r) => !r.consentOnFile)
        break
      default:
        break
    }
    const t = q.trim().toLowerCase()
    if (t) {
      list = list.filter(
        (r) =>
          r.firstName.toLowerCase().includes(t) ||
          r.lastName.toLowerCase().includes(t) ||
          `${r.firstName} ${r.lastName}`.toLowerCase().includes(t),
      )
    }
    list.sort((a, b) => {
      const ln = a.lastName.localeCompare(b.lastName)
      return ln !== 0 ? ln : a.firstName.localeCompare(b.firstName)
    })
    return list
  }, [residents, filter, q])

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
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "flex-start" }}>
          <div>
            <h1 className="va-page-title">Residents</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginTop: 4 }}>
              {rows.length} resident{rows.length === 1 ? "" : "s"}
              {pages?.totalResults != null ? ` (${pages.totalResults} in directory)` : ""}
            </p>
          </div>
          {showAdd ? (
            <Link to="/residents/new" className="va-btn-primary" style={{ textDecoration: "none" }} data-testid="residents-add">
              {t("residents.addResident")}
            </Link>
          ) : null}
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
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="va-card va-table-wrap">
        <table className="va-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Room</th>
              <th>Status</th>
              <th>Last Call</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                data-testid="resident-row"
                data-resident-id={r.id}
                onClick={() => navigate(`/residents/${r.id}`)}
              >
                <td style={{ fontWeight: 600, color: "var(--va-navy)" }}>
                  {r.firstName} {r.lastName}
                </td>
                <td>{r.room}</td>
                <td>
                  <StatusPill status={r.status} />
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
