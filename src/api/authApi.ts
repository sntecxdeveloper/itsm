import api from './axios';
import type { LoginRequest, LoginResponse, SignupRequest, SignupResponse, User } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', data);
  return response.data.data;
}

/** Restores session state on app load - succeeds only if the httpOnly access
 *  cookie is present and still valid, since there's nothing else this code
 *  can check client-side anymore. */
export async function getCurrentUser(): Promise<User> {
  const response = await api.get<ApiResponse<User>>('/auth/me');
  return response.data.data;
}

export async function logout(): Promise<void> {
  await api.post<ApiResponse<null>>('/auth/logout');
}

export async function signup(data: SignupRequest): Promise<SignupResponse> {
  const response = await api.post<ApiResponse<SignupResponse>>('/auth/signup', data);
  return response.data.data;
}

export async function checkUsername(username: string): Promise<boolean> {
  const response = await api.get<ApiResponse<{ exists: boolean }>>('/auth/check-username', {
    params: { username },
  });
  return response.data.data.exists;
}

export async function checkEmail(email: string): Promise<boolean> {
  const response = await api.get<ApiResponse<{ exists: boolean }>>('/auth/check-email', {
    params: { email },
  });
  return response.data.data.exists;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post<ApiResponse<null>>('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<void> {
  await api.post<ApiResponse<null>>('/auth/reset-password', { token, newPassword, confirmPassword });
}

export async function sendOtp(username: string): Promise<void> {
  await api.post<ApiResponse<null>>('/auth/send-otp', { username });
}

export async function verifyOtp(username: string, otp: string): Promise<boolean> {
  const response = await api.post<ApiResponse<{ verified: boolean }>>('/auth/verify-otp', { username, otp });
  return response.data.data.verified;
}

export interface TotpSetupResponse {
  secret: string;
  username: string;
  issuer: string;
  qrCode: string;
}

export async function enableTotp(username: string): Promise<TotpSetupResponse> {
  const response = await api.post<ApiResponse<TotpSetupResponse>>('/auth/enable-totp', { username });
  return response.data.data;
}

export async function verifyTotp(username: string, code: string): Promise<boolean> {
  const response = await api.post<ApiResponse<{ verified: boolean }>>('/auth/verify-totp', { username, code });
  return response.data.data.verified;
}

export async function verify2fa(username: string, code: string): Promise<LoginResponse> {
  const response = await api.post<ApiResponse<LoginResponse>>('/auth/verify-2fa', { username, code });
  return response.data.data;
}

export async function disableTotp(username: string): Promise<void> {
  await api.post<ApiResponse<null>>('/auth/disable-totp', { username });
}

/** Admin-only: switches the session cookie to act as the given user.
 *  Expects POST /auth/impersonate/{userId} on the backend, returning that user. */
export async function impersonateUser(userId: number): Promise<User> {
  const response = await api.post<ApiResponse<User>>(`/auth/impersonate/${userId}`);
  return response.data.data;
}

// Set while an admin is acting as another user, so the header can offer a way back.
const IMPERSONATOR_KEY = 'dex.impersonator';

export function getImpersonator(): User | null {
  try {
    return JSON.parse(sessionStorage.getItem(IMPERSONATOR_KEY) || 'null');
  } catch {
    return null;
  }
}

export function rememberImpersonator(admin: User): void {
  try {
    sessionStorage.setItem(IMPERSONATOR_KEY, JSON.stringify(admin));
  } catch {
    /* without it the menu just won't offer the way back; logging in again still works */
  }
}

/** Ends impersonation. The admin's refresh cookie is untouched by impersonation, so refreshing
 *  re-issues an access cookie for the admin. Returns the admin only if the session really is one. */
export async function stopImpersonating(): Promise<User | null> {
  try {
    sessionStorage.removeItem(IMPERSONATOR_KEY);
  } catch {
    /* ignore */
  }
  try {
    await api.post('/auth/refresh');
    const me = await getCurrentUser();
    return me.role === 'ROLE_ADMIN' ? me : null;
  } catch {
    return null;
  }
}
