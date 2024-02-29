import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store";
import { Schedule } from '../services/api/api.types';

interface ScheduleState {
  schedules: Schedule[];
}

const initialState: ScheduleState = {
  schedules: [],
};

export const scheduleSlice = createSlice({
  name: "schedule",
  initialState,
  reducers: {
    addSchedule(state, action: PayloadAction<Schedule>) {
      state.schedules.push(action.payload);
    },
    removeSchedule(state, action: PayloadAction<number>) {
      state.schedules.splice(action.payload, 1);
    },
    updateSchedule(state, action: PayloadAction<{index: number, schedule: Schedule}>) {
      state.schedules[action.payload.index] = action.payload.schedule;
    },
  },
});

export const { addSchedule, removeSchedule, updateSchedule } = scheduleSlice.actions;

export const getSchedules = (state: RootState) => state.schedule.schedules;

export default scheduleSlice.reducer;