import api from './axios';
import type { Device } from '../types';
import type { SystemEvent } from '../types/device';
import type { PagedResult } from '../types/paged';
import { downloadFile } from '../utils/download';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AgentHealth {
  agentId: string;
  healthy: boolean;
  heartbeatRecent: boolean;
  telemetryRecent: boolean;
  lastHeartbeat: string | null;
  lastTelemetryAt: string | null;
  cpuUsage: number | null;
  memoryUsage: number | null;
  diskUsage: number | null;
  message: string;
}

export interface HealthSummary {
  totalAgents: number;
  onlineAgents: number;
  offlineAgents: number;
  openIssues: number;
  overallHealthy: boolean;
}

export async function getDevices(): Promise<Device[]> {
  const response = await api.get<ApiResponse<Device[]>>('/devices');
  return response.data.data;
}

export async function getDevicesPaged(params?: {
  page?: number;
  size?: number;
  status?: string;
  os?: string;
  q?: string;
}): Promise<PagedResult<Device>> {
  const response = await api.get<ApiResponse<PagedResult<Device>>>('/devices/paged', { params });
  return response.data.data;
}

export async function exportDevices(format: 'csv' | 'json'): Promise<void> {
  await downloadFile(`/export/devices?format=${format}`, `devices.${format}`);
}

export async function getDeviceById(id: number): Promise<Device> {
  const response = await api.get<ApiResponse<Device>>(`/devices/${id}`);
  return response.data.data;
}

export async function getDeviceByAgentId(agentId: string): Promise<Device> {
  const response = await api.get<ApiResponse<Device>>(`/devices/agent/${agentId}`);
  return response.data.data;
}

export async function deleteDevice(id: number): Promise<void> {
  await api.delete(`/devices/${id}`);
}

export async function deleteDevices(ids: number[]): Promise<void> {
  await api.delete('/devices', { params: { ids: ids.join(',') } });
}

export async function getDeletedDevices(): Promise<Device[]> {
  const response = await api.get<ApiResponse<Device[]>>('/devices/deleted');
  return response.data.data;
}

export async function restoreDevice(id: number): Promise<void> {
  await api.post(`/devices/${id}/restore`);
}

export async function restoreDevices(ids: number[]): Promise<void> {
  await api.post('/devices/restore', null, { params: { ids: ids.join(',') } });
}

export interface DeviceService {
  name: string;
  displayName: string;
  status: string;
  startType: string;
  reportedAt?: string;
}

// Latest Windows services the agent reported (it reports every ~2 min).
export async function getDeviceServices(id: number): Promise<DeviceService[]> {
  const response = await api.get<ApiResponse<DeviceService[]>>(`/devices/${id}/services`);
  return response.data.data;
}

// Most recent Windows event-log entries the agent reported (up to 100).
export async function getDeviceEvents(id: number): Promise<SystemEvent[]> {
  const response = await api.get<ApiResponse<SystemEvent[]>>(`/devices/${id}/events`);
  return response.data.data;
}

export async function verifyAgentHealth(agentId: string): Promise<AgentHealth> {
  const response = await api.get<ApiResponse<AgentHealth>>(`/devices/agent/${agentId}/health`);
  return response.data.data;
}

export async function getHealthSummary(): Promise<HealthSummary> {
  const response = await api.get<ApiResponse<HealthSummary>>('/devices/health-summary');
  return response.data.data;
}

/** Sets where a device is. An empty value clears it. */
export async function updateDevicePlacement(id: number, place: { location?: string; region?: string }): Promise<Device> {
  const response = await api.put<ApiResponse<Device>>(`/devices/${id}/placement`, place);
  return response.data.data;
}

/**
 * Every device with the cells the list shows (groups, CPU, memory, disk), fetched in batches of 100 so the whole fleet can be
 * filtered and sorted in the browser. Stops at 2,000 devices.
 */
export async function getAllDevicesDetailed(): Promise<Device[]> {
  const all: Device[] = [];
  for (let page = 0; page < 20; page++) {
    const result = await getDevicesPaged({ page, size: 100 });
    all.push(...result.content);
    if (page + 1 >= result.totalPages) break;
  }
  return all;
}
