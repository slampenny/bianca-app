
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { RootState } from '../../store/store';
import { User } from './api.types';

export const caregiverApi = createApi({
  reducerPath: 'caregiverApi',
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
    assignCaregiver: builder.mutation<void, { userId: string, caregiverId: string }>({
      query: ({ userId, caregiverId }) => ({
        url: `/users/${userId}/caregiver/${caregiverId}`,
        method: 'POST',
      }),
    }),
    removeCaregiver: builder.mutation<void, { userId: string, caregiverId: string }>({
      query: ({ userId, caregiverId }) => ({
        url: `/users/${userId}/caregiver/${caregiverId}`,
        method: 'DELETE',
      }),
    }),
    getClientsForCaregiver: builder.query<void, User | null >({
      query: (caregiver) => {
        if (caregiver === null) {
          throw new Error("No caregiver provided");
        }
        return {
          url: `/users/caregiver/${caregiver.id}/clients`,
          method: 'GET',
        }

      }
    }),
  }),
});

export const {
  useAssignCaregiverMutation,
  useRemoveCaregiverMutation,
  useGetClientsForCaregiverQuery,
  // ...other hooks...
} = caregiverApi;