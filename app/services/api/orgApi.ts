
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { RootState } from '../../store/store';
import { Org, OrgPages } from './api.types';

export const orgApi = createApi({
  reducerPath: 'orgApi',
  baseQuery: fetchBaseQuery({ 
    baseUrl: DEFAULT_API_CONFIG.url,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.tokens?.access.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: (builder) => ({
    getAllOrgs: builder.query<OrgPages, { name?: string, role?: string, sortBy?: string, limit?: number, page?: number }>({
      query: () => `/orgs`,
    }),
    getOrg: builder.query<Org, { orgId: string }>({
      query: ({ orgId }) => `/orgs/${orgId}`,
    }),
    updateOrg: builder.mutation<{ org: Org }, { orgId: string, org: any }>({
      query: ({ orgId, org }) => ({
        url: `/orgs/${orgId}`,
        method: 'PATCH',
        body: org,
      }),
    }),
    deleteOrg: builder.mutation<void, { orgId: string }>({
      query: ({ orgId }) => ({
        url: `/orgs/${orgId}`,
        method: 'DELETE',
      }),
    }),
    addCaregiver: builder.mutation<void, { orgId: string, caregiverId: string }>({
      query: ({ orgId, caregiverId }) => ({
        url: `/orgs/${orgId}/caregiver/${caregiverId}`,
        method: 'POST',
      }),
    }),
    removeCaregiver: builder.mutation<void, { orgId: string, caregiverId: string }>({
      query: ({ orgId, caregiverId }) => ({
        url: `/orgs/${orgId}/caregiver/${caregiverId}`,
        method: 'DELETE',
      }),
    }),
    setRole: builder.mutation<void, { orgId: string, caregiverId: string, role: string }>({
      query: ({ orgId, caregiverId, role }) => ({
        url: `/orgs/${orgId}/caregiver/${caregiverId}/role`,
        method: 'PATCH',
        body: { role },
      }),
    }),
    sendInvite: builder.mutation<void, { orgId: string }>({
      query: ({ orgId }) => ({
        url: `/orgs/${orgId}/invite`,
        method: 'PATCH',
      }),
    }),
    verifyInvite: builder.mutation<void, { orgId: string, token: string }>({
      query: ({ orgId, token }) => ({
        url: `/orgs/${orgId}/verify-invite/${token}`,
        method: 'PATCH',
      }),
    }),
  }),
});

export const {
  useGetAllOrgsQuery,
  useGetOrgQuery,
  useUpdateOrgMutation,
  useDeleteOrgMutation,
  useAddCaregiverMutation,
  useRemoveCaregiverMutation,
  useSetRoleMutation,
  useSendInviteMutation,
  useVerifyInviteMutation,
} = orgApi;