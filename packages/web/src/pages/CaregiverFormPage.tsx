import { FormEvent, useEffect, useMemo, useState } from "react"
import { skipToken } from "@reduxjs/toolkit/query"
import { Link, useNavigate, useParams } from "react-router-dom"
import { AvatarPicker } from "../components/AvatarPicker"
import { LANGUAGE_OPTIONS } from "../lib/languages"
import { canManageCaregivers } from "../lib/roleAccess"
import {
  useCreateCaregiverMutation,
  useGetCaregiverQuery,
  useUpdateCaregiverMutation,
  useUploadAvatarMutation,
} from "../services/api/caregiverApi"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"

export function CaregiverFormPage() {
  const navigate = useNavigate()
  const { caregiverId } = useParams()
  const user = useAppSelector(getCurrentUser)
  const canManage = canManageCaregivers(user?.role)
  const isEdit = !!caregiverId

  const { data: caregiver, isLoading: loadingCaregiver } = useGetCaregiverQuery(
    isEdit && caregiverId ? { id: caregiverId } : skipToken,
  )
  const [createCaregiver, { isLoading: creating }] = useCreateCaregiverMutation()
  const [updateCaregiver, { isLoading: saving }] = useUpdateCaregiverMutation()
  const [uploadAvatar, { isLoading: uploadingAvatar }] = useUploadAvatarMutation()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [preferredLanguage, setPreferredLanguage] = useState("en")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!caregiver) return
    setName(caregiver.name || "")
    setEmail(caregiver.email || "")
    setPhone(caregiver.phone || "")
    setPreferredLanguage(caregiver.preferredLanguage || "en")
    setAvatarFile(null)
  }, [caregiver])

  const title = useMemo(() => (isEdit ? "Edit caregiver" : "Add caregiver"), [isEdit])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage("")
    try {
      if (isEdit && caregiverId) {
        await updateCaregiver({
          id: caregiverId,
          caregiver: {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            preferredLanguage: preferredLanguage || undefined,
          },
        }).unwrap()
        if (avatarFile) {
          await uploadAvatar({ id: caregiverId, avatar: avatarFile }).unwrap()
        }
        navigate("/caregivers")
        return
      }

      const created = await createCaregiver({
        caregiver: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: "invited",
          preferredLanguage: preferredLanguage || undefined,
        },
      }).unwrap()
      const createdId = created.id ? String(created.id) : ""
      if (avatarFile && createdId) {
        await uploadAvatar({ id: createdId, avatar: avatarFile }).unwrap()
      }
      navigate("/caregivers")
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setMessage(typeof msg === "string" ? msg : `Could not ${isEdit ? "update" : "add"} caregiver.`)
    }
  }

  if (!canManage) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 560 }}>
      <div>
        <h1 className="va-page-title">{title}</h1>
        <p style={{ marginTop: 4, fontSize: "0.875rem", color: "var(--va-slate-500)" }}>
          {isEdit ? "Update caregiver details and profile image." : "Create a caregiver and send an invite."}
        </p>
      </div>

      <div className="va-card va-card-pad">
        {loadingCaregiver && isEdit ? (
          <p style={{ margin: 0, color: "var(--va-slate-500)", fontSize: "0.875rem" }}>Loading caregiver...</p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="va-login-form">
            <AvatarPicker
              label="Photo"
              initialsSource={name || caregiver?.name || "?"}
              existingAvatarUrl={caregiver?.avatar}
              onPick={setAvatarFile}
            />
            <label className="va-login-label">
              Name
              <input className="va-login-input" value={name} onChange={(ev) => setName(ev.target.value)} required />
            </label>
            <label className="va-login-label">
              Email
              <input className="va-login-input" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} required />
            </label>
            <label className="va-login-label">
              Phone
              <input className="va-login-input" value={phone} onChange={(ev) => setPhone(ev.target.value)} required />
            </label>
            <label className="va-login-label">
              Preferred language
              <select className="va-login-input" value={preferredLanguage} onChange={(ev) => setPreferredLanguage(ev.target.value)}>
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            {message ? (
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-red-600)" }}>
                {message}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="submit" className="va-btn-primary" disabled={creating || saving || uploadingAvatar}>
                {creating || saving || uploadingAvatar ? "Saving..." : isEdit ? "Save caregiver" : "Add caregiver"}
              </button>
              <Link to="/caregivers" className="va-btn-secondary" style={{ textDecoration: "none" }}>
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
