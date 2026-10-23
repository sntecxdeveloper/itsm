import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type SlaPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Response and resolution targets, in minutes, for one ticket priority. */
export interface SlaPolicy {
  priority: SlaPriority;
  responseMinutes: number;
  resolutionMinutes: number;
  /** Off: new incidents of this priority start no SLA clock. */
  enabled: boolean;
}

export async function getSlaPolicies(): Promise<SlaPolicy[]> {
  const response = await api.get<ApiResponse<SlaPolicy[]>>('/itsm/sla-policies');
  // A server that predates the on/off switch sends no flag: those policies are on.
  return response.data.data.map((p) => ({ ...p, enabled: p.enabled !== false }));
}

export async function updateSlaPolicy(priority: SlaPriority, responseMinutes: number, resolutionMinutes: number): Promise<SlaPolicy> {
  const response = await api.put<ApiResponse<SlaPolicy>>(`/itsm/sla-policies/${priority}`, { responseMinutes, resolutionMinutes });
  return response.data.data;
}

export async function setSlaPolicyEnabled(priority: SlaPriority, enabled: boolean): Promise<SlaPolicy> {
  const response = await api.patch<ApiResponse<SlaPolicy>>(`/itsm/sla-policies/${priority}/enabled`, { enabled });
  return response.data.data;
}
