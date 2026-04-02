import { createApi } from "@reduxjs/toolkit/query/react"
import type { Schedule } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

type ScheduleInput = {
  frequency: "daily" | "weekly" | "monthly"
  intervals: Array<{ day?: number; weeks?: number }>
  time: string
  isActive?: boolean
}

export const scheduleApi = createApi({
  reducerPath: "scheduleApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Schedule"],
  endpoints: (builder) => ({
    createScheduleForClient: builder.mutation<Schedule, { clientId: string; body: ScheduleInput }>({
      query: ({ clientId, body }) => ({
        url: `/schedules/clients/${clientId}`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Schedule"],
    }),
    updateSchedule: builder.mutation<Schedule, { scheduleId: string; body: ScheduleInput }>({
      query: ({ scheduleId, body }) => ({
        url: `/schedules/${scheduleId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_r, _e, { scheduleId }) => [{ type: "Schedule", id: scheduleId }, "Schedule"],
    }),
    deleteSchedule: builder.mutation<void, { scheduleId: string }>({
      query: ({ scheduleId }) => ({
        url: `/schedules/${scheduleId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { scheduleId }) => [{ type: "Schedule", id: scheduleId }, "Schedule"],
    }),
  }),
})

export const { useCreateScheduleForClientMutation, useUpdateScheduleMutation, useDeleteScheduleMutation } = scheduleApi

