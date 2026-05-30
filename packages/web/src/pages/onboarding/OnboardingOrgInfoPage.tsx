import { FormEvent, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { AuthSelectField } from "../../components/AuthSelectField"
import { AuthTextField } from "../../components/AuthTextField"
import { AuthPageShell } from "../../auth/AuthPageShell"
import type { OnboardingOrgInfoState, OnboardingRegisterState } from "../../lib/onboardingTypes"
import { useOrgTimezoneOptions, useRegistrationCountryOptions } from "../../hooks/useGeoOptions"
import { isAuthenticated } from "../../store/authSlice"
import { useAppSelector } from "../../store/store"
import "../../app.css"

export function OnboardingOrgInfoPage() {
  const { t } = useTranslation()
  const countryOptions = useRegistrationCountryOptions()
  const timezoneOptions = useOrgTimezoneOptions()
  const navigate = useNavigate()
  const location = useLocation()
  const authed = useAppSelector(isAuthenticated)
  const state = location.state as OnboardingOrgInfoState | null

  if (!state || state.persona !== "organization") {
    return <Navigate to="/onboarding" replace />
  }

  const [orgName, setOrgName] = useState("")
  const [country, setCountry] = useState("US")
  const [timezone, setTimezone] = useState("America/New_York")

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!orgName.trim()) return
    const next: OnboardingRegisterState = {
      persona: "organization",
      orgName: orgName.trim(),
      orgCountry: country,
      orgTimezone: timezone,
    }
    navigate(authed ? "/onboarding/register" : "/register", { state: next })
  }

  return (
    <AuthPageShell title={t("onboarding.orgInfo.title")} subtitle={t("onboarding.orgInfo.subtitle")} wide>
      <div className="va-onboarding-back">
        <button type="button" className="va-btn-ghost" onClick={() => navigate(-1)}>
          {t("onboarding.registration.back")}
        </button>
      </div>

      <form className="va-login-form" onSubmit={handleSubmit}>
        <AuthTextField
          label={t("onboarding.orgInfo.orgNameLabel")}
          value={orgName}
          onChange={(ev) => setOrgName(ev.target.value)}
          placeholder={t("onboarding.orgInfo.orgNamePlaceholder")}
          autoComplete="organization"
        />

        <AuthSelectField label={t("onboarding.orgInfo.countryLabel")} value={country} onChange={(ev) => setCountry(ev.target.value)}>
          {countryOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </AuthSelectField>

        <AuthSelectField label={t("onboarding.orgInfo.timezoneLabel")} value={timezone} onChange={(ev) => setTimezone(ev.target.value)}>
          {timezoneOptions.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </AuthSelectField>

        <button type="submit" className="va-btn-primary va-login-submit" disabled={!orgName.trim()}>
          {t("onboarding.continue")}
        </button>
      </form>

      <div className="va-auth-footer" style={{ marginTop: "1.25rem" }}>
        <Link to="/login">{t("onboarding.signInLink")}</Link>
      </div>
    </AuthPageShell>
  )
}
