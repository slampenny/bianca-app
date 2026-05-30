import { FormEvent, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { AuthTextField } from "../components/AuthTextField"
import { AuthPageShell } from "../auth/AuthPageShell"
import { useResendVerificationEmailMutation } from "../services/api/authApi"
import "../app.css"

type LocationState = { email?: string }

export function CheckEmailPage() {
  const { t } = useTranslation()
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
      setError(typeof data?.message === "string" ? data.message : t("checkEmail.resendFailed"))
    }
  }

  return (
    <AuthPageShell title={t("checkEmail.title")} subtitle={t("checkEmail.subtitle")} wide>
      <div data-testid="check-email-page">
        <p className="va-auth-muted">{t("checkEmail.hint")}</p>
        <form className="va-login-form" onSubmit={handleSubmit}>
          <AuthTextField
            label={t("checkEmail.email")}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
          {sent ? (
            <div className="va-login-success" role="status">
              {t("checkEmail.sent")}
            </div>
          ) : null}
          {error ? (
            <div className="va-login-error" role="alert">
              {error}
            </div>
          ) : null}
          <button type="submit" className="va-btn-primary va-login-submit" disabled={isLoading}>
            {isLoading ? t("checkEmail.sending") : t("checkEmail.resend")}
          </button>
          <div className="va-auth-footer">
            <Link to="/login">{t("checkEmail.backSignIn")}</Link>
            <span style={{ color: "var(--va-slate-300)" }} aria-hidden>
              |
            </span>
            <Link to="/register">{t("checkEmail.createAccount")}</Link>
          </div>
        </form>
      </div>
    </AuthPageShell>
  )
}
