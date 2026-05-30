import { useTranslation } from "react-i18next"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { AuthPageShell } from "../../auth/AuthPageShell"
import type { OnboardingHowItWorksState } from "../../lib/onboardingTypes"
import { isAuthenticated } from "../../store/authSlice"
import { useAppSelector } from "../../store/store"
import "../../app.css"

export function OnboardingHowItWorksPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const authed = useAppSelector(isAuthenticated)
  const state = location.state as OnboardingHowItWorksState | null
  const persona = state?.persona

  if (!persona) {
    return <Navigate to="/onboarding" replace />
  }

  const isAgingInPlace = persona === "agingInPlace"
  const buttonLabel = isAgingInPlace ? t("onboarding.howItWorks.getStarted") : t("onboarding.howItWorks.next")

  const handleContinue = () => {
    if (persona === "organization") {
      navigate("/onboarding/org", { state: { persona: "organization" as const } })
      return
    }
    navigate(authed ? "/onboarding/register" : "/register", { state: { persona } })
  }

  return (
    <AuthPageShell title={t("onboarding.howItWorks.title")} wide>
      <div className="va-onboarding-back">
        <button type="button" className="va-btn-ghost" onClick={() => navigate(-1)}>
          {t("onboarding.registration.back")}
        </button>
      </div>

      <p className="va-onboarding-body">{t(`onboarding.howItWorks.${persona}`)}</p>

      <div style={{ marginTop: "2.25rem" }}>
        <button type="button" className="va-btn-primary va-login-submit" data-testid="onboarding-how-it-works-continue" onClick={handleContinue}>
          {buttonLabel}
        </button>
      </div>

      <div className="va-auth-footer" style={{ marginTop: "1.25rem" }}>
        <Link to="/login">{t("onboarding.signInLink")}</Link>
      </div>
    </AuthPageShell>
  )
}
