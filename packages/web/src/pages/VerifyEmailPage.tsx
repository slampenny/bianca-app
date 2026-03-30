import { useEffect, useRef } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AuthPageShell } from "../auth/AuthPageShell"
import { useVerifyEmailQuery } from "../services/api/authApi"
import { normalizeOrgForStore } from "../lib/normalizeOrg"
import { setAuthEmail, setAuthTokens, setCurrentUser } from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { useAppDispatch } from "../store/store"
import { notifyAuthSuccess } from "../services/api/baseQueryWithAuth"
import "../app.css"

function errorText(err: unknown): string {
  const e = err as { status?: number; data?: { error?: string; message?: string } }
  if (e.data && typeof e.data === "object") {
    if (typeof e.data.error === "string") return e.data.error
    if (typeof e.data.message === "string") return e.data.message
  }
  return "Email verification failed. The link may be invalid or expired."
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const appliedSession = useRef(false)

  const { data, error, isLoading, isSuccess } = useVerifyEmailQuery({ token }, { skip: !token })

  useEffect(() => {
    if (appliedSession.current) return
    if (!isSuccess || !data?.tokens || !data.caregiver) return
    appliedSession.current = true
    dispatch(setAuthTokens(data.tokens))
    dispatch(setCurrentUser(data.caregiver))
    dispatch(setAuthEmail(data.caregiver.email))
    const org = normalizeOrgForStore(data.org)
    if (org) dispatch(setOrg(org))
    else dispatch(setOrg(null))
    notifyAuthSuccess()
    navigate("/", { replace: true })
  }, [isSuccess, data, dispatch, navigate])

  return (
    <AuthPageShell title="Email verification" subtitle="Confirming your email address…">
      {!token ? (
        <div className="va-login-error" role="alert">
          Missing verification token. Open the link from your email, or sign in to request a new one.
        </div>
      ) : null}
      {token && isLoading ? <p className="va-auth-muted">Please wait…</p> : null}
      {token && error ? (
        <div className="va-login-error" role="alert">
          {errorText(error)}
        </div>
      ) : null}
      {token && isSuccess && data && !data.success ? (
        <div className="va-login-error" role="alert">
          {data.error || "Verification was not completed."}
        </div>
      ) : null}
      {token && isSuccess && data?.tokens && data?.caregiver ? (
        <p className="va-auth-muted">Signing you in…</p>
      ) : null}
      <div className="va-auth-footer">
        <Link to="/login">Back to sign in</Link>
        <span style={{ color: "var(--va-slate-300)" }} aria-hidden>
          |
        </span>
        <Link to="/check-email">Resend verification</Link>
      </div>
    </AuthPageShell>
  )
}
