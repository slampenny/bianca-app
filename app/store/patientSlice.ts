import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { Patient } from '../services/api/api.types';
import { authApi, patientApi } from 'app/services/api';

interface PatientState {
  patient: Patient | null;
  patients: Record<string, Patient[]>; // Map caregiver IDs to arrays of patients
}

const initialState: PatientState = {
  patient: null,
  patients: {},
};

export const patientSlice = createSlice({
  name: 'patient',
  initialState,
  reducers: {
    setPatient: (state, action: PayloadAction<Patient | null>) => {
      state.patient = action.payload;
    },
    setPatientsForCaregiver: (state, action: PayloadAction<{ caregiverId: string, patients: Patient[] }>) => {
      state.patients[action.payload.caregiverId] = action.payload.patients;
    },
    clearPatient: (state) => {
      state.patient = null;
    },
    clearPatients: (state) => {
      state.patients = {};
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      if (!state.patients[payload.caregiver.id!]) {
        state.patients[payload.caregiver.id!] = [];
      }
      payload.patients.forEach((patient: Patient) => {
        state.patients[payload.caregiver.id!].push(patient);
      });
    });
    builder.addMatcher(patientApi.endpoints.createPatient.matchFulfilled, (state, { payload }) => {
      state.patient = payload;
      if (state.patient && state.patient.caregivers) {
        state.patient.caregivers.forEach((caregiverId: string) => {
          if (!state.patients[caregiverId]) {
            state.patients[caregiverId] = [];
          }
          state.patients[caregiverId].push(payload);
        });
      }
    });
    builder.addMatcher(patientApi.endpoints.updatePatient.matchFulfilled, (state, { payload }) => {
      state.patient = payload;
      if (state.patient && state.patient.caregivers) {
        state.patient.caregivers.forEach((caregiverId: string) => {
          const index = state.patients[caregiverId]?.findIndex(patient => patient.id === payload.id);
          if (index !== -1) {
            state.patients[caregiverId][index] = payload;
          }
        });
      }
    });
    builder.addMatcher(patientApi.endpoints.deletePatient.matchFulfilled, (state) => {
      if (state.patient && state.patient.caregivers) {
        state.patient.caregivers.forEach((caregiverId: string) => {
          state.patients[caregiverId] = state.patients[caregiverId]?.filter(patient => patient.id !== state.patient!.id);
        });
      }
      state.patient = null;
    });
  }
});

export const { setPatient, setPatientsForCaregiver, clearPatient, clearPatients } = patientSlice.actions;

export const getPatient = (state: RootState) => state.patient.patient;
export const getPatientsForCaregiver = (state: RootState, caregiverId: string) => state.patient.patients[caregiverId];

export default patientSlice.reducer;