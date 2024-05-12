
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { RootState } from '../../store/store';
import { Caregiver } from './api.types';

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
    createCaregiver: builder.mutation<void, { caregiver: Caregiver }>({
      query: ({ caregiver }) => ({
        url: `/caregivers`,
        method: 'POST',
        body: caregiver,
      }),
    }),
    getAllCaregivers: builder.query<void, void>({
      query: () => `/caregivers`,
    }),
    getCaregiver: builder.query<void, { id: string }>({
      query: ({ id }) => `/caregivers/${id}`,
    }),
    updateCaregiver: builder.mutation<{ caregiver: Caregiver }, { id: string, caregiver: any }>({
      query: ({ id, caregiver }) => ({
        url: `/caregivers/${id}`,
        method: 'PATCH',
        body: caregiver,
      }),
    }),
    deleteCaregiver: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/caregivers/${id}`,
        method: 'DELETE',
      }),
    }),
    assignCaregiver: builder.mutation<void, { patientId: string, caregiverId: string }>({
      query: ({ patientId, caregiverId }) => ({
        url: `/patients/${patientId}/caregiver/${caregiverId}`,
        method: 'POST',
      }),
    }),
    removeCaregiver: builder.mutation<void, { patientId: string, caregiverId: string }>({
      query: ({ patientId, caregiverId }) => ({
        url: `/patients/${patientId}/caregiver/${caregiverId}`,
        method: 'DELETE',
      }),
    }),
    getPatientForCaregiver: builder.query<void, Caregiver | null >({
      query: (caregiver) => {
        if (caregiver === null) {
          throw new Error("No caregiver provided");
        }
        return {
          url: `/caregivers/${caregiver.id}/patients`,
          method: 'GET',
        }

      }
    }),
  }),
});

export const {
  useAssignCaregiverMutation,
  useRemoveCaregiverMutation,
  useCreateCaregiverMutation,
  useGetAllCaregiversQuery,
  useGetCaregiverQuery,
  useUpdateCaregiverMutation,
  useDeleteCaregiverMutation,
  useGetPatientForCaregiverQuery,
} = caregiverApi;