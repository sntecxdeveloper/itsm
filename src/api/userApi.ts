import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  fullName?: string | null;
  role: string;
  enabled: boolean;
  totpEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserInput {
  username?: string;
  email?: string;
  password?: string;
  fullName?: string;
  role?: string;
  enabled?: boolean;
}

export async function getUsers(): Promise<ManagedUser[]> {
  const response = await api.get<ApiResponse<ManagedUser[]>>('/users');
  return response.data.data;
}

export async function createUser(input: UserInput): Promise<ManagedUser> {
  const response = await api.post<ApiResponse<ManagedUser>>('/users', input);
  return response.data.data;
}

export async function updateUser(id: number, input: UserInput): Promise<ManagedUser> {
  const response = await api.put<ApiResponse<ManagedUser>>(`/users/${id}`, input);
  return response.data.data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`);
}

export async function changePassword(id: number, newPassword: string): Promise<void> {
  await api.post(`/users/${id}/change-password`, { newPassword });
}