import { Navigate, Route, Routes } from "react-router-dom"
import { RequireAuth } from "./auth/RequireAuth"
import { RequireSuperAdmin } from "./auth/RequireSuperAdmin"
import { ForbiddenPage } from "./pages/ForbiddenPage"
import { LoginPage } from "./pages/LoginPage"
import { MFAPage } from "./pages/MFAPage"
import { ImpersonatePage } from "./pages/ImpersonatePage"
import { ObservabilityPage } from "./pages/ObservabilityPage"
import { ScimProvisioningPage } from "./pages/ScimProvisioningPage"

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/mfa" element={<MFAPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireSuperAdmin />}>
          <Route index element={<ObservabilityPage />} />
          <Route path="impersonate" element={<ImpersonatePage />} />
          <Route path="scim" element={<ScimProvisioningPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
