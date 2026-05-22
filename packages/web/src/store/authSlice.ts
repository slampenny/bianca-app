import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { needsOnboarding } from "../lib/postAuthNavigation"
import { authApi } from "../services/api/authApi"
import { caregiverApi } from "../services/api/caregiverApi"
import type { AuthTokens, Caregiver } from "../services/api/api.types"
interface AuthState {
  tokens: AuthTokens | null
  authEmail: string
  currentUser: Caregiver | null
  inviteToken: string | null
  pendingOnboarding: boolean
}

const initialState: AuthState = {
  tokens: null,
  authEmail: "",
  currentUser: null,
  inviteToken: null,
  pendingOnboarding: false,
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
    },
    setInviteToken(state, action: PayloadAction<string | null>) {
      state.inviteToken = action.payload
    },
    setPendingOnboarding(state, action: PayloadAction<boolean>) {
      state.pendingOnboarding = action.payload
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      if ("caregiver" in payload && "tokens" in payload) {
        state.currentUser = payload.caregiver
        state.tokens = payload.tokens
        state.pendingOnboarding = needsOnboarding(payload.caregiver)
      }
    })
    builder.addMatcher(authApi.endpoints.registerWithInvite.matchFulfilled, (state, { payload }) => {
      state.currentUser = payload.caregiver
      state.tokens = payload.tokens
      state.pendingOnboarding = false
    })
    builder.addMatcher(caregiverApi.endpoints.updateCaregiver.matchFulfilled, (state, { payload, meta }) => {
      const id = String(meta.arg.originalArgs.id)
      const cur = state.currentUser?.id != null ? String(state.currentUser.id) : ""
      if (cur && id === cur) {
        state.currentUser = { ...state.currentUser!, ...payload }
      }
    })
    builder.addMatcher(caregiverApi.endpoints.uploadAvatar.matchFulfilled, (state, { payload, meta }) => {
      const id = String(meta.arg.originalArgs.id)
      const cur = state.currentUser?.id != null ? String(state.currentUser.id) : ""
      if (cur && id === cur) {
        state.currentUser = { ...state.currentUser!, ...payload }
      }
    })
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      state.tokens = null
      state.authEmail = ""
      state.currentUser = null
      state.inviteToken = null
      state.pendingOnboarding = false
    })
    builder.addMatcher(authApi.endpoints.logout.matchRejected, (state) => {
      state.tokens = null
      state.authEmail = ""
      state.currentUser = null
      state.inviteToken = null
      state.pendingOnboarding = false
    })
    builder.addMatcher(authApi.endpoints.refreshTokens.matchFulfilled, (state, { payload }) => {
      state.tokens = payload.tokens
    })
    builder.addMatcher(authApi.endpoints.refreshTokens.matchRejected, () => {
      // Keep session; next 401 will send user to login (same as mobile).
    })
    builder.addMatcher(authApi.endpoints.verifyEmail.matchFulfilled, (state, { payload }) => {
      if (payload?.tokens && payload?.caregiver) {
        state.tokens = payload.tokens
        state.currentUser = payload.caregiver
        if (payload.caregiver.email) state.authEmail = payload.caregiver.email
        state.pendingOnboarding = needsOnboarding(payload.caregiver)
      }
    })
    builder.addMatcher(authApi.endpoints.completeOnboarding.matchFulfilled, (state, { payload }) => {
      if (payload?.caregiver) {
        state.currentUser = payload.caregiver
      }
      state.pendingOnboarding = false
    })
  },
})

export const {
  setAuthTokens,
  setAuthEmail,
  setCurrentUser,
  clearAuth,
  setInviteToken,
  setPendingOnboarding,
} = authSlice.actions

export const isAuthenticated = (state: { auth: AuthState }) => !!state.auth.tokens
export const getValidationError = (state: { auth: AuthState }) => {
  if (state.auth.authEmail.length === 0) return "can't be blank"
  if (state.auth.authEmail.length < 6) return "must be at least 6 characters"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.auth.authEmail)) return "must be a valid email address"
  return ""
}
export const getCurrentUser = (state: { auth: AuthState }) => state.auth.currentUser
export const getAuthEmail = (state: { auth: AuthState }) => state.auth.authEmail
export const getAuthTokens = (state: { auth: AuthState }) => state.auth.tokens

export default authSlice.reducer
