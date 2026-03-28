import { FormEvent, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { AuthPageShell } from "../auth/AuthPageShell"
import { useResendVerificationEmailMutation } from "../services/api/authApi"
import "../vercel-app.css"

type LocationState = { email?: string }

export function CheckEmailPage() {
  const location = useLocation()
  const initialEmail = (location.state as LocationState | null)?.email?.trim() ?? ""
  const [email, setEmail] = useState(initialEmail)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [resend, { isLoading }] = useResendVerificationEmailMutation()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setSent(false)
    try {
      await resend({ email: email.trim() }).unwrap()
      setSent(true)
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string } })?.data
      setError(typeof data?.message === "string" ? data.message : "Could not resend. Try again later.")
    }
  }

  return (
    <AuthPageShell
      title="Verify your email"
      subtitle="We sent a verification link to your inbox. You need to verify before signing in."
      wide
    >
      <p className="va-auth-muted">
        Didn’t get it? Check spam, or resend the verification email below.
      </p>
      <form className="va-login-form" onSubmit={handleSubmit}>
        <label className="va-login-label">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            className="va-login-input"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
        </label>
        {sent ? (
          <div className="va-login-success" role="status">
            If an account exists for that email, we’ve sent a new verification link.
          </div>
        ) : null}
        {error ? (
          <div className="va-login-error" role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" className="va-btn-primary va-login-submit" disabled={isLoading}>
          {isLoading ? "Sending…" : "Resend verification email"}
        </button>
        <div className="va-auth-footer">
          <Link to="/login">Back to sign in</Link>
          <span style={{ color: "var(--va-slate-300)" }} aria-hidden>
            |
          </span>
          <Link to="/register">Create an account</Link>
        </div>
      </form>
    </AuthPageShell>
  )
}
