import { type FormEvent, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useLoginMutation } from "../services/api/authApi"
import { setAuthTokens, setCurrentUser } from "../store/authSlice"
import { useAppDispatch } from "../store/store"
import { parseLoginError } from "../lib/loginError"

type MfaState = {
  email: string
  password: string
  tempToken: string
}

export function MFAPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const [loginApi] = useLoginMutation()

  const creds = location.state as MfaState | null
  const email = creds?.email ?? ""
  const password = creds?.password ?? ""

  const [mfaToken, setMfaToken] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [loading, setLoading] = useState(false)

  if (!email || !password) {
    return (
      <div className="admin-shell">
        <div className="admin-card admin-card--narrow">
          <p className="admin-error">MFA session missing. Start from the login page.</p>
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => navigate("/login")}>
            Go to login
          </button>
        </div>
      </div>
    )
  }

  const handleVerify = async (e?: FormEvent) => {
    e?.preventDefault()
    if (mfaToken.length !== 6 && mfaToken.length !== 8) {
      setErrorMessage("Enter a 6-digit code or 8-character backup code.")
      return
    }

    setLoading(true)
    setErrorMessage("")
    try {
      const result = await loginApi({
        email,
        password,
        mfaToken: mfaToken.trim(),
      }).unwrap()

      if ("requireMFA" in result && result.requireMFA) {
        setErrorMessage("Invalid code. Try again.")
        setMfaToken("")
        setLoading(false)
        return
      }

      if ("tokens" in result) {
        dispatch(setAuthTokens(result.tokens))
        dispatch(setCurrentUser(result.caregiver))
        navigate("/", { replace: true })
      }
    } catch (err) {
      setErrorMessage(parseLoginError(err).message)
      setMfaToken("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-shell">
      <div className="admin-card admin-card--narrow">
        <div className="admin-brand">
          <h1 className="admin-title">Two-factor authentication</h1>
          <p className="admin-muted">Code from your authenticator app</p>
        </div>
        <form className="admin-form" onSubmit={(e) => void handleVerify(e)}>
          <label className="admin-label">
            Verification code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="admin-input"
              value={mfaToken}
              onChange={(e) => {
                const d = e.target.value.replace(/[^0-9]/g, "").slice(0, 8)
                setMfaToken(d)
                setErrorMessage("")
              }}
              autoFocus
            />
          </label>
          {errorMessage ? (
            <p className="admin-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <button type="submit" className="admin-btn admin-btn--primary admin-btn--block" disabled={loading}>
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>
      </div>
    </div>
  )
}
