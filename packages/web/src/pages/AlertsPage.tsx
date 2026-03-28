import { skipToken } from "@reduxjs/toolkit/query"
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { apiRecordId, mapApiAlertToFacilityAlert } from "../lib/liveData"
import { useGetAllAlertsQuery } from "../services/api/alertApi"
import { useGetAllClientsQuery } from "../services/api/clientApi"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { formatAlertType, formatDetectedDate, formatDetectedTime } from "../lib/timeFormat"
import { AlertOctagonIcon, ChevronRightIcon, ClockIcon, InboxIcon } from "../icons"

export function AlertsPage() {
  const navigate = useNavigate()
  const currentUser = useAppSelector(getCurrentUser)
  const authed = useAppSelector((s) => !!s.auth.tokens)

  const { data: clientPages } = useGetAllClientsQuery(authed ? { limit: 500, page: 1 } : skipToken)
  const { data: apiAlerts, isLoading, isError, refetch, error } = useGetAllAlertsQuery(authed ? undefined : skipToken)

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of clientPages?.results ?? []) {
      const id = apiRecordId(c as { id?: string; _id?: string })
      if (id) m.set(id, c.name)
    }
    return m
  }, [clientPages?.results])

  const alerts = useMemo(
    () =>
      (apiAlerts ?? []).map((a) => mapApiAlertToFacilityAlert(a, clientNameById, currentUser?.id)),
    [apiAlerts, clientNameById, currentUser?.id],
  )

  if (!authed) return null

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--va-slate-500)" }}>Loading alerts…</div>
    )
  }

  if (isError) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
        <p style={{ color: "var(--va-red-600)", marginBottom: 12 }}>Could not load alerts.</p>
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginBottom: 16 }}>
          {(error as { data?: { message?: string } })?.data?.message ?? "Check your connection."}
        </p>
        <button type="button" className="va-btn-primary" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem", maxWidth: 480, margin: "0 auto" }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "var(--va-slate-100)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            color: "var(--va-slate-300)",
          }}
        >
          <InboxIcon size={40} />
        </div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--va-navy)", marginBottom: 8 }}>No active alerts</h2>
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", lineHeight: 1.6 }}>
          You&apos;ll see Bianca alerts here when the backend returns open items for your org.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={{ fontSize: "0.75rem", color: "var(--va-slate-400)" }}>
        {/* WEB_API_GAP: No dedicated “facility alert” fields (confidence %, structured risk); mapped from message + importance. */}
        Severity and confidence are derived from API <code>importance</code> until richer fields exist.
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 className="va-page-title">Alerts</h1>
        <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
          {alerts.length} alert{alerts.length === 1 ? "" : "s"}
        </span>
      </div>

      {alerts.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => navigate(`/alerts/${a.id}`)}
          className="va-card"
          style={{
            width: "100%",
            textAlign: "left",
            border: "none",
            cursor: "pointer",
            borderLeft: "4px solid var(--va-red-500)",
            padding: 0,
          }}
        >
          <div style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0.25rem 0.625rem",
                  borderRadius: 999,
                  background: "var(--va-red-50)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--va-red-700)",
                }}
              >
                <AlertOctagonIcon size={12} />
                {formatAlertType(a.type)}
              </span>
              <span style={{ color: "var(--va-slate-300)" }}>
                <ChevronRightIcon size={16} />
              </span>
            </div>
            <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--va-navy)" }}>{a.residentName}</p>
            <p style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", marginTop: 4 }}>
              {/* WEB_API_GAP: Room not on alert payload */}
              Client ID: {a.residentId || "—"}
            </p>
            <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", marginTop: 10, lineHeight: 1.5 }}>{a.summary}</p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid var(--va-slate-100)",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
                Confidence <strong style={{ color: "var(--va-navy)" }}>{a.confidence}%</strong>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
                <ClockIcon size={12} />
                Detected {formatDetectedTime(a.detectedAt)} · {formatDetectedDate(a.detectedAt)}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  padding: "0.125rem 0.5rem",
                  borderRadius: 999,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: a.status === "new" ? "var(--va-red-50)" : "var(--va-amber-50)",
                  color: a.status === "new" ? "var(--va-red-700)" : "var(--va-amber-700)",
                }}
              >
                {a.status === "new" ? "New" : "Acknowledged"}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
