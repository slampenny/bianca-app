// paymentApi.ts
import { createApi } from "@reduxjs/toolkit/query/react"
import { Invoice } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const paymentApi = createApi({
  reducerPath: "paymentApi",
  baseQuery: baseQueryWithReauth(),
  endpoints: (builder) => ({
    createInvoiceFromConversations: builder.mutation<Invoice, { patientId: string; payload: any }>({
      query: ({ patientId, payload }) => ({
        url: `/payments/patients/${patientId}/invoices`,
        method: "POST",
        body: payload,
      }),
    }),
    getInvoicesByPatient: builder.query<
      Invoice[],
      { patientId: string; status?: string; dueDate?: string }
    >({
      query: ({ patientId, status, dueDate }) => ({
        url: `/payments/patients/${patientId}/invoices`,
        method: "GET",
        params: { status, dueDate },
      }),
    }),
    getInvoicesByOrg: builder.query<
      Invoice[],
      { orgId: string; status?: string; dueDate?: string }
    >({
      query: ({ orgId, status, dueDate }) => ({
        url: `/payments/orgs/${orgId}/invoices`,
        method: "GET",
        params: { status, dueDate },
      }),
    }),
    getUnbilledCostsByOrg: builder.query<
      {
        orgId: string;
        orgName: string;
        totalUnbilledCost: number;
        patientCosts: Array<{
          patientId: string;
          patientName: string;
          conversationCount: number;
          totalCost: number;
          conversations: Array<{
            conversationId: string;
            startTime: string;
            duration: number;
            cost: number;
            status: string;
          }>;
        }>;
        period: {
          days: number;
          startDate: string;
          endDate: string;
        };
      },
      { orgId: string; days?: number }
    >({
      query: ({ orgId, days }) => ({
        url: `/payments/orgs/${orgId}/unbilled-costs`,
        method: "GET",
        params: { days },
      }),
    }),
  }),
})

export const {
  useCreateInvoiceFromConversationsMutation,
  useGetInvoicesByPatientQuery,
  useGetInvoicesByOrgQuery,
  useGetUnbilledCostsByOrgQuery,
} = paymentApi
