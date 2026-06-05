import { Fragment, useMemo, useState } from "react"
import { skipToken } from "@reduxjs/toolkit/query"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ConfirmDialog } from "@bianca-app/ui"
import { AuthSelectField } from "../components/AuthSelectField"
import { canManageCaregivers } from "../lib/roleAccess"
import { formatCaregiverRole } from "../lib/formatCaregiverRole"
import { ChevronDownIcon, PencilIcon, TrashIcon } from "../icons"
import { useDeleteCaregiverMutation, useGetCaregiverClientsQuery, useGetCaregiversQuery } from "../services/api/caregiverApi"
import { mapClientToResident } from "../lib/liveData"
import { useAssignCaregiverToClientMutation, useGetAllClientsQuery, useRemoveCaregiverFromClientMutation } from "../services/api/clientApi"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"

type DeleteState = {
  id: string
  name: string
}

export function CaregiversPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAppSelector(getCurrentUser)
  const role = user?.role
  const currentId = user?.id ? String(user.id) : ""
  const canManage = canManageCaregivers(role)
  const { data, isLoading, isError, error, refetch } = useGetCaregiversQuery(
    canManage ? { limit: 200, page: 1, sortBy: "name:asc" } : skipToken,
  )
  const [deleteCaregiver, { isLoading: deleting }] = useDeleteCaregiverMutation()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [deleteModal, setDeleteModal] = useState<DeleteState | null>(null)
  const [deleteMessage, setDeleteMessage] = useState("")

  const caregivers = useMemo(() => data?.results ?? [], [data?.results])

  const onDelete = async () => {
    if (!deleteModal || deleting) return
    setDeleteMessage("")
    try {
      await deleteCaregiver({ id: deleteModal.id }).unwrap()
      setDeleteModal(null)
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setDeleteMessage(typeof msg === "string" ? msg : t("caregivers.removeError"))
    }
  }

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (!canManage) return null

  return (
    <div data-testid="caregivers-page" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <h1 className="va-page-title">{t("caregivers.title")}</h1>
        <p style={{ marginTop: 4, fontSize: "0.875rem", color: "var(--va-slate-500)" }}>{t("caregivers.subtitle")}</p>
      </div>

      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("caregivers.sectionTitle")}</h2>
        {isLoading ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("caregivers.loading")}</p>
        ) : isError ? (
          <div style={{ maxWidth: 460 }}>
            <p style={{ color: "var(--va-red-600)", marginBottom: 10 }}>{t("caregivers.loadError")}</p>
            <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", marginBottom: 12 }}>
              {(error as { data?: { message?: string } })?.data?.message ?? t("common.retry")}
            </p>
            <button className="va-btn-secondary" type="button" onClick={() => void refetch()}>
              {t("common.retry")}
            </button>
          </div>
        ) : caregivers.length === 0 ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("caregivers.empty")}</p>
        ) : (
          <div className="va-table-wrap">
            <table className="va-table">
              <thead>
                <tr>
                  <th>{t("caregivers.colName")}</th>
                  <th>{t("caregivers.colEmail")}</th>
                  <th>{t("caregivers.colPhone")}</th>
                  <th>{t("caregivers.colRole")}</th>
                  <th>{t("caregivers.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {caregivers.map((c) => {
                  const id = c.id ? String(c.id) : ""
                  const isExpanded = !!expanded[id]
                  const initials = (c.name || "?")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()
                  return (
                    <Fragment key={id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            className="va-btn-ghost"
                            style={{ padding: 0, display: "inline-flex", gap: 6, alignItems: "center" }}
                            onClick={() => toggleExpanded(id)}
                            aria-label={isExpanded ? t("caregivers.collapseClients") : t("caregivers.expandClients")}
                          >
                            <span style={{ display: "inline-flex", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}>
                              <ChevronDownIcon size={14} />
                            </span>
                            <span
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: "50%",
                                overflow: "hidden",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "rgba(37, 99, 235, 0.12)",
                                color: "#1d4ed8",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {c.avatar ? <img src={c.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" /> : initials}
                            </span>
                            <span>{c.name}</span>
                          </button>
                        </td>
                        <td>{c.email}</td>
                        <td>{c.phone}</td>
                        <td>{formatCaregiverRole(c.role, t)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <button
                              type="button"
                              className="va-icon-btn"
                              aria-label={t("caregivers.editCaregiver")}
                              onClick={() => navigate(`/caregivers/${id}/edit`)}
                            >
                              <PencilIcon size={16} />
                            </button>
                            <button
                              type="button"
                              className="va-icon-btn"
                              aria-label={id === currentId ? t("caregivers.cannotRemoveSelf") : t("caregivers.removeCaregiver")}
                              style={id === currentId ? { color: "var(--va-slate-300)" } : { color: "var(--va-red-600)" }}
                              disabled={deleting || id === currentId}
                              onClick={() => setDeleteModal({ id, name: c.name || t("caregivers.defaultName") })}
                            >
                              <TrashIcon size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? <CaregiverClientsRow caregiverId={id} colSpan={5} /> : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button
        type="button"
        className="va-caregivers-fab"
        aria-label={t("caregivers.addCaregiver")}
        data-testid="caregivers-add"
        onClick={() => navigate("/caregivers/new")}
      >
        +
      </button>
      <ConfirmDialog
        open={deleteModal !== null}
        title={t("caregivers.removeConfirmTitle", { name: deleteModal?.name ?? "" })}
        onClose={() => setDeleteModal(null)}
        onConfirm={() => void onDelete()}
        confirmLabel={deleting ? t("caregivers.removing") : t("caregivers.remove")}
        confirmDisabled={deleting}
        cancelLabel={t("caregivers.cancel")}
      >
        <p style={{ margin: 0 }}>{t("caregivers.removeConfirmBody")}</p>
        {deleteMessage ? (
          <p style={{ marginTop: "0.75rem", color: "var(--va-red-600)" }} role="alert">
            {deleteMessage}
          </p>
        ) : null}
      </ConfirmDialog>
      <style>{`
        .va-caregivers-fab {
          position: fixed;
          right: 1.5rem;
          bottom: 1.5rem;
          width: 3rem;
          height: 3rem;
          border-radius: 999px;
          background: var(--va-teal);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          text-decoration: none;
          font-size: 1.75rem;
          line-height: 1;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25);
          z-index: 20;
          cursor: pointer;
        }
        .va-caregivers-fab:hover {
          background: #0f9f90;
        }
        .va-caregivers-fab:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
          box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.45);
        }
        .va-caregiver-clients-wrap {
          display: grid;
          grid-template-rows: 0fr;
          opacity: 0;
          transition: grid-template-rows 220ms ease, opacity 180ms ease;
        }
        .va-caregiver-clients-wrap--open {
          grid-template-rows: 1fr;
          opacity: 1;
        }
        .va-caregiver-clients-inner {
          overflow: hidden;
        }
        .va-caregiver-client-line {
          display: grid;
          grid-template-columns: minmax(150px, 1.8fr) 0.8fr 0.9fr 1.2fr 0.8fr 40px;
          gap: 0.5rem;
          align-items: center;
          padding: 0.45rem 0.2rem;
          border-bottom: 1px solid var(--va-slate-100);
          font-size: 0.8125rem;
        }
        .va-caregiver-client-line:last-child {
          border-bottom: none;
        }
        @media (max-width: 820px) {
          .va-caregiver-client-line {
            grid-template-columns: 1fr;
            gap: 0.2rem;
            padding: 0.55rem 0.2rem;
          }
        }
      `}</style>
    </div>
  )
}

function CaregiverClientsRow({ caregiverId, colSpan }: { caregiverId: string; colSpan: number }) {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useGetCaregiverClientsQuery(
    { id: caregiverId },
    { refetchOnMountOrArgChange: true },
  )
  const { data: allClientsPages, isLoading: allClientsLoading } = useGetAllClientsQuery(
    { limit: 200, page: 1 },
    { refetchOnMountOrArgChange: true },
  )
  const [assignCaregiver, { isLoading: assigning }] = useAssignCaregiverToClientMutation()
  const [removeCaregiver, { isLoading: unassigning }] = useRemoveCaregiverFromClientMutation()
  const [selectedClientId, setSelectedClientId] = useState("")
  const [assignMessage, setAssignMessage] = useState("")
  const clients = data ?? []
  const allClients = allClientsPages?.results ?? []
  const rows = useMemo(() => clients.map(mapClientToResident), [clients])
  const assignedIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows])
  const assignable = useMemo(
    () =>
      allClients
        .filter((c) => {
          const cid = String(c.id ?? "")
          return !!cid && !assignedIds.has(cid)
        })
        .map(mapClientToResident),
    [allClients, assignedIds],
  )

  const onAssign = async () => {
    if (!selectedClientId) return
    setAssignMessage("")
    try {
      await assignCaregiver({ clientId: selectedClientId, caregiverId }).unwrap()
      setSelectedClientId("")
      setAssignMessage(t("caregivers.assigned"))
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setAssignMessage(typeof msg === "string" ? msg : t("caregivers.assignError"))
    }
  }

  const onUnassign = async (clientId: string) => {
    setAssignMessage("")
    try {
      await removeCaregiver({ clientId, caregiverId }).unwrap()
      setAssignMessage(t("caregivers.unassigned"))
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setAssignMessage(typeof msg === "string" ? msg : t("caregivers.unassignError"))
    }
  }

  return (
    <tr>
      <td colSpan={colSpan} style={{ background: "var(--va-slate-50)" }}>
        <div className="va-caregiver-clients-wrap va-caregiver-clients-wrap--open">
          <div className="va-caregiver-clients-inner">
            <div style={{ padding: "0.5rem 0.75rem" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", marginBottom: 6 }}>{t("caregivers.assignedResidents")}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <AuthSelectField
                  label={t("caregivers.assignResident")}
                  style={{ maxWidth: 320 }}
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={allClientsLoading || assigning}
                >
                  <option value="">{t("caregivers.assignResident")}…</option>
                  {assignable.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.displayName} ({r.room})
                    </option>
                  ))}
                </AuthSelectField>
                <button type="button" className="va-btn-secondary" disabled={!selectedClientId || assigning} onClick={() => void onAssign()}>
                  {assigning ? t("caregivers.assigning") : t("caregivers.assignResident")}
                </button>
                {assignMessage ? (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color:
                        assignMessage === t("caregivers.assignError") || assignMessage === t("caregivers.unassignError")
                          ? "var(--va-red-600)"
                          : "var(--va-slate-600)",
                    }}
                  >
                    {assignMessage}
                  </span>
                ) : null}
              </div>
              {isLoading ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)", margin: 0 }}>{t("caregivers.loadingClients")}</p>
              ) : isError ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--va-red-600)", margin: 0 }}>{t("caregivers.loadClientsError")}</p>
              ) : rows.length === 0 ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)", margin: 0 }}>{t("caregivers.noClientsAssigned")}</p>
              ) : (
                <div>
                  {rows.map((r) => (
                    <div key={r.id} className="va-caregiver-client-line">
                      <span style={{ fontWeight: 600, color: "var(--va-navy)" }}>{r.displayName}</span>
                      <span style={{ color: "var(--va-slate-600)" }}>{t("caregivers.roomLabel", { room: r.room })}</span>
                      <StatusPill status={r.status} />
                      <span style={{ color: "var(--va-slate-600)" }}>
                        {r.lastCallDate} {r.lastCallTime}
                      </span>
                      <span style={{ textTransform: "capitalize" }}>{r.riskLevel}</span>
                      <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="va-icon-btn"
                          aria-label={t("caregivers.unassignAria")}
                          disabled={unassigning}
                          onClick={() => void onUnassign(r.id)}
                          style={{ color: "var(--va-red-600)" }}
                        >
                          <TrashIcon size={14} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

function StatusPill({ status }: { status: "active" | "inactive" | "at_risk" }) {
  const { t } = useTranslation()
  const map = {
    active: { bg: "var(--va-emerald-100)", fg: "var(--va-emerald-700)", label: t("caregivers.statusActive") },
    inactive: { bg: "var(--va-slate-100)", fg: "var(--va-slate-600)", label: t("caregivers.statusInactive") },
    at_risk: { bg: "var(--va-red-100)", fg: "var(--va-red-700)", label: t("caregivers.statusAtRisk") },
  }
  const s = map[status]
  return (
    <span
      style={{
        display: "inline-flex",
        width: "fit-content",
        padding: "0.12rem 0.55rem",
        borderRadius: 999,
        fontSize: "0.7rem",
        fontWeight: 600,
        background: s.bg,
        color: s.fg,
      }}
    >
      {s.label}
    </span>
  )
}
