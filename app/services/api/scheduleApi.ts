import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { RootState } from '../../store/store';

export const scheduleApi = createApi({
  reducerPath: 'scheduleApi',
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
    createSchedule: builder.mutation<void, any>({
      query: (data) => ({
        url: '/schedules',
        method: 'POST',
        body: data,
      }),
    }),
    getSchedule: builder.query<void, { scheduleId: string }>({
      query: ({ scheduleId }) => `/schedules/${scheduleId}`,
    }),
    updateSchedule: builder.mutation<void, { scheduleId: string, data: any }>({
      query: ({ scheduleId, data }) => ({
        url: `/schedules/${scheduleId}`,
        method: 'PUT',
        body: data,
      }),
    }),
    patchSchedule: builder.mutation<void, { scheduleId: string, data: any }>({
      query: ({ scheduleId, data }) => ({
        url: `/schedules/${scheduleId}`,
        method: 'PATCH',
        body: data,
      }),
    }),
    deleteSchedule: builder.mutation<void, { scheduleId: string }>({
      query: ({ scheduleId }) => ({
        url: `/schedules/${scheduleId}`,
        method: 'DELETE',
      }),
    }),
  }),
});

export const {
  useCreateScheduleMutation,
  useGetScheduleQuery,
  useUpdateScheduleMutation,
  usePatchScheduleMutation,
  useDeleteScheduleMutation,
} = scheduleApi;