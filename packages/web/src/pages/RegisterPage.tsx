import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { AuthPageShell } from "../auth/AuthPageShell"
import { AuthSelectField } from "../components/AuthSelectField"
import { AuthTextField } from "../components/AuthTextField"
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "../config/legal"
import { useRegistrationCountryOptions } from "../hooks/useGeoOptions"
import { validatePhoneDigits } from "../lib/passwordRules"
import { validatePasswordRulesI18n } from "../lib/passwordI18n"
import { useRegisterMutation } from "../services/api/authApi"
import { PasswordField } from "../components/PasswordField"
import type { OnboardingRegisterState } from "../lib/onboardingTypes"
import "../app.css"

type AccountType = "individual" | "organization"

export function RegisterPage() {
  const { t } = useTranslation()
  const countryOptions = useRegistrationCountryOptions()
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
      setError(t("register.errors.nameRequired"))
      return
    }
    if (accountType === "organization" && !organizationName.trim()) {
      setError(t("register.errors.orgNameRequired"))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t("register.errors.emailInvalid"))
      return
    }
    const pw = validatePasswordRulesI18n(password, t)
    if (pw) {
      setError(pw)
      return
    }
    if (password !== confirm) {
      setError(t("register.errors.passwordMismatch"))
      return
    }
    if (!validatePhoneDigits(phone)) {
      setError(t("register.errors.phoneInvalid"))
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
      setError(typeof data?.message === "string" ? data.message : t("register.errors.failed"))
    }
  }

  return (
    <AuthPageShell
      title={t("register.title")}
      subtitle={onboarding?.persona ? t("register.subtitleOnboarding") : t("register.subtitle")}
      wide
    >
      <div className="va-auth-segment" role="group" aria-label={t("register.accountTypeAria")}>
        <button
          type="button"
          data-testid="register-account-individual"
          className={accountType === "individual" ? "va-auth-segment--active" : ""}
          onClick={() => setAccountType("individual")}
        >
          {t("register.individual")}
        </button>
        <button
          type="button"
          data-testid="register-account-organization"
          className={accountType === "organization" ? "va-auth-segment--active" : ""}
          onClick={() => setAccountType("organization")}
        >
          {t("register.organization")}
        </button>
      </div>
      <p className="va-auth-muted">
        {accountType === "individual" ? t("register.individualHint") : t("register.orgHint")}
      </p>

      <form className="va-login-form" onSubmit={handleSubmit} noValidate>
        {accountType === "organization" ? (
          <AuthTextField
            label={t("register.orgName")}
            autoComplete="organization"
            inputTestId="register-organization-name"
            value={organizationName}
            onChange={(ev) => setOrganizationName(ev.target.value)}
          />
        ) : null}

        <AuthSelectField
          label={t("register.country")}
          selectTestId="register-country"
          value={country}
          onChange={(ev) => setCountry(ev.target.value)}
        >
          {countryOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </AuthSelectField>

        <AuthTextField
          label={accountType === "organization" ? t("register.yourName") : t("register.fullName")}
          inputTestId="register-name"
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          autoComplete="name"
        />

        <AuthTextField
          label={t("register.email")}
          type="email"
          autoComplete="email"
          inputTestId="register-email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
        />

        <AuthTextField
          label={t("register.phone")}
          inputTestId="register-phone"
          value={phone}
          onChange={(ev) => setPhone(ev.target.value)}
          autoComplete="tel"
        />

        <PasswordField
          label={t("register.password")}
          autoComplete="new-password"
          inputTestId="register-password"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
        />
        <p className="va-login-helper">{t("register.passwordRulesHint")}</p>

        <PasswordField
          label={t("register.confirmPassword")}
          autoComplete="new-password"
          inputTestId="register-confirm-password"
          value={confirm}
          onChange={(ev) => setConfirm(ev.target.value)}
        />

        {error ? (
          <div className="va-login-error" role="alert">
            {error}
          </div>
        ) : null}

        <p className="va-login-helper" style={{ textAlign: "center" }}>
          {t("register.termsPrefix")}{" "}
          <a href={TERMS_OF_SERVICE_URL} target="_blank" rel="noreferrer">
            {t("register.termsLink")}
          </a>{" "}
          {t("register.and")}{" "}
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
            {t("register.privacyLink")}
          </a>
          .
        </p>

        <button type="submit" className="va-btn-primary va-login-submit" data-testid="register-submit" disabled={isLoading}>
          {isLoading ? t("register.creating") : t("register.submit")}
        </button>

        <div className="va-auth-footer">
          <span style={{ color: "var(--va-slate-500)" }}>{t("register.alreadyRegistered")}</span>
          <Link to="/login">{t("register.signIn")}</Link>
          {!onboarding?.persona ? (
            <>
              <span style={{ color: "var(--va-slate-300)" }} aria-hidden>
                |
              </span>
              <Link to="/onboarding">{t("register.startTour")}</Link>
            </>
          ) : null}
        </div>
      </form>
    </AuthPageShell>
  )
}
