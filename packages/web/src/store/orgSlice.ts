import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import type { Org } from "../services/api/api.types"

const orgSlice = createSlice({
  name: "org",
  initialState: null as Org | null,
  reducers: {
    setOrg(_state, action: PayloadAction<Org | null>) {
      return action.payload
    },
  },
})

export const { setOrg } = orgSlice.actions
export default orgSlice.reducer
