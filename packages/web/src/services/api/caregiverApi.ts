import { createApi } from "@reduxjs/toolkit/query/react"
import type { Caregiver, CaregiverPages } from "./api.types"
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
    updateCaregiver: builder.mutation<Caregiver, { id: string; caregiver: Partial<Caregiver> }>({
      query: ({ id, caregiver }) => {
        const body: Record<string, unknown> = {}
        if (caregiver.name !== undefined) body.name = caregiver.name
        if (caregiver.email !== undefined) body.email = caregiver.email
        if (caregiver.phone !== undefined) body.phone = caregiver.phone
        if (caregiver.avatar !== undefined) body.avatar = caregiver.avatar
        if (caregiver.preferredLanguage !== undefined) body.preferredLanguage = caregiver.preferredLanguage
        return {
          url: `/caregivers/${id}`,
          method: "PATCH",
          body,
        }
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: "Caregiver", id }],
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
  useUpdateCaregiverMutation,
  useUploadAvatarMutation,
} = caregiverApi
