import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { authApi } from "../services/api/authApi";
import { userApi } from "../services/api/userApi"; 
import { User } from '../services/api/api.types';
import { RootState } from "./store";

export interface AuthTokens {
  access: {
    expires: string;
    token: string;
  },
  refresh: {
    expires: string;
    token: string;
  }
}

interface AuthState {
  tokens: AuthTokens | null; // This is the JWT token  
  authEmail: string;
  currentUser: User | null;
}

const initialState: AuthState = {
  tokens: null,
  authEmail: "jaycee.dibbert43@gmail.com",
  currentUser: null,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthTokens(state, action: PayloadAction<AuthTokens>) {
      state.tokens = action.payload;
    },
    setAuthEmail(state, action: PayloadAction<string>) {
      state.authEmail = action.payload
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.register.matchFulfilled, (state, { payload }) => {
      console.log("logging in");
      state.currentUser = payload;
    });
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      state.currentUser = payload.user;
      state.tokens = payload.tokens;
    });
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      state.tokens = null;
      state.authEmail = "";
      state.currentUser = null;
    });
    builder.addMatcher(authApi.endpoints.refreshTokens.matchFulfilled, (state, { payload }) => {
      state.tokens = payload.tokens;
    });
    builder.addMatcher(userApi.endpoints.updateUser.matchFulfilled, (state, { payload }) => {
      // Check if the updated user is the same as the current user
      if (state.currentUser && payload.user.id === state.currentUser.id) {
        state.currentUser = payload.user;
      }
    });
  },
});

export const { setAuthTokens, setAuthEmail } = authSlice.actions;

export const isAuthenticated = (state : RootState) => {
  return !!state.auth.tokens;
}

export const getValidationError = (state : {auth: AuthState}) => {
  if (state.auth.authEmail.length === 0) return "can't be blank"
  if (state.auth.authEmail.length < 6) return "must be at least 6 characters"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.auth.authEmail))
    return "must be a valid email address"
  return ""
}

export const getCurrentUser = (state: RootState) => state.auth.currentUser;
export const getAuthEmail = (state: {auth: AuthState}) => state.auth.authEmail;
export const getAuthTokens = (state: {auth: AuthState}) => {
  return state.auth.tokens;
}

export default authSlice.reducer;