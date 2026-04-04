import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { authApi } from "../services/api/authApi"
import type { AuthTokens, Caregiver } from "../services/api/api.types"

interface AuthState {
  tokens: AuthTokens | null
  authEmail: string
  currentUser: Caregiver | null
}

const initialState: AuthState = {
  tokens: null,
  authEmail: "",
  currentUser: null,
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
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      if ("caregiver" in payload && "tokens" in payload) {
        state.currentUser = payload.caregiver
        state.tokens = payload.tokens
      }
    })
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      state.tokens = null
      state.authEmail = ""
      state.currentUser = null
    })
    builder.addMatcher(authApi.endpoints.logout.matchRejected, (state) => {
      state.tokens = null
      state.authEmail = ""
      state.currentUser = null
    })
    builder.addMatcher(authApi.endpoints.refreshTokens.matchFulfilled, (state, { payload }) => {
      state.tokens = payload.tokens
    })
    builder.addMatcher(authApi.endpoints.registerWithInvite.matchFulfilled, (state, { payload }) => {
      state.currentUser = payload.caregiver
      state.tokens = payload.tokens
    })
  },
})

export const { setAuthTokens, setAuthEmail, setCurrentUser, clearAuth } = authSlice.actions

export const isAuthenticated = (state: { auth: AuthState }) => !!state.auth.tokens
export const getCurrentUser = (state: { auth: AuthState }) => state.auth.currentUser
export const getAuthEmail = (state: { auth: AuthState }) => state.auth.authEmail
export const getAuthTokens = (state: { auth: AuthState }) => state.auth.tokens
export const getValidationError = (state: { auth: AuthState }) => {
  if (state.auth.authEmail.length === 0) return "can't be blank"
  if (state.auth.authEmail.length < 6) return "must be at least 6 characters"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.auth.authEmail)) return "must be a valid email address"
  return ""
}

export default authSlice.reducer
