import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  useDisableMFAMutation,
  useEnableMFAMutation,
  useGetMFAStatusQuery,
  useRegenerateBackupCodesMutation,
  useVerifyAndEnableMFAMutation,
} from "../services/api/mfaApi"
import { AuthTextField } from "../components/AuthTextField"
import { ConfirmModal } from "../components/ConfirmModal"
import "../app.css"

export function SettingsMfaPage() {
  const { t } = useTranslation()
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
      setError((e as { data?: { message?: string } })?.data?.message || t("settingsMfa.startError"))
    }
  }

  const submitVerify = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (otp.trim().length !== 6) {
      setError(t("settingsMfa.enterSix"))
      return
    }
    try {
      await verifyMFA({ token: otp.trim() }).unwrap()
      setInfo(t("settingsMfa.enabledInfo"))
      setStep("manage")
      setOtp("")
      void refetch()
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || t("settingsMfa.invalidCode"))
      setOtp("")
    }
  }

  const submitDisable = (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (disableOtp.trim().length !== 6) {
      setError(t("settingsMfa.disableSix"))
      return
    }
    setShowDisableConfirm(true)
  }

  const performDisable = async () => {
    setError("")
    try {
      await disableMFA({ token: disableOtp.trim() }).unwrap()
      setDisableOtp("")
      setInfo(t("settingsMfa.disabledInfo"))
      setStep("intro")
      setShowDisableConfirm(false)
      void refetch()
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || t("settingsMfa.disableError"))
    }
  }

  const submitRegen = (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (regenOtp.trim().length !== 6) {
      setError(t("settingsMfa.regenSix"))
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
      setInfo(t("settingsMfa.regenInfo"))
      setShowRegenConfirm(false)
    } catch (e: unknown) {
      setError((e as { data?: { message?: string } })?.data?.message || t("settingsMfa.regenError"))
    }
  }

  return (
    <div data-testid="settings-mfa-page" className="va-page-wrap">
      <Link to="/settings" className="va-link" style={{ fontSize: "0.875rem" }} data-testid="settings-back-link">
        ← {t("settings.backToSettings")}
      </Link>
      <h1 className="va-page-title" style={{ marginTop: "1rem" }}>
        {t("settingsMfa.title")}
      </h1>
      <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", lineHeight: 1.45 }}>
        {t("settingsMfa.subtitle")}
      </p>

      {statusLoading ? (
        <p style={{ color: "var(--va-slate-500)" }}>{t("profile.loadingProfile")}</p>
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
              <p style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>{t("settingsMfa.statusOff")}</p>
              <button type="button" className="va-btn-primary" style={{ width: "100%" }} disabled={enabling} onClick={() => void startEnable()}>
                {enabling ? t("settingsMfa.starting") : t("settingsMfa.setupAuthenticator")}
              </button>
            </>
          )}

          {step === "verify" && qrCode && (
            <>
              <p style={{ fontSize: "0.8125rem", marginBottom: "0.75rem" }}>{t("settingsMfa.scanQr")}</p>
              <img src={qrCode} alt={t("settingsMfa.qrAlt")} style={{ width: 200, height: 200, display: "block", margin: "0 auto 1rem" }} />
              {secret ? (
                <p style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", wordBreak: "break-all", marginBottom: "1rem" }}>
                  {t("settingsMfa.manualKeyPrefix")} <code>{secret}</code>
                </p>
              ) : null}
              {backupCodes.length > 0 ? (
                <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--va-slate-50)", borderRadius: 8, fontSize: "0.75rem" }}>
                  <strong>{t("settingsMfa.backupCodesStrong")}</strong>
                  {t("settingsMfa.backupCodesSaveSuffix")}
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
                <AuthTextField
                  label={t("settingsMfa.verificationCode")}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(ev) => setOtp(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                />
                <button type="submit" className="va-btn-primary" disabled={verifying}>
                  {verifying ? t("settingsMfa.verifying") : t("settingsMfa.confirmEnable")}
                </button>
                <button type="button" className="va-btn-secondary va-login-secondary" onClick={() => setStep("intro")}>
                  {t("settingsMfa.cancel")}
                </button>
              </form>
            </>
          )}

          {step === "manage" && mfaStatus?.mfaEnabled && (
            <>
              <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>{t("settingsMfa.statusOn")}</p>
              <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)", marginBottom: "1.25rem" }}>
                {t("settingsMfa.backupRemaining", { count: mfaStatus.backupCodesRemaining })}
              </p>

              <form onSubmit={submitRegen} style={{ marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 8 }}>{t("settingsMfa.regenSection")}</p>
                <AuthTextField
                  label={t("settingsMfa.currentCode")}
                  inputMode="numeric"
                  value={regenOtp}
                  onChange={(ev) => setRegenOtp(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <button type="submit" className="va-btn-secondary va-login-secondary" disabled={regening} style={{ marginTop: 8 }}>
                  {regening ? t("settingsMfa.working") : t("settingsMfa.regenButton")}
                </button>
              </form>

              {backupCodes.length > 0 ? (
                <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--va-emerald-100)", borderRadius: 8, fontSize: "0.75rem" }}>
                  <strong>{t("settingsMfa.newBackupTitle")}</strong>
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
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 8 }}>{t("settingsMfa.turnOff")}</p>
                <AuthTextField
                  label={t("settingsMfa.currentCode")}
                  inputMode="numeric"
                  value={disableOtp}
                  onChange={(ev) => setDisableOtp(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <button
                  type="submit"
                  className="va-btn-secondary va-login-secondary"
                  disabled={disabling}
                  style={{ marginTop: 8, borderColor: "var(--va-red-200)", color: "var(--va-red-700)" }}
                >
                  {disabling ? t("settingsMfa.disabling") : t("settingsMfa.disableMfa")}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={showDisableConfirm}
        title={t("settingsMfa.disableConfirmTitle")}
        onClose={() => setShowDisableConfirm(false)}
        onConfirm={() => void performDisable()}
        confirmLabel={disabling ? t("settingsMfa.disabling") : t("settingsMfa.disableMfa")}
        confirmDisabled={disabling}
      >
        <p style={{ margin: 0 }}>{t("settingsMfa.disableConfirmBody")}</p>
      </ConfirmModal>

      <ConfirmModal
        open={showRegenConfirm}
        title={t("settingsMfa.regenConfirmTitle")}
        onClose={() => setShowRegenConfirm(false)}
        onConfirm={() => void performRegen()}
        confirmLabel={regening ? t("settingsMfa.working") : t("settingsMfa.regenContinue")}
        confirmDisabled={regening}
      >
        <p style={{ margin: 0 }}>{t("settingsMfa.regenConfirmBody")}</p>
      </ConfirmModal>
    </div>
  )
}
