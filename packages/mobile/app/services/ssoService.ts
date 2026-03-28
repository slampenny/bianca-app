import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { DEFAULT_API_CONFIG } from './api/api';
import { ssoApi } from './api/ssoApi';
import { store } from '../store/store';
import { logger } from '../utils/logger';
import Config from '../config';

// Complete the auth session in the browser (required so the OAuth popup closes after redirect)
WebBrowser.maybeCompleteAuthSession();
// If you see "Cross-Origin-Opener-Policy would block window.closed" and SSO never completes,
// the app or CDN is sending Cross-Origin-Opener-Policy. For OAuth popup flow to work, either
// do not send that header or set it to "unsafe-none" for the web app origin (see docs/SSO-COOP.md).

// OAuth configuration - loaded from Expo config
const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId;
const MICROSOFT_CLIENT_ID = Constants.expoConfig?.extra?.microsoftClientId;
const MICROSOFT_TENANT_ID = Constants.expoConfig?.extra?.microsoftTenantId || 'common';

// Redirect URI for OAuth
// On web, use the current origin to ensure it matches OAuth provider configuration
// On mobile, use the Expo auth redirect URI
const getRedirectUri = (): string => {
  if (Platform.OS === 'web') {
    // For web, use the current origin (window.location.origin)
    // This ensures it matches what's configured in Google/Microsoft OAuth
    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin;
      return origin;
    }
    // Fallback to makeRedirectUri if window is not available
    return AuthSession.makeRedirectUri();
  }
  // For mobile, use the standard Expo redirect URI
  return AuthSession.makeRedirectUri();
};

const redirectUri = getRedirectUri();
// Intentionally no debug logging here to reduce console noise in web dev builds

const isWeb = () => Platform.OS === 'web';

const SSO_REDIRECT_STORAGE_KEY = 'sso_redirect_pending';

/** Web only: true if the current URL has OAuth callback params (?code= or #code=). */
export function hasSSOCallbackInUrl(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  if (new URLSearchParams(window.location.search).get('code')) return true;
  if (window.location.hash && new URLSearchParams(window.location.hash.replace(/^#/, '')).get('code')) return true;
  return false;
}

export interface SSORedirecting {
  redirecting: true;
}

export interface SSOUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'microsoft';
}

export interface SSOError {
  error: string;
  description?: string;
}

/** Result of `signInWithGoogle` / `signInWithMicrosoft` before narrowing. */
export type SSOSignInResult = SSOUser | SSOError | SSORedirecting;

export function isSSOUserResult(result: SSOSignInResult): result is SSOUser {
  return (
    typeof result === 'object' &&
    result !== null &&
    'provider' in result &&
    (result.provider === 'google' || result.provider === 'microsoft') &&
    'id' in result &&
    typeof (result as SSOUser).id === 'string'
  );
}

class SSOService {

  // Google OAuth configuration
  private getGoogleAuthRequest() {
    return new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code, // Use code flow with PKCE (more secure, better COOP compatibility)
      extraParams: {},
      prompt: AuthSession.Prompt.SelectAccount,
      usePKCE: true, // Enable PKCE for code flow
    });
  }

  // Microsoft OAuth configuration
  private getMicrosoftAuthRequest() {
    return new AuthSession.AuthRequest({
      clientId: MICROSOFT_CLIENT_ID,
      scopes: ['openid', 'profile', 'email', 'User.Read'], // Add User.Read for Microsoft Graph API access
      redirectUri,
      responseType: AuthSession.ResponseType.Code, // Use code flow with PKCE (more secure, better COOP compatibility)
      extraParams: {
        tenant: MICROSOFT_TENANT_ID,
      },
      prompt: AuthSession.Prompt.SelectAccount,
      usePKCE: true, // Enable PKCE for code flow
    });
  }

  // Google OAuth endpoints
  private getGoogleEndpoints() {
    return {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    };
  }

  // Microsoft OAuth endpoints
  private getMicrosoftEndpoints() {
    return {
      authorizationEndpoint: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`,
      tokenEndpoint: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
      revocationEndpoint: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/logout`,
    };
  }

  /**
   * Web-only: start SSO by redirecting the current tab to the provider.
   * Avoids COOP/popup issues. Call tryCompleteRedirectAuth() on app load after redirect.
   */
  private async startRedirectAuth(provider: 'google' | 'microsoft'): Promise<SSORedirecting> {
    if (!isWeb() || typeof window === 'undefined' || !window.sessionStorage) {
      throw new Error('Redirect auth is only supported on web');
    }
    const request = provider === 'google' ? this.getGoogleAuthRequest() : this.getMicrosoftAuthRequest();
    const endpoints = provider === 'google' ? this.getGoogleEndpoints() : this.getMicrosoftEndpoints();
    const authUrl = await request.makeAuthUrlAsync(endpoints);
    sessionStorage.setItem(SSO_REDIRECT_STORAGE_KEY, JSON.stringify({
      provider,
      codeVerifier: request.codeVerifier ?? '',
      state: request.state ?? '',
    }));
    window.location.href = authUrl;
    return { redirecting: true };
  }

  /**
   * Web-only: after redirect back from OAuth provider, exchange code and log in.
   * Call once on app load. Returns null if URL has no OAuth callback params.
   */
  async tryCompleteRedirectAuth(): Promise<(SSOUser & { tokens?: any; backendUser?: any; backendOrg?: any; backendClients?: any[]; backendAlerts?: any[] }) | SSOError | null> {
    if (!isWeb() || typeof window === 'undefined' || !window.location) return null;
    // Code can be in query (?code=) or in hash (#code=) depending on provider/config
    const params = new URLSearchParams(window.location.search);
    let code = params.get('code');
    let state = params.get('state');
    if (!code && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      code = code || hashParams.get('code');
      state = state || hashParams.get('state');
    }
    if (!code) return null;
    const stored = (() => {
      try {
        const raw = sessionStorage.getItem(SSO_REDIRECT_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as { provider: string; codeVerifier: string; state?: string };
      } catch {
        return null;
      }
    })();
    if (!stored) {
      return { error: 'Authentication failed', description: 'Session expired. Please try signing in again.' };
    }
    sessionStorage.removeItem(SSO_REDIRECT_STORAGE_KEY);
    // Clear URL without reload
    if (window.history.replaceState) {
      const cleanUrl = window.location.pathname || '/';
      window.history.replaceState({}, '', cleanUrl);
    }
    const { getDefaultApiConfig } = require('./api/api');
    const apiConfig = getDefaultApiConfig();
    try {
      const exchangeResponse = await fetch(`${apiConfig.url}/sso/exchange-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: stored.provider,
          code,
          redirectUri,
          codeVerifier: stored.codeVerifier || '',
        }),
      });
      const exchangeData = await exchangeResponse.json().catch(() => ({}));
      if (!exchangeResponse.ok || !exchangeData.success) {
        logger.error('Backend code exchange failed (redirect):', exchangeData);
        return { error: 'Authentication failed', description: exchangeData.message || 'Failed to exchange authorization code' };
      }
      const accessToken = exchangeData.accessToken;
      if (!accessToken) {
        return { error: 'Authentication failed', description: 'Failed to get access token from backend' };
      }
      const userInfo = stored.provider === 'microsoft'
        ? await this.fetchMicrosoftUserInfo(accessToken)
        : await this.fetchGoogleUserInfo(accessToken);
      const backendResponse = await this.authenticateWithBackend(userInfo);
      return backendResponse;
    } catch (err) {
      logger.error('Redirect SSO exchange error:', err);
      return {
        error: 'Authentication failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<SSOUser | SSOError | SSORedirecting> {
    try {
      if (!GOOGLE_CLIENT_ID) {
        return {
          error: 'Google SSO not configured',
          description: 'Please contact your administrator to set up Google SSO.',
        };
      }
      // On web, use redirect flow so SSO works even when COOP blocks the popup
      if (isWeb()) {
        return await this.startRedirectAuth('google');
      }

      const request = this.getGoogleAuthRequest();
      const endpoints = this.getGoogleEndpoints();

      const result = await request.promptAsync(endpoints);
      
      if (result.type === 'success') {
        // With code flow + PKCE, we get an authorization code
        const code = result.params.code;
        
        if (!code) {
          return {
            error: 'Authentication failed',
            description: 'No authorization code received from Google',
          };
        }

        // Exchange code for access token via BACKEND (which has the client_secret)
        const { getDefaultApiConfig } = require('./api/api');
        const apiConfig = getDefaultApiConfig();
        
        try {
          const exchangeUrl = `${apiConfig.url}/sso/exchange-code`;
          const exchangeResponse = await fetch(exchangeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider: 'google',
              code,
              redirectUri,
              codeVerifier: request.codeVerifier || '',
            }),
          });

          const exchangeData = await exchangeResponse.json().catch(() => ({}));

          if (!exchangeResponse.ok || !exchangeData.success) {
            logger.error('Backend code exchange failed:', exchangeData);
            return {
              error: 'Authentication failed',
              description: exchangeData.message || 'Failed to exchange authorization code',
            };
          }

          const accessToken = exchangeData.accessToken;
          
          if (!accessToken) {
            return {
              error: 'Authentication failed',
              description: 'Failed to get access token from backend',
            };
          }

          // Get user info from Google
          const userInfo = await this.fetchGoogleUserInfo(accessToken);
          
          // Send to backend for authentication
          const backendResponse = await this.authenticateWithBackend(userInfo);
          return backendResponse;
        } catch (exchangeError) {
          logger.error('Code exchange error:', exchangeError);
          const isNetworkError =
            exchangeError instanceof TypeError &&
            (exchangeError.message === 'Failed to fetch' || exchangeError.message?.includes('fetch'));
          const description = isNetworkError
            ? `Cannot reach the server at ${apiConfig.url}. Make sure the backend is running (e.g. \`yarn workspace backend start\` or \`cd packages/backend && yarn start\`).`
            : exchangeError instanceof Error ? exchangeError.message : 'Failed to exchange code for token';
          return {
            error: 'Authentication failed',
            description,
          };
        }
      } else {
        logger.warn('Google OAuth result:', { type: result.type, params: (result as { params?: unknown }).params });
        return {
          error: 'Authentication cancelled',
          description: result.type === 'cancel' ? 'User cancelled the authentication' : 'Authentication failed',
        };
      }
    } catch (error) {
      logger.error('Google sign-in error:', error);
      return {
        error: 'Google sign-in failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Sign in with Microsoft
  async signInWithMicrosoft(): Promise<SSOUser | SSOError | SSORedirecting> {
    try {
      if (!MICROSOFT_CLIENT_ID) {
        return {
          error: 'Microsoft SSO not configured',
          description: 'Please contact your administrator to set up Microsoft SSO.',
        };
      }
      if (isWeb()) {
        return await this.startRedirectAuth('microsoft');
      }

      const request = this.getMicrosoftAuthRequest();
      const endpoints = this.getMicrosoftEndpoints();

      const result = await request.promptAsync(endpoints);
      
      if (result.type === 'success') {
        // With code flow + PKCE, we get an authorization code
        const code = result.params.code;
        
        if (!code) {
          return {
            error: 'Authentication failed',
            description: 'No authorization code received from Microsoft',
          };
        }

        // Exchange code for access token via BACKEND (which has the client_secret)
        const { getDefaultApiConfig } = require('./api/api');
        const apiConfig = getDefaultApiConfig();
        
        try {
          const exchangeUrl = `${apiConfig.url}/sso/exchange-code`;
          const exchangeResponse = await fetch(exchangeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider: 'microsoft',
              code,
              redirectUri,
              codeVerifier: request.codeVerifier || '',
            }),
          });

          const exchangeData = await exchangeResponse.json().catch(() => ({}));

          if (!exchangeResponse.ok || !exchangeData.success) {
            logger.error('Backend code exchange failed:', exchangeData);
            return {
              error: 'Authentication failed',
              description: exchangeData.message || 'Failed to exchange authorization code',
            };
          }

          const accessToken = exchangeData.accessToken;
          
          if (!accessToken) {
            return {
              error: 'Authentication failed',
              description: 'Failed to get access token from backend',
            };
          }

          // Get user info from Microsoft
          const userInfo = await this.fetchMicrosoftUserInfo(accessToken);
          
          // Send to backend for authentication
          const backendResponse = await this.authenticateWithBackend(userInfo);
          return backendResponse;
        } catch (exchangeError) {
          logger.error('Code exchange error:', exchangeError);
          const isNetworkError =
            exchangeError instanceof TypeError &&
            (exchangeError.message === 'Failed to fetch' || exchangeError.message?.includes('fetch'));
          const description = isNetworkError
            ? `Cannot reach the server at ${apiConfig.url}. Make sure the backend is running (e.g. \`yarn workspace backend start\` or \`cd packages/backend && yarn start\`).`
            : exchangeError instanceof Error ? exchangeError.message : 'Failed to exchange code for token';
          return {
            error: 'Authentication failed',
            description,
          };
        }
      } else {
        logger.warn('Microsoft OAuth result:', { type: result.type, params: (result as { params?: unknown }).params });
        return {
          error: 'Authentication cancelled',
          description: result.type === 'cancel' ? 'User cancelled the authentication' : 'Authentication failed',
        };
      }
    } catch (error) {
      logger.error('Microsoft sign-in error:', error);
      return {
        error: 'Microsoft sign-in failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Fetch user info from Google
  private async fetchGoogleUserInfo(accessToken: string): Promise<SSOUser> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Google user info');
    }

    const userInfo = await response.json();
    
    const email = userInfo.email ? String(userInfo.email).trim().toLowerCase() : userInfo.email;
    return {
      id: userInfo.id,
      email,
      name: userInfo.name,
      picture: userInfo.picture,
      provider: 'google',
    };
  }

  // Fetch user info from Microsoft
  private async fetchMicrosoftUserInfo(accessToken: string): Promise<SSOUser> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to fetch Microsoft user info', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`Failed to fetch Microsoft user info: ${response.status} ${response.statusText}`);
    }

    const userInfo = await response.json();
    
    logger.info('Microsoft user info fetched successfully', {
      id: userInfo.id,
      email: userInfo.mail || userInfo.userPrincipalName,
      displayName: userInfo.displayName,
    });
    
    const rawEmail = userInfo.mail || userInfo.userPrincipalName;
    const email = rawEmail ? String(rawEmail).trim().toLowerCase() : rawEmail;
    return {
      id: userInfo.id,
      email,
      name: userInfo.displayName,
      picture: userInfo.photo ? `https://graph.microsoft.com/v1.0/me/photo/$value` : undefined,
      provider: 'microsoft',
    };
  }

  // Authenticate with backend using RTK Query
  private async authenticateWithBackend(userInfo: SSOUser): Promise<SSOUser | SSOError> {
    try {
      // Log API configuration for debugging
      const { getDefaultApiConfig } = require('./api/api');
      const apiConfig = getDefaultApiConfig();
      
      // Prepare request payload - only include picture if it's a valid non-empty string
      const requestPayload = {
        provider: userInfo.provider,
        email: userInfo.email,
        name: userInfo.name,
        id: userInfo.id,
        ...(userInfo.picture && userInfo.picture.trim() ? { picture: userInfo.picture } : {}),
      };
      
      // Intentionally no debug logging here to reduce console noise in web dev builds
      
      // Use RTK Query mutation for backend authentication
      const result = (store.dispatch as (arg: unknown) => { unwrap: () => Promise<{ success?: boolean; tokens?: unknown; caregiver?: unknown; org?: unknown; clients?: unknown[]; alerts?: unknown[]; message?: string }> })(ssoApi.endpoints.ssoLogin.initiate(requestPayload));

      try {
        const data = await result.unwrap();

        if (data?.success) {
          // Return the user info with tokens, org, clients, and alerts for the frontend to handle
          return {
            ...userInfo,
            tokens: data.tokens,
            backendUser: data.caregiver,
            backendOrg: data.org,
            backendClients: data.clients,
            backendAlerts: data.alerts,
          } as SSOUser & { tokens: any; backendUser: any; backendOrg?: any; backendClients?: any[]; backendAlerts?: any[] };
        }

        return {
          error: 'Backend authentication failed',
          description: data?.message || 'Unknown backend error',
        };
      } catch (rtkError: any) {
        const errorData = rtkError?.data;
        const errorStatus = rtkError?.status;
        const fallbackMessage =
          rtkError?.error ||
          rtkError?.message ||
          'Failed to authenticate with backend';

        // Log detailed error information for debugging
        logger.error('SSO backend authentication error:', {
          status: errorStatus,
          statusCode: errorData?.code || errorData?.statusCode,
          message: errorData?.message,
          error: errorData?.error,
          data: errorData,
          fullError: rtkError,
          apiUrl: apiConfig.url,
          endpoint: '/sso/login',
          userInfo: { email: userInfo.email, provider: userInfo.provider }
        });

        // Extract error message from various possible locations
        // Backend returns { code, message } format
        let errorMessage = 'Failed to authenticate with backend';

        if (errorData) {
          // Backend error format: { code: number, message: string }
          errorMessage = errorData.message ||
                        errorData.error ||
                        errorData.description ||
                        errorMessage;
        } else {
          errorMessage = fallbackMessage;
        }

        // Add status code information if available
        if (errorStatus === 'FETCH_ERROR') {
          errorMessage = `Network error: Unable to connect to the server. Please check your connection and try again.`;
        } else if (errorStatus === 'PARSING_ERROR') {
          errorMessage = `Server response error: ${errorMessage}. Please try again.`;
        } else if (errorStatus && typeof errorStatus === 'number') {
          // RTK Query HTTP status code
          errorMessage = `Server error (${errorStatus}): ${errorMessage}`;
        } else if (errorData?.code) {
          // Backend error code
          errorMessage = `Server error (${errorData.code}): ${errorMessage}`;
        } else if (errorData?.statusCode) {
          // Alternative status code location
          errorMessage = `Server error (${errorData.statusCode}): ${errorMessage}`;
        }

        return {
          error: 'Backend authentication failed',
          description: errorMessage,
        };
      } finally {
        const r = result as { unsubscribe?: () => void }
        if (typeof r?.unsubscribe === 'function') {
          r.unsubscribe();
        }
      }
    } catch (error) {
      logger.error('Backend authentication error (catch block):', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userInfo: { email: userInfo.email, provider: userInfo.provider }
      });
      return {
        error: 'Backend authentication failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Sign out (revoke tokens)
  async signOut(provider: 'google' | 'microsoft'): Promise<void> {
    try {
      if (provider === 'google') {
        // Google doesn't require explicit sign out for web
        // The user will be signed out when they close the browser
        return;
      } else if (provider === 'microsoft') {
        // Microsoft sign out
        const signOutUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/logout`;
        await WebBrowser.openAuthSessionAsync(signOutUrl, redirectUri);
      }
    } catch (error) {
      logger.error('Sign out error:', error);
    }
  }
}

export const ssoService = new SSOService();
