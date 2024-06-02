import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { Patient } from '../services/api/api.types';
import { authApi, patientApi } from 'app/services/api';

interface PatientState {
  patient: Patient | null;
  patients: Patient[]; // Array of selected users
}

const initialState: PatientState = {
  patient: null,
  patients: [],
};

export const patientSlice = createSlice({
  name: 'patient',
  initialState,
  reducers: {
    setPatient: (state, action: PayloadAction<Patient | null>) => {
      state.patient = action.payload;
    },
    setPatients: (state, action: PayloadAction<Patient[]>) => {
      state.patients = action.payload;
    },
    clearPatient: (state) => {
      state.patient = null;
    },
    clearPatients: (state) => {
      state.patients = [];
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      state.patients = payload.caregiver.patients;
    });
    builder.addMatcher(patientApi.endpoints.createPatient.matchFulfilled, (state, { payload }) => {
      state.patient = payload;
      state.patients.push(payload);
    });
    builder.addMatcher(patientApi.endpoints.updatePatient.matchFulfilled, (state, { payload }) => {
      state.patient = payload;
    
      const index = state.patients.findIndex(patient => patient.id === payload.id);
      if (index !== -1) {
        state.patients[index] = payload;
      }
    });
    builder.addMatcher(patientApi.endpoints.deletePatient.matchFulfilled, (state) => {
      if (state.patient) {
        state.patients = state.patients.filter(patient => patient.id !== state.patient!.id);
      }
      state.patient = null;
    });
  }
});

export const { setPatient, setPatients, clearPatient, clearPatients, removeSelectedPatient } = patientSlice.actions;

export const getPatient = (state: RootState) => state.patient.patient;
export const getPatients = (state: RootState) => state.patient.patients;

export default patientSlice.reducer;