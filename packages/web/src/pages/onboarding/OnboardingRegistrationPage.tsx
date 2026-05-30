import { FormEvent, useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { AuthCheckboxField } from "../../components/AuthCheckboxField"
import { AuthSelectField } from "../../components/AuthSelectField"
import { AuthTextField } from "../../components/AuthTextField"
import { AuthPageShell } from "../../auth/AuthPageShell"
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "../../config/legal"
import { useRegistrationCountryOptions } from "../../hooks/useGeoOptions"
import { validatePhoneDigits } from "../../lib/passwordRules"
import type { OnboardingRegisterState } from "../../lib/onboardingTypes"
import { useCompleteOnboardingMutation } from "../../services/api/authApi"
import { useUpdateCaregiverMutation } from "../../services/api/caregiverApi"
import { getCurrentUser, isAuthenticated } from "../../store/authSlice"
import { useAppSelector } from "../../store/store"
import "../../app.css"

export function OnboardingRegistrationPage() {
  const { t } = useTranslation()
  const consentLegendId = useId()
  const countryOptions = useRegistrationCountryOptions()
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
      setError(t("onboarding.registration.errors.termsRequired"))
      return
    }
    if (!name.trim()) {
      setError(t("onboarding.registration.errors.nameRequired"))
      return
    }
    if (phone.trim() && !validatePhoneDigits(phone)) {
      setError(t("onboarding.registration.errors.phoneInvalid"))
      return
    }
    if (!currentUser?.id) {
      setError(t("onboarding.registration.errors.sessionExpired"))
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
      setError(typeof data?.message === "string" ? data.message : t("onboarding.registration.errors.saveFailed"))
    }
  }

  return (
    <AuthPageShell title={t("onboarding.registration.title")} subtitle={t("onboarding.registration.subtitle")} wide>
      <div className="va-onboarding-back">
        <button type="button" className="va-btn-ghost" onClick={() => navigate(-1)}>
          {t("onboarding.registration.back")}
        </button>
      </div>

      <form className="va-login-form" onSubmit={handleSubmit} noValidate>
        <AuthTextField
          label={t("onboarding.registration.fullName")}
          inputTestId="onboarding-reg-name"
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          autoComplete="name"
        />

        <AuthTextField
          label={t("onboarding.registration.email")}
          inputTestId="onboarding-reg-email"
          value={email}
          readOnly
          disabled
        />

        <AuthTextField
          label={t("onboarding.registration.phone")}
          inputTestId="onboarding-reg-phone"
          value={phone}
          onChange={(ev) => setPhone(ev.target.value)}
          autoComplete="tel"
          placeholder={t("onboarding.registration.phonePlaceholder")}
        />

        <AuthSelectField label={t("onboarding.registration.country")} value={country} onChange={(ev) => setCountry(ev.target.value)}>
          {countryOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </AuthSelectField>

        <AuthCheckboxField
          inputTestId="onboarding-reg-terms"
          checked={acceptTerms}
          onChange={(ev) => setAcceptTerms(ev.target.checked)}
          label={
            <>
              {t("onboarding.registration.acceptTermsIntro")}{" "}
              <a href={TERMS_OF_SERVICE_URL} target="_blank" rel="noreferrer" className="va-link">
                {t("register.termsLink")}
              </a>{" "}
              {t("register.and")}{" "}
              <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="va-link">
                {t("register.privacyLink")}
              </a>
              .
            </>
          }
        />

        {showConsent ? (
          <fieldset className="va-login-label" style={{ border: "none", padding: 0, margin: 0 }}>
            <legend id={consentLegendId} style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              {t("onboarding.registration.singleConsentLegend")}
            </legend>
            <p className="va-auth-muted" style={{ marginTop: 0 }}>
              {t("onboarding.registration.singleConsentHelper")}
            </p>
            <div role="radiogroup" aria-labelledby={consentLegendId} style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <label
                className={singleConsentState ? "va-btn-primary" : "va-btn-secondary"}
                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", margin: 0 }}
              >
                <input
                  type="radio"
                  name="singleConsentState"
                  className="sr-only"
                  checked={singleConsentState}
                  onChange={() => setSingleConsentState(true)}
                  data-testid="onboarding-reg-consent-yes"
                />
                {t("onboarding.registration.yes")}
              </label>
              <label
                className={!singleConsentState ? "va-btn-primary" : "va-btn-secondary"}
                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", margin: 0 }}
              >
                <input
                  type="radio"
                  name="singleConsentState"
                  className="sr-only"
                  checked={!singleConsentState}
                  onChange={() => setSingleConsentState(false)}
                  data-testid="onboarding-reg-consent-no"
                />
                {t("onboarding.registration.no")}
              </label>
            </div>
          </fieldset>
        ) : null}

        {error ? (
          <div className="va-login-error" role="alert">
            {error}
          </div>
        ) : null}

        <button type="submit" className="va-btn-primary va-login-submit" disabled={busy} data-testid="onboarding-reg-save">
          {busy ? t("onboarding.registration.saving") : t("onboarding.registration.saveContinue")}
        </button>
      </form>

      <div className="va-auth-footer" style={{ marginTop: "1.25rem" }}>
        <Link to="/">{t("onboarding.registration.goToDashboard")}</Link>
      </div>
    </AuthPageShell>
  )
}
