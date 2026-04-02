import { FormEvent, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useLoginMutation } from "../services/api/authApi"
import { setAuthTokens, setCurrentUser } from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { useAppDispatch } from "../store/store"
import { parseLoginError } from "../lib/loginError"
import { notifyAuthSuccess } from "../services/api/baseQueryWithAuth"
import "../app.css"

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
      <div className="va-login">
        <div className="va-login-card">
          <p className="va-login-error">MFA session missing. Start from the login page.</p>
          <button type="button" className="va-btn-primary va-login-submit" onClick={() => navigate("/login")}>
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
        setErrorMessage("Invalid code. Please try again.")
        setMfaToken("")
        setLoading(false)
        return
      }

      if ("tokens" in result) {
        dispatch(setAuthTokens(result.tokens))
        dispatch(setCurrentUser(result.caregiver))
        if (result.org) dispatch(setOrg(result.org))
        notifyAuthSuccess()
        navigate("/", { replace: true })
      }
    } catch (err) {
      setErrorMessage(parseLoginError(err).message)
      setMfaToken("")
    } finally {
      setLoading(false)
    }
  }

  const handleBackupShortcut = () => {
    if (mfaToken.length === 8) void handleVerify()
    else setErrorMessage("Backup codes are 8 characters long.")
  }

  return (
    <div className="va-login">
      <div className="va-login-card">
        <div className="va-login-brand">
          <h1 className="va-login-title">Two-factor authentication</h1>
          <p className="va-login-tagline">Enter the code from your authenticator app</p>
        </div>

        <form className="va-login-form" onSubmit={handleVerify}>
          <label className="va-login-label">
            Verification code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="va-login-input"
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
            <div className="va-login-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            className="va-btn-primary va-login-submit"
            disabled={mfaToken.length < 6 || loading}
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            className="va-btn-secondary va-login-secondary"
            disabled={mfaToken.length !== 8 || loading}
            onClick={handleBackupShortcut}
          >
            Use backup code (8 digits)
          </button>
          <button type="button" className="va-login-linkish" onClick={() => navigate("/login")}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  )
}
