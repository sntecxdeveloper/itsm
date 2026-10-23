export interface User {
  id?: number;
  username: string;
  email: string;
  fullName?: string | null;
  role: string;
  totpEnabled?: boolean;
}

export interface LoginRequest {
  username: string;  // Can be username or email
  password: string;
}

export interface LoginResponse {
  id?: number;
  type: string;
  username: string;
  email: string;
  role: string;
  totpEnabled: boolean;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName?: string;
}

export interface SignupResponse {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  role: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  // False until the initial /auth/me session check (see App.tsx) resolves -
  // ProtectedRoute must wait for this instead of redirecting immediately,
  // since there's no synchronous way to tell if the httpOnly cookie is valid
  // the way a localStorage token used to allow.
  sessionChecked: boolean;
  loading: boolean;
  requiresTwoFactor: boolean;
  pendingUsername: string | null;
}
