import { createApi } from "@reduxjs/toolkit/query/react"
import type { Caregiver, CaregiverPages, Client } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const caregiverApi = createApi({
  reducerPath: "caregiverApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Caregiver"],
  endpoints: (builder) => ({
    getCaregivers: builder.query<
      CaregiverPages,
      { org?: string; name?: string; role?: string; sortBy?: string; limit?: number; page?: number }
    >({
      query: (params) => ({ url: "/caregivers", method: "GET", params }),
      providesTags: ["Caregiver"],
    }),
    getCaregiver: builder.query<Caregiver, { id: string }>({
      query: ({ id }) => `/caregivers/${id}`,
      providesTags: (_r, _e, { id }) => [{ type: "Caregiver", id }],
    }),
    getCaregiverClients: builder.query<Client[], { id: string }>({
      query: ({ id }) => ({
        url: `/caregivers/${id}/clients`,
        method: "GET",
      }),
    }),
    createCaregiver: builder.mutation<
      Caregiver,
      {
        caregiver: {
          orgId?: string
          name: string
          email: string
          phone?: string
          role?: "invited" | "staff" | "orgAdmin" | "superAdmin"
          externalId?: string
          active?: boolean
          preferredLanguage?: string
        }
      }
    >({
      query: ({ caregiver }) => ({
        url: "/caregivers",
        method: "POST",
        body: caregiver,
      }),
      invalidatesTags: ["Caregiver"],
    }),
    updateCaregiver: builder.mutation<Caregiver, { id: string; caregiver: Partial<Caregiver> }>({
      query: ({ id, caregiver }) => {
        const body: Record<string, unknown> = {}
        if (caregiver.name !== undefined) body.name = caregiver.name
        if (caregiver.email !== undefined) body.email = caregiver.email
        if (caregiver.phone !== undefined) body.phone = caregiver.phone
        if (caregiver.avatar !== undefined) body.avatar = caregiver.avatar
        if (caregiver.preferredLanguage !== undefined) body.preferredLanguage = caregiver.preferredLanguage
        if (caregiver.notificationPreferences !== undefined) {
          body.notificationPreferences = caregiver.notificationPreferences
        }
        return {
          url: `/caregivers/${id}`,
          method: "PATCH",
          body,
        }
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: "Caregiver", id }],
    }),
    deleteCaregiver: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/caregivers/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Caregiver"],
    }),
    uploadAvatar: builder.mutation<Caregiver, { id: string; avatar: Blob | File }>({
      query: ({ id, avatar }) => {
        const formData = new FormData()
        formData.append("avatar", avatar, "avatar.jpg")
        return {
          url: `/caregivers/${id}/avatar`,
          method: "POST",
          body: formData,
        }
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: "Caregiver", id }],
    }),
  }),
})

export const {
  useGetCaregiversQuery,
  useGetCaregiverQuery,
  useGetCaregiverClientsQuery,
  useCreateCaregiverMutation,
  useUpdateCaregiverMutation,
  useDeleteCaregiverMutation,
  useUploadAvatarMutation,
} = caregiverApi
