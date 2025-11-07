import { createApi } from "@reduxjs/toolkit/query/react"
import { Schedule } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const scheduleApi = createApi({
  reducerPath: "scheduleApi",
  baseQuery: baseQueryWithReauth(),
  endpoints: (builder) => ({
    createSchedule: builder.mutation<Schedule, { patientId: string; data: Partial<Schedule> }>({
      query: ({ patientId, data }) => ({
        url: `/schedules/patients/${patientId}`,
        method: "POST",
        body: data,
      }),
    }),
    getSchedule: builder.query<Schedule, { scheduleId: string }>({
      query: ({ scheduleId }) => ({
        url: `/schedules/${scheduleId}`,
      }),
    }),
    updateSchedule: builder.mutation<Schedule, { scheduleId: string; data: Partial<Schedule> }>({
      query: ({ scheduleId, data }) => ({
        url: `/schedules/${scheduleId}`,
        method: "PUT",
        body: data,
      }),
    }),
    patchSchedule: builder.mutation<Schedule, { scheduleId: string; data: Partial<Schedule> }>({
      query: ({ scheduleId, data }) => ({
        url: `/schedules/${scheduleId}`,
        method: "PATCH",
        body: data,
      }),
    }),
    deleteSchedule: builder.mutation<{ success: boolean }, { scheduleId: string }>({
      query: ({ scheduleId }) => ({
        url: `/schedules/${scheduleId}`,
        method: "DELETE",
      }),
    }),
  }),
})

export const {
  useCreateScheduleMutation,
  useGetScheduleQuery,
  useUpdateScheduleMutation,
  usePatchScheduleMutation,
  useDeleteScheduleMutation,
} = scheduleApi
