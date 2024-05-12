import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { Org, Caregiver } from '../services/api/api.types';
import { orgApi } from 'app/services/api/orgApi';

interface OrgState {
  org: Org | null;
  caregivers: Caregiver[];
}

const initialState: OrgState = {
  org: null,
  caregivers: [],
};

export const orgSlice = createSlice({
  name: 'org',
  initialState,
  reducers: {
    setOrg: (state, action: PayloadAction<Org | null>) => {
      state.org = action.payload;
    },
    setSelectedUsers: (state, action: PayloadAction<Caregiver[]>) => {
      state.caregivers = action.payload;
    },
    clearCaregiver: (state) => {
      state.org = null;
    },
    clearSelectedUsers: (state) => {
      state.caregivers = [];
    },
    removeSelectedUser: (state, action: PayloadAction<string>) => {
      state.caregivers = state.caregivers.filter(caregiver => caregiver.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(orgApi.endpoints.removeCaregiver.matchFulfilled, (state, { payload }) => {
      state.caregivers = state.caregivers.filter(caregiver => caregiver.id !== payload);
    });
  }
});

export const { setOrg, setSelectedUsers, clearCaregiver, clearSelectedUsers, removeSelectedUser } = orgSlice.actions;

export const selectOrg = (state: RootState) => state.org.org;
export const selectSelectedCaregivers = (state: RootState) => state.org.caregivers;

export default orgSlice.reducer;