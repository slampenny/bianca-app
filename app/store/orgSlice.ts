import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { Org, Caregiver } from '../services/api/api.types';

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
    clearOrg: (state) => {
      state.org = null;
    },
  },
  // extraReducers: (builder) => {
  //   builder.addMatcher(orgApi.endpoints.removeCaregiver.matchFulfilled, (state, { payload }) => {
  //     state.caregivers = state.caregivers.filter(caregiver => caregiver.id !== payload);
  //   });
  // }
});

export const { setOrg, clearOrg } = orgSlice.actions;

export const selectOrg = (state: RootState) => state.org.org;
export const selectSelectedCaregivers = (state: RootState) => state.org.caregivers;

export default orgSlice.reducer;