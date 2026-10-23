import api from './axios';
import type { TelemetryData } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getTelemetryByDeviceId(agentId: string): Promise<TelemetryData[]> {
  const response = await api.get<ApiResponse<TelemetryData[]>>(`/telemetry/device/${agentId}`);
  return response.data.data;
}

export async function getLatestTelemetry(agentId: string): Promise<TelemetryData> {
  const response = await api.get<ApiResponse<TelemetryData>>(`/telemetry/device/${agentId}/latest`);
  return response.data.data;
}
