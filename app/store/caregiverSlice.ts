import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { Caregiver } from '../services/api/api.types';
import { authApi, caregiverApi, orgApi } from 'app/services/api';

interface CaregiverState {
  caregiver: Caregiver | null;
  caregivers: Caregiver[];
  currentOrg: string | null;
}

const initialState: CaregiverState = {
  caregiver: null,
  caregivers: [],
  currentOrg: null,
};

export const caregiverSlice = createSlice({
  name: 'caregiver',
  initialState,
  reducers: {
    setCaregiver: (state, action: PayloadAction<Caregiver | null>) => {
      console.log('[caregiverSlice] setCaregiver called with:', action.payload);
      state.caregiver = action.payload;
    },
    setCaregivers: (state, action: PayloadAction<Caregiver[]>) => {
      console.log('[caregiverSlice] setCaregivers called with:', action.payload);
      state.caregivers = action.payload;
    },
    clearCaregiver: (state) => {
      console.log('[caregiverSlice] clearCaregiver called');
      state.caregiver = null;
    },
    clearCaregivers: (state) => {
      console.log('[caregiverSlice] clearCaregivers called');
      state.caregivers = [];
    },
    removeCaregiver: (state, action: PayloadAction<string>) => {
      console.log('[caregiverSlice] removeCaregiver called with id:', action.payload);
      state.caregivers = state.caregivers.filter(cg => cg.id !== action.payload);
    },
    setCurrentOrg: (state, action: PayloadAction<string>) => {
      console.log('[caregiverSlice] setCurrentOrg called with:', action.payload);
      state.currentOrg = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Set current caregiver from login response
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      console.log('[caregiverSlice] authApi.login.matchFulfilled, payload:', payload);
      state.caregiver = payload.caregiver;
    });
    // Handle caregiver update
    builder.addMatcher(caregiverApi.endpoints.updateCaregiver.matchFulfilled, (state, { payload }) => {
      console.log('[caregiverSlice] caregiverApi.updateCaregiver.matchFulfilled, payload:', payload);
      const index = state.caregivers.findIndex(cg => cg.id === payload.id);
      if (index !== -1) {
        state.caregivers[index] = payload;
      }
      if (state.caregiver && state.caregiver.id === payload.id) {
        state.caregiver = payload;
      }
    });
    // Handle caregiver deletion via orgApi removeCaregiver endpoint
    builder.addMatcher(orgApi.endpoints.removeCaregiver.matchFulfilled, (state, { payload }) => {
      console.log('[caregiverSlice] orgApi.removeCaregiver.matchFulfilled, payload:', payload);
      // Assuming payload contains an object with the removed caregiver's id
      state.caregivers = state.caregivers.filter(cg => cg.id !== payload.id);
      if (state.caregiver && state.caregiver.id === payload.id) {
        state.caregiver = null;
      }
    });
    // Handle invite: when a caregiver is invited successfully via orgApi sendInvite,
    // add the returned caregiver to the caregivers array.
    builder.addMatcher(orgApi.endpoints.sendInvite.matchFulfilled, (state, { payload }) => {
      console.log('[caregiverSlice] orgApi.sendInvite.matchFulfilled, payload:', payload);
      state.caregivers.push(payload);
    });
  }
});

export const { setCaregiver, setCaregivers, clearCaregiver, clearCaregivers, removeCaregiver, setCurrentOrg } = caregiverSlice.actions;

export const getCaregiver = (state: RootState) => state.caregiver.caregiver;
export const getCaregivers = (state: RootState) => state.caregiver.caregivers;
export const getCurrentOrg = (state: RootState) => state.caregiver.currentOrg;

export default caregiverSlice.reducer;
