import { createApi } from "@reduxjs/toolkit/query/react"
import { Alert } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const alertApi = createApi({
  reducerPath: "alertApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Alert"],
  endpoints: (builder) => ({
    createAlert: builder.mutation<Alert, Partial<Alert>>({
      query: (alert) => ({
        url: "/alerts",
        method: "POST",
        body: alert,
      }),
    }),
    getAllAlerts: builder.query<Alert[], void>({
      query: () => {
        // CRITICAL: Always fetch ALL alerts (both read and unread)
        // Backend expects showRead as query string parameter with value "true" (string)
        return {
          url: "/alerts?showRead=true", // Explicitly include in URL to ensure it's sent
          method: "GET",
        }
      },
      providesTags: ["Alert"],
    }),
    getAlert: builder.query<Alert, { alertId: string }>({
      query: ({ alertId }) => `/alerts/${alertId}`,
    }),
    updateAlert: builder.mutation<Alert, { alertId: string; alert: Partial<Alert> }>({
      query: ({ alertId, alert }) => ({
        url: `/alerts/${alertId}`,
        method: "PATCH",
        body: alert,
      }),
    }),
    deleteAlert: builder.mutation<void, { alertId: string }>({
      query: ({ alertId }) => ({
        url: `/alerts/${alertId}`,
        method: "DELETE",
      }),
    }),
    markAlertAsRead: builder.mutation<Alert, { alertId: string }>({
      query: ({ alertId }) => ({
        url: `/alerts/markAsRead/${alertId}`,
        method: "POST",
      }),
      invalidatesTags: ["Alert"], // CRITICAL: Invalidate cache so refetch gets updated alerts
    }),
    markAllAsRead: builder.mutation<Alert[], { alerts: Alert[] }>({
      query: ({ alerts }) => ({
        url: `/alerts/markAsRead`,
        method: "POST",
        body: { alertIds: alerts.map((alert) => alert.id) },
      }),
      invalidatesTags: ["Alert"], // CRITICAL: Invalidate cache so refetch gets updated alerts
    }),
  }),
})

export const {
  useCreateAlertMutation,
  useGetAllAlertsQuery,
  useGetAlertQuery,
  useUpdateAlertMutation,
  useDeleteAlertMutation,
  useMarkAlertAsReadMutation,
  useMarkAllAsReadMutation,
} = alertApi
