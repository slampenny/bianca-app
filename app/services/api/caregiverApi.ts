import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { RootState } from '../../store/store';
import { Caregiver, CaregiverPages, Patient } from './api.types';

export const caregiverApi = createApi({
  reducerPath: 'caregiverApi',
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
    getAllCaregivers: builder.query<CaregiverPages, { name?: string, role?: string, sortBy?: string, limit?: number, page?: number }>({
      query: (params) => ({
        url: '/caregivers',
        method: 'GET',
        params,
      }),
    }),
    getCaregiver: builder.query<Caregiver, { id: string }>({
      query: ({ id }) => `/caregivers/${id}`,
    }),
    updateCaregiver: builder.mutation<Caregiver, { id: string, caregiver: Partial<Caregiver> }>({
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
    // assignCaregiver: builder.mutation<void, { patientId: string, caregiverId: string }>({
    //   query: ({ patientId, caregiverId }) => ({
    //     url: `/caregivers/${caregiverId}/patients/${patientId}`,
    //     method: 'POST',
    //   }),
    // }),
    // removeCaregiver: builder.mutation<void, { patientId: string, caregiverId: string }>({
    //   query: ({ patientId, caregiverId }) => ({
    //     url: `/caregivers/${caregiverId}/patients/${patientId}`,
    //     method: 'DELETE',
    //   }),
    // }),
    getPatientForCaregiver: builder.query<Patient, { patientId: string, caregiverId: string }>({
      query: ({ patientId, caregiverId }) => ({
        url: `/caregivers/${caregiverId}/patients/${patientId}`,
        method: 'GET',
      }),
    }),
    getPatientsForCaregiver: builder.query<Patient[], string | null>({
      query: (caregiverId) => {
        if (caregiverId === null) {
          throw new Error("No caregiver provided");
        }
        return {
          url: `/caregivers/${caregiverId}/patients`,
          method: 'GET',
        };
      },
    }),
  }),
});

export const {
  // useAssignCaregiverMutation,
  // useRemoveCaregiverMutation,
  useGetAllCaregiversQuery,
  useGetCaregiverQuery,
  useUpdateCaregiverMutation,
  useDeleteCaregiverMutation,
  useGetPatientForCaregiverQuery,
  useGetPatientsForCaregiverQuery,
} = caregiverApi;
