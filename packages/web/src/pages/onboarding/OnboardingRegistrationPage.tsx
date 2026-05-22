import { FormEvent, useEffect, useState } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { AuthPageShell } from "../../auth/AuthPageShell"
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "../../config/legal"
import { REGISTRATION_COUNTRY_OPTIONS } from "../../lib/registrationCountries"
import { validatePhoneDigits } from "../../lib/passwordRules"
import type { OnboardingRegisterState } from "../../lib/onboardingTypes"
import { useCompleteOnboardingMutation } from "../../services/api/authApi"
import { useUpdateCaregiverMutation } from "../../services/api/caregiverApi"
import { getCurrentUser, isAuthenticated } from "../../store/authSlice"
import { useAppSelector } from "../../store/store"
import "../../app.css"

export function OnboardingRegistrationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const onboarding = (location.state ?? null) as OnboardingRegisterState | null
  const authed = useAppSelector(isAuthenticated)
  const currentUser = useAppSelector(getCurrentUser)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [country, setCountry] = useState("CA")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [singleConsentState, setSingleConsentState] = useState(true)
  const [error, setError] = useState("")

  const [completeOnboarding, { isLoading: isCompleting }] = useCompleteOnboardingMutation()
  const [updateCaregiver, { isLoading: isUpdating }] = useUpdateCaregiverMutation()

  const persona = onboarding?.persona
  const showConsent = persona === "organization" || persona === "caregiver"
  const busy = isCompleting || isUpdating

  useEffect(() => {
    if (!currentUser) return
    setName(currentUser.name || "")
    setEmail(currentUser.email || "")
    setPhone(currentUser.phone || "")
  }, [currentUser])

  if (!authed) {
    return <Navigate to="/login" replace />
  }

  if (!persona) {
    return <Navigate to="/onboarding" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")

    if (!acceptTerms) {
      setError("Please accept the Terms of Service and Privacy Policy.")
      return
    }
    if (!name.trim()) {
      setError("Enter your name.")
      return
    }
    if (phone.trim() && !validatePhoneDigits(phone)) {
      setError("Phone must be at least 10 digits, or +1 followed by 10 digits.")
      return
    }
    if (!currentUser?.id) {
      setError("Session expired. Please sign in again.")
      return
    }

    try {
      const updates: { name?: string; phone?: string } = {}
      if (name.trim() !== (currentUser.name || "")) updates.name = name.trim()
      const normalizedPhone = phone.replace(/\s/g, "")
      if (normalizedPhone !== (currentUser.phone || "")) {
        updates.phone = normalizedPhone || undefined
      }
      if (Object.keys(updates).length > 0) {
        await updateCaregiver({ id: currentUser.id, caregiver: updates }).unwrap()
      }

      await completeOnboarding({
        persona,
        acceptTerms: true,
        ...(showConsent ? { singleConsentState } : {}),
      }).unwrap()

      navigate("/", { replace: true })
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string } })?.data
      setError(typeof data?.message === "string" ? data.message : "Could not save. Please try again.")
    }
  }

  return (
    <AuthPageShell
      title="Finish setting up your account"
      subtitle="Confirm your details and accept our terms to start using Bianca."
      wide
    >
      <div className="va-onboarding-back">
        <button type="button" className="va-btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <form className="va-login-form" onSubmit={handleSubmit} noValidate>
        <label className="va-login-label">
          Full name
          <input
            className="va-login-input"
            data-testid="onboarding-reg-name"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            autoComplete="name"
          />
        </label>

        <label className="va-login-label">
          Email
          <input
            className="va-login-input"
            data-testid="onboarding-reg-email"
            value={email}
            readOnly
            style={{ opacity: 0.75 }}
          />
        </label>

        <label className="va-login-label">
          Phone
          <input
            className="va-login-input"
            data-testid="onboarding-reg-phone"
            value={phone}
            onChange={(ev) => setPhone(ev.target.value)}
            autoComplete="tel"
            placeholder="Optional but recommended"
          />
        </label>

        <label className="va-login-label">
          Country / region
          <select
            className="va-login-input"
            value={country}
            onChange={(ev) => setCountry(ev.target.value)}
          >
            {REGISTRATION_COUNTRY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="va-login-label" style={{ flexDirection: "row", alignItems: "flex-start", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(ev) => setAcceptTerms(ev.target.checked)}
            data-testid="onboarding-reg-terms"
          />
          <span style={{ fontWeight: 400, lineHeight: 1.5 }}>
            I have read and accept the{" "}
            <a href={TERMS_OF_SERVICE_URL} target="_blank" rel="noreferrer" className="va-link">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="va-link">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {showConsent ? (
          <fieldset className="va-login-label" style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              Are you in a single-consent jurisdiction?
            </legend>
            <p className="va-auth-muted" style={{ marginTop: 0 }}>
              In some regions only one party must consent to recorded wellness calls. Choose what applies to your
              organization.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className={singleConsentState ? "va-btn-primary" : "va-btn-secondary"}
                onClick={() => setSingleConsentState(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={!singleConsentState ? "va-btn-primary" : "va-btn-secondary"}
                onClick={() => setSingleConsentState(false)}
              >
                No
              </button>
            </div>
          </fieldset>
        ) : null}

        {error ? (
          <div className="va-login-error" role="alert">
            {error}
          </div>
        ) : null}

        <button type="submit" className="va-btn-primary va-login-submit" disabled={busy} data-testid="onboarding-reg-save">
          {busy ? "Saving…" : "Save and continue"}
        </button>
      </form>

      <div className="va-auth-footer" style={{ marginTop: "1.25rem" }}>
        <Link to="/">Go to dashboard</Link>
      </div>
    </AuthPageShell>
  )
}
