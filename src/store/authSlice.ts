import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, User } from '../types';

// No localStorage here anymore - the access/refresh tokens live in httpOnly
// cookies the backend sets, which this code can't read even if it wanted to.
// isAuthenticated starts false on every load and is restored (or not) by the
// /auth/me session check in App.tsx once it resolves - see sessionChecked.
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  sessionChecked: false,
  loading: false,
  requiresTwoFactor: false,
  pendingUsername: null,
} satisfies AuthState;

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart(state) {
      state.loading = true;
    },
    loginSuccess(state, action: PayloadAction<{ user: User }>) {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.sessionChecked = true;
      state.loading = false;
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
    },
    loginFailure(state) {
      state.loading = false;
    },
    requiresTwoFactor(state, action: PayloadAction<string>) {
      state.loading = false;
      state.requiresTwoFactor = true;
      state.pendingUsername = action.payload;
    },
    completeTwoFactor(state, action: PayloadAction<{ user: User }>) {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.sessionChecked = true;
      state.loading = false;
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
    },
    cancelTwoFactor(state) {
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
      state.loading = false;
    },
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.sessionChecked = true;
      state.loading = false;
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    // Result of the one-time /auth/me check on app load.
    sessionRestored(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.sessionChecked = true;
    },
    sessionCheckFailed(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.sessionChecked = true;
    },
  },
});

export const {
  loginStart, loginSuccess, loginFailure, requiresTwoFactor, completeTwoFactor,
  cancelTwoFactor, logout, setUser, sessionRestored, sessionCheckFailed,
} = authSlice.actions;
export default authSlice.reducer;
