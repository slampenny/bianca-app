import { FormEvent, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { AuthTextField } from "../components/AuthTextField"
import { AuthPageShell } from "../auth/AuthPageShell"
import { useForgotPasswordMutation } from "../services/api/authApi"
import "../app.css"

export function ForgotPasswordPage() {
  const { t } = useTranslation()
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
      setError(t("forgotPassword.sendError"))
    }
  }

  return (
    <AuthPageShell title={t("forgotPassword.title")} subtitle={t("forgotPassword.subtitle")}>
      {done ? (
        <>
          <p className="va-login-helper" style={{ textAlign: "center", marginBottom: "1rem" }}>
            {t("forgotPassword.doneLine", { email })}
          </p>
          <div className="va-login-success" role="status" data-testid="forgot-password-success">
            {t("forgotPassword.doneSecurity")}
          </div>
          <div className="va-auth-footer">
            <Link to="/login">{t("forgotPassword.backSignIn")}</Link>
          </div>
        </>
      ) : (
        <form className="va-login-form" onSubmit={handleSubmit}>
          <AuthTextField
            label={t("forgotPassword.email")}
            type="email"
            autoComplete="email"
            required
            inputTestId="forgot-password-email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
          {error ? (
            <div className="va-login-error" role="alert">
              {error}
            </div>
          ) : null}
          <button type="submit" className="va-btn-primary va-login-submit" data-testid="forgot-password-submit" disabled={isLoading}>
            {isLoading ? t("forgotPassword.sending") : t("forgotPassword.sendLink")}
          </button>
          <div className="va-auth-footer">
            <Link to="/login">{t("forgotPassword.backSignIn")}</Link>
          </div>
        </form>
      )}
    </AuthPageShell>
  )
}
