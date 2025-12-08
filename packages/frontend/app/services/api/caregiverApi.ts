import { createApi } from "@reduxjs/toolkit/query/react"
import { Caregiver, CaregiverPages, Patient } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const caregiverApi = createApi({
  reducerPath: "caregiverApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Caregiver"],
  endpoints: (builder) => ({
    getAllCaregivers: builder.query<
      CaregiverPages,
      {
        org?: string | null
        name?: string
        role?: string
        sortBy?: string
        limit?: number
        page?: number
      }
    >({
      query: (params) => ({
        url: "/caregivers",
        method: "GET",
        params,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: "Caregiver" as const, id })),
              { type: "Caregiver" as const, id: "LIST" },
            ]
          : [{ type: "Caregiver" as const, id: "LIST" }],
    }),
    getCaregiver: builder.query<Caregiver, { id: string }>({
      query: ({ id }) => `/caregivers/${id}`,
      providesTags: (result, error, { id }) => [{ type: "Caregiver" as const, id }],
    }),
    updateCaregiver: builder.mutation<Caregiver, { id: string; caregiver: Partial<Caregiver> }>({
      query: ({ id, caregiver }) => {
        const filteredData: Partial<Caregiver> = {}

        // Explicitly handle each field with proper typing
        if ("name" in caregiver && caregiver.name !== undefined) {
          filteredData.name = caregiver.name
        }

        if ("email" in caregiver && caregiver.email !== undefined) {
          filteredData.email = caregiver.email
        }

        if ("phone" in caregiver && caregiver.phone !== undefined) {
          filteredData.phone = caregiver.phone
        }

        if ("avatar" in caregiver && caregiver.avatar !== undefined) {
          filteredData.avatar = caregiver.avatar
        }

        if ("preferredLanguage" in caregiver && caregiver.preferredLanguage !== undefined) {
          filteredData.preferredLanguage = caregiver.preferredLanguage
        }

        return {
          url: `/caregivers/${id}`,
          method: "PATCH",
          body: filteredData,
        }
      },
      invalidatesTags: (result, error, { id }) => [
        { type: "Caregiver", id },
        { type: "Caregiver", id: "LIST" },
      ],
    }),
    uploadAvatar: builder.mutation<Caregiver, { id: string; avatar: Blob | File }>({
      query: ({ id, avatar }) => {
        const formData = new FormData()

        // Properly append the avatar as a file/blob
        formData.append("avatar", avatar, "avatar.jpg")

        return {
          url: `/caregivers/${id}/avatar`,
          method: "POST",
          body: formData,
          // Don't set content-type header, browser will set it with proper boundary
          formData: true,
        }
      },
    }),
    deleteCaregiver: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/caregivers/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Caregiver", id },
        { type: "Caregiver", id: "LIST" },
      ],
    }),
    getPatientForCaregiver: builder.query<Patient, { patientId: string; caregiverId: string }>({
      query: ({ patientId, caregiverId }) => ({
        url: `/caregivers/${caregiverId}/patients/${patientId}`,
        method: "GET",
      }),
    }),
    getPatientsForCaregiver: builder.query<Patient[], string | null>({
      query: (caregiverId) => {
        if (caregiverId === null) {
          throw new Error("No caregiver provided")
        }
        return {
          url: `/caregivers/${caregiverId}/patients`,
          method: "GET",
        }
      },
    }),
  }),
})

export const {
  useGetAllCaregiversQuery,
  useGetCaregiverQuery,
  useUpdateCaregiverMutation,
  useUploadAvatarMutation,
  useDeleteCaregiverMutation,
  useGetPatientForCaregiverQuery,
  useGetPatientsForCaregiverQuery,
} = caregiverApi
