import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { Alert } from '../services/api/api.types';

interface AlertState {
  selectedAlert: Alert | null;
  alerts: Alert[];
}

const initialState: AlertState = {
  selectedAlert: null,
  alerts: [],
};

export const alertSlice = createSlice({
  name: 'alert',
  initialState,
  reducers: {
    setAlert: (state, action: PayloadAction<Alert | null>) => {
      state.selectedAlert = action.payload;
    },
    setAlerts: (state, action: PayloadAction<Alert[]>) => {
      state.alerts = action.payload;
    },
    clearAlert: (state) => {
      state.selectedAlert = null;
    },
    clearAlerts: (state) => {
      state.alerts = [];
    },
    removeSelectedAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(alert => alert.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    // builder.addMatcher(alertApi.endpoints.removeAlert.matchFulfilled, (state, { payload }) => {
    //   state.selectedUsers = state.selectedUsers.filter(user => user.id !== payload);
    // });
  }
});

export const { setAlert, setAlerts, clearAlert, clearAlerts, removeSelectedAlert } = alertSlice.actions;

export const getSelectedAlert = (state: RootState) => state.alert.selectedAlert;
export const getAlerts = (state: RootState) => state.alert.alerts;

export default alertSlice.reducer;