import { FormEvent, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AuthPageShell } from "../auth/AuthPageShell"
import { useResetPasswordMutation } from "../services/api/authApi"
import { validatePasswordRulesI18n } from "../lib/passwordI18n"
import { PasswordField } from "../components/PasswordField"
import "../app.css"

export function ResetPasswordPage() {
  const { t } = useTranslation()
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
      setError(t("resetPassword.missingToken"))
      return
    }
    const pwErr = validatePasswordRulesI18n(password, t)
    if (pwErr) {
      setError(pwErr)
      return
    }
    if (password !== confirm) {
      setError(t("resetPassword.passwordMismatch"))
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
      setError(typeof data?.message === "string" ? data.message : t("resetPassword.failed"))
    }
  }

  return (
    <AuthPageShell title={t("resetPassword.title")} subtitle={t("resetPassword.subtitle")}>
      {!token ? (
        <div className="va-login-error" role="alert">
          {t("resetPassword.invalidLink")}
        </div>
      ) : (
        <form className="va-login-form" onSubmit={handleSubmit}>
          <PasswordField
            label={t("resetPassword.newPassword")}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            autoComplete="new-password"
          />
          <p className="va-login-helper">{t("resetPassword.rulesHint")}</p>
          <PasswordField
            label={t("resetPassword.confirm")}
            value={confirm}
            onChange={(ev) => setConfirm(ev.target.value)}
            autoComplete="new-password"
          />
          {error ? (
            <div className="va-login-error" role="alert">
              {error}
            </div>
          ) : null}
          <button type="submit" className="va-btn-primary va-login-submit" disabled={isLoading}>
            {isLoading ? t("resetPassword.updating") : t("resetPassword.update")}
          </button>
        </form>
      )}
      <div className="va-auth-footer">
        <Link to="/login">{t("resetPassword.backSignIn")}</Link>
      </div>
    </AuthPageShell>
  )
}
