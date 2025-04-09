import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { authApi, alertApi } from '../services/api';
import { Alert } from '../services/api/api.types';
import { getCurrentUser } from './authSlice';

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
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      state.alerts = payload.alerts;
    });
    builder.addMatcher(alertApi.endpoints.markAllAsRead.matchFulfilled, (state, { payload }) => {
      // Iterate through each alert in the payload
      payload.forEach((alertFromPayload) => {
        // Find the index of the alert in state.alerts that matches the current alert's ID
        const index = state.alerts.findIndex((alertInState) => alertInState.id === alertFromPayload.id);
        // If a matching alert is found, replace it
        if (index !== -1) {
          state.alerts[index] = alertFromPayload;
        }
      });
    });

    builder.addMatcher(alertApi.endpoints.markAlertAsRead.matchFulfilled, (state, { payload }) => {
      // Find the index of the alert in state.alerts that matches the current alert's ID
      const index = state.alerts.findIndex((alertInState) => alertInState.id === payload.id);
      // If a matching alert is found, replace it
      if (index !== -1) {
        state.alerts[index] = payload;
      }
    });
  }
});

export const { setAlert, setAlerts, clearAlert, clearAlerts, removeSelectedAlert } = alertSlice.actions;

export const getSelectedAlert = (state: RootState) => state.alert.selectedAlert;
export const getAlerts = (state: RootState) => state.alert.alerts;

export const selectUnreadAlertCount = (state: RootState) => {
  const currentUser = getCurrentUser(state); // Get the current user
  if (!currentUser || !currentUser.id) { // Check if currentUser and currentUser.id exist
    return 0; // If no current user or no user ID, no unread alerts
  }

  return state.alert.alerts.filter(alert => {
    return !alert.readBy.includes(currentUser.id!); // Use non-null assertion to ensure currentUser.id is a string
  }).length;
};

export default alertSlice.reducer;