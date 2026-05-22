import type { Caregiver } from "../services/api/api.types"

/** True when the backend marks the caregiver as needing the onboarding / signup workflow. */
export function needsOnboarding(caregiver: Caregiver | null | undefined): boolean {
  return caregiver != null && caregiver.onboardingComplete === false
}

export type PostAuthFrom = { pathname: string; search?: string }

/** Where to send the user immediately after tokens are issued (login, SSO, verify-email). */
export function resolvePostAuthPath(caregiver: Caregiver, from?: PostAuthFrom | null): string {
  if (needsOnboarding(caregiver)) return "/onboarding"
  if (from?.pathname) return `${from.pathname}${from.search ?? ""}`
  return "/"
}
