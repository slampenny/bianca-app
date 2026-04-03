import { type FormEvent, useEffect, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { SSOLoginButtons } from "../components/SSOLoginButtons"
import { useLoginMutation } from "../services/api/authApi"
import type { AuthTokens, Caregiver } from "../services/api/api.types"
import { consumeSsoRedirectError } from "../services/webSsoService"
import { setAuthEmail, setAuthTokens, setCurrentUser, getValidationError, getAuthEmail } from "../store/authSlice"
import { useAppDispatch, useAppSelector } from "../store/store"
import { mapValidationErrorToMessage, parseLoginError } from "../lib/loginError"
import { PasswordField } from "../components/PasswordField"

type LoginLocationState = {
  from?: { pathname: string; search?: string }
}

export function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const state = (location.state || {}) as LoginLocationState

  const [loginApi] = useLoginMutation()
  const validationError = useAppSelector(getValidationError)
  const authEmail = useAppSelector(getAuthEmail)

  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get("expired")) {
      setErrorMessage("Session expired. Please sign in again.")
    }
  }, [searchParams])

  useEffect(() => {
    const msg = consumeSsoRedirectError()
    if (msg) setErrorMessage(msg)
  }, [])

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (validationError) {
      setErrorMessage(mapValidationErrorToMessage(validationError))
      return
    }
    setLoading(true)
    setErrorMessage("")
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
        const next = searchParams.get("next")
        const fromPath =
          next ||
          (state.from && typeof state.from.pathname === "string"
            ? `${state.from.pathname}${state.from.search || ""}`
            : "/")
        navigate(fromPath || "/", { replace: true })
      }
    } catch (err) {
      setErrorMessage(parseLoginError(err).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-shell">
      <div className="admin-card admin-card--narrow">
        <div className="admin-brand">
          <span className="admin-badge">Admin</span>
          <h1 className="admin-title">Bianca console</h1>
          <p className="admin-muted">Super administrators only — observability and ops.</p>
        </div>
        <form className="admin-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="admin-label">
            Email
            <input
              type="email"
              autoComplete="username"
              className="admin-input"
              value={authEmail}
              onChange={(e) => dispatch(setAuthEmail(e.target.value.trim()))}
            />
          </label>
          <label className="admin-label">
            Password
            <PasswordField autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {errorMessage ? (
            <p className="admin-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <button type="submit" className="admin-btn admin-btn--primary admin-btn--block" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <SSOLoginButtons
          disabled={loading}
          onSsoError={(err) => {
            const message = err.description || err.error
            setErrorMessage(
              err.error.includes("not configured")
                ? `Single sign-on is not available: ${message}`
                : `Sign-in failed: ${message}`,
            )
          }}
          onSsoSuccess={(user) => {
            if (!user.tokens || !user.backendUser) return
            dispatch(setAuthTokens(user.tokens as AuthTokens))
            dispatch(setAuthEmail(user.email))
            dispatch(setCurrentUser(user.backendUser as Caregiver))
            const next = searchParams.get("next")
            const fromPath =
              next ||
              (state.from && typeof state.from.pathname === "string"
                ? `${state.from.pathname}${state.from.search || ""}`
                : "/")
            navigate(fromPath || "/", { replace: true })
          }}
        />
      </div>
    </div>
  )
}
