import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { AuthPageShell } from "../../auth/AuthPageShell"
import type { OnboardingPersona } from "../../lib/onboardingTypes"
import "../../app.css"

const PERSONA_ORDER: OnboardingPersona[] = ["organization", "caregiver", "agingInPlace"]

export function OnboardingAboutYouPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [persona, setPersona] = useState<OnboardingPersona | null>(null)

  const handleContinue = () => {
    if (!persona) return
    navigate("/onboarding/how-it-works", { state: { persona } })
  }

  return (
    <AuthPageShell title={t("onboarding.aboutYou.title")} subtitle={t("onboarding.aboutYou.subtitle")} wide>
      <div className="va-onboarding-back">
        <Link to="/login" className="va-btn-ghost">
          {t("onboarding.registration.backSignIn")}
        </Link>
      </div>

      <div className="va-onboarding-stack" role="group" aria-label={t("onboarding.whoAreYouAria")}>
        {PERSONA_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            data-testid={`onboarding-persona-${key}`}
            className={`va-onboarding-choice${persona === key ? " va-onboarding-choice--selected" : ""}`}
            onClick={() => setPersona(key)}
            aria-pressed={persona === key}
          >
            {t(`onboarding.aboutYou.${key}`)}
          </button>
        ))}
      </div>

      <div style={{ marginTop: "2rem" }}>
        <button
          type="button"
          className="va-btn-primary va-login-submit"
          data-testid="onboarding-about-you-continue"
          disabled={!persona}
          onClick={handleContinue}
        >
          {t("onboarding.continue")}
        </button>
      </div>

      <div className="va-auth-footer" style={{ marginTop: "1.25rem" }}>
        <span style={{ color: "var(--va-slate-500)" }}>{t("onboarding.alreadyRegistered")}</span>
        <Link to="/login">{t("onboarding.signInLink")}</Link>
      </div>
    </AuthPageShell>
  )
}
