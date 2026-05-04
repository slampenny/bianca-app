import { FormEvent, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  useDisableMFAMutation,
  useEnableMFAMutation,
  useGetMFAStatusQuery,
  useRegenerateBackupCodesMutation,
  useVerifyAndEnableMFAMutation,
} from "../services/api/mfaApi"
import { ConfirmModal } from "../components/ConfirmModal"
import "../app.css"

export function SettingsMfaPage() {
  const { data: mfaStatus, isLoading: statusLoading, refetch } = useGetMFAStatusQuery()
  const [enableMFA, { isLoading: enabling }] = useEnableMFAMutation()
  const [verifyMFA, { isLoading: verifying }] = useVerifyAndEnableMFAMutation()
  const [disableMFA, { isLoading: disabling }] = useDisableMFAMutation()
  const [regenCodes, { isLoading: regening }] = useRegenerateBackupCodesMutation()

  const [step, setStep] = useState<"intro" | "verify" | "done" | "manage">("intro")
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [otp, setOtp] = useState("")
  const [disableOtp, setDisableOtp] = useState("")
  const [regenOtp, setRegenOtp] = useState("")
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)

  useEffect(() => {
    if (!mfaStatus) return
    if (step === "verify") return
    if (mfaStatus.mfaEnabled) {
      setStep("manage")
    } else {
      setStep("intro")
    }
  }, [mfaStatus, step])

  const startEnable = async () => {
    setError("")
    try {
      const r = await enableMFA().unwrap()
      setQrCode(r.qrCode)
      setSecret(r.secret)
      setBackupCodes(r.backupCodes || [])
      setStep("verify")
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || "Could not start MFA setup.")
    }
  }

  const submitVerify = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (otp.trim().length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.")
      return
    }
    try {
      await verifyMFA({ token: otp.trim() }).unwrap()
      setInfo("Multi-factor authentication is on.")
      setStep("manage")
      setOtp("")
      void refetch()
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || "Invalid code.")
      setOtp("")
    }
  }

  const submitDisable = (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (disableOtp.trim().length !== 6) {
      setError("Enter your current 6-digit code to disable MFA.")
      return
    }
    setShowDisableConfirm(true)
  }

  const performDisable = async () => {
    setError("")
    try {
      await disableMFA({ token: disableOtp.trim() }).unwrap()
      setDisableOtp("")
      setInfo("MFA has been disabled.")
      setStep("intro")
      setShowDisableConfirm(false)
      void refetch()
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || "Could not disable MFA.")
    }
  }

  const submitRegen = (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (regenOtp.trim().length !== 6) {
      setError("Enter your 6-digit code to regenerate backup codes.")
      return
    }
    setShowRegenConfirm(true)
  }

  const performRegen = async () => {
    setError("")
    try {
      const r = await regenCodes({ token: regenOtp.trim() }).unwrap()
      setBackupCodes(r.backupCodes || [])
      setRegenOtp("")
      setInfo("New backup codes generated — save them in a safe place.")
      setShowRegenConfirm(false)
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || "Could not regenerate codes.")
    }
  }

  return (
    <div data-testid="settings-mfa-page" className="va-page-wrap">
      <Link to="/settings" className="va-link" style={{ fontSize: "0.875rem" }}>
        ← Back to settings
      </Link>
      <h1 className="va-page-title" style={{ marginTop: "1rem" }}>
        Multi-factor authentication
      </h1>
      <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", lineHeight: 1.45 }}>
        Use an authenticator app (Google Authenticator, Authy, etc.) for a second sign-in step.
      </p>

      {statusLoading ? (
        <p style={{ color: "var(--va-slate-500)" }}>Loading…</p>
      ) : (
        <div className="va-page-section" style={{ marginTop: "1.25rem" }}>
          {info ? (
            <div className="va-login-success" style={{ marginBottom: "1rem" }} role="status">
              {info}
            </div>
          ) : null}
          {error ? (
            <div className="va-login-error" style={{ marginBottom: "1rem" }} role="alert">
              {error}
            </div>
          ) : null}

          {step === "intro" && (
            <>
              <p style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
                Status: <strong>off</strong>
              </p>
              <button type="button" className="va-btn-primary" style={{ width: "100%" }} disabled={enabling} onClick={() => void startEnable()}>
                {enabling ? "Starting…" : "Set up authenticator"}
              </button>
            </>
          )}

          {step === "verify" && qrCode && (
            <>
              <p style={{ fontSize: "0.8125rem", marginBottom: "0.75rem" }}>Scan this QR code, then enter the 6-digit code.</p>
              <img src={qrCode} alt="Authenticator QR code" style={{ width: 200, height: 200, display: "block", margin: "0 auto 1rem" }} />
              {secret ? (
                <p style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", wordBreak: "break-all", marginBottom: "1rem" }}>
                  Manual key: <code>{secret}</code>
                </p>
              ) : null}
              {backupCodes.length > 0 ? (
                <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--va-slate-50)", borderRadius: 8, fontSize: "0.75rem" }}>
                  <strong>One-time backup codes</strong> (save now):
                  <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
                    {backupCodes.map((c) => (
                      <li key={c} style={{ fontFamily: "monospace" }}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <form onSubmit={submitVerify} className="va-login-form" style={{ gap: "0.75rem" }}>
                <label className="va-login-label">
                  Verification code
                  <input
                    className="va-login-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(ev) => setOtp(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                  />
                </label>
                <button type="submit" className="va-btn-primary" disabled={verifying}>
                  {verifying ? "Verifying…" : "Confirm & enable"}
                </button>
                <button type="button" className="va-btn-secondary va-login-secondary" onClick={() => setStep("intro")}>
                  Cancel
                </button>
              </form>
            </>
          )}

          {step === "manage" && mfaStatus?.mfaEnabled && (
            <>
              <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                Status: <strong>on</strong>
              </p>
              <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)", marginBottom: "1.25rem" }}>
                Backup codes remaining: <strong>{mfaStatus.backupCodesRemaining}</strong>
              </p>

              <form onSubmit={submitRegen} style={{ marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 8 }}>Regenerate backup codes</p>
                <label className="va-login-label">
                  Current 6-digit code
                  <input
                    className="va-login-input"
                    inputMode="numeric"
                    value={regenOtp}
                    onChange={(ev) => setRegenOtp(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </label>
                <button type="submit" className="va-btn-secondary va-login-secondary" disabled={regening} style={{ marginTop: 8 }}>
                  {regening ? "Working…" : "Regenerate backup codes"}
                </button>
              </form>

              {backupCodes.length > 0 ? (
                <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--va-emerald-100)", borderRadius: 8, fontSize: "0.75rem" }}>
                  <strong>New backup codes</strong>
                  <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
                    {backupCodes.map((c) => (
                      <li key={c} style={{ fontFamily: "monospace" }}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <form onSubmit={submitDisable}>
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 8 }}>Turn off MFA</p>
                <label className="va-login-label">
                  Current 6-digit code
                  <input
                    className="va-login-input"
                    inputMode="numeric"
                    value={disableOtp}
                    onChange={(ev) => setDisableOtp(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </label>
                <button
                  type="submit"
                  className="va-btn-secondary va-login-secondary"
                  disabled={disabling}
                  style={{ marginTop: 8, borderColor: "var(--va-red-200)", color: "var(--va-red-700)" }}
                >
                  {disabling ? "Disabling…" : "Disable MFA"}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={showDisableConfirm}
        title="Disable multi-factor authentication?"
        onClose={() => setShowDisableConfirm(false)}
        onConfirm={() => void performDisable()}
        confirmLabel={disabling ? "Disabling…" : "Disable MFA"}
        confirmDisabled={disabling}
      >
        <p style={{ margin: 0 }}>Your account will be less protected.</p>
      </ConfirmModal>

      <ConfirmModal
        open={showRegenConfirm}
        title="Regenerate backup codes?"
        onClose={() => setShowRegenConfirm(false)}
        onConfirm={() => void performRegen()}
        confirmLabel={regening ? "Working…" : "Continue"}
        confirmDisabled={regening}
      >
        <p style={{ margin: 0 }}>Old backup codes will stop working.</p>
      </ConfirmModal>
    </div>
  )
}
