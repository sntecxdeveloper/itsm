import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AuditLog {
  id: number;
  username: string;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export async function getRecentLogs(): Promise<AuditLog[]> {
  const response = await api.get<ApiResponse<AuditLog[]>>('/audit-logs');
  return response.data.data;
}

export async function getLogsByUser(username: string): Promise<AuditLog[]> {
  const response = await api.get<ApiResponse<AuditLog[]>>(`/audit-logs/user/${username}`);
  return response.data.data;
}

export async function getLogsByEntityType(entityType: string): Promise<AuditLog[]> {
  const response = await api.get<ApiResponse<AuditLog[]>>(`/audit-logs/entity/${entityType}`);
  return response.data.data;
}
