import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { DEFAULT_API_CONFIG } from './api/api';

// Complete the auth session in the browser
WebBrowser.maybeCompleteAuthSession();

// OAuth configuration - loaded from Expo config
const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId;
const MICROSOFT_CLIENT_ID = Constants.expoConfig?.extra?.microsoftClientId;
const MICROSOFT_TENANT_ID = Constants.expoConfig?.extra?.microsoftTenantId || 'common';

// Redirect URI for OAuth - Use AuthSession.makeRedirectUri() for now
const redirectUri = AuthSession.makeRedirectUri();
console.log('OAuth Redirect URI:', redirectUri);
console.log('OAuth Client IDs:', {
  google: GOOGLE_CLIENT_ID ? 'configured' : 'missing',
  microsoft: MICROSOFT_CLIENT_ID ? 'configured' : 'missing',
  tenant: MICROSOFT_TENANT_ID
});

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
      console.error('Google sign-in error:', error);
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
      console.error('Microsoft sign-in error:', error);
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

  // Authenticate with backend
  private async authenticateWithBackend(userInfo: SSOUser): Promise<SSOUser | SSOError> {
    try {
      const response = await fetch(`${DEFAULT_API_CONFIG.url}/sso/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: userInfo.provider,
          email: userInfo.email,
          name: userInfo.name,
          id: userInfo.id,
          picture: userInfo.picture,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: 'Backend authentication failed',
          description: data.message || 'Failed to authenticate with backend',
        };
      }

      if (data.success) {
        // Return the user info with tokens and org for the frontend to handle
        return {
          ...userInfo,
          tokens: data.tokens,
          backendUser: data.user,
          backendOrg: data.org,
        } as SSOUser & { tokens: any; backendUser: any; backendOrg?: any };
      } else {
        return {
          error: 'Backend authentication failed',
          description: data.message || 'Unknown backend error',
        };
      }
    } catch (error) {
      console.error('Backend authentication error:', error);
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
      console.error('Sign out error:', error);
    }
  }
}

export const ssoService = new SSOService();
