import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { DEFAULT_API_CONFIG } from "./api"
import { RootState } from "../../store/store"
import { Schedule } from "./api.types"

export const scheduleApi = createApi({
  reducerPath: "scheduleApi",
  baseQuery: fetchBaseQuery({
    baseUrl: DEFAULT_API_CONFIG.url,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.tokens?.access.token
      if (token) {
        headers.set("authorization", `Bearer ${token}`)
      }
      return headers
    },
  }),
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
