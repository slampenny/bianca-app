import { FormEvent, useState } from "react"
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
      setMessage("We sent a 6-digit code to the phone number on your profile.")
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || "Could not send code.")
    }
  }

  const handleResend = async () => {
    setError("")
    try {
      await resend().unwrap()
      setMessage("A new code has been sent.")
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || "Could not resend.")
    }
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code.")
      return
    }
    try {
      await verifyCode({ code: code.trim() }).unwrap()
      const r = await refetch()
      if (r.data) dispatch(setCurrentUser(r.data))
      navigate("/settings", { replace: true })
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || "Invalid or expired code.")
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <Link to="/settings" className="va-link" style={{ fontSize: "0.875rem" }}>
        ← Back to settings
      </Link>
      <h1 className="va-page-title" style={{ marginTop: "1rem" }}>
        Verify phone
      </h1>
      <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", lineHeight: 1.45 }}>
        We’ll text a code to the phone number on your account. If you just changed it, go back and click <strong>Save profile</strong> first.
      </p>

      <div className="va-card va-card-pad" style={{ marginTop: "1.25rem" }}>
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
            {sending ? "Sending…" : "Send code"}
          </button>
          <button type="button" className="va-btn-secondary" disabled={resending} onClick={() => void handleResend()}>
            {resending ? "…" : "Resend"}
          </button>
        </div>

        <form onSubmit={handleVerify} className="va-login-form">
          <label className="va-login-label">
            6-digit code
            <input
              className="va-login-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
            />
          </label>
          <button type="submit" className="va-btn-primary va-login-submit" disabled={verifying}>
            {verifying ? "Verifying…" : "Verify phone"}
          </button>
        </form>
      </div>
    </div>
  )
}
