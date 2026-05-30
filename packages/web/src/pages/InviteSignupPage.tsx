import { FormEvent, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AuthPageShell } from "../auth/AuthPageShell"
import { useGetInviteInfoQuery, useRegisterWithInviteMutation } from "../services/api/authApi"
import { orgStubFromCaregiverOrgId } from "../lib/normalizeOrg"
import { validatePhoneDigits } from "../lib/passwordRules"
import { validatePasswordRulesI18n } from "../lib/passwordI18n"
import { setAuthEmail } from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { useAppDispatch } from "../store/store"
import { notifyAuthSuccess } from "../services/api/baseQueryWithAuth"
import { AuthTextField } from "../components/AuthTextField"
import { PasswordField } from "../components/PasswordField"
import "../app.css"

export function InviteSignupPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams])
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const { data: inviteInfo, isLoading: inviteLoading, error: inviteError } = useGetInviteInfoQuery(
    { token },
    { skip: !token },
  )

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [formError, setFormError] = useState("")

  const [registerWithInvite, { isLoading: submitting }] = useRegisterWithInviteMutation()

  useEffect(() => {
    if (!inviteInfo) return
    setName(inviteInfo.name || "")
    setEmail(inviteInfo.email || "")
    setPhone(inviteInfo.phone || "")
  }, [inviteInfo])

  const inviteErrMsg = inviteError
    ? (() => {
        const data = (inviteError as { data?: { message?: string } })?.data
        return typeof data?.message === "string" ? data.message : t("invite.invalidInvite")
      })()
    : ""

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError("")
    if (!token) {
      setFormError(t("invite.errors.tokenMissing"))
      return
    }
    const pw = validatePasswordRulesI18n(password, t)
    if (pw) {
      setFormError(pw)
      return
    }
    if (password !== confirm) {
      setFormError(t("invite.errors.passwordMismatch"))
      return
    }
    if (!name.trim()) {
      setFormError(t("invite.errors.nameRequired"))
      return
    }
    if (!validatePhoneDigits(phone)) {
      setFormError(t("invite.errors.phoneInvalid"))
      return
    }
    try {
      const result = await registerWithInvite({
        token,
        password,
        name: name.trim(),
        email: email.trim(),
        phone: phone.replace(/\s/g, ""),
      }).unwrap()
      dispatch(setOrg(orgStubFromCaregiverOrgId(String(result.caregiver.org))))
      dispatch(setAuthEmail(result.caregiver.email))
      notifyAuthSuccess()
      navigate("/", { replace: true })
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string } })?.data
      setFormError(typeof data?.message === "string" ? data.message : t("invite.invalidInvite"))
    }
  }

  return (
    <AuthPageShell title={t("invite.title")} subtitle={t("invite.subtitle")} wide>
      {!token ? (
        <div className="va-login-error" role="alert">
          {t("invite.missingTokenBanner")}
        </div>
      ) : null}
      {token && inviteLoading ? <p className="va-auth-muted">{t("invite.loading")}</p> : null}
      {token && inviteErrMsg && !inviteLoading ? (
        <div className="va-login-error" role="alert">
          {inviteErrMsg}
        </div>
      ) : null}
      {token && inviteInfo ? (
        <form className="va-login-form" onSubmit={handleSubmit}>
          <AuthTextField
            label={t("invite.fullName")}
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            autoComplete="name"
          />
          <AuthTextField
            label={t("invite.email")}
            type="email"
            value={email}
            readOnly
            disabled
          />
          <AuthTextField
            label={t("invite.phone")}
            value={phone}
            onChange={(ev) => setPhone(ev.target.value)}
            autoComplete="tel"
          />
          <PasswordField
            label={t("invite.password")}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            autoComplete="new-password"
          />
          <p className="va-login-helper">{t("invite.rulesHint")}</p>
          <PasswordField
            label={t("invite.confirmPassword")}
            value={confirm}
            onChange={(ev) => setConfirm(ev.target.value)}
            autoComplete="new-password"
          />
          {formError ? (
            <div className="va-login-error" role="alert">
              {formError}
            </div>
          ) : null}
          <button type="submit" className="va-btn-primary va-login-submit" disabled={submitting}>
            {submitting ? t("invite.submitting") : t("invite.submit")}
          </button>
        </form>
      ) : null}
      <div className="va-auth-footer">
        <Link to="/login">{t("invite.footerHasAccount")}</Link>
      </div>
    </AuthPageShell>
  )
}
