import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useVerifyConsentMutation } from "../services/api/clientApi"
import "../app.css"

/**
 * Public page for client consent links from email — same backend as mobile `ClientConsentScreen`
 * (`GET /v1/clients/consent/verify?token=...`).
 */
export function ClientConsentPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")?.trim() || ""
  const [verifyConsent] = useVerifyConsentMutation()
  const [status, setStatus] = useState<"verifying" | "success" | "error">(() => (token ? "verifying" : "error"))
  const [message, setMessage] = useState(() =>
    token ? "" : "Consent token is missing. Please use the link from your email.",
  )

  useEffect(() => {
    if (!token) return

    let cancelled = false

    verifyConsent({ token })
      .unwrap()
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setStatus("success")
          setMessage(res.message || "Your consent has been recorded. Thank you.")
        } else {
          setStatus("error")
          setMessage(res.message || "We could not complete consent.")
        }
      })
      .catch((err: { data?: { error?: string; message?: string }; message?: string }) => {
        if (cancelled) return
        setStatus("error")
        setMessage(
          err?.data?.error ||
            err?.data?.message ||
            err?.message ||
            "Invalid or expired consent link. Please contact your care organization for a new link.",
        )
      })

    return () => {
      cancelled = true
    }
  }, [token, verifyConsent])

  const title =
    status === "success" ? "Consent confirmed" : status === "error" && !token ? "Consent" : status === "error" ? "Could not confirm consent" : "Verifying consent"

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
            Please wait while we confirm your consent…
          </p>
        ) : null}

        {status === "success" ? (
          <>
            <div className="va-login-success" role="status" style={{ marginBottom: "1rem" }}>
              {message}
            </div>
            <p className="va-login-helper" style={{ textAlign: "center" }}>
              You can close this window.
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
            Contact your care organization if you need a new consent link.
          </p>
        ) : null}

        <div className="va-auth-footer" style={{ justifyContent: "center", marginTop: "1.5rem" }}>
          <Link to="/login">Staff sign in</Link>
        </div>
      </div>
    </div>
  )
}
