// paymentApi.ts
import { createApi } from "@reduxjs/toolkit/query/react"
import { Invoice } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const paymentApi = createApi({
  reducerPath: "paymentApi",
  baseQuery: baseQueryWithReauth(),
  endpoints: (builder) => ({
    createInvoiceFromConversations: builder.mutation<Invoice, { clientId: string; payload: any }>({
      query: ({ clientId, payload }) => ({
        url: `/payments/clients/${clientId}/invoices`,
        method: "POST",
        body: payload,
      }),
    }),
    getInvoicesByClient: builder.query<
      Invoice[],
      { clientId: string; status?: string; dueDate?: string }
    >({
      query: ({ clientId, status, dueDate }) => ({
        url: `/payments/clients/${clientId}/invoices`,
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
          clientId: string;
          clientName: string;
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
        stripeUsage?: {
          totalUsage: number;
          currentPeriodStart: string;
          currentPeriodEnd: string;
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
  useGetInvoicesByClientQuery,
  useGetInvoicesByOrgQuery,
  useGetUnbilledCostsByOrgQuery,
} = paymentApi
