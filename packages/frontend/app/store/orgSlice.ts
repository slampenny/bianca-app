import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "./store"
import { Org, Caregiver } from "../services/api/api.types"
import { authApi } from "app/services/api"

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
        if (!payload.requireMFA && payload.org) {
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
      // Listen for any action that ends with '/updateOrg/fulfilled'
      .addMatcher(
        (action) => action.type.endsWith('/updateOrg/fulfilled'),
        (state, action: any) => {
          if (action.payload?.org) {
            state.org = action.payload.org as Org
          }
        }
      )
  },
})

export const { setOrg, clearOrg } = orgSlice.actions

export const getOrg = (state: RootState) => state.org.org
export const getSelectedCaregivers = (state: RootState) => state.org.caregivers

export default orgSlice.reducer
