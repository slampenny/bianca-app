import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthSessionBridge } from "./auth/AuthSessionBridge"
import { RequireAuth } from "./auth/RequireAuth"
import { DemoProvider } from "./state/DemoContext"
import { AppShell } from "./layout/AppShell"
import { LoginPage } from "./pages/LoginPage"
import { MFAPage } from "./pages/MFAPage"
import { RegisterPage } from "./pages/RegisterPage"
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage"
import { ResetPasswordPage } from "./pages/ResetPasswordPage"
import { CheckEmailPage } from "./pages/CheckEmailPage"
import { InviteSignupPage } from "./pages/InviteSignupPage"
import { VerifyEmailPage } from "./pages/VerifyEmailPage"
import { DashboardPage } from "./pages/DashboardPage"
import { ResidentsPage } from "./pages/ResidentsPage"
import { ResidentDetailPage } from "./pages/ResidentDetailPage"
import { AlertsPage } from "./pages/AlertsPage"
import { AlertDetailPage } from "./pages/AlertDetailPage"
import { ReportsPage } from "./pages/ReportsPage"
import { SettingsPage } from "./pages/SettingsPage"
import { SettingsMfaPage } from "./pages/SettingsMfaPage"
import { SettingsPhonePage } from "./pages/SettingsPhonePage"
import { SettingsPrivacyPage } from "./pages/SettingsPrivacyPage"

export default function App() {
  return (
    <DemoProvider>
      <BrowserRouter>
        <AuthSessionBridge />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/mfa" element={<MFAPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/check-email" element={<CheckEmailPage />} />
          <Route path="/signup" element={<InviteSignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="alerts/:alertId" element={<AlertDetailPage />} />
              <Route path="residents" element={<ResidentsPage />} />
              <Route path="residents/:residentId" element={<ResidentDetailPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings/mfa" element={<SettingsMfaPage />} />
              <Route path="settings/phone" element={<SettingsPhonePage />} />
              <Route path="settings/privacy" element={<SettingsPrivacyPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </DemoProvider>
  )
}
