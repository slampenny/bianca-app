import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { Caregiver } from '../services/api/api.types';
//import { caregiverApi } from 'app/services/api/caregiverApi';

interface CaregiverState {
  caregiver: Caregiver | null;
  caregivers: Caregiver[]; // Array of selected users
}

const initialState: CaregiverState = {
  caregiver: null,
  caregivers: [],
};

export const caregiverSlice = createSlice({
  name: 'caregiver',
  initialState,
  reducers: {
    setCaregiver: (state, action: PayloadAction<Caregiver | null>) => {
      state.caregiver = action.payload;
    },
    setCaregivers: (state, action: PayloadAction<Caregiver[]>) => {
      state.caregivers = action.payload;
    },
    clearCaregiver: (state) => {
      state.caregiver = null;
    },
    clearCaregivers: (state) => {
      state.caregivers = [];
    },
    removeCaregiver: (state, action: PayloadAction<string>) => {
      state.caregivers = state.caregivers.filter(caregiver => caregiver.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    // builder.addMatcher(caregiverApi.endpoints.removeCaregiver.matchFulfilled, (state, { payload }) => {
    //   state.caregivers = state.caregivers.filter(user => user.id !== payload);
    // });
  }
});

export const { setCaregiver, setCaregivers, clearCaregiver, clearCaregivers, removeCaregiver } = caregiverSlice.actions;

export const selectCaregiver = (state: RootState) => state.caregiver.caregiver;
export const selectCaregivers = (state: RootState) => state.caregiver.caregivers;

export default caregiverSlice.reducer;