// paymentApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { RootState } from '../../store/store';
import { Invoice } from './api.types';

export const paymentApi = createApi({
  reducerPath: 'paymentApi',
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
    createInvoiceFromConversations: builder.mutation<Invoice, { patientId: string; payload: any }>({
      query: ({ patientId, payload }) => ({
        url: `/payments/patients/${patientId}/invoices`,
        method: 'POST',
        body: payload,
      }),
    }),
    getInvoicesByPatient: builder.query<Invoice[], { patientId: string; status?: string; dueDate?: string }>({
      query: ({ patientId, status, dueDate }) => ({
        url: `/payments/patients/${patientId}/invoices`,
        method: 'GET',
        params: { status, dueDate },
      }),
    }),
    getInvoicesByOrg: builder.query<Invoice[], { orgId: string; status?: string; dueDate?: string }>({
      query: ({ orgId, status, dueDate }) => ({
        url: `/payments/orgs/${orgId}/invoices`,
        method: 'GET',
        params: { status, dueDate },
      }),
    }),
  }),
});

export const {
  useCreateInvoiceFromConversationsMutation,
  useGetInvoicesByPatientQuery,
  useGetInvoicesByOrgQuery,
} = paymentApi;
