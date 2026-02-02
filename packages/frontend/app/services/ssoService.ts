import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { DEFAULT_API_CONFIG } from './api/api';
import { ssoApi } from './api/ssoApi';
import { store } from '../store/store';
import { logger } from '../utils/logger';
import Config from '../config';

// Complete the auth session in the browser
WebBrowser.maybeCompleteAuthSession();

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

class SSOService {

  // Google OAuth configuration
  private getGoogleAuthRequest() {
    return new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token, // Use implicit flow for web
      extraParams: {},
      prompt: AuthSession.Prompt.SelectAccount,
      usePKCE: false, // Disable PKCE for implicit flow
    });
  }

  // Microsoft OAuth configuration
  private getMicrosoftAuthRequest() {
    return new AuthSession.AuthRequest({
      clientId: MICROSOFT_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token, // Use implicit flow for web
      extraParams: {
        tenant: MICROSOFT_TENANT_ID,
      },
      prompt: AuthSession.Prompt.SelectAccount,
      usePKCE: false, // Disable PKCE for implicit flow
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

  // Sign in with Google
  async signInWithGoogle(): Promise<SSOUser | SSOError> {
    try {
      // Check if Google client ID is configured
      if (!GOOGLE_CLIENT_ID) {
        return {
          error: 'Google SSO not configured',
          description: 'Please contact your administrator to set up Google SSO.',
        };
      }

      const request = this.getGoogleAuthRequest();
      const endpoints = this.getGoogleEndpoints();

      const result = await request.promptAsync(endpoints);
      
      if (result.type === 'success') {
        // With implicit flow, we get the access token directly
        const accessToken = result.params.access_token;
        
        if (!accessToken) {
          return {
            error: 'Authentication failed',
            description: 'No access token received from Google',
          };
        }

        // Get user info from Google
        const userInfo = await this.fetchGoogleUserInfo(accessToken);
        
        // Send to backend for authentication
        const backendResponse = await this.authenticateWithBackend(userInfo);
        return backendResponse;
      } else {
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
  async signInWithMicrosoft(): Promise<SSOUser | SSOError> {
    try {
      // Check if Microsoft client ID is configured
      if (!MICROSOFT_CLIENT_ID) {
        return {
          error: 'Microsoft SSO not configured',
          description: 'Please contact your administrator to set up Microsoft SSO.',
        };
      }

      const request = this.getMicrosoftAuthRequest();
      const endpoints = this.getMicrosoftEndpoints();

      const result = await request.promptAsync(endpoints);
      
      if (result.type === 'success') {
        // With implicit flow, we get the access token directly
        const accessToken = result.params.access_token;
        
        if (!accessToken) {
          return {
            error: 'Authentication failed',
            description: 'No access token received from Microsoft',
          };
        }

        // Get user info from Microsoft
        const userInfo = await this.fetchMicrosoftUserInfo(accessToken);
        
        // Send to backend for authentication
        const backendResponse = await this.authenticateWithBackend(userInfo);
        return backendResponse;
      } else {
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
    
    return {
      id: userInfo.id,
      email: userInfo.email,
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
      throw new Error('Failed to fetch Microsoft user info');
    }

    const userInfo = await response.json();
    
    return {
      id: userInfo.id,
      email: userInfo.mail || userInfo.userPrincipalName,
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
      const result = store.dispatch(
        ssoApi.endpoints.ssoLogin.initiate(requestPayload)
      );

      try {
        // Unwrap throws on RTK Query errors, returns payload on success
        const data = await result.unwrap();

        if (data?.success) {
          // Return the user info with tokens, org, patients, and alerts for the frontend to handle
          return {
            ...userInfo,
            tokens: data.tokens,
            backendUser: data.caregiver,
            backendOrg: data.org,
            backendPatients: data.patients,
            backendAlerts: data.alerts,
          } as SSOUser & { tokens: any; backendUser: any; backendOrg?: any; backendPatients?: any[]; backendAlerts?: any[] };
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
        if (typeof (result as any)?.unsubscribe === 'function') {
          result.unsubscribe();
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
