import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { clientDisplayName } from "../lib/clientDisplayName"
import { useGetAllClientsQuery } from "../services/api/clientApi"
import { ChevronLeftIcon } from "../icons"
import "../app.css"

export function FamilyWeeklyDigestHubPage() {
  const { t } = useTranslation()
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
        {t("reports.backToReports")}
      </button>

      <div>
        <h1 className="va-page-title" style={{ marginBottom: 8 }}>
          {t("reports.familyDigestTitle")}
        </h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-500)", lineHeight: 1.55 }}>
          {t("reports.familyDigestIntro")}
        </p>
      </div>

      {isError ? (
        <p style={{ margin: 0, color: "var(--va-red-600)" }} role="alert">
          {t("reports.loadResidentsError")}
        </p>
      ) : isLoading || isFetching ? (
        <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("reports.loadingResidents")}</p>
      ) : clients.length === 0 ? (
        <div className="va-card va-card-pad">
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.55 }}>
            {t("reports.noResidentsDigest")}
          </p>
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {clients.map((c) => {
            const id = c.id
            if (!id) return null
            const name = clientDisplayName(c)
            return (
              <li key={id}>
                <Link
                  to={`/reports/family_weekly_digest/clients/${id}`}
                  className="va-card va-card-pad"
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
                >
                  <strong style={{ color: "var(--va-navy)" }}>{name}</strong>
                  <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--va-slate-500)", marginTop: 4 }}>
                    {t("reports.viewDigest")}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
