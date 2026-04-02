import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AuthPageShell } from "../../auth/AuthPageShell"
import { onboardingCopy } from "../../lib/onboardingCopy"
import type { OnboardingPersona } from "../../lib/onboardingTypes"
import "../../app.css"

const PERSONA_ORDER: OnboardingPersona[] = ["organization", "caregiver", "agingInPlace"]

export function OnboardingAboutYouPage() {
  const navigate = useNavigate()
  const [persona, setPersona] = useState<OnboardingPersona | null>(null)
  const { title, subtitle, options } = onboardingCopy.aboutYou

  const handleContinue = () => {
    if (!persona) return
    navigate("/onboarding/how-it-works", { state: { persona } })
  }

  return (
    <AuthPageShell title={title} subtitle={subtitle} wide>
      <div className="va-onboarding-back">
        <Link to="/login" className="va-btn-ghost">
          ← Back to sign in
        </Link>
      </div>

      <div className="va-onboarding-stack" role="group" aria-label="Who are you signing up as?">
        {PERSONA_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            data-testid={`onboarding-persona-${key}`}
            className={`va-onboarding-choice${persona === key ? " va-onboarding-choice--selected" : ""}`}
            onClick={() => setPersona(key)}
            aria-pressed={persona === key}
          >
            {options[key]}
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
          Continue
        </button>
      </div>

      <div className="va-auth-footer" style={{ marginTop: "1.25rem" }}>
        <span style={{ color: "var(--va-slate-500)" }}>Already registered?</span>
        <Link to="/login">Sign in</Link>
      </div>
    </AuthPageShell>
  )
}
