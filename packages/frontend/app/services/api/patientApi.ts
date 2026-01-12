import { createApi } from "@reduxjs/toolkit/query/react"
import { Patient, PatientPages, Caregiver, Conversation } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

// Lazy import to break circular dependency with patientSlice
// This function loads the action only when needed (at runtime)
const getSetPatientsForCaregiver = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../../store/patientSlice").setPatientsForCaregiver
}

export const patientApi = createApi({
  reducerPath: "patientApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Patient"],
  endpoints: (builder) => ({
    createPatient: builder.mutation<Patient, { patient: Partial<Patient> }>({
      query: ({ patient }) => {
        return {
          url: `/patients`,
          method: "POST",
          body: patient,
        }
      },
      async onQueryStarted({ patient }, { dispatch, getState, queryFulfilled }) {
        console.log('[API CALLBACK] createPatient onQueryStarted - starting')
        try {
          const { data: createdPatient } = await queryFulfilled
          console.log('[API CALLBACK] createPatient onQueryStarted - patient created:', createdPatient.id)
          console.log('[API CALLBACK] createPatient onQueryStarted - full payload:', JSON.stringify(createdPatient, null, 2))
          console.log('[API CALLBACK] createPatient onQueryStarted - caregivers array:', createdPatient.caregivers)
          console.log('[API CALLBACK] createPatient onQueryStarted - caregivers type:', typeof createdPatient.caregivers, Array.isArray(createdPatient.caregivers))
          
          // Get current user from state
          const state = getState() as any
          console.log('[API CALLBACK] createPatient onQueryStarted - state keys:', Object.keys(state))
          console.log('[API CALLBACK] createPatient onQueryStarted - auth keys:', state?.auth ? Object.keys(state.auth) : 'no auth')
          const currentUser = state?.auth?.currentUser || state?.auth?.user
          console.log('[API CALLBACK] createPatient onQueryStarted - current user:', currentUser?.id, currentUser?.name)
          
          // First, try to add to all caregivers in the response
          if (createdPatient.caregivers && Array.isArray(createdPatient.caregivers) && createdPatient.caregivers.length > 0) {
            console.log('[API CALLBACK] createPatient onQueryStarted - adding to', createdPatient.caregivers.length, 'caregiver(s):', createdPatient.caregivers)
            createdPatient.caregivers.forEach((caregiverId: string) => {
              const userPatients = state?.patient?.patients?.[caregiverId] || []
              console.log(`[API CALLBACK] createPatient onQueryStarted - caregiver ${caregiverId} currently has ${userPatients.length} patients`)
              const existingIndex = userPatients.findIndex((p: Patient) => p.id === createdPatient.id)
              if (existingIndex === -1) {
                console.log(`[API CALLBACK] createPatient onQueryStarted - dispatching setPatientsForCaregiver for ${caregiverId}`)
                const setPatientsForCaregiver = getSetPatientsForCaregiver()
                dispatch(setPatientsForCaregiver({
                  caregiverId,
                  patients: [...userPatients, createdPatient],
                }))
                console.log(`[API CALLBACK] createPatient onQueryStarted - added to caregiver ${caregiverId}, new count: ${userPatients.length + 1}`)
              } else {
                console.log(`[API CALLBACK] createPatient onQueryStarted - patient already exists for caregiver ${caregiverId}`)
              }
            })
          } else {
            console.log('[API CALLBACK] createPatient onQueryStarted - no caregivers array or empty')
          }
          
          // Also ensure current user gets the patient (fallback)
          if (currentUser && currentUser.id && createdPatient) {
            const userPatients = state?.patient?.patients?.[currentUser.id] || []
            console.log(`[API CALLBACK] createPatient onQueryStarted - current user ${currentUser.id} currently has ${userPatients.length} patients`)
            const existingIndex = userPatients.findIndex((p: Patient) => p.id === createdPatient.id)
            
            if (existingIndex === -1) {
              console.log('[API CALLBACK] createPatient onQueryStarted - adding to current user as fallback')
              const setPatientsForCaregiver = getSetPatientsForCaregiver()
              dispatch(setPatientsForCaregiver({
                caregiverId: currentUser.id,
                patients: [...userPatients, createdPatient],
              }))
              console.log('[API CALLBACK] createPatient onQueryStarted - patient added to Redux for user', currentUser.id)
            } else {
              console.log('[API CALLBACK] createPatient onQueryStarted - patient already exists for current user')
            }
          } else {
            console.log('[API CALLBACK] createPatient onQueryStarted - no current user or patient')
          }
          
          // Check final state
          const finalState = getState() as any
          const finalUserPatients = currentUser?.id ? (finalState?.patient?.patients?.[currentUser.id] || []) : []
          console.log(`[API CALLBACK] createPatient onQueryStarted - final state: user ${currentUser?.id} has ${finalUserPatients.length} patients`)
          console.log(`[API CALLBACK] createPatient onQueryStarted - final patient IDs:`, finalUserPatients.map((p: Patient) => p.id))
        } catch (error) {
          // Error handling - patient creation failed
          console.error("[API CALLBACK] Error in createPatient onQueryStarted:", error)
        }
      },
    }),
    getAllPatients: builder.query<
      PatientPages,
      { name?: string; role?: string; sortBy?: string; limit?: number; page?: number }
    >({
      query: (params) => ({
        url: "/patients",
        method: "GET",
        params,
      }),
    }),
    getPatient: builder.query<Patient, { id: string }>({
      query: ({ id }) => `/patients/${id}`,
      providesTags: (result, error, { id }) => [{ type: "Patient", id }],
    }),
    updatePatient: builder.mutation<Patient, { id: string; patient: Partial<Patient> }>({
      query: ({ id, patient }) => {
        const { schedules, ...filteredPatient } = patient

        return {
          url: `/patients/${id}`,
          method: "PATCH",
          body: filteredPatient,
        }
      },
    }),
    uploadPatientAvatar: builder.mutation<Caregiver, { id: string; avatar: Blob | File }>({
      query: ({ id, avatar }) => {
        const formData = new FormData()

        // Properly append the avatar as a file/blob
        formData.append("avatar", avatar, "avatar.jpg")

        return {
          url: `/patients/${id}/avatar`,
          method: "POST",
          body: formData,
          // Don't set content-type header, browser will set it with proper boundary
          formData: true,
        }
      },
    }),
    deletePatient: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/patients/${id}`,
        method: "DELETE",
      }),
    }),
    assignCaregiver: builder.mutation<Patient, { patientId: string; caregiverId: string }>({
      query: ({ patientId, caregiverId }) => ({
        url: `/patients/${patientId}/caregivers/${caregiverId}`,
        method: "POST",
      }),
    }),
    unassignCaregiver: builder.mutation<Patient, { patientId: string; caregiverId: string }>({
      query: ({ patientId, caregiverId }) => ({
        url: `/patients/${patientId}/caregivers/${caregiverId}`,
        method: "DELETE",
      }),
    }),
    getConversationsByPatient: builder.query<Conversation[], { patientId: string }>({
      query: ({ patientId }) => ({
        url: `/patients/${patientId}/conversations`,
        method: "GET",
      }),
    }),
    getCaregivers: builder.query<Caregiver[], { patientId: string }>({
      query: ({ patientId }) => ({
        url: `/patients/${patientId}/caregivers`,
        method: "GET",
      }),
    }),
    getUnassignedPatients: builder.query<Patient[], void>({
      query: () => ({
        url: "/patients/unassigned",
        method: "GET",
      }),
    }),
    assignUnassignedPatients: builder.mutation<
      Patient[],
      { caregiverId: string; patientIds: string[] }
    >({
      query: ({ caregiverId, patientIds }) => ({
        url: "/patients/assign-unassigned",
        method: "POST",
        body: { caregiverId, patientIds },
      }),
    }),
    verifyConsent: builder.mutation<
      { success: boolean; message: string; alreadyConsented: boolean; patient: Patient },
      { token: string }
    >({
      query: ({ token }) => ({
        url: `/patients/consent/verify?token=${encodeURIComponent(token)}`,
        method: "GET",
        headers: {
          'Accept': 'application/json',
        },
      }),
    }),
  }),
})

export const {
  useCreatePatientMutation,
  useGetAllPatientsQuery,
  useGetPatientQuery,
  useUploadPatientAvatarMutation,
  useUpdatePatientMutation,
  useDeletePatientMutation,
  useAssignCaregiverMutation,
  useUnassignCaregiverMutation,
  // useGetConversationsByPatientQuery,
  useGetCaregiversQuery,
  useGetUnassignedPatientsQuery,
  useAssignUnassignedPatientsMutation,
  useVerifyConsentMutation,
} = patientApi
