import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"
import { useVerifyConsentMutation } from "../services/api/clientApi"
import "../app.css"

/**
 * Public page for client consent links from email — same backend as mobile `ClientConsentScreen`
 * (`GET /v1/clients/consent/verify?token=...`).
 */
export function ClientConsentPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")?.trim() || ""
  const [verifyConsent] = useVerifyConsentMutation()
  const [status, setStatus] = useState<"verifying" | "success" | "error">(() => (token ? "verifying" : "error"))
  const [message, setMessage] = useState(() => (token ? "" : t("clientConsent.missingToken")))

  useEffect(() => {
    if (!token) return

    let cancelled = false

    verifyConsent({ token })
      .unwrap()
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setStatus("success")
          setMessage(res.message || t("clientConsent.successDefault"))
        } else {
          setStatus("error")
          setMessage(res.message || t("clientConsent.errorDefault"))
        }
      })
      .catch((err: { data?: { error?: string; message?: string }; message?: string }) => {
        if (cancelled) return
        setStatus("error")
        setMessage(
          err?.data?.error ||
            err?.data?.message ||
            err?.message ||
            t("clientConsent.expiredLink"),
        )
      })

    return () => {
      cancelled = true
    }
  }, [token, verifyConsent, t])

  const title =
    status === "success"
      ? t("clientConsent.titleSuccess")
      : status === "error" && !token
        ? t("clientConsent.titleMissing")
        : status === "error"
          ? t("clientConsent.titleError")
          : t("clientConsent.titleVerifying")

  return (
    <div className="va-login">
      <div className="va-login-card" style={{ maxWidth: 480 }}>
        <div className="va-login-brand">
          <span className="va-logo">
            bianca<span className="va-logo-teal">.</span>
          </span>
          <h1 className="va-login-title" style={{ marginTop: "0.75rem" }}>
            {title}
          </h1>
        </div>

        {status === "verifying" ? (
          <p className="va-login-tagline" style={{ textAlign: "center" }}>
            {t("clientConsent.verifying")}
          </p>
        ) : null}

        {status === "success" ? (
          <>
            <div className="va-login-success" role="status" style={{ marginBottom: "1rem" }}>
              {message}
            </div>
            <p className="va-login-helper" style={{ textAlign: "center" }}>
              {t("clientConsent.closeWindow")}
            </p>
          </>
        ) : null}

        {status === "error" ? (
          <div className="va-login-error" role="alert">
            {message}
          </div>
        ) : null}

        {status === "error" && token ? (
          <p className="va-login-helper" style={{ textAlign: "center", marginTop: "0.75rem" }}>
            {t("clientConsent.needNewLink")}
          </p>
        ) : null}

        <div className="va-auth-footer" style={{ justifyContent: "center", marginTop: "1.5rem" }}>
          <Link to="/login">{t("clientConsent.staffSignIn")}</Link>
        </div>
      </div>
    </div>
  )
}
