import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store";
import { Schedule } from '../services/api/api.types';
import { patientApi, scheduleApi } from "../services/api";

interface ScheduleState {
  schedule: Schedule;
  schedules: Schedule[];
}

const defaultSchedule: Schedule = {
  frequency: 'weekly',
  intervals: [],
  time: '',
  isActive: false,
};

const initialState: ScheduleState = {
  schedule: defaultSchedule,
  schedules: [],
};

export const scheduleSlice = createSlice({
  name: "schedule",
  initialState,
  reducers: {
    setSchedule: (state, action: PayloadAction<Schedule | null>) => {
      if (!action.payload) {
        state.schedule = defaultSchedule;
      } else {
        state.schedule = action.payload;
        const index = state.schedules.findIndex(schedule => schedule.id === state.schedule.id);
        if (index !== -1) {
          state.schedules[index] = state.schedule;
        }
      }
    },
    setSchedules: (state, action: PayloadAction<Schedule[]>) => {
      if (action.payload.length > 0) {
        state.schedule = action.payload[0];
      }
      state.schedules = action.payload;
    },
    clearSchedule: (state) => {
      if (state.schedules.length > 0) {
        state.schedule = state.schedules[0];
      } else {
        state.schedule = defaultSchedule;
      }
    },
    clearSchedules: (state) => {
      state.schedule = defaultSchedule;
      state.schedules = [];
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(patientApi.endpoints.createPatient.matchFulfilled, (state) => {
      state.schedule = defaultSchedule;
      state.schedules = [];
    });
    builder.addMatcher(scheduleApi.endpoints.createSchedule.matchFulfilled, (state, { payload }) => {
      state.schedule = payload;
      state.schedules.push(payload);
    });
    builder.addMatcher(scheduleApi.endpoints.patchSchedule.matchFulfilled, (state, { payload }) => {
      state.schedule = payload;
    
      const index = state.schedules.findIndex(schedule => schedule.id === payload.id);
      if (index !== -1) {
        state.schedules[index] = payload;
      }
    });
    builder.addMatcher(scheduleApi.endpoints.updateSchedule.matchFulfilled, (state, { payload }) => {
      state.schedule = payload;
    
      const index = state.schedules.findIndex(schedule => schedule.id === payload.id);
      if (index !== -1) {
        state.schedules[index] = payload;
      }
    });
    builder.addMatcher(scheduleApi.endpoints.deleteSchedule.matchFulfilled, (state) => {
      if (state.schedule) {
        state.schedules = state.schedules.filter(schedule => schedule.id !== state.schedule!.id);
      }

      if (state.schedules.length > 0) {
        state.schedule = state.schedules[0];
      } else {
        state.schedule = defaultSchedule;
      }
    });
  }
});

export const { setSchedule, setSchedules, clearSchedule, clearSchedules } = scheduleSlice.actions;

export const getSchedule = (state: RootState) => state.schedule.schedule;
export const getSchedules = (state: RootState) => state.schedule.schedules;

export default scheduleSlice.reducer;