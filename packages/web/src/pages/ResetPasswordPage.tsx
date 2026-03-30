import { FormEvent, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AuthPageShell } from "../auth/AuthPageShell"
import { useResetPasswordMutation } from "../services/api/authApi"
import { validatePasswordRules } from "../lib/passwordRules"
import { PasswordField } from "../components/PasswordField"
import "../app.css"

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams])

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [resetPassword, { isLoading }] = useResetPasswordMutation()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (!token) {
      setError("This reset link is missing a token. Open the link from your email.")
      return
    }
    const pwErr = validatePasswordRules(password)
    if (pwErr) {
      setError(pwErr)
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    try {
      await resetPassword({ token, password }).unwrap()
      navigate("/login", {
        replace: true,
        state: { passwordReset: true },
      })
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string } })?.data
      setError(typeof data?.message === "string" ? data.message : "Reset failed. The link may have expired.")
    }
  }

  return (
    <AuthPageShell title="Choose a new password" subtitle="Enter a new password for your account.">
      {!token ? (
        <div className="va-login-error" role="alert">
          Invalid or missing reset link. Request a new one from the sign-in page.
        </div>
      ) : null}
      <form className="va-login-form" onSubmit={handleSubmit}>
        <label className="va-login-label">
          New password
          <PasswordField autoComplete="new-password" value={password} onChange={(ev) => setPassword(ev.target.value)} />
        </label>
        <p className="va-login-helper">At least 8 characters, with at least one letter and one number.</p>
        <label className="va-login-label">
          Confirm password
          <PasswordField autoComplete="new-password" value={confirm} onChange={(ev) => setConfirm(ev.target.value)} />
        </label>
        {error ? (
          <div className="va-login-error" role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" className="va-btn-primary va-login-submit" disabled={isLoading || !token}>
          {isLoading ? "Updating…" : "Update password"}
        </button>
        <div className="va-auth-footer">
          <Link to="/login">Back to sign in</Link>
        </div>
      </form>
    </AuthPageShell>
  )
}
