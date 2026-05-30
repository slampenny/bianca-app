import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AuthPageShell } from "../auth/AuthPageShell"
import { useVerifyEmailQuery } from "../services/api/authApi"
import { normalizeOrgForStore } from "../lib/normalizeOrg"
import { needsOnboarding, resolvePostAuthPath } from "../lib/postAuthNavigation"
import { setAuthEmail, setAuthTokens, setCurrentUser, setPendingOnboarding } from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { useAppDispatch } from "../store/store"
import { notifyAuthSuccess } from "../services/api/baseQueryWithAuth"
import "../app.css"

function errorText(err: unknown, fallback: string): string {
  const e = err as { status?: number; data?: { error?: string; message?: string } }
  if (e.data && typeof e.data === "object") {
    if (typeof e.data.error === "string") return e.data.error
    if (typeof e.data.message === "string") return e.data.message
  }
  return fallback
}

export function VerifyEmailPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const appliedSession = useRef(false)

  const { data, error, isLoading, isSuccess } = useVerifyEmailQuery({ token }, { skip: !token })

  useEffect(() => {
    if (appliedSession.current) return
    if (!isSuccess || !data?.tokens || !data.caregiver) return
    appliedSession.current = true
    dispatch(setAuthTokens(data.tokens))
    dispatch(setCurrentUser(data.caregiver))
    dispatch(setPendingOnboarding(needsOnboarding(data.caregiver)))
    dispatch(setAuthEmail(data.caregiver.email))
    const org = normalizeOrgForStore(data.org)
    if (org) dispatch(setOrg(org))
    else dispatch(setOrg(null))
    notifyAuthSuccess()
    navigate(resolvePostAuthPath(data.caregiver), { replace: true })
  }, [isSuccess, data, dispatch, navigate])

  return (
    <AuthPageShell title={t("verifyEmail.title")} subtitle={t("verifyEmail.subtitle")}>
      {!token ? (
        <div className="va-login-error" role="alert">
          {t("verifyEmail.missingToken")}
        </div>
      ) : null}
      {token && isLoading ? <p className="va-auth-muted">{t("verifyEmail.pleaseWait")}</p> : null}
      {token && error ? (
        <div className="va-login-error" role="alert">
          {errorText(error, t("verifyEmail.failed"))}
        </div>
      ) : null}
      {token && isSuccess && data && !data.success ? (
        <div className="va-login-error" role="alert">
          {data.error || t("verifyEmail.notCompleted")}
        </div>
      ) : null}
      {token && isSuccess && data?.tokens && data?.caregiver ? (
        <p className="va-auth-muted">{t("verifyEmail.signingIn")}</p>
      ) : null}
      <div className="va-auth-footer">
        <Link to="/login">{t("verifyEmail.backSignIn")}</Link>
        <span style={{ color: "var(--va-slate-300)" }} aria-hidden>
          |
        </span>
        <Link to="/check-email">{t("verifyEmail.resend")}</Link>
      </div>
    </AuthPageShell>
  )
}
