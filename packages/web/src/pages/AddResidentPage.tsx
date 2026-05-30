import { FormEvent, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { LANGUAGE_OPTIONS } from "../lib/languages"
import { intervalsForDraft } from "../lib/scheduleDraft"
import { AuthSelectField } from "../components/AuthSelectField"
import { AuthTextField } from "../components/AuthTextField"
import { AvatarPicker } from "../components/AvatarPicker"
import { NewScheduleFormFields, type ScheduleFrequency } from "../components/NewScheduleFormFields"
import { useCreateClientMutation, useAssignCaregiverToClientMutation, useUploadClientAvatarMutation } from "../services/api/clientApi"
import { useCreateScheduleForClientMutation } from "../services/api/scheduleApi"
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
  const role = user?.role

  const { data: caregiverPages, isLoading: loadingCaregivers, isError: caregiversError } = useGetCaregiversQuery(
    { limit: 200, page: 1, sortBy: "name:asc" },
    { skip: !canAddResidents(role) },
  )

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [preferredName, setPreferredName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [room, setRoom] = useState("")
  const [preferredLanguage, setPreferredLanguage] = useState("en")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [extraCaregiverIds, setExtraCaregiverIds] = useState<Set<string>>(new Set())
  const [formError, setFormError] = useState("")
  const [partialCreateId, setPartialCreateId] = useState<string | null>(null)
  const [newScheduleFrequency, setNewScheduleFrequency] = useState<ScheduleFrequency>("weekly")
  const [newScheduleTime, setNewScheduleTime] = useState("09:00")
  const [newScheduleWeeklyDays, setNewScheduleWeeklyDays] = useState<number[]>([1, 3, 5])
  const [newScheduleWeeklyWeeks, setNewScheduleWeeklyWeeks] = useState(1)
  const [newScheduleMonthlyDaysRaw, setNewScheduleMonthlyDaysRaw] = useState("1,15")
  const [newScheduleActive, setNewScheduleActive] = useState(true)

  const [createClient, { isLoading: creating }] = useCreateClientMutation()
  const [assignCaregiver] = useAssignCaregiverToClientMutation()
  const [uploadClientAvatar] = useUploadClientAvatarMutation()
  const [createScheduleForClient, { isLoading: creatingSchedule }] = useCreateScheduleForClientMutation()

  useEffect(() => {
    if (!canAddResidents(role)) {
      navigate("/residents", { replace: true })
    }
  }, [role, navigate])

  const peers = useMemo(() => {
    const raw = caregiverPages?.results ?? []
    return assignableCaregivers(raw).sort((a, b) => a.name.localeCompare(b.name))
  }, [caregiverPages?.results])

  const toggleCaregiver = (id: string) => {
    setExtraCaregiverIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllCaregivers = () => {
    setExtraCaregiverIds(new Set(peers.map((c) => String(c.id))))
  }

  const clearAllCaregivers = () => {
    setExtraCaregiverIds(new Set())
  }

  const toggleNewScheduleDay = (day: number) => {
    setNewScheduleWeeklyDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
      return next.sort((a, b) => a - b)
    })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError("")
    setPartialCreateId(null)
    const fn = firstName.trim()
    const ln = lastName.trim()
    const em = email.trim()
    const ph = phone.replace(/\s/g, "")
    if (!fn || !em || !ph) {
      setFormError(t("residents.fieldsRequired"))
      return
    }
    const scheduleIntervals = intervalsForDraft(
      newScheduleFrequency,
      newScheduleWeeklyDays,
      newScheduleWeeklyWeeks,
      newScheduleMonthlyDaysRaw,
    )
    if (newScheduleFrequency !== "daily" && scheduleIntervals.length === 0) {
      setFormError(t("residents.scheduleIntervalRequired"))
      return
    }
    try {
      const client = await createClient({
        firstName: fn,
        lastName: ln,
        preferredName: preferredName.trim() || undefined,
        email: em,
        phone: ph,
        preferredLanguage: preferredLanguage || undefined,
        room: room.trim() || undefined,
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
          setFormError(t("residents.avatarUploadFailed"))
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
      try {
        await createScheduleForClient({
          clientId: cid,
          body: {
            frequency: newScheduleFrequency,
            intervals: scheduleIntervals,
            time: newScheduleTime,
            isActive: newScheduleActive,
          },
        }).unwrap()
      } catch (schedErr: unknown) {
        const msg = (schedErr as { data?: { message?: string } })?.data?.message
        setFormError(typeof msg === "string" ? msg : t("residents.scheduleSaveFailed"))
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
    <div data-testid="add-resident-page" className="va-page-wrap">
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
          <AuthTextField
            label={t("residents.labelFirstName")}
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            inputTestId="add-resident-first-name"
          />
          <AuthTextField
            label={t("residents.labelLastName")}
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            inputTestId="add-resident-last-name"
          />
          <AuthTextField
            label={t("residents.labelPreferredName")}
            type="text"
            autoComplete="nickname"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            inputTestId="add-resident-preferred-name"
          />
          <AuthTextField
            label={t("residents.labelEmail")}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            inputTestId="add-resident-email"
          />
          <AuthTextField
            label={t("residents.labelPhone")}
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            inputTestId="add-resident-phone"
          />
          <AuthTextField
            label={t("residents.labelRoom")}
            type="text"
            autoComplete="off"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder={t("residents.roomPlaceholder")}
            inputTestId="add-resident-room"
          />
          <AuthSelectField
            label={t("residents.labelLanguage")}
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value)}
            selectTestId="add-resident-language"
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </AuthSelectField>

          <div style={{ marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: 6 }}>{t("residents.callScheduleTitle")}</h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)", marginBottom: "0.75rem", lineHeight: 1.45 }}>
              {t("residents.callScheduleIntro")}
            </p>
            <div
              style={{
                border: "1px solid var(--va-slate-200)",
                borderRadius: 10,
                padding: "0.85rem",
                display: "grid",
                gap: 10,
                background: "var(--va-slate-50)",
              }}
            >
              <NewScheduleFormFields
                testIdPrefix="add-resident-schedule"
                frequency={newScheduleFrequency}
                setFrequency={setNewScheduleFrequency}
                time={newScheduleTime}
                setTime={setNewScheduleTime}
                active={newScheduleActive}
                setActive={setNewScheduleActive}
                weeklyDays={newScheduleWeeklyDays}
                toggleWeeklyDay={toggleNewScheduleDay}
                weeklyWeeks={newScheduleWeeklyWeeks}
                setWeeklyWeeks={setNewScheduleWeeklyWeeks}
                monthlyDaysRaw={newScheduleMonthlyDaysRaw}
                setMonthlyDaysRaw={setNewScheduleMonthlyDaysRaw}
              />
            </div>
          </div>

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
              {peers.length > 0 ? (
                <div style={{ display: "flex", gap: 8, margin: "0.35rem 0.25rem 0.5rem" }}>
                  <button type="button" className="va-btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }} onClick={selectAllCaregivers}>
                    {t("residents.selectAllCaregivers")}
                  </button>
                  <button type="button" className="va-btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }} onClick={clearAllCaregivers}>
                    {t("residents.clearAllCaregivers")}
                  </button>
                </div>
              ) : null}
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {peers.map((c) => {
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

          <AvatarPicker
            label={t("residents.avatarOptionalLabel")}
            initialsSource={preferredName || firstName || "?"}
            onPick={setAvatarFile}
          />

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
            <button type="submit" className="va-btn-primary" disabled={creating || creatingSchedule} data-testid="add-resident-submit">
              {creating || creatingSchedule ? t("residents.submitting") : t("residents.submit")}
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
