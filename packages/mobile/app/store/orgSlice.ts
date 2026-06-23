import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "./store"
import { Org, Caregiver } from "../services/api/api.types"
// Import API directly to break circular dependency with app/services/api/index.ts
import { authApi } from "../services/api/authApi"
import { ssoApi } from "../services/api/ssoApi"

interface OrgState {
  org: Org | null
  caregivers: Caregiver[]
}

const initialState: OrgState = {
  org: null,
  caregivers: [],
}

export const orgSlice = createSlice({
  name: "org",
  initialState,
  reducers: {
    setOrg: (state, action: PayloadAction<Org | null>) => {
      state.org = action.payload
    },
    clearOrg: (state) => {
      state.org = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
        // Only set org if MFA is not required (when MFA is required, payload only has tempToken)
        // Login response can be either success with org data or MFA requirement
        if ('org' in payload && payload.org) {
          state.org = payload.org as Org
        }
      })
      .addMatcher(authApi.endpoints.registerWithInvite.matchFulfilled, (state, { payload }) => {
        if ('org' in payload && payload.org) {
          state.org = payload.org as Org
        }
      })
      // Auto-clear org on logout
      .addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
        state.org = null
      })
      .addMatcher(authApi.endpoints.logout.matchRejected, (state) => {
        state.org = null
      })
      .addMatcher(ssoApi.endpoints.ssoLogin.matchFulfilled, (state, { payload }) => {
        if (payload?.success && payload?.org) {
          state.org = payload.org as Org
        }
      })
      // Listen for any action that ends with '/updateOrg/fulfilled'
      .addMatcher(
        (action) => action.type.endsWith('/updateOrg/fulfilled'),
        (state, action: any) => {
          // Backend returns org directly, not wrapped in { org: ... }
          if (action.payload) {
            // Check if payload is wrapped in { org: ... } or is the org directly
            const updatedOrg = action.payload.org || action.payload
            if (updatedOrg && updatedOrg.id) {
              state.org = updatedOrg as Org
            }
          }
        }
      )
  },
})

export const { setOrg, clearOrg } = orgSlice.actions

export const getOrg = (state: RootState) => state.org.org
export const getSelectedCaregivers = (state: RootState) => state.org.caregivers

export default orgSlice.reducer
