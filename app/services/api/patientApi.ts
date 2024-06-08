import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { RootState } from '../../store/store';
import { Patient, PatientPages, Caregiver, Conversation } from './api.types';

export const patientApi = createApi({
  reducerPath: 'patientApi',
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
    createPatient: builder.mutation<Patient, { patient: Partial<Patient>, avatar?: File }>({
      query: ({patient, avatar}) => {
        const formData = new FormData();
        Object.keys(patient).forEach(key => {
          formData.append(key, (patient as { [key: string]: any })[key]);
        });

        if (avatar) {
          formData.append('avatar', avatar);
        }

        return {
          url: `/patients`,
          method: 'POST',
          body: formData,
        };
      }
    }),
    getAllPatients: builder.query<PatientPages, { name?: string, role?: string, sortBy?: string, limit?: number, page?: number }>({
      query: (params) => ({
        url: '/patients',
        method: 'GET',
        params,
      }),
    }),
    getPatient: builder.query<Patient, { id: string }>({
      query: ({ id }) => `/patients/${id}`,
    }),
    updatePatient: builder.mutation<Patient, { id: string, patient: Partial<Patient>, avatar?: File }>({
      query: ({ id, patient, avatar }) => {
        const formData = new FormData();
        Object.keys(patient).forEach(key => {
          formData.append(key, (patient as { [key: string]: any })[key]);
        });

        if (avatar) {
          formData.append('avatar', avatar);
        }

        return {
          url: `/patients/${id}`,
          method: 'PATCH',
          body: formData,
        };
      }
    }),
    deletePatient: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/patients/${id}`,
        method: 'DELETE',
      }),
    }),
    assignCaregiver: builder.mutation<Patient, { patientId: string, caregiverId: string }>({
      query: ({ patientId, caregiverId }) => ({
        url: `/patients/${patientId}/caregivers/${caregiverId}`,
        method: 'POST',
      }),
    }),
    unassignCaregiver: builder.mutation<Patient, { patientId: string, caregiverId: string }>({
      query: ({ patientId, caregiverId }) => ({
        url: `/patients/${patientId}/caregivers/${caregiverId}`,
        method: 'DELETE',
      }),
    }),
    getConversationsByPatient: builder.query<Conversation[], { patientId: string }>({
      query: ({ patientId }) => ({
        url: `/patients/${patientId}/conversations`,
        method: 'GET',
      }),
    }),
    getCaregivers: builder.query<Caregiver[], { patientId: string }>({
      query: ({ patientId }) => ({
        url: `/patients/${patientId}/caregivers`,
        method: 'GET',
      }),
    }),
  }),
});

export const {
  useCreatePatientMutation,
  useGetAllPatientsQuery,
  useGetPatientQuery,
  useUpdatePatientMutation,
  useDeletePatientMutation,
  useAssignCaregiverMutation,
  useUnassignCaregiverMutation,
  useGetConversationsByPatientQuery,
  useGetCaregiversQuery,
} = patientApi;
