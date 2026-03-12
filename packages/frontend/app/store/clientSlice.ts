import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "./store"
import { Client } from "../services/api/api.types"
import { authApi } from "../services/api/authApi"
import { clientApi } from "../services/api/clientApi"
import { ssoApi } from "../services/api/ssoApi"
import { logger } from "../utils/logger"

interface ClientState {
  client: Client | null
  clients: Record<string, Client[]>
}

const initialState: ClientState = {
  client: null,
  clients: {},
}

export const clientSlice = createSlice({
  name: "client",
  initialState,
  reducers: {
    setClient: (state, action: PayloadAction<Client | null>) => {
      logger.debug("setClient called with:", action.payload)
      state.client = action.payload
      if (action.payload && action.payload.caregivers) {
        action.payload.caregivers.forEach((caregiverId: string) => {
          if (state.clients[caregiverId]) {
            const index = state.clients[caregiverId].findIndex((p) => p.id === action.payload!.id)
            if (index !== -1) {
              state.clients[caregiverId][index] = action.payload
            }
          }
        })
      }
    },
    setClientsForCaregiver: (
      state,
      action: PayloadAction<{ caregiverId: string; clients: Client[] }>,
    ) => {
      logger.debug("setClientsForCaregiver called for caregiver:", action.payload.caregiverId)
      const { caregiverId, clients } = action.payload
      if (!state.clients[caregiverId]) {
        state.clients[caregiverId] = []
      }
      clients.forEach((c) => {
        const existingIndex = state.clients[caregiverId].findIndex((p) => p.id === c.id)
        if (existingIndex === -1) {
          state.clients[caregiverId].push(c)
        } else {
          state.clients[caregiverId][existingIndex] = c
        }
      })
    },
    clearClient: (state) => {
      logger.debug("clearClient called")
      state.client = null
    },
    clearClients: (state) => {
      logger.debug("clearClients called")
      state.clients = {}
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      if ('caregiver' in payload && 'clients' in payload && payload.caregiver && payload.clients) {
        const caregiverId = payload.caregiver.id!
        if (!state.clients[caregiverId]) {
          state.clients[caregiverId] = []
        }
        (payload.clients as Client[]).forEach((c: Client) => {
          const existingIndex = state.clients[caregiverId].findIndex((p) => p.id === c.id)
          if (existingIndex === -1) {
            state.clients[caregiverId].push(c)
          } else {
            state.clients[caregiverId][existingIndex] = c
          }
        })
      }
    })
    builder.addMatcher(ssoApi.endpoints.ssoLogin.matchFulfilled, (state, { payload }) => {
      if (payload?.caregiver?.id && payload?.clients) {
        state.clients[payload.caregiver.id] = []
        ;(payload.clients as Client[]).forEach((c: Client) => {
          state.clients[payload.caregiver!.id].push(c)
        })
      }
    })
    builder.addMatcher(authApi.endpoints.verifyEmail.matchFulfilled, (state, { payload }) => {
      if (payload?.caregiver?.id && payload?.clients && Array.isArray(payload.clients)) {
        const caregiverId = payload.caregiver.id
        if (!state.clients[caregiverId]) state.clients[caregiverId] = []
        ;(payload.clients as Client[]).forEach((c: Client) => {
          const existingIndex = state.clients[caregiverId].findIndex((p) => p.id === c.id)
          if (existingIndex === -1) state.clients[caregiverId].push(c)
          else state.clients[caregiverId][existingIndex] = c
        })
      }
    })
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      state.client = null
      state.clients = {}
    })
    builder.addMatcher(authApi.endpoints.logout.matchRejected, (state) => {
      state.client = null
      state.clients = {}
    })
    builder.addMatcher(clientApi.endpoints.createClient.matchFulfilled, (state, { payload }) => {
      state.client = payload
      if (payload?.caregivers && Array.isArray(payload.caregivers) && payload.caregivers.length > 0) {
        payload.caregivers.forEach((caregiverId: string) => {
          if (!state.clients[caregiverId]) {
            state.clients[caregiverId] = []
          }
          const existingIndex = state.clients[caregiverId].findIndex((p) => p.id === payload.id)
          if (existingIndex === -1) {
            state.clients[caregiverId].push(payload)
          }
        })
      }
    })
    builder.addMatcher(clientApi.endpoints.updateClient.matchFulfilled, (state, { payload }) => {
      state.client = payload
      Object.keys(state.clients).forEach((caregiverId) => {
        const index = state.clients[caregiverId].findIndex((p) => p.id === payload.id)
        if (index !== -1) {
          state.clients[caregiverId][index] = payload
        }
      })
    })
    builder.addMatcher(
      clientApi.endpoints.uploadClientAvatar.matchFulfilled,
      (state, { payload }) => {
        if (state.client && state.client.id === payload.id) {
          state.client.avatar = payload.avatar
        }
      },
    )
    builder.addMatcher(clientApi.endpoints.deleteClient.matchFulfilled, (state) => {
      if (state.client?.caregivers) {
        state.client.caregivers.forEach((caregiverId: string) => {
          state.clients[caregiverId] = state.clients[caregiverId]?.filter(
            (c) => c.id !== state.client!.id,
          ) ?? []
        })
      }
      state.client = null
    })
  },
})

export const { setClient, setClientsForCaregiver, clearClient, clearClients } = clientSlice.actions

export const getClient = (state: RootState) => state.client.client
export const getClientsForCaregiver = (state: RootState, caregiverId: string) =>
  state.client.clients[caregiverId] || []

export default clientSlice.reducer
