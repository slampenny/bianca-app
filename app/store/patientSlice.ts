import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "./store"
import { Patient } from "../services/api/api.types"
import { authApi, patientApi } from "app/services/api"

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
      console.log("setPatient called with:", action.payload)
      state.patient = action.payload
    },
    setPatientsForCaregiver: (
      state,
      action: PayloadAction<{ caregiverId: string; patients: Patient[] }>,
    ) => {
      console.log("setPatientsForCaregiver called for caregiver:", action.payload.caregiverId)
      state.patients[action.payload.caregiverId] = action.payload.patients
    },
    clearPatient: (state) => {
      console.log("clearPatient called")
      state.patient = null
    },
    clearPatients: (state) => {
      console.log("clearPatients called")
      state.patients = {}
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      console.log("Login matchFulfilled:", payload)
      // Only set patients if MFA is not required (when MFA is required, payload only has tempToken)
      if (!payload.requireMFA && payload.caregiver && payload.patients) {
        state.patients[payload.caregiver.id!] = []
        payload.patients.forEach((patient: Patient) => {
          state.patients[payload.caregiver.id!].push(patient)
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
      console.log("createPatient matchFulfilled:", payload)
      state.patient = payload
      
      // Add the patient to all caregivers' patient lists
      if (state.patient && state.patient.caregivers) {
        state.patient.caregivers.forEach((caregiverId: string) => {
          if (!state.patients[caregiverId]) {
            state.patients[caregiverId] = []
          }
          // Check if patient already exists to avoid duplicates
          const existingIndex = state.patients[caregiverId].findIndex(p => p.id === payload.id)
          if (existingIndex === -1) {
            state.patients[caregiverId].push(payload)
          }
        })
      }
      
      // Also add to the current user's patient list if not already there
      // This is a fallback in case the caregivers array is not populated
      const currentUser = (state as any).auth?.user
      if (currentUser && currentUser.id) {
        console.log(`Adding patient to current user's list: ${currentUser.id}`)
        if (!state.patients[currentUser.id]) {
          state.patients[currentUser.id] = []
        }
        const existingIndex = state.patients[currentUser.id].findIndex(p => p.id === payload.id)
        if (existingIndex === -1) {
          state.patients[currentUser.id].push(payload)
          console.log(`Patient added to user ${currentUser.id}'s list. Total patients: ${state.patients[currentUser.id].length}`)
        } else {
          console.log(`Patient already exists in user ${currentUser.id}'s list`)
        }
      } else {
        console.log('No current user found in auth state')
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
        console.log("uploadPatientAvatar matchFulfilled:", payload)
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
      console.log("deletePatient matchFulfilled")
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
