import { createApi } from "@reduxjs/toolkit/query/react"
import type { ApiAlertRecord } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

/**
 * Alerts refresh via Socket.IO `alerts:changed` (see RealtimeSocketBridge) and mutation
 * invalidation — not interval polling. Disable focus refetch so it does not race the socket.
 */
export const liveAlertsQueryOptions = {
  pollingInterval: 0,
  refetchOnFocus: false,
  refetchOnReconnect: true,
} as const

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
    resolveAlert: builder.mutation<ApiAlertRecord, { alertId: string; resolutionNote: string }>({
      query: ({ alertId, resolutionNote }) => ({
        url: `/alerts/${alertId}`,
        method: "PATCH",
        body: { resolutionNote },
      }),
      invalidatesTags: ["Alert"],
    }),
  }),
})

export const { useGetAllAlertsQuery, useMarkAlertAsReadMutation, useResolveAlertMutation } = alertApi
