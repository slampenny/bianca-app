import { FormEvent, useState } from "react"
import { useTranslation } from "react-i18next"
import { AuthTextField } from "../components/AuthTextField"
import { useLocation, useNavigate } from "react-router-dom"
import { useLoginMutation } from "../services/api/authApi"
import { setAuthTokens, setCurrentUser } from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { useAppDispatch } from "../store/store"
import { parseLoginError } from "../lib/loginError"
import { notifyAuthSuccess } from "../services/api/baseQueryWithAuth"
import { useDocumentTitle } from "../hooks/useDocumentTitle"
import "../app.css"

type MfaState = {
  email: string
  password: string
  tempToken: string
}

export function MFAPage() {
  const { t } = useTranslation()
  useDocumentTitle()
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
          <p className="va-login-error">{t("mfaLogin.sessionMissing")}</p>
          <button type="button" className="va-btn-primary va-login-submit" onClick={() => navigate("/login")}>
            {t("mfaLogin.goToLogin")}
          </button>
        </div>
      </div>
    )
  }

  const handleVerify = async (e?: FormEvent) => {
    e?.preventDefault()
    if (mfaToken.length !== 6 && mfaToken.length !== 8) {
      setErrorMessage(t("mfaLogin.codeHint"))
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
        setErrorMessage(t("mfaLogin.invalidCode"))
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
      setErrorMessage(parseLoginError(err, t).message)
      setMfaToken("")
    } finally {
      setLoading(false)
    }
  }

  const handleBackupShortcut = () => {
    if (mfaToken.length === 8) void handleVerify()
    else setErrorMessage(t("mfaLogin.backupLength"))
  }

  return (
    <div className="va-login">
      <div className="va-login-card">
        <div className="va-login-brand">
          <h1 className="va-login-title">{t("mfaLogin.title")}</h1>
          <p className="va-login-tagline">{t("mfaLogin.tagline")}</p>
        </div>

        <form className="va-login-form" onSubmit={handleVerify}>
          <AuthTextField
            label={t("mfaLogin.verificationCode")}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={mfaToken}
            onChange={(e) => {
              const d = e.target.value.replace(/[^0-9]/g, "").slice(0, 8)
              setMfaToken(d)
              setErrorMessage("")
            }}
            autoFocus
          />

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
            {loading ? t("mfaLogin.verifying") : t("mfaLogin.verify")}
          </button>
          <button
            type="button"
            className="va-btn-secondary va-login-secondary"
            disabled={mfaToken.length !== 8 || loading}
            onClick={handleBackupShortcut}
          >
            {t("mfaLogin.useBackupButton")}
          </button>
          <button type="button" className="va-login-linkish" onClick={() => navigate("/login")}>
            {t("mfaLogin.cancel")}
          </button>
        </form>
      </div>
    </div>
  )
}
