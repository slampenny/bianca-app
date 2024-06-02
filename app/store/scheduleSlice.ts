import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store";
import { Schedule } from '../services/api/api.types';
import { patientApi } from "../services/api";

interface ScheduleState {
  schedule: Schedule;
  schedules: Schedule[];
}

const defaultSchedule: Schedule = {
  id: null,
  patient: null,
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
      }
    },
    setSchedules: (state, action: PayloadAction<Schedule[]>) => {
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
  }
});

export const { setSchedule, setSchedules, clearSchedule, clearSchedules } = scheduleSlice.actions;

export const getSchedule = (state: RootState) => state.schedule.schedule;
export const getSchedules = (state: RootState) => state.schedule.schedules;

export default scheduleSlice.reducer;