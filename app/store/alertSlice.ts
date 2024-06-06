import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { authApi } from '../services/api';
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
      if (state.selectedAlert) {
        const index = state.alerts.findIndex(alert => alert.id === state.selectedAlert!.id);
        if (index !== -1) {
          state.alerts[index] = state.selectedAlert;
        }
      }
    },
    setAlerts: (state, action: PayloadAction<Alert[]>) => {
      if (action.payload.length > 0) {
        state.selectedAlert = action.payload[0];
      }
      state.alerts = action.payload;
    },
    clearAlert: (state) => {
      state.selectedAlert = null;
    },
    clearAlerts: (state) => {
      state.selectedAlert = null;
      state.alerts = [];
    },
    removeSelectedAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(alert => alert.id !== action.payload);
    },
    markAlertAsRead: (state, action: PayloadAction<{ alertId: string; caregiverId: string }>) => {
      const { alertId, caregiverId } = action.payload;
      const alert = state.alerts.find((alert) => alert.id === alertId);
      if (alert && !alert.readBy.includes(caregiverId)) {
        alert.readBy.push(caregiverId);
      }
    },
    markAllAsRead: (state, action: PayloadAction<string>) => {
      const caregiverId = action.payload;
      state.alerts = state.alerts.map(alert => {
        if (!alert.readBy.includes(caregiverId)) {
          return { ...alert, readBy: [...alert.readBy, caregiverId] };
        }
        return alert;
      });
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      state.alerts = payload.alerts;
    });
  }
});

export const { setAlert, setAlerts, clearAlert, clearAlerts, removeSelectedAlert } = alertSlice.actions;

export const getSelectedAlert = (state: RootState) => state.alert.selectedAlert;
export const getAlerts = (state: RootState) => state.alert.alerts;

export default alertSlice.reducer;