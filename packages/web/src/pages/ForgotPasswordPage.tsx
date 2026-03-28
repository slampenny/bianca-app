import { FormEvent, useState } from "react"
import { Link } from "react-router-dom"
import { AuthPageShell } from "../auth/AuthPageShell"
import { useForgotPasswordMutation } from "../services/api/authApi"
import "../vercel-app.css"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      await forgotPassword({ email: email.trim() }).unwrap()
      setDone(true)
    } catch {
      setError("Could not send reset email. Check the address and try again.")
    }
  }

  return (
    <AuthPageShell title="Reset password" subtitle="We’ll email you a link to choose a new password.">
      {done ? (
        <>
          <p className="va-login-helper" style={{ textAlign: "center", marginBottom: "1rem" }}>
            If an account exists for <strong>{email}</strong>, you’ll receive an email with reset instructions shortly.
          </p>
          <div className="va-login-success" role="status">
            For security, this message is the same whether or not the email is registered.
          </div>
          <div className="va-auth-footer">
            <Link to="/login">Back to sign in</Link>
          </div>
        </>
      ) : (
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
          {error ? (
            <div className="va-login-error" role="alert">
              {error}
            </div>
          ) : null}
          <button type="submit" className="va-btn-primary va-login-submit" disabled={isLoading}>
            {isLoading ? "Sending…" : "Send reset link"}
          </button>
          <div className="va-auth-footer">
            <Link to="/login">Back to sign in</Link>
          </div>
        </form>
      )}
    </AuthPageShell>
  )
}
