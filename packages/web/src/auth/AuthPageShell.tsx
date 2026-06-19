import type { ReactNode } from "react"
import { useDocumentTitle } from "../hooks/useDocumentTitle"
import { AuthBrand } from "../components/AuthBrand"
import "../app.css"

export function AuthPageShell({
  title,
  subtitle,
  wide,
  children,
}: {
  title?: string
  subtitle?: string
  wide?: boolean
  children: ReactNode
}) {
  useDocumentTitle()
  return (
    <div className="va-login">
      <div className={`va-login-card${wide ? " va-login-card--wide" : ""}`}>
        <div className="va-login-brand">
          <AuthBrand title={title} tagline={subtitle} linkToLogin />
        </div>
        {children}
      </div>
    </div>
  )
}
