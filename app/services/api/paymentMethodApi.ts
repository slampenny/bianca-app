import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { RootState } from '../../store/store';
import { PaymentMethod } from './api.types';

export const paymentMethodApi = createApi({
  reducerPath: 'paymentMethodApi',
  baseQuery: fetchBaseQuery({
    baseUrl: DEFAULT_API_CONFIG.url,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.tokens?.access?.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: (builder) => ({
    attachPaymentMethod: builder.mutation<PaymentMethod, { orgId: string; paymentMethodId: string }>({
      query: ({ orgId, paymentMethodId }) => ({
        url: `/payment-methods/orgs/${orgId}`,
        method: 'POST',
        body: { paymentMethodId },
      }),
    }),
    getPaymentMethods: builder.query<PaymentMethod[], string>({
      query: (orgId: string) => ({
        url: `/payment-methods/orgs/${orgId}`,
        method: 'GET',
      }),
    }),
    getPaymentMethod: builder.query<PaymentMethod, { orgId: string; paymentMethodId: string }>({
      query: ({ orgId, paymentMethodId }) => ({
        url: `/payment-methods/orgs/${orgId}/${paymentMethodId}`,
        method: 'GET',
      }),
    }),
    setDefaultPaymentMethod: builder.mutation<PaymentMethod, { orgId: string; paymentMethodId: string }>({
      query: ({ orgId, paymentMethodId }) => ({
        url: `/payment-methods/orgs/${orgId}/${paymentMethodId}`,
        method: 'PATCH',
      }),
    }),
    detachPaymentMethod: builder.mutation<null, { orgId: string; paymentMethodId: string }>({
      query: ({ orgId, paymentMethodId }) => ({
        url: `/payment-methods/orgs/${orgId}/${paymentMethodId}`,
        method: 'DELETE',
      }),
    }),
  }),
});

export const {
  useAttachPaymentMethodMutation,
  useGetPaymentMethodsQuery,
  useGetPaymentMethodQuery,
  useSetDefaultPaymentMethodMutation,
  useDetachPaymentMethodMutation,
} = paymentMethodApi;
