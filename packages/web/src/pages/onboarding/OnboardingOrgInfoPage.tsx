import { FormEvent, useState } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { AuthPageShell } from "../../auth/AuthPageShell"
import { onboardingCopy } from "../../lib/onboardingCopy"
import type { OnboardingOrgInfoState, OnboardingRegisterState } from "../../lib/onboardingTypes"
import { REGISTRATION_COUNTRY_OPTIONS } from "../../lib/registrationCountries"
import { ORG_TIMEZONE_OPTIONS } from "../../lib/orgTimezones"
import { isAuthenticated } from "../../store/authSlice"
import { useAppSelector } from "../../store/store"
import "../../app.css"

export function OnboardingOrgInfoPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const authed = useAppSelector(isAuthenticated)
  const state = location.state as OnboardingOrgInfoState | null

  if (!state || state.persona !== "organization") {
    return <Navigate to="/onboarding" replace />
  }

  const { title, subtitle, orgNameLabel, orgNamePlaceholder, countryLabel, timezoneLabel } = onboardingCopy.orgInfo

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
    <AuthPageShell title={title} subtitle={subtitle} wide>
      <div className="va-onboarding-back">
        <button type="button" className="va-btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <form className="va-login-form" onSubmit={handleSubmit}>
        <label className="va-login-label">
          {orgNameLabel}
          <input
            className="va-login-input"
            value={orgName}
            onChange={(ev) => setOrgName(ev.target.value)}
            placeholder={orgNamePlaceholder}
            autoComplete="organization"
          />
        </label>

        <label className="va-login-label">
          {countryLabel}
          <select className="va-login-input" value={country} onChange={(ev) => setCountry(ev.target.value)}>
            {REGISTRATION_COUNTRY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="va-login-label">
          {timezoneLabel}
          <select className="va-login-input" value={timezone} onChange={(ev) => setTimezone(ev.target.value)}>
            {ORG_TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="va-btn-primary va-login-submit" disabled={!orgName.trim()}>
          Continue
        </button>
      </form>

      <div className="va-auth-footer" style={{ marginTop: "1.25rem" }}>
        <Link to="/login">Sign in</Link>
      </div>
    </AuthPageShell>
  )
}
