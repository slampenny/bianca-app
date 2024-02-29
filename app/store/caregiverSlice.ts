import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { User } from '../services/api/api.types';

interface CaregiverState {
  caregiver: User | null;
  selectedUsers: User[]; // Array of selected users
}

const initialState: CaregiverState = {
  caregiver: null,
  selectedUsers: [],
};

export const caregiverSlice = createSlice({
  name: 'caregiver',
  initialState,
  reducers: {
    setCaregiver: (state, action: PayloadAction<User | null>) => {
      state.caregiver = action.payload;
    },
    setSelectedUsers: (state, action: PayloadAction<User[]>) => {
      state.selectedUsers = action.payload;
    },
    clearCaregiver: (state) => {
      state.caregiver = null;
    },
    clearSelectedUsers: (state) => {
      state.selectedUsers = [];
    },
    removeSelectedUser: (state, action: PayloadAction<string>) => {
      state.selectedUsers = state.selectedUsers.filter(user => user.id !== action.payload);
    },
  },
});

export const { setCaregiver, setSelectedUsers, clearCaregiver, clearSelectedUsers, removeSelectedUser } = caregiverSlice.actions;

export const selectCaregiver = (state: RootState) => state.caregiver.caregiver;
export const selectSelectedUsers = (state: RootState) => state.caregiver.selectedUsers;

export default caregiverSlice.reducer;