import { createApi } from "@reduxjs/toolkit/query/react"
import { PaymentMethod } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const paymentMethodApi = createApi({
  reducerPath: "paymentMethodApi",
  baseQuery: baseQueryWithReauth(),
  endpoints: (builder) => ({
    attachPaymentMethod: builder.mutation<
      PaymentMethod,
      { orgId: string; paymentMethodId: string }
    >({
      query: ({ orgId, paymentMethodId }) => ({
        url: `/payment-methods/orgs/${orgId}`,
        method: "POST",
        body: { paymentMethodId },
      }),
    }),
    getPaymentMethods: builder.query<PaymentMethod[], string>({
      query: (orgId: string) => ({
        url: `/payment-methods/orgs/${orgId}`,
        method: "GET",
      }),
    }),
    getPaymentMethod: builder.query<PaymentMethod, { orgId: string; paymentMethodId: string }>({
      query: ({ orgId, paymentMethodId }) => ({
        url: `/payment-methods/orgs/${orgId}/${paymentMethodId}`,
        method: "GET",
      }),
    }),
    setDefaultPaymentMethod: builder.mutation<
      PaymentMethod,
      { orgId: string; paymentMethodId: string }
    >({
      query: ({ orgId, paymentMethodId }) => ({
        url: `/payment-methods/orgs/${orgId}/${paymentMethodId}`,
        method: "PATCH",
      }),
    }),
    detachPaymentMethod: builder.mutation<null, { orgId: string; paymentMethodId: string }>({
      query: ({ orgId, paymentMethodId }) => ({
        url: `/payment-methods/orgs/${orgId}/${paymentMethodId}`,
        method: "DELETE",
      }),
    }),
    createSetupIntent: builder.mutation<
      { clientSecret: string; id: string },
      { orgId: string }
    >({
      query: ({ orgId }) => ({
        url: `/payment-methods/orgs/${orgId}/setup-intent`,
        method: "POST",
      }),
    }),
  }),
})

export const {
  useAttachPaymentMethodMutation,
  useGetPaymentMethodsQuery,
  useGetPaymentMethodQuery,
  useSetDefaultPaymentMethodMutation,
  useDetachPaymentMethodMutation,
  useCreateSetupIntentMutation,
} = paymentMethodApi
