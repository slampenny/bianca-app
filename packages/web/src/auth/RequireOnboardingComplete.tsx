import { Navigate, Outlet, useLocation } from "react-router-dom"
import { needsOnboarding } from "../lib/postAuthNavigation"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"

/**
 * After SSO / first-time login, keep users in the onboarding workflow until
 * `onboardingComplete` is set on the caregiver (same as mobile OnboardingStack).
 */
export function RequireOnboardingComplete() {
  const currentUser = useAppSelector(getCurrentUser)
  const location = useLocation()

  if (needsOnboarding(currentUser)) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />
  }

  return <Outlet />
}
