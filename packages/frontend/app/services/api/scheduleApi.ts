import { createApi } from "@reduxjs/toolkit/query/react"
import { Schedule } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { patientApi } from "./patientApi"

export const scheduleApi = createApi({
  reducerPath: "scheduleApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Schedule"],
  endpoints: (builder) => ({
    createSchedule: builder.mutation<Schedule, { patientId: string; data: Partial<Schedule> }>({
      query: ({ patientId, data }) => ({
        url: `/schedules/patients/${patientId}`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Schedule"],
      async onQueryStarted({ patientId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          // Invalidate patient query since patients include schedules
          dispatch(patientApi.util.invalidateTags([{ type: "Patient", id: patientId }]))
        } catch {
          // Ignore errors - schedule invalidation will still happen
        }
      },
    }),
    getSchedule: builder.query<Schedule, { scheduleId: string }>({
      query: ({ scheduleId }) => ({
        url: `/schedules/${scheduleId}`,
      }),
      providesTags: (result, error, { scheduleId }) => [{ type: "Schedule", id: scheduleId }],
    }),
    updateSchedule: builder.mutation<Schedule, { scheduleId: string; data: Partial<Schedule> }>({
      query: ({ scheduleId, data }) => ({
        url: `/schedules/${scheduleId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { scheduleId }) => [
        { type: "Schedule", id: scheduleId },
        "Schedule",
      ],
      async onQueryStarted({ scheduleId, data }, { dispatch, queryFulfilled }) {
        try {
          const result = await queryFulfilled
          // Invalidate patient queries since patients include schedules
          if (result.data?.patient) {
            dispatch(
              patientApi.util.invalidateTags([{ type: "Patient", id: result.data.patient }])
            )
          }
        } catch {
          // Ignore errors - schedule invalidation will still happen
        }
      },
    }),
    patchSchedule: builder.mutation<Schedule, { scheduleId: string; data: Partial<Schedule> }>({
      query: ({ scheduleId, data }) => ({
        url: `/schedules/${scheduleId}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (result, error, { scheduleId }) => [
        { type: "Schedule", id: scheduleId },
        "Schedule",
      ],
      async onQueryStarted({ scheduleId, data }, { dispatch, queryFulfilled }) {
        try {
          const result = await queryFulfilled
          // Invalidate patient queries since patients include schedules
          if (result.data?.patient) {
            dispatch(
              patientApi.util.invalidateTags([{ type: "Patient", id: result.data.patient }])
            )
          }
        } catch {
          // Ignore errors - schedule invalidation will still happen
        }
      },
    }),
    deleteSchedule: builder.mutation<{ success: boolean }, { scheduleId: string }>({
      query: ({ scheduleId }) => ({
        url: `/schedules/${scheduleId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { scheduleId }) => [
        { type: "Schedule", id: scheduleId },
        "Schedule",
      ],
      async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
        // Get the schedule from cache before deletion to find the patient ID
        const scheduleCache = scheduleApi.endpoints.getSchedule.select({ scheduleId: arg.scheduleId })(
          getState()
        )
        const patientId = scheduleCache?.data?.patient

        try {
          await queryFulfilled
          // Invalidate patient query since patients include schedules
          if (patientId) {
            dispatch(patientApi.util.invalidateTags([{ type: "Patient", id: patientId }]))
          }
        } catch {
          // Ignore errors - schedule invalidation will still happen
        }
      },
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
