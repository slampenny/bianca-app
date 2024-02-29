import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { User } from '../services/api/api.types';

interface UserState {
  selectedUser: User;
}

const initialState: UserState = {
  selectedUser: {
    name: '',
    email: '',
    phone: '',
    role: 'user',
    caregiver: null,
    schedules: [{
      frequency: 'daily',
      intervals: [{
        day: 0
      }],
      time: new Date().toISOString(),
      isActive: true,
    }],
  }
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setSelectedUser: (state, action: PayloadAction<User>) => {
      state.selectedUser = action.payload;
    },
    clearUser: (state) => {
      state.selectedUser = {
        name: '',
        email: '',
        phone: '',
        role: 'user',
        caregiver: null,
        schedules: [{
          frequency: 'daily',
          intervals: [{
            day: 0
          }],
          time: new Date().toISOString(),
          isActive: true,
        }],
      };
    },
  },
});

export const { setSelectedUser, clearUser } = userSlice.actions;

export const getSelectedUser = (state: RootState) => state.user.selectedUser;

export default userSlice.reducer;