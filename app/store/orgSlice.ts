import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { Org, Caregiver } from '../services/api/api.types';
import { authApi } from 'app/services/api';

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
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      state.org = payload.org as Org;
    });
  }
});

export const { setOrg, clearOrg } = orgSlice.actions;

export const getOrg = (state: RootState) => state.org.org;
export const getSelectedCaregivers = (state: RootState) => state.org.caregivers;

export default orgSlice.reducer;