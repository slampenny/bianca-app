import { FormEvent, useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useLoginMutation } from "../services/api/authApi"
import {
  setAuthEmail,
  setAuthTokens,
  setCurrentUser,
  getValidationError,
  getAuthEmail,
} from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { useAppDispatch, useAppSelector } from "../store/store"
import { mapValidationErrorToMessage, parseLoginError } from "../lib/loginError"
import { notifyAuthSuccess } from "../services/api/baseQueryWithAuth"
import { PasswordField } from "../components/PasswordField"
import "../app.css"

type LoginLocationState = {
  from?: { pathname: string; search?: string }
  sessionExpired?: boolean
  passwordReset?: boolean
}

export function LoginPage() {
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
      setErrorMessage("Your session has expired. Please sign in again.")
    }
  }, [state.sessionExpired])

  useEffect(() => {
    if (state.passwordReset) {
      setErrorMessage("")
      setNeedsEmailVerification(false)
    }
  }, [state.passwordReset])

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (validationError) {
      setErrorMessage(mapValidationErrorToMessage(validationError))
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
        if (result.org) dispatch(setOrg(result.org))
        notifyAuthSuccess()
        const to =
          state.from && typeof state.from.pathname === "string"
            ? `${state.from.pathname}${state.from.search || ""}`
            : "/"
        navigate(to, { replace: true })
      }
    } catch (err) {
      const { message, requiresSSOLinking, emailVerificationRequired } = parseLoginError(err)
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
          <p className="va-login-tagline">Sign in to continue to the facility dashboard</p>
        </div>

        <form className="va-login-form" onSubmit={handleSubmit}>
          <label className="va-login-label">
            Email
            <input
              type="email"
              autoComplete="email"
              className="va-login-input"
              data-testid="email-input"
              value={authEmail}
              onChange={(e) => dispatch(setAuthEmail(e.target.value))}
            />
          </label>
          <label className="va-login-label">
            Password
            <PasswordField
              autoComplete="current-password"
              inputTestId="password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {state.passwordReset ? (
            <div className="va-login-success" role="status">
              Your password was updated. Sign in with your new password.
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
                Resend verification email
              </Link>
            </p>
          ) : null}

          <button
            type="submit"
            className="va-btn-primary va-login-submit"
            disabled={loading}
            data-testid="login-button"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="va-auth-footer">
          <Link to="/forgot-password" data-testid="login-forgot-password-link">
            Forgot password?
          </Link>
          <span style={{ color: "var(--va-slate-300)" }} aria-hidden>
            |
          </span>
          <Link to="/onboarding">Create account</Link>
          <span style={{ color: "var(--va-slate-300)" }} aria-hidden>
            |
          </span>
          <Link to="/signup">Accept invite</Link>
        </div>

        <p className="va-login-hint">
          API:{" "}
          <code className="va-login-code">{import.meta.env.VITE_API_URL || "http://localhost:3000/v1"}</code>
        </p>
      </div>
    </div>
  )
}
