import { createApi } from "@reduxjs/toolkit/query/react"
import type {
  AdminCaregiverSearchResponse,
  ImpersonateResponse,
  ObservabilityPayload,
} from "./api.types"
import baseQueryWithAuth from "./baseQueryWithAuth"

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: baseQueryWithAuth(),
  tagTypes: ["Observability"],
  endpoints: (builder) => ({
    getObservability: builder.query<ObservabilityPayload, void>({
      query: () => ({
        url: "/admin/observability",
        method: "GET",
      }),
      providesTags: ["Observability"],
    }),
    searchCaregivers: builder.query<AdminCaregiverSearchResponse, { q: string; page?: number; limit?: number }>({
      query: ({ q, page = 1, limit = 20 }) => ({
        url: "/admin/caregivers",
        method: "GET",
        params: { q, page, limit },
      }),
    }),
    impersonateCaregiver: builder.mutation<ImpersonateResponse, { caregiverId: string }>({
      query: (body) => ({
        url: "/admin/impersonate",
        method: "POST",
        body,
      }),
    }),
  }),
})

export const {
  useGetObservabilityQuery,
  useLazyGetObservabilityQuery,
  useLazySearchCaregiversQuery,
  useImpersonateCaregiverMutation,
} = adminApi
