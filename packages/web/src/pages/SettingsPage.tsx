import { FormEvent, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "../config/legal"
import { LANGUAGE_OPTIONS } from "../lib/languages"
import {
  applyWebFontScalePct,
  applyWebThemeMode,
  getStoredFontScalePct,
  getStoredThemeMode,
  type WebThemeMode,
} from "../lib/webPreferences"
import { useLogoutMutation, useResendVerificationEmailMutation } from "../services/api/authApi"
import { useGetCaregiverQuery, useUpdateCaregiverMutation, useUploadAvatarMutation } from "../services/api/caregiverApi"
import { useGetMFAStatusQuery } from "../services/api/mfaApi"
import { clearAuth, getAuthTokens, getCurrentUser } from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { useAppDispatch, useAppSelector } from "../store/store"
import "../app.css"

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0"

function phoneOk(phone: string): boolean {
  const p = phone.replace(/\s/g, "")
  return /^(\+1\d{10}|\d{10})$/.test(p)
}

export function SettingsPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const tokens = useAppSelector(getAuthTokens)
  const user = useAppSelector(getCurrentUser)
  const id = user?.id ? String(user.id) : ""

  const { data: fresh, isLoading: loadingProfile } = useGetCaregiverQuery({ id }, { skip: !id })
  const profile = useMemo(() => fresh ?? user, [fresh, user])

  const { data: mfaStatus } = useGetMFAStatusQuery(undefined, { skip: !id })

  const [updateCaregiver, { isLoading: saving }] = useUpdateCaregiverMutation()
  const [uploadAvatar, { isLoading: uploading }] = useUploadAvatarMutation()
  const [resendVerification, { isLoading: resendingEmail }] = useResendVerificationEmailMutation()
  const [logoutApi, { isLoading: signingOut }] = useLogoutMutation()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [preferredLanguage, setPreferredLanguage] = useState("en")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const [themeMode, setThemeMode] = useState<WebThemeMode>(() => getStoredThemeMode())
  const [fontPct, setFontPct] = useState(() => getStoredFontScalePct())

  const [formError, setFormError] = useState("")
  const [formSuccess, setFormSuccess] = useState("")
  const [emailBanner, setEmailBanner] = useState("")

  const isSsoUser = Boolean(profile?.ssoProvider)
  const isEmailVerified = Boolean(profile?.isEmailVerified || isSsoUser)
  const hasMissingPhone = !profile?.phone || String(profile.phone).trim() === ""

  useEffect(() => {
    if (!profile) return
    setName(profile.name ?? "")
    setEmail(profile.email ?? "")
    setPhone(profile.phone ?? "")
    setPreferredLanguage(profile.preferredLanguage || "en")
    setAvatarFile(null)
    setAvatarPreview(null)
  }, [profile])

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  const onAvatarPick = (f: File | null) => {
    setAvatarFile(f)
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(f ? URL.createObjectURL(f) : null)
  }

  const onThemeChange = (mode: WebThemeMode) => {
    setThemeMode(mode)
    applyWebThemeMode(mode)
  }

  const onFontChange = (pct: number) => {
    setFontPct(pct)
    applyWebFontScalePct(pct)
  }

  const handleResendEmail = async () => {
    setEmailBanner("")
    try {
      await resendVerification({ email: email.trim() || profile?.email || "" }).unwrap()
      setEmailBanner("Verification email sent. Check your inbox.")
    } catch {
      setEmailBanner("Could not send email. Try again later.")
    }
  }

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setFormError("")
    setFormSuccess("")
    if (!id || !profile) return

    if (!name.trim()) {
      setFormError("Name is required.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Enter a valid email address.")
      return
    }
    if (!phoneOk(phone)) {
      setFormError("Phone must be 10 digits or +1 followed by 10 digits.")
      return
    }

    try {
      if (avatarFile) {
        await uploadAvatar({ id, avatar: avatarFile }).unwrap()
      }
      await updateCaregiver({
        id,
        caregiver: {
          name: name.trim(),
          email: isSsoUser ? undefined : email.trim(),
          phone: phone.replace(/\s/g, ""),
          preferredLanguage,
        },
      }).unwrap()
      setFormSuccess("Profile updated.")
      setAvatarFile(null)
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(null)
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setFormError(typeof msg === "string" ? msg : "Update failed.")
    }
  }

  const signOut = async () => {
    const rt = tokens?.refresh?.token
    if (rt) {
      try {
        await logoutApi({ refreshToken: rt }).unwrap()
      } catch {
        /* slice clears on reject */
      }
    } else {
      dispatch(clearAuth())
    }
    dispatch(setOrg(null))
    navigate("/login", { replace: true })
  }

  const displayAvatar = avatarPreview || profile?.avatar

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 className="va-page-title">Settings</h1>
      <p style={{ color: "var(--va-slate-500)", marginTop: 8, marginBottom: "1.5rem", fontSize: "0.875rem", lineHeight: 1.45 }}>
        Profile, security, and appearance — aligned with the mobile app.
      </p>

      {!isEmailVerified && (
        <div className="va-login-error" style={{ marginBottom: "1rem" }} role="status">
          Please verify your email to use all features.{" "}
          <Link to="/check-email" state={{ email: profile?.email }} className="va-link" style={{ fontSize: "inherit" }}>
            Open email help
          </Link>
        </div>
      )}

      {hasMissingPhone && isEmailVerified && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            background: "var(--va-amber-50)",
            border: "1px solid var(--va-amber-700)",
            fontSize: "0.875rem",
            color: "var(--va-amber-700)",
          }}
        >
          Add a phone number on your profile for account recovery and alerts.
        </div>
      )}

      <div className="va-card va-card-pad" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Profile</h2>
        {loadingProfile && !fresh ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>Loading profile…</p>
        ) : (
          <form onSubmit={handleSaveProfile} className="va-login-form">
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt=""
                  style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--va-slate-200)" }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: "var(--va-slate-200)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.25rem",
                    color: "var(--va-slate-500)",
                  }}
                >
                  {(name || profile?.name || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <label style={{ fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
                <span style={{ display: "block", marginBottom: 6 }}>Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(ev) => onAvatarPick(ev.target.files?.[0] ?? null)}
                  style={{ fontSize: "0.75rem" }}
                />
              </label>
            </div>

            <label className="va-login-label">
              Name
              <input className="va-login-input" value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="name" />
            </label>

            <label className="va-login-label">
              Email
              <input
                className="va-login-input"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                disabled={isSsoUser}
                style={isSsoUser ? { opacity: 0.75 } : undefined}
                autoComplete="email"
              />
            </label>
            {isSsoUser ? (
              <p className="va-login-helper">Email is managed by your sign-in provider.</p>
            ) : null}

            <div style={{ marginBottom: 8 }}>
              {isEmailVerified ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--va-emerald-600)", margin: 0 }}>✓ Email verified</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--va-amber-700)" }}>⏳ Email not verified</span>
                  <button
                    type="button"
                    className="va-btn-secondary"
                    style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                    disabled={resendingEmail}
                    onClick={() => void handleResendEmail()}
                  >
                    {resendingEmail ? "Sending…" : "Resend verification"}
                  </button>
                </div>
              )}
              {emailBanner ? (
                <p style={{ fontSize: "0.75rem", marginTop: 6, color: "var(--va-slate-600)" }}>{emailBanner}</p>
              ) : null}
            </div>

            <label className="va-login-label">
              Phone
              <input className="va-login-input" value={phone} onChange={(ev) => setPhone(ev.target.value)} autoComplete="tel" />
            </label>
            <p className="va-login-helper">10 digits or +1 and 10 digits (US/Canada).</p>

            {profile?.isPhoneVerified ? (
              <p style={{ fontSize: "0.8125rem", color: "var(--va-emerald-600)", marginBottom: 8 }}>✓ Phone verified</p>
            ) : phoneOk(phone) ? (
              <p style={{ fontSize: "0.8125rem", marginBottom: 8 }}>
                <Link to="/settings/phone" className="va-link">
                  Verify phone with SMS code →
                </Link>
              </p>
            ) : (
              <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)", marginBottom: 8 }}>⏳ Phone not verified</p>
            )}

            {formError ? (
              <div className="va-login-error" role="alert">
                {formError}
              </div>
            ) : null}
            {formSuccess ? (
              <div className="va-login-success" role="status">
                {formSuccess}
              </div>
            ) : null}

            <button type="submit" className="va-btn-primary va-login-submit" disabled={saving || uploading}>
              {saving || uploading ? "Saving…" : "Save profile"}
            </button>
          </form>
        )}
      </div>

      <div className="va-card va-card-pad" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Language</h2>
        <p className="va-login-helper" style={{ marginBottom: "0.75rem" }}>
          Preferred language is saved to your account (for emails and future in-app translations).
        </p>
        <select
          className="va-login-input"
          value={preferredLanguage}
          onChange={(ev) => setPreferredLanguage(ev.target.value)}
        >
          {LANGUAGE_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName} ({l.label})
            </option>
          ))}
        </select>
      </div>

      <div className="va-card va-card-pad" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Appearance</h2>
        <label className="va-login-label">
          Theme
          <select className="va-login-input" value={themeMode} onChange={(ev) => onThemeChange(ev.target.value as WebThemeMode)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">Match system</option>
          </select>
        </label>
        <label className="va-login-label" style={{ marginTop: "0.75rem" }}>
          Text size
          <select
            className="va-login-input"
            value={String(fontPct)}
            onChange={(ev) => onFontChange(Number(ev.target.value))}
          >
            <option value="90">Smaller (90%)</option>
            <option value="100">Default (100%)</option>
            <option value="110">Larger (110%)</option>
            <option value="125">Largest (125%)</option>
          </select>
        </label>
      </div>

      <div className="va-card va-card-pad" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Security</h2>
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", marginBottom: "0.75rem" }}>
          MFA:{" "}
          <strong>{mfaStatus?.mfaEnabled ? `On (${mfaStatus.backupCodesRemaining} backup codes left)` : "Off"}</strong>
        </p>
        <Link to="/settings/mfa" className="va-btn-secondary" style={{ display: "inline-flex", textDecoration: "none", marginRight: 8 }}>
          {mfaStatus?.mfaEnabled ? "Manage MFA" : "Set up MFA"}
        </Link>
      </div>

      <div className="va-card va-card-pad" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Privacy</h2>
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", marginBottom: "0.75rem" }}>
          Access requests and your privacy history.
        </p>
        <Link to="/settings/privacy" className="va-btn-secondary" style={{ display: "inline-flex", textDecoration: "none" }}>
          Privacy & data requests
        </Link>
      </div>

      <div className="va-card va-card-pad" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Legal</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1.25rem", fontSize: "0.875rem" }}>
          <a href={TERMS_OF_SERVICE_URL} target="_blank" rel="noreferrer" className="va-link">
            Terms of Service
          </a>
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="va-link">
            Privacy Policy
          </a>
        </div>
      </div>

      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Session</h2>
        <button type="button" className="va-btn-secondary" style={{ width: "100%" }} disabled={signingOut} onClick={() => void signOut()}>
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        <p
          style={{
            marginTop: "1.25rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--va-slate-100)",
            fontSize: "0.75rem",
            color: "var(--va-slate-400)",
            textAlign: "center",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          Web app v{APP_VERSION}
        </p>
      </div>
    </div>
  )
}
