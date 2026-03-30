import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { AuthPageShell } from "../../auth/AuthPageShell"
import { onboardingCopy } from "../../lib/onboardingCopy"
import type { OnboardingHowItWorksState } from "../../lib/onboardingTypes"
import "../../app.css"

export function OnboardingHowItWorksPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as OnboardingHowItWorksState | null
  const persona = state?.persona

  if (!persona) {
    return <Navigate to="/onboarding" replace />
  }

  const { title, next, getStarted, byPersona } = onboardingCopy.howItWorks
  const body = byPersona[persona]
  const isAgingInPlace = persona === "agingInPlace"
  const buttonLabel = isAgingInPlace ? getStarted : next

  const handleContinue = () => {
    if (persona === "organization") {
      navigate("/onboarding/org", { state: { persona: "organization" as const } })
      return
    }
    navigate("/register", { state: { persona } })
  }

  return (
    <AuthPageShell title={title} wide>
      <div className="va-onboarding-back">
        <button type="button" className="va-btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <p className="va-onboarding-body">{body}</p>

      <div style={{ marginTop: "2.25rem" }}>
        <button type="button" className="va-btn-primary va-login-submit" onClick={handleContinue}>
          {buttonLabel}
        </button>
      </div>

      <div className="va-auth-footer" style={{ marginTop: "1.25rem" }}>
        <Link to="/login">Sign in</Link>
      </div>
    </AuthPageShell>
  )
}
