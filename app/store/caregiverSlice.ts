import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "./store"
import { Caregiver } from "../services/api/api.types"
import { authApi, caregiverApi, orgApi } from "app/services/api"
import { logger } from "../utils/logger"

interface CaregiverState {
  caregiver: Caregiver | null
  caregivers: Caregiver[]
}

const initialState: CaregiverState = {
  caregiver: null,
  caregivers: [],
}

export const caregiverSlice = createSlice({
  name: "caregiver",
  initialState,
  reducers: {
    setCaregiver: (state, action: PayloadAction<Caregiver | null>) => {
      logger.debug("[caregiverSlice] setCaregiver called with:", action.payload)
      state.caregiver = action.payload
    },
    setCaregivers: (state, action: PayloadAction<Caregiver[]>) => {
      logger.debug("[caregiverSlice] setCaregivers called with:", action.payload)
      state.caregivers = action.payload
    },
    clearCaregiver: (state) => {
      logger.debug("[caregiverSlice] clearCaregiver called")
      state.caregiver = null
    },
    clearCaregivers: (state) => {
      logger.debug("[caregiverSlice] clearCaregivers called")
      state.caregivers = []
    },
    removeCaregiver: (state, action: PayloadAction<string>) => {
      logger.debug("[caregiverSlice] removeCaregiver called with id:", action.payload)
      state.caregivers = state.caregivers.filter((cg) => cg.id !== action.payload)
    },

  },
  extraReducers: (builder) => {
    // Set current caregiver from login response
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      logger.debug("[caregiverSlice] authApi.login.matchFulfilled, payload:", payload)
      // Only set caregiver if MFA is not required (when MFA is required, payload only has tempToken)
      if (!payload.requireMFA && payload.caregiver) {
        state.caregiver = payload.caregiver
      }
    })
    // Auto-clear caregivers on logout
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      state.caregiver = null
      state.caregivers = []
    })
    builder.addMatcher(authApi.endpoints.logout.matchRejected, (state) => {
      state.caregiver = null
      state.caregivers = []
    })
    // Handle caregiver update
    builder.addMatcher(
      caregiverApi.endpoints.updateCaregiver.matchFulfilled,
      (state, { payload }) => {
        logger.debug(
          "[caregiverSlice] caregiverApi.updateCaregiver.matchFulfilled, payload:",
          payload,
        )
        const index = state.caregivers.findIndex((cg) => cg.id === payload.id)
        if (index !== -1) {
          state.caregivers[index] = payload
        }
        if (state.caregiver && state.caregiver.id === payload.id) {
          state.caregiver = payload
        }
      },
    )
    // Handle caregiver deletion via orgApi removeCaregiver endpoint
    // Use caregiverId from action.meta.arg since payload is void.
    builder.addMatcher(orgApi.endpoints.removeCaregiver.matchFulfilled, (state, { payload }) => {
      if (payload?.id) {
        logger.debug(
          "[caregiverSlice] orgApi.removeCaregiver.matchFulfilled, removed id:",
          payload.id,
        )
        state.caregivers = state.caregivers.filter((cg) => cg.id !== payload.id)
        if (state.caregiver && state.caregiver.id === payload.id) {
          state.caregiver = null
        }
      }
    })
    // Handle invite: when a caregiver is invited successfully via orgApi sendInvite,
    // add the returned caregiver to the caregivers array.
    builder.addMatcher(orgApi.endpoints.sendInvite.matchFulfilled, (state, { payload }) => {
      logger.debug("[caregiverSlice] orgApi.sendInvite.matchFulfilled, payload:", payload.caregiver)
      state.caregivers.push(payload.caregiver)
    })

    builder.addMatcher(
      caregiverApi.endpoints.getAllCaregivers.matchFulfilled,
      (state, { payload }) => {
        logger.debug(
          "[caregiverSlice] caregiverApi.getAllCaregivers.matchFulfilled, payload:",
          payload,
        )
        // If the API returns a paginated object, you might need to extract the docs property.
        state.caregivers = payload.results
      },
    )
  },
})

export const {
  setCaregiver,
  setCaregivers,
  clearCaregiver,
  clearCaregivers,
  removeCaregiver,
} = caregiverSlice.actions

export const getCaregiver = (state: RootState) => state.caregiver.caregiver
export const getCaregivers = (state: RootState) => state.caregiver.caregivers

export default caregiverSlice.reducer
