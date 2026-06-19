import { getApiBaseUrl } from "../config/api"
import {
  getGoogleClientId,
  getMicrosoftClientId,
  getMicrosoftTenantId,
} from "../config/sso"

const SSO_REDIRECT_STORAGE_KEY = "sso_redirect_pending"
export const SSO_REDIRECT_ERROR_KEY = "sso_redirect_error"

/** True while an OAuth redirect callback is being processed (survives StrictMode remount). */
let oauthCallbackActive = false

export function isOAuthCallbackActive(): boolean {
  if (typeof window === "undefined") return false
  return oauthCallbackActive || hasSSOCallbackInUrl()
}

function markOAuthCallbackStarted(): void {
  oauthCallbackActive = true
}

export function clearOAuthCallbackActive(): void {
  oauthCallbackActive = false
}

function clearOAuthUrl(): void {
  if (typeof window === "undefined" || !window.history.replaceState) return
  const cleanUrl = window.location.pathname || "/"
  window.history.replaceState({}, "", cleanUrl)
}

export function consumeSsoRedirectError(): string | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SSO_REDIRECT_ERROR_KEY)
    sessionStorage.removeItem(SSO_REDIRECT_ERROR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { description?: string }
    return parsed.description ?? null
  } catch {
    return null
  }
}

export interface SSORedirecting {
  redirecting: true
}

export interface SSOUser {
  id: string
  email: string
  name: string
  picture?: string
  provider: "google" | "microsoft"
}

export interface SSOError {
  error: string
  description?: string
}

export function hasSSOCallbackInUrl(): boolean {
  if (typeof window === "undefined" || !window.location) return false
  if (new URLSearchParams(window.location.search).get("code")) return true
  if (window.location.hash) {
    const hp = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    if (hp.get("code")) return true
  }
  return false
}

function getRedirectUri(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }
  return ""
}

function randomBase64Url(byteLength = 32): string {
  const arr = new Uint8Array(byteLength)
  crypto.getRandomValues(arr)
  let s = ""
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i])
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function sha256Base64Url(plain: string): Promise<string> {
  const enc = new TextEncoder().encode(plain)
  const buf = await crypto.subtle.digest("SHA-256", enc)
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

type StoredRedirect = {
  provider: "google" | "microsoft"
  codeVerifier: string
  state: string
}

async function buildGoogleAuthUrl(verifier: string, state: string): Promise<string> {
  const clientId = getGoogleClientId()
  if (!clientId) throw new Error("Google SSO not configured")
  const redirectUri = getRedirectUri()
  const challenge = await sha256Base64Url(verifier)
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`
}

async function buildMicrosoftAuthUrl(verifier: string, state: string): Promise<string> {
  const clientId = getMicrosoftClientId()
  if (!clientId) throw new Error("Microsoft SSO not configured")
  const tenant = getMicrosoftTenantId()
  const redirectUri = getRedirectUri()
  const challenge = await sha256Base64Url(verifier)
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email User.Read",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  })
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${p.toString()}`
}

export async function startSsoRedirect(provider: "google" | "microsoft"): Promise<SSORedirecting | SSOError> {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return { error: "SSO unavailable", description: "Not in a browser environment." }
  }
  const redirectUri = getRedirectUri()
  if (!redirectUri) {
    return { error: "SSO unavailable", description: "Could not determine redirect URL." }
  }

  try {
    const codeVerifier = randomBase64Url(32)
    const state = randomBase64Url(16)
    const authUrl =
      provider === "google"
        ? await buildGoogleAuthUrl(codeVerifier, state)
        : await buildMicrosoftAuthUrl(codeVerifier, state)

    const payload: StoredRedirect = { provider, codeVerifier, state }
    sessionStorage.setItem(SSO_REDIRECT_STORAGE_KEY, JSON.stringify(payload))
    window.location.href = authUrl
    return { redirecting: true }
  } catch (e) {
    return {
      error: "SSO failed",
      description: e instanceof Error ? e.message : "Unknown error",
    }
  }
}

async function fetchGoogleUserInfo(accessToken: string): Promise<SSOUser> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error("Failed to fetch Google user info")
  const userInfo = (await response.json()) as {
    id?: string
    email?: string
    name?: string
    picture?: string
  }
  const email = userInfo.email ? String(userInfo.email).trim().toLowerCase() : ""
  return {
    id: String(userInfo.id ?? ""),
    email,
    name: String(userInfo.name ?? ""),
    picture: userInfo.picture,
    provider: "google",
  }
}

async function fetchMicrosoftUserInfo(accessToken: string): Promise<SSOUser> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`Failed to fetch Microsoft user info: ${response.status}`)
  const userInfo = (await response.json()) as {
    id?: string
    mail?: string
    userPrincipalName?: string
    displayName?: string
  }
  const raw = userInfo.mail || userInfo.userPrincipalName
  const email = raw ? String(raw).trim().toLowerCase() : ""
  return {
    id: String(userInfo.id ?? ""),
    email,
    name: String(userInfo.displayName ?? ""),
    provider: "microsoft",
  }
}

type SsoLoginSuccess = {
  success?: boolean
  tokens?: unknown
  caregiver?: unknown
  org?: unknown
  clients?: unknown[]
  alerts?: unknown[]
  message?: string
}

async function authenticateWithBackend(userInfo: SSOUser): Promise<
  | (SSOUser & {
      tokens: unknown
      backendUser: unknown
      backendOrg?: unknown
      backendClients?: unknown[]
      backendAlerts?: unknown[]
    })
  | SSOError
> {
  const apiBase = getApiBaseUrl()
  const body: Record<string, string> = {
    provider: userInfo.provider,
    email: userInfo.email,
    name: userInfo.name,
    id: userInfo.id,
  }
  if (userInfo.picture?.trim()) body.picture = userInfo.picture.trim()

  let res: Response
  try {
    res = await fetch(`${apiBase}/sso/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error"
    return {
      error: "Backend authentication failed",
      description:
        msg === "Failed to fetch"
          ? `Cannot reach the server at ${apiBase}. Check your connection.`
          : msg,
    }
  }

  const data = (await res.json().catch(() => ({}))) as SsoLoginSuccess
  if (!res.ok || !data.success) {
    const message =
      (typeof data.message === "string" && data.message) ||
      `Server error (${res.status})`
    return { error: "Backend authentication failed", description: message }
  }
  if (!data.tokens || !data.caregiver) {
    return {
      error: "Backend authentication failed",
      description: "Incomplete response from server",
    }
  }
  return {
    ...userInfo,
    tokens: data.tokens,
    backendUser: data.caregiver,
    backendOrg: data.org,
    backendClients: data.clients,
    backendAlerts: data.alerts,
  }
}

/**
 * After OAuth redirect, exchange code and complete backend login. Clears query/hash from URL.
 * Returns null if no `code` in URL.
 *
 * React StrictMode (Vite dev / staging live-dev) mounts twice; reuse one in-flight exchange
 * so the auth code and sessionStorage PKCE state are not consumed by parallel runs.
 */
let redirectAuthInFlight: Promise<
  | (SSOUser & {
      tokens?: unknown
      backendUser?: unknown
      backendOrg?: unknown
      backendClients?: unknown[]
      backendAlerts?: unknown[]
    })
  | SSOError
  | null
> | null = null

async function completeRedirectAuthOnce(
  code: string,
  state: string | null,
): Promise<
  | (SSOUser & {
      tokens?: unknown
      backendUser?: unknown
      backendOrg?: unknown
      backendClients?: unknown[]
      backendAlerts?: unknown[]
    })
  | SSOError
> {
  const redirectUri = getRedirectUri()
  let stored: StoredRedirect | null = null
  try {
    const raw = sessionStorage.getItem(SSO_REDIRECT_STORAGE_KEY)
    if (raw) stored = JSON.parse(raw) as StoredRedirect
  } catch {
    stored = null
  }
  if (!stored) {
    return {
      error: "Authentication failed",
      description: "Session expired. Please try signing in again.",
    }
  }
  if (state && stored.state && state !== stored.state) {
    sessionStorage.removeItem(SSO_REDIRECT_STORAGE_KEY)
    return {
      error: "Authentication failed",
      description: "Invalid sign-in state. Please try again.",
    }
  }

  const apiBase = getApiBaseUrl()
  let exchangeResponse: Response
  try {
    exchangeResponse = await fetch(`${apiBase}/sso/exchange-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: stored.provider,
        code,
        redirectUri,
        codeVerifier: stored.codeVerifier || "",
      }),
    })
  } catch (e) {
    return {
      error: "Authentication failed",
      description: e instanceof Error ? e.message : "Failed to exchange code",
    }
  }

  const exchangeData = (await exchangeResponse.json().catch(() => ({}))) as {
    success?: boolean
    accessToken?: string
    message?: string
  }
  if (!exchangeResponse.ok || !exchangeData.success) {
    return {
      error: "Authentication failed",
      description: exchangeData.message || "Failed to exchange authorization code",
    }
  }
  const accessToken = exchangeData.accessToken
  if (!accessToken) {
    return {
      error: "Authentication failed",
      description: "Failed to get access token from server",
    }
  }

  const userInfo =
    stored.provider === "microsoft"
      ? await fetchMicrosoftUserInfo(accessToken)
      : await fetchGoogleUserInfo(accessToken)

  sessionStorage.removeItem(SSO_REDIRECT_STORAGE_KEY)
  const loginResult = await authenticateWithBackend(userInfo)
  if (!("error" in loginResult)) {
    clearOAuthUrl()
  }
  return loginResult
}

export async function tryCompleteRedirectAuth(): Promise<
  | (SSOUser & {
      tokens?: unknown
      backendUser?: unknown
      backendOrg?: unknown
      backendClients?: unknown[]
      backendAlerts?: unknown[]
    })
  | SSOError
  | null
> {
  if (typeof window === "undefined" || !window.location) return null

  const params = new URLSearchParams(window.location.search)
  let code = params.get("code")
  let state = params.get("state")
  if (!code && window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    code = code || hashParams.get("code")
    state = state || hashParams.get("state")
  }
  if (!code) return null

  markOAuthCallbackStarted()

  if (redirectAuthInFlight) {
    return redirectAuthInFlight
  }

  redirectAuthInFlight = completeRedirectAuthOnce(code, state).finally(() => {
    redirectAuthInFlight = null
  })

  return redirectAuthInFlight
}
