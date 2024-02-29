import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { RootState } from '../../store/store';
import { User } from './api.types';

export const userApi = createApi({
  reducerPath: 'userApi',
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
    createUser: builder.mutation<void, { user: User }>({
      query: ({ user }) => ({
        url: `/users`,
        method: 'POST',
        body: user,
      }),
    }),
    getAllUsers: builder.query<void, void>({
      query: () => `/users`,
    }),
    getUser: builder.query<void, { id: string }>({
      query: ({ id }) => `/users/${id}`,
    }),
    updateUser: builder.mutation<{ user: User }, { id: string, user: any }>({
      query: ({ id, user }) => ({
        url: `/users/${id}`,
        method: 'PATCH',
        body: user,
      }),
    }),
    deleteUser: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/users/${id}`,
        method: 'DELETE',
      }),
    }),
  }),
});

export const {
  useCreateUserMutation,
  useGetAllUsersQuery,
  useGetUserQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = userApi;