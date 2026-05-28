import { useCallback, useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useLazyValidateConsentTokenQuery, useSubmitClientConsentMutation } from "../services/api/clientApi"
import "../app.css"

type ConsentPurpose = "recording" | "transcription" | "aiAnalysis" | "familyReports"

const PURPOSE_META: Record<
  ConsentPurpose,
  { label: string; description: string }
> = {
  recording: {
    label: "Call recording",
    description:
      "Record wellness check calls for quality assurance and care coordination. Calls can still occur without recording if you decline.",
  },
  transcription: {
    label: "Call transcription",
    description: "Convert call audio into text so caregivers can review conversations and provide better support.",
  },
  aiAnalysis: {
    label: "AI analysis",
    description: "Use AI to analyze call content and generate wellness insights for your care team.",
  },
  familyReports: {
    label: "Family wellness reports",
    description:
      "Share weekly call summaries with an authorized emergency contact or family member you designate.",
  },
}

const ALL_PURPOSES: ConsentPurpose[] = ["recording", "transcription", "aiAnalysis", "familyReports"]

/**
 * Public page for client consent links from email — explicit per-purpose opt-in (GDPR).
 */
export function ClientConsentPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")?.trim() || ""
  const [validateToken, { isFetching: isValidating }] = useLazyValidateConsentTokenQuery()
  const [submitConsent, { isLoading: isSubmitting }] = useSubmitClientConsentMutation()

  const [status, setStatus] = useState<"loading" | "form" | "success" | "error">(() =>
    token ? "loading" : "error",
  )
  const [message, setMessage] = useState(() =>
    token ? "" : "Consent token is missing. Please use the link from your email.",
  )
  const [clientName, setClientName] = useState("")
  const [orgName, setOrgName] = useState("")
  const [selected, setSelected] = useState<Record<ConsentPurpose, boolean>>({
    recording: false,
    transcription: false,
    aiAnalysis: false,
    familyReports: false,
  })
  const [alreadyGranted, setAlreadyGranted] = useState<Record<ConsentPurpose, boolean>>({
    recording: false,
    transcription: false,
    aiAnalysis: false,
    familyReports: false,
  })

  useEffect(() => {
    if (!token) return

    let cancelled = false

    validateToken({ token })
      .unwrap()
      .then((res) => {
        if (cancelled) return
        setClientName(res.clientName || "")
        setOrgName(res.orgName || "")
        const granted = res.consentedPurposes || {}
        const grantedMap = ALL_PURPOSES.reduce(
          (acc, purpose) => {
            acc[purpose] = granted[purpose] === true
            return acc
          },
          {} as Record<ConsentPurpose, boolean>,
        )
        setAlreadyGranted(grantedMap)
        setStatus("form")
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
  }, [token, validateToken])

  const togglePurpose = useCallback((purpose: ConsentPurpose) => {
    setSelected((prev) => ({ ...prev, [purpose]: !prev[purpose] }))
  }, [])

  const handleSubmit = useCallback(async () => {
    const purposes = ALL_PURPOSES.filter((p) => selected[p] && !alreadyGranted[p])
    if (purposes.length === 0) {
      setMessage("Select at least one purpose you have not already consented to.")
      return
    }

    try {
      const res = await submitConsent({ token, purposes }).unwrap()
      setStatus("success")
      setMessage(res.message || "Your consent has been recorded. Thank you.")
    } catch (err: unknown) {
      const e = err as { data?: { error?: string; message?: string }; message?: string }
      setStatus("error")
      setMessage(
        e?.data?.error ||
          e?.data?.message ||
          e?.message ||
          "We could not save your consent. Please contact your care organization for help.",
      )
    }
  }, [alreadyGranted, selected, submitConsent, token])

  const title =
    status === "success"
      ? "Consent recorded"
      : status === "error" && !token
        ? "Consent"
        : status === "error"
          ? "Could not save consent"
          : status === "loading"
            ? "Loading consent form"
            : "Your consent preferences"

  return (
    <div className="va-login">
      <div className="va-login-card" style={{ maxWidth: 520 }}>
        <div className="va-login-brand">
          <span className="va-logo">
            bianca<span className="va-logo-teal">.</span>
          </span>
          <h1 className="va-login-title" style={{ marginTop: "0.75rem" }}>
            {title}
          </h1>
        </div>

        {status === "loading" || isValidating ? (
          <p className="va-login-tagline" style={{ textAlign: "center" }}>
            Please wait while we load your consent options…
          </p>
        ) : null}

        {status === "form" ? (
          <>
            <p className="va-login-helper" style={{ marginBottom: "1rem" }}>
              {clientName ? `Hello ${clientName}, ` : ""}
              {orgName
                ? `${orgName} uses Bianca Wellness for wellness check calls. `
                : "Your care organization uses Bianca Wellness. "}
              Select each purpose you consent to. Nothing is pre-selected — submit only when you are ready.
            </p>

            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend className="sr-only">Consent purposes</legend>
              {ALL_PURPOSES.map((purpose) => {
                const meta = PURPOSE_META[purpose]
                const isGranted = alreadyGranted[purpose]
                return (
                  <label
                    key={purpose}
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      alignItems: "flex-start",
                      marginBottom: "1rem",
                      cursor: isGranted ? "default" : "pointer",
                      opacity: isGranted ? 0.7 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isGranted || selected[purpose]}
                      disabled={isGranted}
                      onChange={() => togglePurpose(purpose)}
                      style={{ marginTop: "0.25rem" }}
                    />
                    <span>
                      <strong>{meta.label}</strong>
                      {isGranted ? (
                        <span style={{ marginLeft: "0.5rem", color: "var(--va-teal, #0d9488)" }}>
                          (already on file)
                        </span>
                      ) : null}
                      <br />
                      <span className="va-login-helper">{meta.description}</span>
                    </span>
                  </label>
                )
              })}
            </fieldset>

            {message && status === "form" ? (
              <div className="va-login-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                {message}
              </div>
            ) : null}

            <button
              type="button"
              className="va-btn va-btn-primary"
              style={{ width: "100%" }}
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? "Saving…" : "Submit selected consents"}
            </button>
          </>
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
