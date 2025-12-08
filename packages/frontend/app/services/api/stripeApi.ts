import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

export interface StripeConfig {
  publishableKey: string
  mode: 'test' | 'live'
}

export const stripeApi = createApi({
  reducerPath: "stripeApi",
  baseQuery: baseQueryWithReauth(),
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








