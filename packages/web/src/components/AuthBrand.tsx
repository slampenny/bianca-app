import type { ReactNode } from "react"
import { Link } from "react-router-dom"

/** Same asset as mobile login (`config.base.ts` appIconUrl). */
const APP_ICON_URL = "https://bianca-app-assets.s3.us-east-2.amazonaws.com/icon.png"

function Wordmark() {
  return (
    <span className="va-logo">
      bianca<span className="va-logo-teal">.</span>
    </span>
  )
}

export function AuthBrand({
  title,
  tagline,
  linkToLogin = false,
}: {
  title?: string
  tagline?: ReactNode
  linkToLogin?: boolean
}) {
  return (
    <>
      <img
        src={APP_ICON_URL}
        alt=""
        className="va-login-logo"
        decoding="async"
        aria-hidden
        data-testid="auth-brand-logo"
      />
      {linkToLogin ? (
        <Link to="/login" className="va-login-wordmark-link">
          <Wordmark />
        </Link>
      ) : (
        <div className="va-login-wordmark">
          <Wordmark />
        </div>
      )}
      {title ? (
        <h1 className="va-login-title" style={{ marginTop: "0.75rem" }}>
          {title}
        </h1>
      ) : null}
      {tagline ? <p className="va-login-tagline">{tagline}</p> : null}
    </>
  )
}
