
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { RootState } from '../../store/store';
import { Org } from './api.types';

export const orgApi = createApi({
  reducerPath: 'orgApi',
  baseQuery: fetchBaseQuery({ 
    baseUrl: DEFAULT_API_CONFIG.url,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.tokens?.access;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: (builder) => ({
    // Existing endpoints...
    createOrg: builder.mutation<void, { org: Org }>({
      query: ({ org }) => ({
        url: `/orgs`,
        method: 'POST',
        body: org,
      }),
    }),
    getAllOrgs: builder.query<void, void>({
      query: () => `/orgs`,
    }),
    getOrg: builder.query<void, { id: string }>({
      query: ({ id }) => `/orgs/${id}`,
    }),
    updateOrg: builder.mutation<{ org: Org }, { id: string, org: any }>({
      query: ({ id, org }) => ({
        url: `/orgs/${id}`,
        method: 'PATCH',
        body: org,
      }),
    }),
    deleteOrg: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/orgs/${id}`,
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
  // Existing hooks...
  useCreateOrgMutation,
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