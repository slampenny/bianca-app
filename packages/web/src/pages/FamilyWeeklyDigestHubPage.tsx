import { useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { clientDisplayName } from "../lib/clientDisplayName"
import { useGetAllClientsQuery } from "../services/api/clientApi"
import { ChevronLeftIcon } from "../icons"
import "../app.css"

export function FamilyWeeklyDigestHubPage() {
  const navigate = useNavigate()
  const { data: pages, isLoading, isFetching, isError } = useGetAllClientsQuery({ limit: 500, page: 1 })

  const clients = useMemo(() => pages?.results ?? [], [pages?.results])

  return (
    <div
      data-testid="family-weekly-digest-hub"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 720, margin: "0 auto", paddingBottom: 48 }}
    >
      <button type="button" className="va-btn-ghost" data-testid="report-detail-back" onClick={() => navigate("/reports")}>
        <ChevronLeftIcon size={16} />
        Back to Reports
      </button>

      <div>
        <h1 className="va-page-title" style={{ marginBottom: 8 }}>
          Weekly family call digest
        </h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-500)", lineHeight: 1.55 }}>
          Choose a resident to preview the family-facing weekly summary (wellness check-in calls only). Each digest is scoped
          to one authorized contact on the resident&apos;s profile.
        </p>
      </div>

      {isError ? (
        <p style={{ margin: 0, color: "var(--va-red-600)" }} role="alert">
          Could not load residents. Check your connection and try again.
        </p>
      ) : isLoading || isFetching ? (
        <p style={{ margin: 0, color: "var(--va-slate-600)" }}>Loading residents…</p>
      ) : clients.length === 0 ? (
        <div className="va-card va-card-pad">
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.55 }}>
            No assigned residents yet. Add residents from the Residents page to build digests here.
          </p>
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {clients.map((c) => {
            const id = c.id
            if (!id) return null
            return (
              <li key={id}>
                <Link
                  to={`/reports/family_weekly_digest/clients/${id}`}
                  className="va-card va-card-pad"
                  style={{
                    display: "block",
                    textDecoration: "none",
                    color: "var(--va-navy)",
                    fontWeight: 600,
                    fontSize: "0.9375rem",
                    border: "1px solid var(--va-slate-200)",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  }}
                >
                  {clientDisplayName(c)}
                  {c.room?.trim() ? (
                    <span style={{ fontWeight: 400, color: "var(--va-slate-500)", marginLeft: 8 }}>· Room {c.room}</span>
                  ) : null}
                  <span style={{ display: "block", marginTop: 6, fontSize: "0.8125rem", fontWeight: 500, color: "var(--va-teal)" }}>
                    Open weekly digest preview →
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <p style={{ margin: "1.5rem 0 0", fontSize: "0.8125rem", color: "var(--va-slate-400)", lineHeight: 1.5 }}>
        <Link to="/reports/family_weekly_digest/clients/sample" style={{ color: "var(--va-teal)" }}>
          View sample layout (demo)
        </Link>
      </p>
    </div>
  )
}
