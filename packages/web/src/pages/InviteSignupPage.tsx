import { FormEvent, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AuthPageShell } from "../auth/AuthPageShell"
import { useGetInviteInfoQuery, useRegisterWithInviteMutation } from "../services/api/authApi"
import { orgStubFromCaregiverOrgId } from "../lib/normalizeOrg"
import { validatePasswordRules, validatePhoneDigits } from "../lib/passwordRules"
import { setAuthEmail } from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { useAppDispatch } from "../store/store"
import { notifyAuthSuccess } from "../services/api/baseQueryWithAuth"
import "../vercel-app.css"

function inviteFetchError(err: unknown): string {
  const data = (err as { data?: { message?: string } })?.data
  return typeof data?.message === "string" ? data.message : "Invalid or expired invite."
}

export function InviteSignupPage() {
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

  const inviteErrMsg = inviteError ? inviteFetchError(inviteError) : ""

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError("")
    if (!token) {
      setFormError("Missing invite token. Open the link from your invitation email.")
      return
    }
    const pw = validatePasswordRules(password)
    if (pw) {
      setFormError(pw)
      return
    }
    if (password !== confirm) {
      setFormError("Passwords do not match.")
      return
    }
    if (!name.trim()) {
      setFormError("Name is required.")
      return
    }
    if (!validatePhoneDigits(phone)) {
      setFormError("Enter a valid phone number (at least 10 digits, or +1 followed by 10 digits).")
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
      setFormError(inviteFetchError(err))
    }
  }

  return (
    <AuthPageShell title="Complete invitation" subtitle="Set your password to join your organization." wide>
      {!token ? (
        <div className="va-login-error" role="alert">
          Missing invite token. Use the link from your email, or ask an admin to resend your invite.
        </div>
      ) : null}
      {token && inviteLoading ? <p className="va-auth-muted">Loading invitation…</p> : null}
      {token && inviteErrMsg && !inviteLoading ? (
        <div className="va-login-error" role="alert">
          {inviteErrMsg}
        </div>
      ) : null}
      {token && inviteInfo ? (
        <form className="va-login-form" onSubmit={handleSubmit}>
          <label className="va-login-label">
            Full name
            <input
              className="va-login-input"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="va-login-label">
            Email
            <input type="email" className="va-login-input" value={email} readOnly disabled />
          </label>
          <label className="va-login-label">
            Phone
            <input
              className="va-login-input"
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              autoComplete="tel"
            />
          </label>
          <label className="va-login-label">
            Password
            <input
              type="password"
              className="va-login-input"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              autoComplete="new-password"
            />
          </label>
          <p className="va-login-helper">At least 8 characters, with at least one letter and one number.</p>
          <label className="va-login-label">
            Confirm password
            <input
              type="password"
              className="va-login-input"
              value={confirm}
              onChange={(ev) => setConfirm(ev.target.value)}
              autoComplete="new-password"
            />
          </label>
          {formError ? (
            <div className="va-login-error" role="alert">
              {formError}
            </div>
          ) : null}
          <button type="submit" className="va-btn-primary va-login-submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Complete registration"}
          </button>
        </form>
      ) : null}
      <div className="va-auth-footer">
        <Link to="/login">Already have an account? Sign in</Link>
      </div>
    </AuthPageShell>
  )
}
