import { type FormEvent, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { PasswordField } from "../components/PasswordField"
import { useGetInviteInfoQuery, useRegisterWithInviteMutation } from "../services/api/authApi"
import { setAuthEmail, setAuthTokens, setCurrentUser } from "../store/authSlice"
import { useAppDispatch } from "../store/store"
import type { AuthTokens, Caregiver } from "../services/api/api.types"
import { validatePasswordRules, validatePhoneDigits } from "../lib/passwordRules"

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
      dispatch(setAuthTokens(result.tokens as AuthTokens))
      dispatch(setAuthEmail(result.caregiver.email))
      dispatch(setCurrentUser(result.caregiver as Caregiver))
      navigate("/", { replace: true })
    } catch (err: unknown) {
      setFormError(inviteFetchError(err))
    }
  }

  return (
    <div className="admin-shell">
      <div className="admin-card admin-card--narrow">
        <div className="admin-brand">
          <span className="admin-badge">Admin</span>
          <h1 className="admin-title">Complete invitation</h1>
          <p className="admin-muted">Set your password to access the super-admin console.</p>
        </div>
        {!token ? (
          <p className="admin-error" role="alert">
            Missing invite token. Use the link from your email, or ask a super administrator to resend.
          </p>
        ) : null}
        {token && inviteLoading ? <p className="admin-muted">Loading invitation…</p> : null}
        {token && inviteErrMsg && !inviteLoading ? (
          <p className="admin-error" role="alert">
            {inviteErrMsg}
          </p>
        ) : null}
        {token && inviteInfo ? (
          <form className="admin-form" onSubmit={(e) => void handleSubmit(e)}>
            <label className="admin-label">
              Full name
              <input
                className="admin-input"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="admin-label">
              Email
              <input type="email" className="admin-input" value={email} readOnly disabled autoComplete="username" />
            </label>
            <label className="admin-label">
              Phone
              <input
                className="admin-input"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                autoComplete="tel"
              />
            </label>
            <label className="admin-label">
              Password
              <PasswordField value={password} onChange={(ev) => setPassword(ev.target.value)} autoComplete="new-password" />
            </label>
            <p className="admin-muted" style={{ marginTop: "-0.5rem", fontSize: "0.85rem" }}>
              At least 8 characters, with at least one letter and one number.
            </p>
            <label className="admin-label">
              Confirm password
              <PasswordField value={confirm} onChange={(ev) => setConfirm(ev.target.value)} autoComplete="new-password" />
            </label>
            {formError ? (
              <p className="admin-error" role="alert">
                {formError}
              </p>
            ) : null}
            <button type="submit" className="admin-btn admin-btn--primary admin-btn--block" disabled={submitting}>
              {submitting ? "Creating account…" : "Complete registration"}
            </button>
          </form>
        ) : null}
        <p className="admin-muted" style={{ marginTop: "1.25rem", textAlign: "center" }}>
          <Link to="/login">Already have an account? Sign in</Link>
        </p>
      </div>
    </div>
  )
}
