import { createApi } from "@reduxjs/toolkit/query/react"
import { Schedule } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { clientApi } from "./clientApi"

export const scheduleApi = createApi({
  reducerPath: "scheduleApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Schedule"],
  endpoints: (builder) => ({
    createSchedule: builder.mutation<Schedule, { clientId: string; data: Partial<Schedule> }>({
      query: ({ clientId, data }) => ({
        url: `/schedules/clients/${clientId}`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Schedule"],
      async onQueryStarted({ clientId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          dispatch(clientApi.util.invalidateTags([{ type: "Client", id: clientId }]))
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
          const clientId = result.data?.client ?? result.data?.patient
          if (clientId) {
            dispatch(clientApi.util.invalidateTags([{ type: "Client", id: clientId }]))
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
          const clientId = result.data?.client ?? result.data?.patient
          if (clientId) {
            dispatch(clientApi.util.invalidateTags([{ type: "Client", id: clientId }]))
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
        const scheduleCache = scheduleApi.endpoints.getSchedule.select({ scheduleId: arg.scheduleId })(
          getState()
        )
        const clientId = scheduleCache?.data?.client ?? scheduleCache?.data?.patient

        try {
          await queryFulfilled
          if (clientId) {
            dispatch(clientApi.util.invalidateTags([{ type: "Client", id: clientId }]))
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
