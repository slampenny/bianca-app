import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

export type PaymentMethodRecord = {
  id?: string
  stripePaymentMethodId?: string
  org?: string
  isDefault?: boolean
  type?: string
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  bankName?: string
  accountType?: string
  billingDetails?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export const paymentMethodApi = createApi({
  reducerPath: "paymentMethodApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["PaymentMethod"],
  endpoints: (builder) => ({
    getOrgPaymentMethods: builder.query<PaymentMethodRecord[], { orgId: string }>({
      query: ({ orgId }) => `/payment-methods/orgs/${orgId}`,
      providesTags: (result) =>
        result
          ? [
              ...result.map((pm) => ({ type: "PaymentMethod" as const, id: String(pm.id ?? "") })),
              { type: "PaymentMethod", id: "LIST" },
            ]
          : [{ type: "PaymentMethod", id: "LIST" }],
    }),
    attachPaymentMethod: builder.mutation<PaymentMethodRecord, { orgId: string; paymentMethodId: string }>({
      query: ({ orgId, paymentMethodId }) => ({
        url: `/payment-methods/orgs/${orgId}`,
        method: "POST",
        body: { paymentMethodId },
      }),
      invalidatesTags: [{ type: "PaymentMethod", id: "LIST" }],
    }),
    setDefaultPaymentMethod: builder.mutation<PaymentMethodRecord, { orgId: string; paymentMethodId: string }>({
      query: ({ orgId, paymentMethodId }) => ({
        url: `/payment-methods/orgs/${orgId}/${paymentMethodId}`,
        method: "PATCH",
      }),
      invalidatesTags: (_r, _e, { paymentMethodId }) => [
        { type: "PaymentMethod", id: paymentMethodId },
        { type: "PaymentMethod", id: "LIST" },
      ],
    }),
    detachPaymentMethod: builder.mutation<void, { orgId: string; paymentMethodId: string }>({
      query: ({ orgId, paymentMethodId }) => ({
        url: `/payment-methods/orgs/${orgId}/${paymentMethodId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { paymentMethodId }) => [
        { type: "PaymentMethod", id: paymentMethodId },
        { type: "PaymentMethod", id: "LIST" },
      ],
    }),
  }),
})

export const {
  useGetOrgPaymentMethodsQuery,
  useAttachPaymentMethodMutation,
  useSetDefaultPaymentMethodMutation,
  useDetachPaymentMethodMutation,
} = paymentMethodApi
