import { FormEvent, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { LANGUAGE_OPTIONS } from "../lib/languages"
import { useCreateClientMutation, useAssignCaregiverToClientMutation, useUploadClientAvatarMutation } from "../services/api/clientApi"
import { useGetCaregiversQuery } from "../services/api/caregiverApi"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { canAddResidents } from "../lib/roleAccess"
import "../app.css"

function assignableCaregivers(
  results: { id?: string; role?: string; name: string }[],
) {
  return results.filter((c) => {
    const id = c.id != null ? String(c.id) : ""
    if (!id) return false
    const r = c.role
    return r === "staff" || r === "orgAdmin" || r === "superAdmin"
  })
}

export function AddResidentPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAppSelector(getCurrentUser)
  const currentId = user?.id != null ? String(user.id) : ""
  const role = user?.role

  const { data: caregiverPages, isLoading: loadingCaregivers, isError: caregiversError } = useGetCaregiversQuery(
    { limit: 200, page: 1, sortBy: "name:asc" },
    { skip: !canAddResidents(role) },
  )

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [preferredLanguage, setPreferredLanguage] = useState("en")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [extraCaregiverIds, setExtraCaregiverIds] = useState<Set<string>>(new Set())
  const [formError, setFormError] = useState("")
  const [partialCreateId, setPartialCreateId] = useState<string | null>(null)

  const [createClient, { isLoading: creating }] = useCreateClientMutation()
  const [assignCaregiver] = useAssignCaregiverToClientMutation()
  const [uploadClientAvatar] = useUploadClientAvatarMutation()

  useEffect(() => {
    if (!canAddResidents(role)) {
      navigate("/residents", { replace: true })
    }
  }, [role, navigate])

  const peers = useMemo(() => {
    const raw = caregiverPages?.results ?? []
    return assignableCaregivers(raw).sort((a, b) => a.name.localeCompare(b.name))
  }, [caregiverPages?.results])
  const selfCaregiver = useMemo(
    () => peers.find((c) => String(c.id) === currentId),
    [peers, currentId],
  )
  const otherCaregivers = useMemo(
    () => peers.filter((c) => String(c.id) !== currentId),
    [peers, currentId],
  )

  const toggleCaregiver = (id: string) => {
    setExtraCaregiverIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllCaregivers = () => {
    setExtraCaregiverIds(new Set(otherCaregivers.map((c) => String(c.id))))
  }

  const clearAllCaregivers = () => {
    setExtraCaregiverIds(new Set())
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError("")
    setPartialCreateId(null)
    const n = name.trim()
    const em = email.trim()
    const ph = phone.replace(/\s/g, "")
    if (!n || !em || !ph) {
      setFormError(t("residents.fieldsRequired"))
      return
    }
    try {
      const client = await createClient({
        name: n,
        email: em,
        phone: ph,
        preferredLanguage: preferredLanguage || undefined,
      }).unwrap()
      const cid = client.id != null ? String(client.id) : ""
      if (!cid) {
        setFormError(t("residents.createError"))
        return
      }
      const toAssign = [...extraCaregiverIds]
      const assignResults = await Promise.allSettled(
        toAssign.map((cgId) => assignCaregiver({ clientId: cid, caregiverId: cgId }).unwrap()),
      )
      if (avatarFile) {
        const up = await uploadClientAvatar({ clientId: cid, file: avatarFile })
        if ("error" in up) {
          setFormError("Resident created, but image upload failed.")
          setPartialCreateId(cid)
          return
        }
      }
      const failedCount = assignResults.filter((r) => r.status === "rejected").length
      if (failedCount > 0) {
        setFormError(t("residents.assignPartialError"))
        setPartialCreateId(cid)
        return
      }
      navigate(`/residents/${cid}`, { replace: true })
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setFormError(typeof msg === "string" ? msg : t("residents.createError"))
    }
  }

  if (!canAddResidents(role)) {
    return null
  }

  return (
    <div data-testid="add-resident-page" style={{ maxWidth: 560, margin: "0 auto" }}>
      <p style={{ marginBottom: "0.75rem" }}>
        <Link to="/residents" className="va-link" style={{ fontSize: "0.875rem" }}>
          ← {t("residentDetail.back")}
        </Link>
      </p>
      <h1 className="va-page-title">{t("residents.addPageTitle")}</h1>
      <p style={{ color: "var(--va-slate-500)", marginTop: 8, marginBottom: "1.5rem", fontSize: "0.875rem", lineHeight: 1.45 }}>
        {t("residents.addPageIntro")}
      </p>

      {caregiversError && (
        <div className="va-login-error" style={{ marginBottom: "1rem" }} role="alert">
          {t("residents.loadCaregiversError")}
        </div>
      )}

      <div className="va-card va-card-pad">
        <form onSubmit={(e) => void onSubmit(e)} className="va-login-form">
          <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
            <span style={{ display: "block", marginBottom: 6 }}>{t("residents.labelFullName")}</span>
            <input
              className="va-login-input"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              data-testid="add-resident-name"
            />
          </label>
          <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
            <span style={{ display: "block", marginBottom: 6 }}>{t("residents.labelEmail")}</span>
            <input
              className="va-login-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="add-resident-email"
            />
          </label>
          <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
            <span style={{ display: "block", marginBottom: 6 }}>{t("residents.labelPhone")}</span>
            <input
              className="va-login-input"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              data-testid="add-resident-phone"
            />
          </label>
          <label style={{ display: "block", marginBottom: "1rem", fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
            <span style={{ display: "block", marginBottom: 6 }}>{t("residents.labelLanguage")}</span>
            <select
              className="va-login-input"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              data-testid="add-resident-language"
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "block", marginBottom: "1rem", fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
            <span style={{ display: "block", marginBottom: 6 }}>Resident photo (optional)</span>
            <input
              className="va-login-input"
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: 8 }}>{t("residents.caregiversHeading")}</h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)", marginBottom: "0.75rem", lineHeight: 1.45 }}>
            {t("residents.caregiversHint")}
          </p>
          {loadingCaregivers ? (
            <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", marginBottom: "1rem" }}>
              {t("residents.caregiversLoading")}
            </p>
          ) : peers.length === 0 ? (
            <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", marginBottom: "1rem" }}>
              {t("residents.caregiversEmpty")}
            </p>
          ) : (
            <div
              style={{
                border: "1px solid var(--va-slate-200)",
                borderRadius: 10,
                padding: "0.25rem 0.5rem",
                marginBottom: "1rem",
                maxHeight: 260,
                overflowY: "auto",
                background: "#fff",
              }}
            >
              {otherCaregivers.length > 0 ? (
                <div style={{ display: "flex", gap: 8, margin: "0.35rem 0.25rem 0.5rem" }}>
                  <button type="button" className="va-btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }} onClick={selectAllCaregivers}>
                    Select all
                  </button>
                  <button type="button" className="va-btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }} onClick={clearAllCaregivers}>
                    Clear all
                  </button>
                </div>
              ) : null}
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {selfCaregiver ? (
                  <li
                    key={String(selfCaregiver.id)}
                    style={{
                      padding: "0.45rem 0.25rem",
                      borderBottom: otherCaregivers.length > 0 ? "1px solid var(--va-slate-100)" : "none",
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.875rem", color: "var(--va-slate-500)" }}>
                      <input type="checkbox" checked disabled />
                      <span>{selfCaregiver.name} (you, auto-assigned)</span>
                    </label>
                  </li>
                ) : null}
                {otherCaregivers.map((c) => {
                  const id = String(c.id)
                  return (
                    <li key={id} style={{ padding: "0.45rem 0.25rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "0.875rem" }}>
                        <input
                          type="checkbox"
                          checked={extraCaregiverIds.has(id)}
                          onChange={() => toggleCaregiver(id)}
                          data-testid={`add-resident-cg-${id}`}
                        />
                        <span>{c.name}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {formError ? (
            <div className="va-login-error" style={{ marginBottom: "1rem" }} role="alert">
              <div>{formError}</div>
              {partialCreateId ? (
                <div style={{ marginTop: "0.75rem" }}>
                  <Link to={`/residents/${partialCreateId}`} className="va-link">
                    {t("residents.viewNewResident")}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button type="submit" className="va-btn-primary" disabled={creating} data-testid="add-resident-submit">
              {creating ? t("residents.submitting") : t("residents.submit")}
            </button>
            <Link to="/residents" className="va-btn-secondary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              {t("residents.cancel")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
