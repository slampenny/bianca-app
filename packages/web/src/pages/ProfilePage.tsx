import { FormEvent, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { changeWebLanguage } from "../i18n/i18n"
import { AuthSelectField } from "../components/AuthSelectField"
import { AuthTextField } from "../components/AuthTextField"
import { AvatarPicker } from "../components/AvatarPicker"
import "../app.css"

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0"

function phoneOk(phone: string): boolean {
  const p = phone.replace(/\s/g, "")
  return /^(\+1\d{10}|\d{10})$/.test(p)
}

export function ProfilePage() {
  const { t } = useTranslation()
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

  const [themeMode, setThemeMode] = useState<WebThemeMode>(() => getStoredThemeMode())
  const [fontPct, setFontPct] = useState(() => getStoredFontScalePct())

  const [formError, setFormError] = useState("")
  const [profileSaved, setProfileSaved] = useState(false)
  const [emailBannerKey, setEmailBannerKey] = useState<"verificationEmailSent" | "verificationEmailFailed" | null>(null)

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
  }, [profile])

  const onThemeChange = (mode: WebThemeMode) => {
    setThemeMode(mode)
    applyWebThemeMode(mode)
  }

  const onFontChange = (pct: number) => {
    setFontPct(pct)
    applyWebFontScalePct(pct)
  }

  const handleResendEmail = async () => {
    setEmailBannerKey(null)
    try {
      await resendVerification({ email: email.trim() || profile?.email || "" }).unwrap()
      setEmailBannerKey("verificationEmailSent")
    } catch {
      setEmailBannerKey("verificationEmailFailed")
    }
  }

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setFormError("")
    setProfileSaved(false)
    if (!id || !profile) return

    if (!name.trim()) {
      setFormError(t("profile.errorNameRequired"))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError(t("profile.errorEmailInvalid"))
      return
    }
    if (!phoneOk(phone)) {
      setFormError(t("profile.errorPhoneFormat"))
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
      setProfileSaved(true)
      setAvatarFile(null)
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setFormError(typeof msg === "string" ? msg : t("profile.updateFailed"))
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

  return (
    <div className="va-page-wrap">
      <h1 className="va-page-title">{t("profile.title")}</h1>
      <p style={{ color: "var(--va-slate-500)", marginTop: 8, marginBottom: "1.5rem", fontSize: "0.875rem", lineHeight: 1.45 }}>
        {t("profile.subtitle")}
      </p>

      <p style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
        <Link to="/settings" className="va-link">
          {t("profile.orgSettingsLink")}
        </Link>
      </p>

      {!isEmailVerified && (
        <div className="va-login-error" style={{ marginBottom: "1rem" }} role="status">
          {t("profile.verifyEmailBanner")}{" "}
          <Link to="/check-email" state={{ email: profile?.email }} className="va-link" style={{ fontSize: "inherit" }}>
            {t("profile.verifyEmailHelp")}
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
          {t("profile.phoneBanner")}
        </div>
      )}

      <div className="va-page-section">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>{t("profile.sectionYourDetails")}</h2>
        {loadingProfile && !fresh ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("profile.loadingProfile")}</p>
        ) : (
          <form id="profile-details-form" onSubmit={handleSaveProfile} className="va-login-form">
            <AvatarPicker
              label={t("profile.photo")}
              initialsSource={name || profile?.name || "?"}
              existingAvatarUrl={profile?.avatar}
              onPick={setAvatarFile}
            />

            <AuthTextField
              label={t("profile.name")}
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              autoComplete="name"
            />

            <AuthTextField
              label={t("profile.email")}
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              disabled={isSsoUser}
              style={isSsoUser ? { opacity: 0.75 } : undefined}
              autoComplete="email"
            />
            {isSsoUser ? (
              <p className="va-login-helper">{t("profile.ssoEmailHelper")}</p>
            ) : null}

            <div style={{ marginBottom: 8 }}>
              {isEmailVerified ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--va-emerald-600)", margin: 0 }}>{t("profile.emailVerified")}</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--va-amber-700)" }}>{t("profile.emailNotVerified")}</span>
                  <button
                    type="button"
                    className="va-btn-secondary"
                    style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                    disabled={resendingEmail}
                    onClick={() => void handleResendEmail()}
                  >
                    {resendingEmail ? t("profile.sending") : t("profile.resendVerification")}
                  </button>
                </div>
              )}
              {emailBannerKey ? (
                <p style={{ fontSize: "0.75rem", marginTop: 6, color: "var(--va-slate-600)" }}>{t(`profile.${emailBannerKey}`)}</p>
              ) : null}
            </div>

            <AuthTextField
              label={t("profile.phone")}
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              autoComplete="tel"
            />
            <p className="va-login-helper">{t("profile.phoneFormatHelper")}</p>

            {profile?.isPhoneVerified ? (
              <p style={{ fontSize: "0.8125rem", color: "var(--va-emerald-600)", marginBottom: 8 }}>{t("profile.phoneVerified")}</p>
            ) : phoneOk(phone) ? (
              <p style={{ fontSize: "0.8125rem", marginBottom: 8 }}>
                <Link to="/profile/phone" className="va-link">
                  {t("profile.verifyPhoneLink")}
                </Link>
              </p>
            ) : (
              <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)", marginBottom: 8 }}>{t("profile.phoneNotVerified")}</p>
            )}

            <AuthSelectField
              label={t("profile.preferredLanguage")}
              value={preferredLanguage}
              onChange={(ev) => {
                const v = ev.target.value
                setPreferredLanguage(v)
                void changeWebLanguage(v.length >= 2 ? v.slice(0, 2).toLowerCase() : v)
              }}
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} ({l.label})
                </option>
              ))}
            </AuthSelectField>
            <p className="va-login-helper">{t("profile.preferredLanguageHelper")}</p>
          </form>
        )}
      </div>

      <div className="va-page-section">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("profile.appearanceTitle")}</h2>
        <p className="va-login-helper" style={{ marginBottom: "0.75rem" }}>
          {t("profile.appearanceHelper")}
        </p>
        <AuthSelectField label={t("profile.theme")} value={themeMode} onChange={(ev) => onThemeChange(ev.target.value as WebThemeMode)}>
          <option value="light">{t("profile.themeLight")}</option>
          <option value="dark">{t("profile.themeDark")}</option>
          <option value="system">{t("profile.themeSystem")}</option>
        </AuthSelectField>
        <AuthSelectField
          label={t("profile.textSize")}
          style={{ marginTop: "0.75rem" }}
          value={String(fontPct)}
          onChange={(ev) => onFontChange(Number(ev.target.value))}
        >
          <option value="90">{t("profile.textSize90")}</option>
          <option value="100">{t("profile.textSize100")}</option>
          <option value="110">{t("profile.textSize110")}</option>
          <option value="125">{t("profile.textSize125")}</option>
        </AuthSelectField>
      </div>

      <div className="va-page-section">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("profile.securityTitle")}</h2>
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", marginBottom: "0.75rem" }}>
          {t("profile.mfaLabel")}{" "}
          <strong>
            {mfaStatus?.mfaEnabled
              ? t("profile.mfaStateOn", { count: mfaStatus.backupCodesRemaining ?? 0 })
              : t("profile.mfaStateOff")}
          </strong>
        </p>
        <Link to="/profile/mfa" className="va-btn-secondary" style={{ display: "inline-flex", textDecoration: "none", marginRight: 8 }}>
          {mfaStatus?.mfaEnabled ? t("profile.manageMfa") : t("profile.setupMfa")}
        </Link>
      </div>

      <div className="va-page-section">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("profile.privacyTitle")}</h2>
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", marginBottom: "0.75rem" }}>
          {t("profile.privacyBody")}
        </p>
        <Link to="/profile/privacy" className="va-btn-secondary" style={{ display: "inline-flex", textDecoration: "none" }}>
          {t("profile.privacyLink")}
        </Link>
      </div>

      <div className="va-page-section">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("profile.legalTitle")}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1.25rem", fontSize: "0.875rem" }}>
          <a href={TERMS_OF_SERVICE_URL} target="_blank" rel="noreferrer" className="va-link">
            {t("profile.terms")}
          </a>
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="va-link">
            {t("profile.privacyPolicy")}
          </a>
        </div>
      </div>

      {!loadingProfile || fresh ? (
        <div className="va-page-section">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("profile.saveChangesTitle")}</h2>
          <p className="va-login-helper" style={{ marginBottom: "1rem" }}>
            {t("profile.saveChangesHelper")}
          </p>
          {formError ? (
            <div className="va-login-error" role="alert" style={{ marginBottom: "0.75rem" }}>
              {formError}
            </div>
          ) : null}
          {profileSaved ? (
            <div className="va-login-success" role="status" style={{ marginBottom: "0.75rem" }}>
              {t("profile.profileUpdated")}
            </div>
          ) : null}
          <button
            type="submit"
            form="profile-details-form"
            className="va-btn-primary va-login-submit"
            style={{ width: "100%" }}
            disabled={saving || uploading || !id || !profile}
          >
            {saving || uploading ? t("profile.saving") : t("profile.saveProfile")}
          </button>
        </div>
      ) : null}

      <div className="va-page-section">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>{t("profile.sessionTitle")}</h2>
        <button type="button" className="va-btn-secondary" style={{ width: "100%" }} disabled={signingOut} onClick={() => void signOut()}>
          {signingOut ? t("profile.signingOut") : t("profile.signOut")}
        </button>
        <p className="va-settings-version">{t("profile.webVersion", { version: APP_VERSION })}</p>
      </div>
    </div>
  )
}
