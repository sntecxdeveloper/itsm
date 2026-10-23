import api from './axios';
import type { AppliedStatus, GroupFeatures } from '../types/group';
import type { CreatedOrganization, MoveResult, Organization, OrganizationDevice } from '../types/organization';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getOrganizations(): Promise<Organization[]> {
  const r = await api.get<ApiResponse<Organization[]>>('/organizations');
  return r.data.data;
}

export async function getOrganization(id: number): Promise<Organization> {
  const r = await api.get<ApiResponse<Organization>>(`/organizations/${id}`);
  return r.data.data;
}

/** Makes an organization. The enrollment token in the answer is shown only now. */
export async function createOrganization(name: string): Promise<CreatedOrganization> {
  const r = await api.post<ApiResponse<CreatedOrganization>>('/organizations', { name });
  return r.data.data;
}

export async function updateOrganization(id: number, changes: { name?: string; status?: 'ACTIVE' | 'SUSPENDED' }): Promise<Organization> {
  const r = await api.put<ApiResponse<Organization>>(`/organizations/${id}`, changes);
  return r.data.data;
}

/** Makes a new token; the old one stops working at once. Devices already enrolled keep working. */
export async function rotateOrganizationToken(id: number): Promise<CreatedOrganization> {
  const r = await api.post<ApiResponse<CreatedOrganization>>(`/organizations/${id}/token`);
  return r.data.data;
}

export async function deleteOrganization(id: number): Promise<void> {
  await api.delete(`/organizations/${id}`);
}

/** Devices with the organization each belongs to; optionally one organization's and/or a search on name or id. */
export async function getOrganizationDevices(params: { organizationId?: number; q?: string } = {}): Promise<OrganizationDevice[]> {
  const r = await api.get<ApiResponse<OrganizationDevice[]>>('/organizations/devices', { params });
  return r.data.data;
}

export async function moveDevicesToOrganization(id: number, agentIds: string[]): Promise<MoveResult> {
  const r = await api.post<ApiResponse<MoveResult>>(`/organizations/${id}/devices`, { agentIds });
  return r.data.data;
}

export async function getOrganizationFeaturesApplied(id: number): Promise<AppliedStatus> {
  const r = await api.get<ApiResponse<AppliedStatus>>(`/organizations/${id}/features/applied`);
  return r.data.data;
}

export async function getOrganizationFeatures(id: number): Promise<GroupFeatures> {
  const r = await api.get<ApiResponse<GroupFeatures>>(`/organizations/${id}/features`);
  return r.data.data;
}

export async function setOrganizationFeatures(id: number, hidden: string[]): Promise<void> {
  await api.put(`/organizations/${id}/features`, { hidden });
}

export async function clearOrganizationFeatures(id: number): Promise<void> {
  await api.delete(`/organizations/${id}/features`);
}
