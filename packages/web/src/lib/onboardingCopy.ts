import type { OnboardingPersona } from "./onboardingTypes"

/** English copy aligned with `packages/mobile/app/i18n/en.ts` onboarding section. */
export const onboardingCopy = {
  aboutYou: {
    title: "Tell us a bit about you",
    subtitle: "This helps us tailor your experience.",
    options: {
      organization: "Organization",
      caregiver: "Caregiver",
      agingInPlace: "Aging in place",
    } satisfies Record<OnboardingPersona, string>,
  },
  howItWorks: {
    title: "How Bianca works",
    next: "Next",
    getStarted: "Get started",
    byPersona: {
      organization:
        "Add your clients, schedule when Bianca should call them, and review conversations and reports in one place. Bianca handles the calls so you can focus on care.",
      caregiver:
        "Add the people you care for, choose when Bianca calls them, and see how they're doing through conversations and reports. You stay in the loop without being on every call.",
      agingInPlace:
        "Bianca calls you on your schedule for friendly check-ins. You can review your own wellness and reports anytime. It's like having a companion who's always there when you need them.",
    } satisfies Record<OnboardingPersona, string>,
  },
  orgInfo: {
    title: "Organization information",
    subtitle: "Tell us about your organization.",
    orgNameLabel: "Organization name",
    orgNamePlaceholder: "Enter your organization name",
    countryLabel: "Country / region",
    timezoneLabel: "Timezone",
  },
} as const
