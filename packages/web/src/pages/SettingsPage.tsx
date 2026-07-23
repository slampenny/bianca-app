import { FormEvent, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { canManageBilling, canManageCaregivers } from "../lib/roleAccess"
import {
  buildDailyDigestAutomationStatus,
  type OrgSchedulingAvailability,
} from "../lib/dailyDigestAutomation"
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
import { useGetOrgQuery, useUpdateOrgMutation } from "../services/api/orgApi"
import { AuthSelectField } from "../components/AuthSelectField"
import { AuthTextField } from "../components/AuthTextField"
import { AvatarPicker } from "../components/AvatarPicker"
import { AutomatedDigestStatusPanel } from "../components/AutomatedDigestStatusPanel"
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
  const [dailyDigestEmail, setDailyDigestEmail] = useState(false)
  const [notifBannerKey, setNotifBannerKey] = useState<"dailyDigestEmailSaved" | "dailyDigestEmailSaveFailed" | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [themeMode, setThemeMode] = useState<WebThemeMode>(() => getStoredThemeMode())
  const [fontPct, setFontPct] = useState(() => getStoredFontScalePct())

  const [formError, setFormError] = useState("")
  const [profileSaved, setProfileSaved] = useState(false)
  const [emailBannerKey, setEmailBannerKey] = useState<"verificationEmailSent" | "verificationEmailFailed" | null>(null)

  const isSsoUser = Boolean(profile?.ssoProvider)
  const isEmailVerified = Boolean(profile?.isEmailVerified || isSsoUser)
  const hasMissingPhone = !profile?.phone || String(profile.phone).trim() === ""
  const canSeeBilling = canManageBilling(user?.role)
  const isOrgAdmin = canManageCaregivers(user?.role)
  const orgId = user?.org != null ? String(user.org) : ""
  const canManageOrgSettings = isOrgAdmin && Boolean(orgId)

  const { data: orgData, isLoading: orgLoading, isError: orgError } = useGetOrgQuery({ orgId }, { skip: !canManageOrgSettings })
  const [updateOrg, { isLoading: savingOrg }] = useUpdateOrgMutation()
  const [familyPortalEnabled, setFamilyPortalEnabled] = useState(false)
  const [familyPortalBannerKey, setFamilyPortalBannerKey] = useState<"familyPortalSaved" | "familyPortalSaveFailed" | null>(
    null,
  )
  const [orgDailyDigestEnabled, setOrgDailyDigestEnabled] = useState(false)
  const [orgDailyDigestBannerKey, setOrgDailyDigestBannerKey] = useState<
    "dailyDigestOrgSaved" | "dailyDigestOrgSaveFailed" | null
  >(null)

  const orgSchedulingAvailability = useMemo((): OrgSchedulingAvailability => {
    if (!canManageOrgSettings) return "unavailable"
    if (orgLoading) return "loading"
    if (orgError) return "error"
    return "available"
  }, [canManageOrgSettings, orgLoading, orgError])

  const digestAutomationStatus = useMemo(
    () =>
      buildDailyDigestAutomationStatus({
        caregiver: profile,
        org: orgData ?? null,
        orgSchedulingAvailability,
      }),
    [profile, orgData, orgSchedulingAvailability],
  )

  useEffect(() => {
    setFamilyPortalEnabled(orgData?.familyPortalSettings?.enabled === true)
  }, [orgData?.familyPortalSettings?.enabled])

  useEffect(() => {
    setOrgDailyDigestEnabled(orgData?.dailyDigestSettings?.enabled === true)
  }, [orgData?.dailyDigestSettings?.enabled])

  useEffect(() => {
    if (!profile) return
    setName(profile.name ?? "")
    setEmail(profile.email ?? "")
    setPhone(profile.phone ?? "")
    setPreferredLanguage(profile.preferredLanguage || "en")
    setDailyDigestEmail(profile.notificationPreferences?.dailyDigestEmail === true)
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

  const handleDailyDigestEmailChange = async (enabled: boolean) => {
    setNotifBannerKey(null)
    setDailyDigestEmail(enabled)
    if (!id) return
    try {
      await updateCaregiver({
        id,
        caregiver: { notificationPreferences: { dailyDigestEmail: enabled } },
      }).unwrap()
      setNotifBannerKey("dailyDigestEmailSaved")
    } catch {
      setDailyDigestEmail(!enabled)
      setNotifBannerKey("dailyDigestEmailSaveFailed")
    }
  }

  const handleFamilyPortalChange = async (enabled: boolean) => {
    if (!canManageOrgSettings) return
    setFamilyPortalBannerKey(null)
    setFamilyPortalEnabled(enabled)
    try {
      await updateOrg({
        orgId,
        org: {
          familyPortalSettings: {
            enabled,
            allowInviteAfterDigestVerify: orgData?.familyPortalSettings?.allowInviteAfterDigestVerify !== false,
          },
        },
      }).unwrap()
      setFamilyPortalBannerKey("familyPortalSaved")
    } catch {
      setFamilyPortalEnabled(!enabled)
      setFamilyPortalBannerKey("familyPortalSaveFailed")
    }
  }

  const handleOrgDailyDigestChange = async (enabled: boolean) => {
    if (!canManageOrgSettings) return
    setOrgDailyDigestBannerKey(null)
    setOrgDailyDigestEnabled(enabled)
    try {
      await updateOrg({
        orgId,
        org: {
          dailyDigestSettings: {
            enabled,
            sendTime: orgData?.dailyDigestSettings?.sendTime ?? null,
          },
        },
      }).unwrap()
      setOrgDailyDigestBannerKey("dailyDigestOrgSaved")
    } catch {
      setOrgDailyDigestEnabled(!enabled)
      setOrgDailyDigestBannerKey("dailyDigestOrgSaveFailed")
    }
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
    <div data-testid="settings-page" className="va-page-wrap">
      <h1 className="va-page-title">{t("settings.title")}</h1>
      <p style={{ color: "var(--va-slate-500)", marginTop: 8, marginBottom: "1.5rem", fontSize: "0.875rem", lineHeight: 1.45 }}>
        {t("settings.subtitle")}
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
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>{t("profile.title")}</h2>
        {loadingProfile && !fresh ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("profile.loadingProfile")}</p>
        ) : (
          <form onSubmit={handleSaveProfile} className="va-login-form">
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
                <Link to="/settings/phone" data-testid="settings-phone-link" className="va-link">
                  {t("profile.verifyPhoneLink")}
                </Link>
              </p>
            ) : (
              <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)", marginBottom: 8 }}>{t("profile.phoneNotVerified")}</p>
            )}

            {formError ? (
              <div className="va-login-error" role="alert">
                {formError}
              </div>
            ) : null}
            {profileSaved ? (
              <div className="va-login-success" role="status">
                {t("profile.profileUpdated")}
              </div>
            ) : null}

            <button type="submit" className="va-btn-primary va-login-submit" disabled={saving || uploading}>
              {saving || uploading ? t("profile.saving") : t("profile.saveProfile")}
            </button>
          </form>
        )}
      </div>

      <div className="va-page-section">
        <p className="va-login-helper" style={{ marginBottom: "0.75rem" }}>
          {t("settings.languageHelper")}
        </p>
        <AuthSelectField
          label={t("settings.languageSectionTitle")}
          value={preferredLanguage}
          onChange={(ev) => setPreferredLanguage(ev.target.value)}
        >
          {LANGUAGE_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName} ({l.label})
            </option>
          ))}
        </AuthSelectField>
      </div>

      <div className="va-page-section">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("settings.notificationsTitle")}</h2>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            cursor: saving ? "wait" : "pointer",
            fontSize: "0.875rem",
          }}
        >
          <input
            type="checkbox"
            data-testid="settings-daily-digest-email"
            checked={dailyDigestEmail}
            disabled={saving}
            onChange={(ev) => void handleDailyDigestEmailChange(ev.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span style={{ display: "block", fontWeight: 500 }}>{t("settings.dailyDigestEmailLabel")}</span>
            <span style={{ display: "block", marginTop: 4, color: "var(--va-slate-500)", fontSize: "0.8125rem", lineHeight: 1.45 }}>
              {t("settings.dailyDigestEmailHelper")}
            </span>
          </span>
        </label>
        {notifBannerKey ? (
          <p style={{ fontSize: "0.8125rem", marginTop: 10, color: "var(--va-slate-600)" }} role="status">
            {t(`settings.${notifBannerKey}`)}
          </p>
        ) : null}
      </div>

      {canManageOrgSettings ? (
        <div className="va-page-section" data-testid="settings-org-daily-digest">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("orgSettings.dailyDigestSection")}</h2>
          {orgLoading && !orgData ? (
            <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("orgSettings.loading")}</p>
          ) : (
            <>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  cursor: savingOrg ? "wait" : "pointer",
                  fontSize: "0.875rem",
                }}
              >
                <input
                  type="checkbox"
                  data-testid="settings-org-daily-digest-enabled"
                  checked={orgDailyDigestEnabled}
                  disabled={savingOrg || orgLoading}
                  onChange={(ev) => void handleOrgDailyDigestChange(ev.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ display: "block", fontWeight: 500 }}>{t("orgSettings.dailyDigestEnabledBold")}</span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      color: "var(--va-slate-500)",
                      fontSize: "0.8125rem",
                      lineHeight: 1.45,
                    }}
                  >
                    {t("orgSettings.dailyDigestEnabledDetail")}
                  </span>
                </span>
              </label>
              {orgDailyDigestBannerKey ? (
                <p style={{ fontSize: "0.8125rem", marginTop: 10, color: "var(--va-slate-600)" }} role="status">
                  {t(`orgSettings.${orgDailyDigestBannerKey}`)}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="va-page-section" data-testid="settings-daily-digest-automation">
        <AutomatedDigestStatusPanel status={digestAutomationStatus} caregiver={profile} orgLoading={orgLoading} />
      </div>

      {canManageOrgSettings ? (
        <div className="va-page-section" data-testid="settings-org-voice-onboarding">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("orgSettings.voiceOnboardingSection")}</h2>
          {orgLoading && !orgData ? (
            <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("orgSettings.loading")}</p>
          ) : (
            <>
              <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", marginBottom: "0.75rem", lineHeight: 1.45 }}>
                {orgData?.voiceOnboarding?.useDefault === false
                  ? t("orgSettings.voiceOnboardingStatusCustom")
                  : t("orgSettings.voiceOnboardingStatusDefault")}
              </p>
              <Link
                to="/settings/voice-onboarding"
                data-testid="settings-voice-onboarding-link"
                className="va-btn-secondary"
                style={{ display: "inline-flex", textDecoration: "none" }}
              >
                {t("orgSettings.voiceOnboardingLink")}
              </Link>
            </>
          )}
        </div>
      ) : null}

      {canManageOrgSettings ? (
        <div className="va-page-section" data-testid="settings-org-family-portal">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("orgSettings.familyPortalSection")}</h2>
          {orgLoading && !orgData ? (
            <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("orgSettings.loading")}</p>
          ) : (
            <>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  cursor: savingOrg ? "wait" : "pointer",
                  fontSize: "0.875rem",
                }}
              >
                <input
                  type="checkbox"
                  data-testid="settings-family-portal-enabled"
                  checked={familyPortalEnabled}
                  disabled={savingOrg || orgLoading}
                  onChange={(ev) => void handleFamilyPortalChange(ev.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ display: "block", fontWeight: 500 }}>{t("orgSettings.familyPortalEnabledBold")}</span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      color: "var(--va-slate-500)",
                      fontSize: "0.8125rem",
                      lineHeight: 1.45,
                    }}
                  >
                    {t("orgSettings.familyPortalEnabledDetail")}
                  </span>
                </span>
              </label>
              {familyPortalBannerKey ? (
                <p style={{ fontSize: "0.8125rem", marginTop: 10, color: "var(--va-slate-600)" }} role="status">
                  {t(`orgSettings.${familyPortalBannerKey}`)}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="va-page-section">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("profile.appearanceTitle")}</h2>
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
              ? t("profile.mfaStateOn", { count: mfaStatus.backupCodesRemaining })
              : t("profile.mfaStateOff")}
          </strong>
        </p>
        <Link
          to="/settings/mfa"
          data-testid="settings-mfa-link"
          className="va-btn-secondary"
          style={{ display: "inline-flex", textDecoration: "none", marginRight: 8 }}
        >
          {mfaStatus?.mfaEnabled ? t("profile.manageMfa") : t("profile.setupMfa")}
        </Link>
      </div>

      <div className="va-page-section">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("profile.privacyTitle")}</h2>
        <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", marginBottom: "0.75rem" }}>
          {t("profile.privacyBody")}
        </p>
        <Link to="/settings/privacy" data-testid="settings-privacy-link" className="va-btn-secondary" style={{ display: "inline-flex", textDecoration: "none" }}>
          {t("profile.privacyLink")}
        </Link>
      </div>

      {canSeeBilling ? (
        <div className="va-page-section">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("settings.billingTitle")}</h2>
          <p style={{ fontSize: "0.875rem", color: "var(--va-slate-600)", marginBottom: "0.75rem" }}>
            {t("settings.billingBody")}
          </p>
          <Link to="/settings/billing" data-testid="settings-billing-link" className="va-btn-secondary" style={{ display: "inline-flex", textDecoration: "none" }}>
            {t("settings.billingLink")}
          </Link>
        </div>
      ) : null}

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

      <div className="va-page-section">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>{t("profile.sessionTitle")}</h2>
        <button
          type="button"
          className="va-btn-secondary"
          data-testid="settings-sign-out"
          style={{ width: "100%" }}
          disabled={signingOut}
          onClick={() => void signOut()}
        >
          {signingOut ? t("profile.signingOut") : t("profile.signOut")}
        </button>
        <p className="va-settings-version">{t("profile.webVersion", { version: APP_VERSION })}</p>
      </div>
    </div>
  )
}
