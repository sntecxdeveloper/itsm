import api from './axios';
import type { AppliedStatus, FeatureTab } from '../types/group';
import type { Customization, CustomizationLayout, CustomizationTarget } from '../types/customization';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** The groups (and, for administrators, organizations) the signed-in person may customize the agent for. */
export async function getCustomizationTargets(): Promise<CustomizationTarget[]> {
  const r = await api.get<ApiResponse<CustomizationTarget[]>>('/customization/targets');
  return r.data.data;
}

export async function getCustomizationCatalog(): Promise<FeatureTab[]> {
  const r = await api.get<ApiResponse<FeatureTab[]>>('/customization/catalog');
  return r.data.data;
}

export async function getCustomization(type: string, id: number): Promise<Customization> {
  const r = await api.get<ApiResponse<Customization>>(`/customization/${type}/${id}`);
  return r.data.data;
}

export async function saveCustomization(type: string, id: number, hidden: string[], layout: CustomizationLayout | null, pilotPercent?: number | null): Promise<void> {
  await api.put(`/customization/${type}/${id}`, { hidden, layout, pilotPercent: pilotPercent ?? null });
}

export async function promotePilot(type: string, id: number): Promise<void> {
  await api.post(`/customization/${type}/${id}/rollout/promote`);
}

export async function rollbackPilot(type: string, id: number): Promise<void> {
  await api.post(`/customization/${type}/${id}/rollout/rollback`);
}

export async function resetCustomization(type: string, id: number): Promise<void> {
  await api.delete(`/customization/${type}/${id}`);
}

export interface CustomizationApplied extends AppliedStatus {
  pilotPercent?: number | null;
  pilotTotal?: number;
  /** Agent tab opens per device in the last 7 days, pilot vs the others. */
  pilotOpens?: number | null;
  restOpens?: number | null;
}

export async function getCustomizationApplied(type: string, id: number): Promise<CustomizationApplied> {
  const r = await api.get<ApiResponse<CustomizationApplied>>(`/customization/${type}/${id}/applied`);
  return r.data.data;
}
