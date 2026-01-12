import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "./store"
import { Patient } from "../services/api/api.types"
// Import APIs directly to break circular dependency with app/services/api/index.ts
import { authApi } from "../services/api/authApi"
import { patientApi } from "../services/api/patientApi"
import { ssoApi } from "../services/api/ssoApi"
import { logger } from "../utils/logger"

interface PatientState {
  patient: Patient | null
  patients: Record<string, Patient[]> // Map caregiver IDs to arrays of patients
}

const initialState: PatientState = {
  patient: null,
  patients: {},
}

export const patientSlice = createSlice({
  name: "patient",
  initialState,
  reducers: {
    setPatient: (state, action: PayloadAction<Patient | null>) => {
      logger.debug("setPatient called with:", action.payload)
      state.patient = action.payload
      // Also update the patient in the patients list for all caregivers
      if (action.payload && action.payload.caregivers) {
        action.payload.caregivers.forEach((caregiverId: string) => {
          if (state.patients[caregiverId]) {
            const index = state.patients[caregiverId].findIndex((p) => p.id === action.payload!.id)
            if (index !== -1) {
              state.patients[caregiverId][index] = action.payload
            }
          }
        })
      }
    },
    setPatientsForCaregiver: (
      state,
      action: PayloadAction<{ caregiverId: string; patients: Patient[] }>,
    ) => {
      logger.debug("setPatientsForCaregiver called for caregiver:", action.payload.caregiverId)
      const { caregiverId, patients } = action.payload
      if (!state.patients[caregiverId]) {
        state.patients[caregiverId] = []
      }
      // Merge new patients with existing ones, avoiding duplicates
      patients.forEach((patient) => {
        const existingIndex = state.patients[caregiverId].findIndex((p) => p.id === patient.id)
        if (existingIndex === -1) {
          state.patients[caregiverId].push(patient)
        } else {
          // Update existing patient
          state.patients[caregiverId][existingIndex] = patient
        }
      })
    },
    clearPatient: (state) => {
      logger.debug("clearPatient called")
      state.patient = null
    },
    clearPatients: (state) => {
      logger.debug("clearPatients called")
      state.patients = {}
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      console.log('[REDUX REDUCER] Login matchFulfilled - merging patient list')
      logger.debug("Login matchFulfilled:", payload)
      // Login response can be either success with patient data or MFA requirement
      if ('caregiver' in payload && 'patients' in payload && payload.caregiver && payload.patients) {
        const caregiverId = payload.caregiver.id!
        const beforeCount = state.patients[caregiverId]?.length || 0
        console.log(`[REDUX REDUCER] Login: merging ${beforeCount} existing patients with ${payload.patients.length} from API for caregiver ${caregiverId}`)
        
        // Initialize array if it doesn't exist
        if (!state.patients[caregiverId]) {
          state.patients[caregiverId] = []
        }
        
        // Merge patients from login response with existing patients
        // This preserves any newly created patients that might not be in the login response yet
        payload.patients.forEach((patient: Patient) => {
          const existingIndex = state.patients[caregiverId].findIndex((p) => p.id === patient.id)
          if (existingIndex === -1) {
            // Patient not in existing list, add it
            state.patients[caregiverId].push(patient)
            console.log(`[REDUX REDUCER] Login: added patient ${patient.id} (${patient.name}) from API`)
          } else {
            // Patient exists, update it with latest data from API
            state.patients[caregiverId][existingIndex] = patient
            console.log(`[REDUX REDUCER] Login: updated patient ${patient.id} (${patient.name}) from API`)
          }
        })
        
        const afterCount = state.patients[caregiverId].length
        console.log(`[REDUX REDUCER] Login: after merge, caregiver ${caregiverId} has ${afterCount} patients (was ${beforeCount})`)
        if (afterCount > beforeCount) {
          console.log(`[REDUX REDUCER] Login: merge added ${afterCount - beforeCount} new patients`)
        }
      }
    })
    // Handle SSO login - patients come in the response
    builder.addMatcher(ssoApi.endpoints.ssoLogin.matchFulfilled, (state, { payload }) => {
      logger.debug("SSO login matchFulfilled:", payload)
      if (payload?.user?.id && payload?.patients) {
        state.patients[payload.user.id] = []
        payload.patients.forEach((patient: Patient) => {
          state.patients[payload.user.id].push(patient)
        })
      }
    })
    // Auto-clear patients on logout
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      state.patient = null
      state.patients = {}
    })
    builder.addMatcher(authApi.endpoints.logout.matchRejected, (state) => {
      state.patient = null
      state.patients = {}
    })
    builder.addMatcher(patientApi.endpoints.createPatient.matchFulfilled, (state, { payload }) => {
      console.log('[REDUX REDUCER] createPatient.matchFulfilled called')
      console.log('[REDUX REDUCER] Payload:', JSON.stringify(payload, null, 2))
      console.log('[REDUX REDUCER] Payload caregivers array:', payload.caregivers)
      console.log('[REDUX REDUCER] Payload caregivers type:', typeof payload.caregivers, Array.isArray(payload.caregivers))
      logger.debug("createPatient matchFulfilled:", payload)
      logger.debug("createPatient matchFulfilled - caregivers array:", payload.caregivers)
      state.patient = payload
      
      // Add the patient to all caregivers' patient lists
      // The backend should include the current user in the caregivers array
      if (payload && payload.caregivers && Array.isArray(payload.caregivers) && payload.caregivers.length > 0) {
        console.log(`[REDUX REDUCER] Adding patient to ${payload.caregivers.length} caregiver(s) lists:`, payload.caregivers)
        logger.debug(`Adding patient to ${payload.caregivers.length} caregiver(s) lists`)
        payload.caregivers.forEach((caregiverId: string) => {
          if (!state.patients[caregiverId]) {
            state.patients[caregiverId] = []
            console.log(`[REDUX REDUCER] Created new patient list for caregiver ${caregiverId}`)
          }
          // Check if patient already exists to avoid duplicates
          const existingIndex = state.patients[caregiverId].findIndex(p => p.id === payload.id)
          if (existingIndex === -1) {
            state.patients[caregiverId].push(payload)
            console.log(`[REDUX REDUCER] Patient ${payload.id} added to caregiver ${caregiverId}'s list. Total: ${state.patients[caregiverId].length}`)
            logger.debug(`Patient added to caregiver ${caregiverId}'s list. Total: ${state.patients[caregiverId].length}`)
          } else {
            console.log(`[REDUX REDUCER] Patient ${payload.id} already exists in caregiver ${caregiverId}'s list`)
            logger.debug(`Patient already exists in caregiver ${caregiverId}'s list`)
          }
        })
        console.log(`[REDUX REDUCER] Final state.patients keys:`, Object.keys(state.patients))
        console.log(`[REDUX REDUCER] Final state.patients:`, JSON.stringify(Object.fromEntries(
          Object.entries(state.patients).map(([k, v]) => [k, (v as Patient[]).map(p => ({ id: p.id, name: p.name }))])
        ), null, 2))
      } else {
        console.log('[REDUX REDUCER] No caregivers array or empty array in payload')
        console.log('[REDUX REDUCER] Payload structure:', {
          hasPayload: !!payload,
          hasCaregivers: !!(payload && payload.caregivers),
          caregiversValue: payload?.caregivers,
          caregiversType: typeof payload?.caregivers,
          isArray: Array.isArray(payload?.caregivers),
          length: Array.isArray(payload?.caregivers) ? payload.caregivers.length : 'N/A'
        })
        logger.debug('createPatient matchFulfilled - no caregivers array or empty array in payload')
      }
    })
    builder.addMatcher(patientApi.endpoints.updatePatient.matchFulfilled, (state, { payload }) => {
      state.patient = payload
      // Update the patient in every patients list where it exists
      Object.keys(state.patients).forEach((caregiverId) => {
        const index = state.patients[caregiverId].findIndex((p) => p.id === payload.id)
        if (index !== -1) {
          state.patients[caregiverId][index] = payload
        }
      })
    })

    builder.addMatcher(
      patientApi.endpoints.uploadPatientAvatar.matchFulfilled,
      (state, { payload }) => {
        logger.debug("uploadPatientAvatar matchFulfilled:", payload)
        if (state.patient && state.patient.id === payload.id) {
          state.patient.avatar = payload.avatar
        }
        // Optionally update the patients map if needed:
        // if (state.patient && state.patient.caregivers) {
        //   state.patient.caregivers.forEach((caregiverId: string) => {
        //     const index = state.patients[caregiverId]?.findIndex(p => p.id === payload.id);
        //     if (index !== -1) {
        //       state.patients[caregiverId][index] = payload;
        //     }
        //   });
        // }
      },
    )
    builder.addMatcher(patientApi.endpoints.deletePatient.matchFulfilled, (state) => {
      logger.debug("deletePatient matchFulfilled")
      if (state.patient && state.patient.caregivers) {
        state.patient.caregivers.forEach((caregiverId: string) => {
          state.patients[caregiverId] = state.patients[caregiverId]?.filter(
            (patient) => patient.id !== state.patient!.id,
          )
        })
      }
      state.patient = null
    })
  },
})

export const { setPatient, setPatientsForCaregiver, clearPatient, clearPatients } =
  patientSlice.actions

export const getPatient = (state: RootState) => state.patient.patient
export const getPatientsForCaregiver = (state: RootState, caregiverId: string) =>
  state.patient.patients[caregiverId] || []

export default patientSlice.reducer
