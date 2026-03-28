import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import "../vercel-app.css"

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
  return (
    <div className="va-login">
      <div className={`va-login-card${wide ? " va-login-card--wide" : ""}`}>
        <div className="va-login-brand">
          <Link to="/login" className="va-logo" style={{ textDecoration: "none", color: "inherit", display: "inline-block" }}>
            bianca<span className="va-logo-teal">.</span>
          </Link>
          {title ? (
            <h1 className="va-login-title" style={{ marginTop: "0.75rem" }}>
              {title}
            </h1>
          ) : null}
          {subtitle ? <p className="va-login-tagline">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  )
}
