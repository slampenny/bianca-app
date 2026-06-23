import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { authApi } from "../services/api/authApi"
import { caregiverApi } from "../services/api/caregiverApi"
import { ssoApi } from "../services/api/ssoApi"
import { AuthTokens, Caregiver } from "../services/api/api.types"
import { RootState } from "./store"
import { logger } from "../utils/logger"

interface AuthState {
  tokens: AuthTokens | null // This is the JWT token
  authEmail: string
  currentUser: Caregiver | null
  inviteToken: string | null // Store invite token for invited users
  /** True only when user just completed registration (verify-email) or first-time SSO; never true after normal email/password login */
  pendingOnboarding: boolean
  /** B2C first-run wizard completed or skipped */
  lovedOneSetupComplete: boolean
}

const initialState: AuthState = {
  tokens: null,
  authEmail: "",
  currentUser: null,
  inviteToken: null,
  pendingOnboarding: false,
  lovedOneSetupComplete: false,
}

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthTokens(state, action: PayloadAction<AuthTokens>) {
      state.tokens = action.payload
    },
    setAuthEmail(state, action: PayloadAction<string>) {
      state.authEmail = action.payload
    },
    setCurrentUser(state, action: PayloadAction<Caregiver>) {
      state.currentUser = action.payload
    },
    clearAuth(state) {
      state.tokens = null
      state.authEmail = ""
      state.currentUser = null
      state.inviteToken = null
      state.pendingOnboarding = false
      state.lovedOneSetupComplete = false
    },
    setInviteToken(state, action: PayloadAction<string | null>) {
      state.inviteToken = action.payload
    },
    setPendingOnboarding(state, action: PayloadAction<boolean>) {
      state.pendingOnboarding = action.payload
    },
    setLovedOneSetupComplete(state) {
      state.lovedOneSetupComplete = true
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.register.matchFulfilled, (state, { payload }) => {
      // Register endpoint doesn't return tokens - only caregiver info
      state.currentUser = payload.caregiver
      // Tokens are not set on register - user needs to verify email first
    })
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      // Login response can be either success with user data or MFA requirement
      if ('caregiver' in payload && 'tokens' in payload) {
        state.currentUser = payload.caregiver
        state.tokens = payload.tokens
        state.pendingOnboarding = false
        if (payload.caregiver.clients?.length) {
          state.lovedOneSetupComplete = true
        }
      }
    })
    builder.addMatcher(authApi.endpoints.registerWithInvite.matchFulfilled, (state, { payload }) => {
      state.currentUser = payload.caregiver
      state.tokens = payload.tokens
      state.inviteToken = null // Clear invite token after successful registration
      state.pendingOnboarding = payload.caregiver?.onboardingComplete === false
      if (payload.caregiver?.clients?.length) {
        state.lovedOneSetupComplete = true
      }
    })
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      state.tokens = null
      state.authEmail = ""
      state.currentUser = null
      state.inviteToken = null
      state.pendingOnboarding = false
      state.lovedOneSetupComplete = false
    })
    // Also clear local state if logout fails (e.g., network error, expired token)
    // This ensures users can always log out locally even if the API is down
    builder.addMatcher(authApi.endpoints.logout.matchRejected, (state) => {
      logger.warn('[authSlice] Logout API failed, clearing local state anyway')
      state.tokens = null
      state.authEmail = ""
      state.currentUser = null
      state.inviteToken = null
      state.pendingOnboarding = false
      state.lovedOneSetupComplete = false
    })
    builder.addMatcher(authApi.endpoints.refreshTokens.matchFulfilled, (state, { payload }) => {
      logger.debug("refreshed tokens", JSON.stringify(payload.tokens))
      state.tokens = payload.tokens
    })
    // Do NOT clear state on refresh failure: a 401 on refresh can be due to COOP/popup issues
    // or a one-off failure. Clearing here would log the user out right after SSO. If tokens
    // are truly invalid, the next authenticated API call will 401 and we show the auth modal.
    builder.addMatcher(authApi.endpoints.refreshTokens.matchRejected, (state) => {
      logger.warn("Failed to refresh tokens (keeping current session until next 401)")
    })
    builder.addMatcher(
      caregiverApi.endpoints.updateCaregiver.matchFulfilled,
      (state, { payload }) => {
        // Check if the updated user is the same as the current user
        if (state.currentUser && payload.id === state.currentUser.id) {
          state.currentUser = payload
        }
      },
    )
    builder.addMatcher(authApi.endpoints.completeOnboarding.matchFulfilled, (state, { payload }) => {
      if (payload?.caregiver && state.currentUser && payload.caregiver.id === state.currentUser.id) {
        state.currentUser = payload.caregiver
      }
      state.pendingOnboarding = false
      state.lovedOneSetupComplete = false
    })
    // Verify-email (after registration): allow onboarding flow only when backend says incomplete
    builder.addMatcher(authApi.endpoints.verifyEmail.matchFulfilled, (state, { payload }) => {
      if (payload?.tokens && payload?.caregiver) {
        state.tokens = payload.tokens;
        state.currentUser = payload.caregiver;
        state.authEmail = payload.caregiver?.email ?? state.authEmail;
        state.pendingOnboarding = payload.caregiver?.onboardingComplete === false;
      }
    })
    // SSO login: update store when API succeeds so we don't rely only on component callback (avoids empty profile after redirect/reload)
    builder.addMatcher(ssoApi.endpoints.ssoLogin.matchFulfilled, (state, { payload }) => {
      // Validate that we have complete caregiver data before updating state
      if (payload?.success && payload?.tokens && payload?.caregiver) {
        // Additional validation: ensure caregiver has required fields
        const caregiver = payload.caregiver;
        if (caregiver.id && caregiver.email && caregiver.name) {
          logger.debug('[authSlice] SSO login fulfilled, setting tokens and caregiver:', { 
            caregiverId: caregiver.id, 
            email: caregiver.email,
            hasOrg: !!caregiver.org 
          });
          state.tokens = payload.tokens;
          state.currentUser = caregiver;
          if (caregiver.email) state.authEmail = caregiver.email;
          // First-time SSO: show onboarding only when backend says incomplete
          state.pendingOnboarding = caregiver.onboardingComplete === false;
        } else {
          logger.error('[authSlice] SSO login fulfilled but caregiver data incomplete:', {
            hasId: !!caregiver.id,
            hasEmail: !!caregiver.email,
            hasName: !!caregiver.name,
            caregiver: caregiver
          });
        }
      } else {
        logger.warn('[authSlice] SSO login fulfilled but payload incomplete:', {
          hasSuccess: !!payload?.success,
          hasTokens: !!payload?.tokens,
          hasCaregiver: !!payload?.caregiver
        });
      }
    })
  },
})

export const { setAuthTokens, setAuthEmail, setCurrentUser, clearAuth, setInviteToken, setPendingOnboarding, setLovedOneSetupComplete } = authSlice.actions

export const isAuthenticated = (state: RootState) => {
  return !!state.auth.tokens
}

export const getValidationError = (state: { auth: AuthState }) => {
  if (state.auth.authEmail.length === 0) return "can't be blank"
  if (state.auth.authEmail.length < 6) return "must be at least 6 characters"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.auth.authEmail))
    return "must be a valid email address"
  return ""
}

export const getCurrentUser = (state: RootState) => state.auth.currentUser
export const getAuthEmail = (state: { auth: AuthState }) => state.auth.authEmail
export const getAuthTokens = (state: { auth: AuthState }) => {
  return state.auth.tokens
}
export const getInviteToken = (state: RootState) => {
  return state.auth.inviteToken
}
export const getPendingOnboarding = (state: RootState) => state.auth.pendingOnboarding
export const getLovedOneSetupComplete = (state: RootState) => state.auth.lovedOneSetupComplete

export default authSlice.reducer
