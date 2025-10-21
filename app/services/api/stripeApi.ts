import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { DEFAULT_API_CONFIG } from "./api"
import { RootState } from "../../store/store"

export interface StripeConfig {
  publishableKey: string
  mode: 'test' | 'live'
}

export const stripeApi = createApi({
  reducerPath: "stripeApi",
  baseQuery: fetchBaseQuery({
    baseUrl: DEFAULT_API_CONFIG.url,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.tokens?.access?.token
      if (token) {
        headers.set("authorization", `Bearer ${token}`)
      }
      return headers
    },
  }),
  endpoints: (builder) => ({
    getStripeConfig: builder.query<StripeConfig, void>({
      query: () => ({
        url: `/stripe/publishable-key`,
        method: "GET",
      }),
    }),
  }),
})

export const {
  useGetStripeConfigQuery,
} = stripeApi

