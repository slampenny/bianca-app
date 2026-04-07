import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AdminSessionHandoffBridge } from "./auth/AdminSessionHandoffBridge"
import { AuthSessionBridge } from "./auth/AuthSessionBridge"
import { RequireAuth } from "./auth/RequireAuth"
import { RequireRole } from "./auth/RequireRole"
import { SSOCallbackGate } from "./auth/SSOCallbackGate"
import { DemoProvider } from "./state/DemoContext"
import { AppShell } from "./layout/AppShell"
import { LoginPage } from "./pages/LoginPage"
import { MFAPage } from "./pages/MFAPage"
import { RegisterPage } from "./pages/RegisterPage"
import { OnboardingAboutYouPage } from "./pages/onboarding/OnboardingAboutYouPage"
import { OnboardingHowItWorksPage } from "./pages/onboarding/OnboardingHowItWorksPage"
import { OnboardingOrgInfoPage } from "./pages/onboarding/OnboardingOrgInfoPage"
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage"
import { ResetPasswordPage } from "./pages/ResetPasswordPage"
import { CheckEmailPage } from "./pages/CheckEmailPage"
import { InviteSignupPage } from "./pages/InviteSignupPage"
import { VerifyEmailPage } from "./pages/VerifyEmailPage"
import { ClientConsentPage } from "./pages/ClientConsentPage"
import { DashboardPage } from "./pages/DashboardPage"
import { AddResidentPage } from "./pages/AddResidentPage"
import { ResidentsPage } from "./pages/ResidentsPage"
import ResidentDetailPage from "./pages/ResidentDetailPage"
import { ResidentCallPage } from "./pages/ResidentCallPage"
import { AlertsPage } from "./pages/AlertsPage"
import { AlertDetailPage } from "./pages/AlertDetailPage"
import { FamilyWeeklyDigestClientPage } from "./pages/FamilyWeeklyDigestClientPage"
import { FamilyWeeklyDigestHubPage } from "./pages/FamilyWeeklyDigestHubPage"
import { ReportTemplateDetailPage } from "./pages/ReportTemplateDetailPage"
import { ReportsPage } from "./pages/ReportsPage"
import { DailyDigestPage } from "./pages/DailyDigestPage"
import { ProfilePage } from "./pages/ProfilePage"
import { CaregiversPage } from "./pages/CaregiversPage"
import { CaregiverFormPage } from "./pages/CaregiverFormPage"
import { SettingsPage } from "./pages/SettingsPage"
import { SettingsMfaPage } from "./pages/SettingsMfaPage"
import { SettingsPhonePage } from "./pages/SettingsPhonePage"
import { SettingsPrivacyPage } from "./pages/SettingsPrivacyPage"
import { SettingsBillingPage } from "./pages/SettingsBillingPage"

export default function App() {
  return (
    <DemoProvider>
      <BrowserRouter>
        <SSOCallbackGate>
          <AuthSessionBridge />
          <AdminSessionHandoffBridge />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/mfa" element={<MFAPage />} />
            <Route path="/onboarding" element={<OnboardingAboutYouPage />} />
            <Route path="/onboarding/how-it-works" element={<OnboardingHowItWorksPage />} />
            <Route path="/onboarding/org" element={<OnboardingOrgInfoPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/check-email" element={<CheckEmailPage />} />
            <Route path="/signup" element={<InviteSignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/client/consent" element={<ClientConsentPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="alerts/:alertId" element={<AlertDetailPage />} />
                <Route path="residents" element={<ResidentsPage />} />
                <Route path="residents/new" element={<AddResidentPage />} />
                <Route path="residents/:residentId" element={<ResidentDetailPage />} />
                <Route element={<RequireRole roles={["orgAdmin", "superAdmin"]} />}>
                  <Route path="residents/:residentId/call" element={<ResidentCallPage />} />
                </Route>
                <Route path="reports/family_weekly_digest/clients/:clientId" element={<FamilyWeeklyDigestClientPage />} />
                <Route path="reports/family_weekly_digest" element={<FamilyWeeklyDigestHubPage />} />
                <Route path="reports/daily-digest" element={<DailyDigestPage />} />
                <Route path="reports/:templateId" element={<ReportTemplateDetailPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="daily-digest" element={<Navigate to="/reports/daily-digest" replace />} />
                <Route element={<RequireRole roles={["orgAdmin", "superAdmin"]} />}>
                  <Route path="caregivers" element={<CaregiversPage />} />
                  <Route path="caregivers/new" element={<CaregiverFormPage />} />
                  <Route path="caregivers/:caregiverId/edit" element={<CaregiverFormPage />} />
                </Route>
                <Route path="profile" element={<ProfilePage />} />
                <Route path="profile/mfa" element={<SettingsMfaPage />} />
                <Route path="profile/phone" element={<SettingsPhonePage />} />
                <Route path="profile/privacy" element={<SettingsPrivacyPage />} />
                <Route element={<RequireRole roles={["orgAdmin", "superAdmin"]} />}>
                  <Route path="profile/billing" element={<SettingsBillingPage />} />
                </Route>
                <Route path="settings/mfa" element={<SettingsMfaPage />} />
                <Route path="settings/phone" element={<SettingsPhonePage />} />
                <Route path="settings/privacy" element={<SettingsPrivacyPage />} />
                <Route element={<RequireRole roles={["orgAdmin", "superAdmin"]} />}>
                  <Route path="settings/billing" element={<SettingsBillingPage />} />
                </Route>
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </SSOCallbackGate>
      </BrowserRouter>
    </DemoProvider>
  )
}
