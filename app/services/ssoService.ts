import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Complete the auth session in the browser
WebBrowser.maybeCompleteAuthSession();

// OAuth configuration from app config
const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId || 'your-google-client-id';
const MICROSOFT_CLIENT_ID = Constants.expoConfig?.extra?.microsoftClientId || 'your-microsoft-client-id';
const MICROSOFT_TENANT_ID = Constants.expoConfig?.extra?.microsoftTenantId || 'common';

// Redirect URI for OAuth
const redirectUri = AuthSession.makeRedirectUri();

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
      responseType: AuthSession.ResponseType.Code,
      extraParams: {},
      prompt: AuthSession.Prompt.SelectAccount,
    });
  }

  // Microsoft OAuth configuration
  private getMicrosoftAuthRequest() {
    return new AuthSession.AuthRequest({
      clientId: MICROSOFT_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      extraParams: {
        tenant: MICROSOFT_TENANT_ID,
      },
      prompt: AuthSession.Prompt.SelectAccount,
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
      if (GOOGLE_CLIENT_ID === 'your-google-client-id' || !GOOGLE_CLIENT_ID) {
        return {
          error: 'Google SSO not configured',
          description: 'Please contact your administrator to set up Google SSO.',
        };
      }

      const request = this.getGoogleAuthRequest();
      const endpoints = this.getGoogleEndpoints();

      const result = await request.promptAsync(endpoints);
      
      if (result.type === 'success') {
        // Exchange code for tokens
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: GOOGLE_CLIENT_ID,
            code: result.params.code,
            redirectUri,
            extraParams: {},
          },
          endpoints
        );

        // Get user info from Google
        const userInfo = await this.fetchGoogleUserInfo(tokenResult.accessToken);
        
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
      if (MICROSOFT_CLIENT_ID === 'your-microsoft-client-id' || !MICROSOFT_CLIENT_ID) {
        return {
          error: 'Microsoft SSO not configured',
          description: 'Please contact your administrator to set up Microsoft SSO.',
        };
      }

      const request = this.getMicrosoftAuthRequest();
      const endpoints = this.getMicrosoftEndpoints();

      const result = await request.promptAsync(endpoints);
      
      if (result.type === 'success') {
        // Exchange code for tokens
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: MICROSOFT_CLIENT_ID,
            code: result.params.code,
            redirectUri,
            extraParams: {
              tenant: MICROSOFT_TENANT_ID,
            },
          },
          endpoints
        );

        // Get user info from Microsoft
        const userInfo = await this.fetchMicrosoftUserInfo(tokenResult.accessToken);
        
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
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.myphonefriend.com'}/v1/sso/login`, {
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
        // Return the user info with tokens for the frontend to handle
        return {
          ...userInfo,
          tokens: data.tokens,
          backendUser: data.user,
        } as SSOUser & { tokens: any; backendUser: any };
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
