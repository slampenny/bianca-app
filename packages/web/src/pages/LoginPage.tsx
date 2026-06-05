import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useLoginMutation } from "../services/api/authApi"
import { needsOnboarding, resolvePostAuthPath } from "../lib/postAuthNavigation"
import {
  setAuthEmail,
  setAuthTokens,
  setCurrentUser,
  setPendingOnboarding,
  getValidationError,
  getAuthEmail,
} from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { useAppDispatch, useAppSelector } from "../store/store"
import { mapValidationErrorToMessage, parseLoginError } from "../lib/loginError"
import { notifyAuthSuccess } from "../services/api/baseQueryWithAuth"
import { AuthTextField } from "../components/AuthTextField"
import { PasswordField } from "../components/PasswordField"
import { SSOLoginButtons } from "../components/SSOLoginButtons"
import { consumeSsoRedirectError } from "../services/webSsoService"
import { useDocumentTitle } from "../hooks/useDocumentTitle"
import type { AuthTokens, Caregiver, Org } from "../services/api/api.types"
import { shouldShowLoginApiHint } from "../config/api"
import "../app.css"

type LoginLocationState = {
  from?: { pathname: string; search?: string }
  sessionExpired?: boolean
  passwordReset?: boolean
}

export function LoginPage() {
  const { t } = useTranslation()
  useDocumentTitle()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as LoginLocationState

  const [loginApi] = useLoginMutation()
  const validationError = useAppSelector(getValidationError)
  const authEmail = useAppSelector(getAuthEmail)

  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false)

  useEffect(() => {
    if (state.sessionExpired) {
      setErrorMessage(t("login.sessionExpired"))
    }
  }, [state.sessionExpired, t])

  useEffect(() => {
    if (state.passwordReset) {
      setErrorMessage("")
      setNeedsEmailVerification(false)
    }
  }, [state.passwordReset])

  useEffect(() => {
    const msg = consumeSsoRedirectError()
    if (msg) setErrorMessage(msg)
  }, [])

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (validationError) {
      setErrorMessage(mapValidationErrorToMessage(validationError, t))
      return
    }
    setLoading(true)
    setErrorMessage("")
    setNeedsEmailVerification(false)
    try {
      const result = await loginApi({ email: authEmail, password }).unwrap()

      if ("requireMFA" in result && result.requireMFA) {
        setLoading(false)
        navigate("/login/mfa", {
          state: { email: authEmail, password, tempToken: result.tempToken },
        })
        return
      }

      if ("tokens" in result) {
        dispatch(setAuthTokens(result.tokens))
        dispatch(setCurrentUser(result.caregiver))
        dispatch(setPendingOnboarding(needsOnboarding(result.caregiver)))
        if (result.org) dispatch(setOrg(result.org))
        notifyAuthSuccess()
        navigate(resolvePostAuthPath(result.caregiver, state.from), { replace: true })
      }
    } catch (err) {
      const { message, requiresSSOLinking, emailVerificationRequired } = parseLoginError(err, t)
      if (emailVerificationRequired) {
        setErrorMessage(message)
        setNeedsEmailVerification(true)
        setLoading(false)
        return
      }
      if (requiresSSOLinking) {
        setErrorMessage(message)
        setLoading(false)
        return
      }
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="va-login">
      <div className="va-login-card">
        <div className="va-login-brand">
          <span className="va-logo">
            bianca<span className="va-logo-teal">.</span>
          </span>
          <p className="va-login-tagline">{t("login.tagline")}</p>
        </div>

        <form className="va-login-form" onSubmit={handleSubmit}>
          <AuthTextField
            label={t("login.email")}
            type="email"
            autoComplete="email"
            inputTestId="email-input"
            value={authEmail}
            onChange={(e) => dispatch(setAuthEmail(e.target.value))}
          />
          <PasswordField
            label={t("login.password")}
            autoComplete="current-password"
            inputTestId="password-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {state.passwordReset ? (
            <div className="va-login-success" role="status">
              {t("login.passwordResetSuccess")}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="va-login-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          {needsEmailVerification ? (
            <p className="va-login-helper" style={{ textAlign: "center", margin: 0 }}>
              <Link to="/check-email" state={{ email: authEmail }} className="va-link" style={{ fontSize: "inherit" }}>
                {t("login.resendVerificationLink")}
              </Link>
            </p>
          ) : null}

          <button
            type="submit"
            className="va-btn-primary va-login-submit"
            disabled={loading}
            data-testid="login-button"
          >
            {loading ? t("login.signingIn") : t("login.signIn")}
          </button>
        </form>

        <SSOLoginButtons
          disabled={loading}
          onSsoError={(err) => {
            const message = err.description || err.error
            setErrorMessage(
              err.error.includes("not configured")
                ? t("login.ssoNotConfigured", { message })
                : t("login.ssoFailed", { message }),
            )
          }}
          onSsoSuccess={(user) => {
            if (!user.tokens || !user.backendUser) return
            const caregiver = user.backendUser as Caregiver
            dispatch(setAuthTokens(user.tokens as AuthTokens))
            dispatch(setAuthEmail(user.email))
            dispatch(setCurrentUser(caregiver))
            dispatch(setPendingOnboarding(needsOnboarding(caregiver)))
            if (user.backendOrg) dispatch(setOrg(user.backendOrg as Org))
            notifyAuthSuccess()
            navigate(resolvePostAuthPath(caregiver, state.from), { replace: true })
          }}
        />

        <div className="va-auth-footer">
          <Link to="/forgot-password" data-testid="login-forgot-password-link">
            {t("login.forgotPassword")}
          </Link>
          <span style={{ color: "var(--va-slate-300)" }} aria-hidden>
            |
          </span>
          <Link to="/onboarding">{t("register.submit")}</Link>
          <span style={{ color: "var(--va-slate-300)" }} aria-hidden>
            |
          </span>
          <Link to="/signup">{t("login.acceptInvite")}</Link>
        </div>

        {shouldShowLoginApiHint() ? (
          <p className="va-login-hint">
            {t("login.apiLabel")}{" "}
            <code className="va-login-code">{import.meta.env.VITE_API_URL || "http://localhost:3000/v1"}</code>
          </p>
        ) : null}
      </div>
    </div>
  )
}
