import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { authApi } from "../services/api/authApi"
import { caregiverApi } from "../services/api/caregiverApi"
import { AuthTokens, Caregiver } from "../services/api/api.types"
import { RootState } from "./store"
import { logger } from "../utils/logger"

interface AuthState {
  tokens: AuthTokens | null // This is the JWT token
  authEmail: string
  currentUser: Caregiver | null
  inviteToken: string | null // Store invite token for invited users
}

const initialState: AuthState = {
  tokens: null,
  authEmail: "",
  currentUser: null,
  inviteToken: null,
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
    },
    setInviteToken(state, action: PayloadAction<string | null>) {
      state.inviteToken = action.payload
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.register.matchFulfilled, (state, { payload }) => {
      state.currentUser = payload.caregiver
      state.tokens = payload.tokens
    })
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      // Only set user and tokens if MFA is not required (when MFA is required, payload only has tempToken)
      if (!payload.requireMFA) {
        state.currentUser = payload.caregiver
        state.tokens = payload.tokens
      }
    })
    builder.addMatcher(authApi.endpoints.registerWithInvite.matchFulfilled, (state, { payload }) => {
      state.currentUser = payload.caregiver
      state.tokens = payload.tokens
      state.inviteToken = null // Clear invite token after successful registration
    })
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      state.tokens = null
      state.authEmail = ""
      state.currentUser = null
      state.inviteToken = null
    })
    // Also clear local state if logout fails (e.g., network error, expired token)
    // This ensures users can always log out locally even if the API is down
    builder.addMatcher(authApi.endpoints.logout.matchRejected, (state) => {
      logger.warn('[authSlice] Logout API failed, clearing local state anyway')
      state.tokens = null
      state.authEmail = ""
      state.currentUser = null
      state.inviteToken = null
    })
    builder.addMatcher(authApi.endpoints.refreshTokens.matchFulfilled, (state, { payload }) => {
      logger.debug("refreshed tokens", JSON.stringify(payload.tokens))
      state.tokens = payload.tokens
    })
    // Add this block
    builder.addMatcher(authApi.endpoints.refreshTokens.matchRejected, (state) => {
      logger.warn("Failed to refresh tokens")
      state.tokens = null
      state.currentUser = null
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
  },
})

export const { setAuthTokens, setAuthEmail, setCurrentUser, clearAuth, setInviteToken } = authSlice.actions

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

export default authSlice.reducer
