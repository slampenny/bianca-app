import { FormEvent, useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { AuthPageShell } from "../auth/AuthPageShell"
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "../config/legal"
import { REGISTRATION_COUNTRY_OPTIONS } from "../lib/registrationCountries"
import { validatePasswordRules, validatePhoneDigits } from "../lib/passwordRules"
import { useRegisterMutation } from "../services/api/authApi"
import { PasswordField } from "../components/PasswordField"
import type { OnboardingRegisterState } from "../lib/onboardingTypes"
import "../app.css"

type AccountType = "individual" | "organization"

export function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const onboarding = (location.state ?? null) as OnboardingRegisterState | null

  const [accountType, setAccountType] = useState<AccountType>("individual")
  const [organizationName, setOrganizationName] = useState("")
  const [country, setCountry] = useState("CA")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")

  const [register, { isLoading }] = useRegisterMutation()

  useEffect(() => {
    if (!onboarding?.persona) return
    if (onboarding.persona === "organization") {
      setAccountType("organization")
      if (onboarding.orgName) setOrganizationName(onboarding.orgName)
      if (onboarding.orgCountry) setCountry(onboarding.orgCountry)
    } else {
      setAccountType("individual")
      if (onboarding.orgCountry) setCountry(onboarding.orgCountry)
    }
    if (onboarding.orgTimezone) {
      try {
        sessionStorage.setItem("bianca_onboarding_org_timezone", onboarding.orgTimezone)
      } catch {
        /* ignore quota / private mode */
      }
    }
  }, [onboarding])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")

    const displayName = name.trim()
    if (accountType === "individual" && !displayName) {
      setError("Enter your full name.")
      return
    }
    if (accountType === "organization" && !organizationName.trim()) {
      setError("Organization name is required.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.")
      return
    }
    const pw = validatePasswordRules(password)
    if (pw) {
      setError(pw)
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    if (!validatePhoneDigits(phone)) {
      setError("Phone must be at least 10 digits, or +1 followed by 10 digits.")
      return
    }

    const apiName = accountType === "organization" ? organizationName.trim() : displayName

    try {
      const result = await register({
        name: apiName,
        email: email.trim(),
        password,
        phone: phone.replace(/\s/g, ""),
        country,
      }).unwrap()

      if (result.requiresEmailVerification) {
        navigate("/check-email", { replace: true, state: { email: email.trim() } })
        return
      }
      navigate("/check-email", { replace: true, state: { email: email.trim() } })
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string } })?.data
      setError(typeof data?.message === "string" ? data.message : "Registration failed. Try again.")
    }
  }

  return (
    <AuthPageShell
      title="Create account"
      subtitle={
        onboarding?.persona
          ? "Finish creating your account. You can still adjust details below."
          : "Register your organization to use the facility dashboard."
      }
      wide
    >
      <div className="va-auth-segment" role="group" aria-label="Account type">
        <button
          type="button"
          data-testid="register-account-individual"
          className={accountType === "individual" ? "va-auth-segment--active" : ""}
          onClick={() => setAccountType("individual")}
        >
          Individual
        </button>
        <button
          type="button"
          data-testid="register-account-organization"
          className={accountType === "organization" ? "va-auth-segment--active" : ""}
          onClick={() => setAccountType("organization")}
        >
          Organization
        </button>
      </div>
      <p className="va-auth-muted">
        {accountType === "individual"
          ? "For a personal or single-site account, your name will be used as the organization name on your profile."
          : "For a facility or company, use your official organization name."}
      </p>

      <form className="va-login-form" onSubmit={handleSubmit} noValidate>
        {accountType === "organization" ? (
          <label className="va-login-label">
            Organization name
            <input
              className="va-login-input"
              data-testid="register-organization-name"
              value={organizationName}
              onChange={(ev) => setOrganizationName(ev.target.value)}
              autoComplete="organization"
            />
          </label>
        ) : null}

        <label className="va-login-label">
          Country / region
          <select
            className="va-login-input"
            data-testid="register-country"
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

        <label className="va-login-label">
          {accountType === "organization" ? "Your name" : "Full name"}
          <input
            className="va-login-input"
            data-testid="register-name"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            autoComplete="name"
          />
        </label>

        <label className="va-login-label">
          Email
          <input
            type="email"
            autoComplete="email"
            className="va-login-input"
            data-testid="register-email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
        </label>

        <label className="va-login-label">
          Phone
          <input
            className="va-login-input"
            data-testid="register-phone"
            value={phone}
            onChange={(ev) => setPhone(ev.target.value)}
            autoComplete="tel"
          />
        </label>

        <label className="va-login-label">
          Password
          <PasswordField
            autoComplete="new-password"
            inputTestId="register-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
        </label>
        <p className="va-login-helper">At least 8 characters, with at least one letter and one number.</p>

        <label className="va-login-label">
          Confirm password
          <PasswordField
            autoComplete="new-password"
            inputTestId="register-confirm-password"
            value={confirm}
            onChange={(ev) => setConfirm(ev.target.value)}
          />
        </label>

        {error ? (
          <div className="va-login-error" role="alert">
            {error}
          </div>
        ) : null}

        <p className="va-login-helper" style={{ textAlign: "center" }}>
          By registering you agree to our{" "}
          <a href={TERMS_OF_SERVICE_URL} target="_blank" rel="noreferrer">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          .
        </p>

        <button type="submit" className="va-btn-primary va-login-submit" data-testid="register-submit" disabled={isLoading}>
          {isLoading ? "Creating account…" : "Create account"}
        </button>

        <div className="va-auth-footer">
          <span style={{ color: "var(--va-slate-500)" }}>Already registered?</span>
          <Link to="/login">Sign in</Link>
          {!onboarding?.persona ? (
            <>
              <span style={{ color: "var(--va-slate-300)" }} aria-hidden>
                |
              </span>
              <Link to="/onboarding">New here? Start the tour</Link>
            </>
          ) : null}
        </div>
      </form>
    </AuthPageShell>
  )
}
