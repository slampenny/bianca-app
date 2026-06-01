import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"
import { useVerifyFamilyDigestEmailMutation } from "../services/api/clientApi"
import "../app.css"

/**
 * Public page for family digest email verification links from email.
 * (`GET /v1/clients/family-digest-email/verify?token=...`).
 */
export function FamilyDigestEmailVerifyPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")?.trim() || ""
  const [verifyEmail] = useVerifyFamilyDigestEmailMutation()
  const [status, setStatus] = useState<"verifying" | "success" | "error">(() => (token ? "verifying" : "error"))
  const [message, setMessage] = useState(() => (token ? "" : t("familyDigestEmailVerify.missingToken")))

  useEffect(() => {
    if (!token) return

    let cancelled = false

    verifyEmail({ token })
      .unwrap()
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setStatus("success")
          setMessage(res.message || t("familyDigestEmailVerify.successDefault"))
        } else {
          setStatus("error")
          setMessage(res.message || t("familyDigestEmailVerify.errorDefault"))
        }
      })
      .catch((err: { data?: { error?: string; message?: string }; message?: string }) => {
        if (cancelled) return
        setStatus("error")
        setMessage(
          err?.data?.error ||
            err?.data?.message ||
            err?.message ||
            t("familyDigestEmailVerify.expiredLink"),
        )
      })

    return () => {
      cancelled = true
    }
  }, [token, verifyEmail, t])

  const title =
    status === "success"
      ? t("familyDigestEmailVerify.titleSuccess")
      : status === "error" && !token
        ? t("familyDigestEmailVerify.titleMissing")
        : status === "error"
          ? t("familyDigestEmailVerify.titleError")
          : t("familyDigestEmailVerify.titleVerifying")

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
            {t("familyDigestEmailVerify.verifying")}
          </p>
        ) : null}

        {status === "success" ? (
          <>
            <div className="va-login-success" role="status" style={{ marginBottom: "1rem" }}>
              {message}
            </div>
            <p className="va-login-helper" style={{ textAlign: "center" }}>
              {t("familyDigestEmailVerify.closeWindow")}
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
            {t("familyDigestEmailVerify.needNewLink")}
          </p>
        ) : null}

        <div className="va-auth-footer" style={{ justifyContent: "center", marginTop: "1.5rem" }}>
          <Link to="/login">{t("familyDigestEmailVerify.staffSignIn")}</Link>
        </div>
      </div>
    </div>
  )
}
