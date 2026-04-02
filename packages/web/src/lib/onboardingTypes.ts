/** Matches mobile `OnboardingPersona` — used for pre-register flow only. */
export type OnboardingPersona = "organization" | "caregiver" | "agingInPlace"

export type OnboardingHowItWorksState = {
  persona: OnboardingPersona
}

export type OnboardingOrgInfoState = {
  persona: "organization"
}

/** Passed into `/register` after onboarding (mirrors mobile Register route params). */
export type OnboardingRegisterState = {
  persona: OnboardingPersona
  orgName?: string
  orgCountry?: string
  orgTimezone?: string
}
