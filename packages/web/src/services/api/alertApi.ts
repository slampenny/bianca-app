import { createApi } from "@reduxjs/toolkit/query/react"
import type { ApiAlertRecord } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const alertApi = createApi({
  reducerPath: "alertApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Alert"],
  endpoints: (builder) => ({
    getAllAlerts: builder.query<ApiAlertRecord[], void>({
      query: () => ({
        url: "/alerts?showRead=true",
        method: "GET",
      }),
      providesTags: ["Alert"],
    }),
    markAlertAsRead: builder.mutation<ApiAlertRecord, { alertId: string }>({
      query: ({ alertId }) => ({
        url: `/alerts/markAsRead/${alertId}`,
        method: "POST",
      }),
      invalidatesTags: ["Alert"],
    }),
  }),
})

export const { useGetAllAlertsQuery, useMarkAlertAsReadMutation } = alertApi
