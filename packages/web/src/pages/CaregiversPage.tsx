import { FormEvent, Fragment, useMemo, useState } from "react"
import { skipToken } from "@reduxjs/toolkit/query"
import { canManageCaregivers } from "../lib/roleAccess"
import { ChevronDownIcon, PencilIcon, TrashIcon } from "../icons"
import { useCreateCaregiverMutation, useDeleteCaregiverMutation, useGetCaregiverClientsQuery, useGetCaregiversQuery, useUpdateCaregiverMutation } from "../services/api/caregiverApi"
import { mapClientToResident } from "../lib/liveData"
import { useAssignCaregiverToClientMutation, useGetAllClientsQuery, useRemoveCaregiverFromClientMutation } from "../services/api/clientApi"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"

type EditState = {
  id: string
  name: string
  email: string
  phone: string
  preferredLanguage: string
}

type DeleteState = {
  id: string
  name: string
}

export function CaregiversPage() {
  const user = useAppSelector(getCurrentUser)
  const role = user?.role
  const currentId = user?.id ? String(user.id) : ""
  const canManage = canManageCaregivers(role)
  const { data, isLoading, isError, error, refetch } = useGetCaregiversQuery(
    canManage ? { limit: 200, page: 1, sortBy: "name:asc" } : skipToken,
  )
  const [createCaregiver, { isLoading: creating }] = useCreateCaregiverMutation()
  const [updateCaregiver, { isLoading: saving }] = useUpdateCaregiverMutation()
  const [deleteCaregiver, { isLoading: deleting }] = useDeleteCaregiverMutation()

  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [invitePhone, setInvitePhone] = useState("")
  const [addMessage, setAddMessage] = useState("")
  const [editMessage, setEditMessage] = useState("")
  const [editing, setEditing] = useState<EditState | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [deleteModal, setDeleteModal] = useState<DeleteState | null>(null)
  const [deleteMessage, setDeleteMessage] = useState("")

  const caregivers = useMemo(() => data?.results ?? [], [data?.results])

  const onInvite = async (e: FormEvent) => {
    e.preventDefault()
    setAddMessage("")
    try {
      await createCaregiver({
        caregiver: {
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          phone: invitePhone.trim(),
          role: "invited",
        },
      }).unwrap()
      setInviteName("")
      setInviteEmail("")
      setInvitePhone("")
      setAddOpen(false)
      setAddMessage("Caregiver added.")
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setAddMessage(typeof msg === "string" ? msg : "Could not add caregiver.")
    }
  }

  const onSaveEdit = async () => {
    if (!editing) return
    setEditMessage("")
    try {
      await updateCaregiver({
        id: editing.id,
        caregiver: {
          name: editing.name.trim(),
          email: editing.email.trim(),
          phone: editing.phone.trim(),
          preferredLanguage: editing.preferredLanguage.trim() || undefined,
        },
      }).unwrap()
      setEditing(null)
      setEditMessage("Caregiver updated.")
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setEditMessage(typeof msg === "string" ? msg : "Could not update caregiver.")
    }
  }

  const onDelete = async () => {
    if (!deleteModal || deleting) return
    setDeleteMessage("")
    try {
      await deleteCaregiver({ id: deleteModal.id }).unwrap()
      setDeleteModal(null)
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setDeleteMessage(typeof msg === "string" ? msg : "Could not remove caregiver.")
    }
  }

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (!canManage) return null

  return (
    <div data-testid="caregivers-page" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <h1 className="va-page-title">Caregivers</h1>
        <p style={{ marginTop: 4, fontSize: "0.875rem", color: "var(--va-slate-500)" }}>
          Manage organization caregivers and send invites.
        </p>
      </div>

      {addOpen ? (
        <div className="va-card va-card-pad">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Add caregiver</h2>
            <button type="button" className="va-btn-secondary" onClick={() => setAddOpen(false)}>
              Close
            </button>
          </div>
          <form onSubmit={(e) => void onInvite(e)} className="va-login-form">
            <label className="va-login-label">
              Name
              <input className="va-login-input" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
            </label>
            <label className="va-login-label">
              Email
              <input className="va-login-input" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            </label>
            <label className="va-login-label">
              Phone
              <input className="va-login-input" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} required />
            </label>
            <button type="submit" className="va-btn-primary" disabled={creating}>
              {creating ? "Adding..." : "Add caregiver"}
            </button>
            {addMessage ? (
              <p style={{ margin: 0, fontSize: "0.8125rem", color: addMessage.includes("Could not") ? "var(--va-red-600)" : "var(--va-emerald-700)" }}>
                {addMessage}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}

      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Organization caregivers</h2>
        {editMessage ? (
          <p style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "0.8125rem", color: editMessage.includes("Could not") ? "var(--va-red-600)" : "var(--va-emerald-700)" }}>
            {editMessage}
          </p>
        ) : null}
        {isLoading ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>Loading caregivers...</p>
        ) : isError ? (
          <div style={{ maxWidth: 460 }}>
            <p style={{ color: "var(--va-red-600)", marginBottom: 10 }}>Could not load caregivers.</p>
            <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", marginBottom: 12 }}>
              {(error as { data?: { message?: string } })?.data?.message ?? "Try again."}
            </p>
            <button className="va-btn-secondary" type="button" onClick={() => void refetch()}>
              Retry
            </button>
          </div>
        ) : caregivers.length === 0 ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>No caregivers found.</p>
        ) : (
          <div className="va-table-wrap">
            <table className="va-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {caregivers.map((c) => {
                  const id = c.id ? String(c.id) : ""
                  const isEditing = editing?.id === id
                  const isExpanded = !!expanded[id]
                  return (
                    <Fragment key={id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            className="va-btn-ghost"
                            style={{ padding: 0, display: "inline-flex", gap: 6, alignItems: "center" }}
                            onClick={() => toggleExpanded(id)}
                            aria-label={isExpanded ? "Collapse assigned clients" : "Expand assigned clients"}
                          >
                            <span style={{ display: "inline-flex", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}>
                              <ChevronDownIcon size={14} />
                            </span>
                            <span>{isEditing ? (
                              <input className="va-login-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                            ) : c.name}</span>
                          </button>
                        </td>
                        <td>
                          {isEditing ? (
                            <input className="va-login-input" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                          ) : (
                            c.email
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input className="va-login-input" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
                          ) : (
                            c.phone
                          )}
                        </td>
                        <td>{c.role}</td>
                        <td>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {isEditing ? (
                              <>
                                <button type="button" className="va-btn-primary" onClick={() => void onSaveEdit()} disabled={saving}>
                                  Save
                                </button>
                                <button type="button" className="va-btn-secondary" onClick={() => setEditing(null)}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="va-icon-btn"
                                  aria-label="Edit caregiver"
                                  onClick={() =>
                                    setEditing({
                                      id,
                                      name: c.name || "",
                                      email: c.email || "",
                                      phone: c.phone || "",
                                      preferredLanguage: c.preferredLanguage || "",
                                    })
                                  }
                                >
                                  <PencilIcon size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="va-icon-btn"
                                  aria-label={id === currentId ? "Current user cannot be removed" : "Remove caregiver"}
                                  style={id === currentId ? { color: "var(--va-slate-300)" } : { color: "var(--va-red-600)" }}
                                  disabled={deleting || id === currentId}
                                  onClick={() => setDeleteModal({ id, name: c.name || "Caregiver" })}
                                >
                                  <TrashIcon size={16} />
                                </button>
                              </>
                            )}
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
        aria-label="Add caregiver"
        data-testid="caregivers-add"
        onClick={() => setAddOpen(true)}
      >
        +
      </button>
      {deleteModal ? (
        <div className="va-modal-backdrop" role="dialog" aria-modal onClick={() => setDeleteModal(null)}>
          <div className="va-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "1.1rem 1.3rem", borderBottom: "1px solid var(--va-slate-200)" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Remove caregiver?</h3>
            </div>
            <div style={{ padding: "1rem 1.3rem", fontSize: "0.875rem", color: "var(--va-slate-700)" }}>
              <p style={{ margin: 0 }}>
                This will remove <strong>{deleteModal.name}</strong> from the organization.
              </p>
              {deleteMessage ? (
                <p style={{ marginTop: "0.75rem", color: "var(--va-red-600)" }}>{deleteMessage}</p>
              ) : null}
            </div>
            <div
              style={{
                padding: "0.85rem 1.3rem",
                borderTop: "1px solid var(--va-slate-200)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
              }}
            >
              <button type="button" className="va-btn-secondary" onClick={() => setDeleteModal(null)}>
                Cancel
              </button>
              <button type="button" className="va-btn-primary" onClick={() => void onDelete()} disabled={deleting}>
                {deleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
      setAssignMessage("Assigned.")
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setAssignMessage(typeof msg === "string" ? msg : "Could not assign client.")
    }
  }

  const onUnassign = async (clientId: string) => {
    setAssignMessage("")
    try {
      await removeCaregiver({ clientId, caregiverId }).unwrap()
      setAssignMessage("Unassigned.")
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setAssignMessage(typeof msg === "string" ? msg : "Could not unassign client.")
    }
  }

  return (
    <tr>
      <td colSpan={colSpan} style={{ background: "var(--va-slate-50)" }}>
        <div className="va-caregiver-clients-wrap va-caregiver-clients-wrap--open">
          <div className="va-caregiver-clients-inner">
            <div style={{ padding: "0.5rem 0.75rem" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", marginBottom: 6 }}>Assigned clients</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <select
                  className="va-login-input"
                  style={{ maxWidth: 320 }}
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={allClientsLoading || assigning}
                >
                  <option value="">Assign resident...</option>
                  {assignable.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.firstName} {r.lastName} ({r.room})
                    </option>
                  ))}
                </select>
                <button type="button" className="va-btn-secondary" disabled={!selectedClientId || assigning} onClick={() => void onAssign()}>
                  {assigning ? "Assigning..." : "Assign"}
                </button>
                {assignMessage ? (
                  <span style={{ fontSize: "0.75rem", color: assignMessage.includes("Could not") ? "var(--va-red-600)" : "var(--va-slate-600)" }}>
                    {assignMessage}
                  </span>
                ) : null}
              </div>
              {isLoading ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)", margin: 0 }}>Loading...</p>
              ) : isError ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--va-red-600)", margin: 0 }}>Could not load clients.</p>
              ) : rows.length === 0 ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)", margin: 0 }}>No clients assigned.</p>
              ) : (
                <div>
                  {rows.map((r) => (
                    <div key={r.id} className="va-caregiver-client-line">
                      <span style={{ fontWeight: 600, color: "var(--va-navy)" }}>
                        {r.firstName} {r.lastName}
                      </span>
                      <span style={{ color: "var(--va-slate-600)" }}>Room {r.room}</span>
                      <StatusPill status={r.status} />
                      <span style={{ color: "var(--va-slate-600)" }}>
                        {r.lastCallDate} {r.lastCallTime}
                      </span>
                      <span style={{ textTransform: "capitalize" }}>{r.riskLevel}</span>
                      <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="va-icon-btn"
                          aria-label="Unassign resident"
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
  const map = {
    active: { bg: "var(--va-emerald-100)", fg: "var(--va-emerald-700)", label: "Active" },
    inactive: { bg: "var(--va-slate-100)", fg: "var(--va-slate-600)", label: "Inactive" },
    at_risk: { bg: "var(--va-red-100)", fg: "var(--va-red-700)", label: "At Risk" },
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
