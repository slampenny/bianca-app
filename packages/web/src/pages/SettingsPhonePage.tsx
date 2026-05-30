import { FormEvent, useState } from "react"
import { useTranslation } from "react-i18next"
import { AuthTextField } from "../components/AuthTextField"
import { Link, useNavigate } from "react-router-dom"
import { useGetCaregiverQuery } from "../services/api/caregiverApi"
import {
  useResendPhoneVerificationCodeMutation,
  useSendPhoneVerificationCodeMutation,
  useVerifyPhoneCodeMutation,
} from "../services/api/phoneVerificationApi"
import { getCurrentUser, setCurrentUser } from "../store/authSlice"
import { useAppDispatch, useAppSelector } from "../store/store"
import "../app.css"

export function SettingsPhonePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector(getCurrentUser)
  const id = user?.id ? String(user.id) : ""
  const { refetch } = useGetCaregiverQuery({ id }, { skip: !id })

  const [sendCode, { isLoading: sending }] = useSendPhoneVerificationCodeMutation()
  const [verifyCode, { isLoading: verifying }] = useVerifyPhoneCodeMutation()
  const [resend, { isLoading: resending }] = useResendPhoneVerificationCodeMutation()

  const [code, setCode] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleSend = async () => {
    setError("")
    setMessage("")
    try {
      await sendCode({}).unwrap()
      setMessage(t("settingsPhone.sent"))
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || t("settingsPhone.sendError"))
    }
  }

  const handleResend = async () => {
    setError("")
    try {
      await resend().unwrap()
      setMessage(t("settingsPhone.resent"))
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || t("settingsPhone.resendError"))
    }
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (code.trim().length !== 6) {
      setError(t("settingsPhone.enterSix"))
      return
    }
    try {
      await verifyCode({ code: code.trim() }).unwrap()
      const r = await refetch()
      if (r.data) dispatch(setCurrentUser(r.data))
      navigate("/settings", { replace: true })
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || t("settingsPhone.verifyError"))
    }
  }

  return (
    <div data-testid="settings-phone-page" className="va-page-wrap">
      <Link to="/settings" className="va-link" style={{ fontSize: "0.875rem" }}>
        ← {t("settings.backToSettings")}
      </Link>
      <h1 className="va-page-title" style={{ marginTop: "1rem" }}>
        {t("settingsPhone.title")}
      </h1>
      <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", lineHeight: 1.45 }}>
        {t("settingsPhone.subtitleBefore")}
        <strong>{t("settingsPhone.saveProfileStrong")}</strong>
        {t("settingsPhone.subtitleAfter")}
      </p>

      <div className="va-page-section" style={{ marginTop: "1.25rem" }}>
        {message ? (
          <div className="va-login-success" style={{ marginBottom: "1rem" }} role="status">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="va-login-error" style={{ marginBottom: "1rem" }} role="alert">
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "1rem" }}>
          <button type="button" className="va-btn-primary" disabled={sending || !id} onClick={() => void handleSend()}>
            {sending ? t("settingsPhone.sending") : t("settingsPhone.sendCode")}
          </button>
          <button type="button" className="va-btn-secondary" disabled={resending} onClick={() => void handleResend()}>
            {resending ? t("settingsPhone.resendingShort") : t("settingsPhone.resendShort")}
          </button>
        </div>

        <form onSubmit={handleVerify} className="va-login-form">
          <AuthTextField
            label={t("settingsPhone.codeLabel")}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={t("settingsPhone.codeSix")}
          />
          <button type="submit" className="va-btn-primary va-login-submit" disabled={verifying}>
            {verifying ? t("settingsPhone.verifying") : t("settingsPhone.verify")}
          </button>
        </form>
      </div>
    </div>
  )
}
