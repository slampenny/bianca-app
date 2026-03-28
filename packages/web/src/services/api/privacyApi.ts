import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

export interface PrivacyRequestItem {
  _id?: string
  id?: string
  requestType?: string
  status?: string
  informationRequested?: string
  createdAt?: string
}

export interface PrivacyRequestPages {
  limit: number
  page: number
  results: PrivacyRequestItem[]
  totalPages: number
  totalResults: number
}

export const privacyApi = createApi({
  reducerPath: "privacyApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["PrivacyRequest"],
  endpoints: (builder) => ({
    createAccessRequest: builder.mutation<
      PrivacyRequestItem,
      { informationRequested?: string; accessMethod?: "email" | "download" | "mail" }
    >({
      query: (body) => ({
        url: "/privacy/requests/access",
        method: "POST",
        body: {
          informationRequested: body.informationRequested || "All my personal information",
          accessMethod: body.accessMethod || "email",
        },
      }),
      invalidatesTags: [{ type: "PrivacyRequest", id: "LIST" }],
    }),
    getPrivacyRequests: builder.query<PrivacyRequestPages, { page?: number; limit?: number }>({
      query: (params) => ({
        url: "/privacy/requests",
        params: { page: params.page ?? 1, limit: params.limit ?? 10 },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map((r) => ({
                type: "PrivacyRequest" as const,
                id: String(r._id ?? r.id ?? ""),
              })),
              { type: "PrivacyRequest", id: "LIST" },
            ]
          : [{ type: "PrivacyRequest", id: "LIST" }],
    }),
  }),
})

export const { useCreateAccessRequestMutation, useGetPrivacyRequestsQuery } = privacyApi
