import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"

const ROUTE_TITLE_KEYS: Record<string, string> = {
  "/": "nav.dashboard",
  "/alerts": "nav.alerts",
  "/residents": "nav.residents",
  "/caregivers": "nav.caregivers",
  "/reports": "nav.reports",
  "/settings": "nav.settings",
  "/profile": "nav.settings",
  "/login": "login.signIn",
  "/login/mfa": "mfaLogin.title",
  "/register": "register.title",
  "/forgot-password": "forgotPassword.title",
  "/reset-password": "resetPassword.title",
  "/check-email": "checkEmail.title",
  "/signup": "invite.title",
  "/auth/verify-email": "verifyEmail.title",
  "/verify-email": "verifyEmail.title",
  "/onboarding": "onboarding.aboutYou.title",
  "/onboarding/how-it-works": "onboarding.howItWorks.title",
  "/onboarding/org": "onboarding.orgInfo.title",
  "/onboarding/register": "onboarding.registration.title",
  "/client/consent": "clientConsent.titleMissing",
}

function titleKeyForPath(pathname: string): string | undefined {
  if (ROUTE_TITLE_KEYS[pathname]) return ROUTE_TITLE_KEYS[pathname]
  if (pathname.startsWith("/residents/")) return "nav.residents"
  if (pathname.startsWith("/alerts/")) return "nav.alerts"
  if (pathname.startsWith("/caregivers")) return "nav.caregivers"
  if (pathname.startsWith("/reports")) return "nav.reports"
  if (pathname.startsWith("/settings") || pathname.startsWith("/profile")) return "nav.settings"
  return undefined
}

/** Sets document.title from the current route’s i18n label. */
export function useDocumentTitle() {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  useEffect(() => {
    const suffix = t("appShell.pageTitleSuffix")
    const key = titleKeyForPath(pathname)
    document.title = key ? `${t(key)} · ${suffix}` : suffix
  }, [pathname, t])
}
