// homeSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface HomeState {
  selectedUser: number | null
}

const initialState: HomeState = {
  selectedUser: null,
}

export const homeSlice = createSlice({
  name: "home",
  initialState,
  reducers: {
    selectUser: (state, action: PayloadAction<number>) => {
      state.selectedUser = action.payload
    },
  },
})

export const { selectUser } = homeSlice.actions

export default homeSlice.reducer
