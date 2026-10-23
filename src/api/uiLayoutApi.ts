import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type LayoutScope = 'GLOBAL' | 'ROLE' | 'GROUP' | 'USER';
export type CustomizeLevel = 'NONE' | 'PERSONAL' | 'TEAM' | 'GLOBAL';

/** A layout as the signed-in person gets it. `lockedByWiderLevel`: an administrator locked it, so it cannot be personalized. */
export interface ResolvedLayout {
  area: string;
  config: Record<string, unknown>;
  source: LayoutScope;
  sourceKey: string;
  locked: boolean;
  lockedByWiderLevel: boolean;
  version: number;
  /** Every level that sets this area, widest first (stops at a locked one). */
  layers?: { source: LayoutScope; sourceKey: string; locked: boolean; config: Record<string, unknown> }[];
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface StoredLayout {
  scope: LayoutScope;
  scopeKey: string;
  area: string;
  config: Record<string, unknown>;
  locked: boolean;
  version: number;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface LayoutVersion {
  version: number;
  locked: boolean;
  changedBy?: string | null;
  changedAt?: string | null;
  config: Record<string, unknown>;
}

export interface MyLayouts {
  level: CustomizeLevel;
  groups: { id: number; name: string }[];
  layouts: Record<string, ResolvedLayout>;
}

export interface CustomizeGrant {
  subjectType: 'ROLE' | 'USER';
  subjectKey: string;
  level: CustomizeLevel;
  grantedBy?: string | null;
  grantedAt?: string | null;
}

const keyOf = (key: string) => encodeURIComponent(key || '-');

export async function getMyLayouts(): Promise<MyLayouts> {
  const r = await api.get<ApiResponse<MyLayouts>>('/ui/layouts/me');
  return r.data.data;
}

export async function saveMyLayout(area: string, config: Record<string, unknown>): Promise<void> {
  await api.put(`/ui/layouts/me/${area}`, { config, locked: false });
}

export async function resetMyLayout(area: string): Promise<void> {
  await api.delete(`/ui/layouts/me/${area}`);
}

export async function getLayoutsAt(scope: LayoutScope, key: string): Promise<StoredLayout[]> {
  const r = await api.get<ApiResponse<StoredLayout[]>>(`/ui/layouts/${scope.toLowerCase()}/${keyOf(key)}`);
  return r.data.data;
}

export async function saveLayoutAt(scope: LayoutScope, key: string, area: string, config: Record<string, unknown>, locked: boolean): Promise<void> {
  await api.put(`/ui/layouts/${scope.toLowerCase()}/${keyOf(key)}/${area}`, { config, locked });
}

export async function resetLayoutAt(scope: LayoutScope, key: string, area: string): Promise<void> {
  await api.delete(`/ui/layouts/${scope.toLowerCase()}/${keyOf(key)}/${area}`);
}

export async function getLayoutHistory(scope: LayoutScope, key: string, area: string): Promise<LayoutVersion[]> {
  const r = await api.get<ApiResponse<LayoutVersion[]>>(`/ui/layouts/${scope.toLowerCase()}/${keyOf(key)}/${area}/history`);
  return r.data.data;
}

export async function restoreLayout(scope: LayoutScope, key: string, area: string, version: number): Promise<void> {
  await api.post(`/ui/layouts/${scope.toLowerCase()}/${keyOf(key)}/${area}/restore/${version}`);
}

export async function previewRole(role: string): Promise<Record<string, ResolvedLayout>> {
  const r = await api.get<ApiResponse<Record<string, ResolvedLayout>>>('/ui/layouts/preview', { params: { role } });
  return r.data.data;
}

export async function getGrants(): Promise<CustomizeGrant[]> {
  const r = await api.get<ApiResponse<CustomizeGrant[]>>('/ui/grants');
  return r.data.data;
}

export async function setGrant(subjectType: 'ROLE' | 'USER', subjectKey: string, level: CustomizeLevel): Promise<void> {
  await api.put('/ui/grants', { subjectType, subjectKey, level });
}

export async function removeGrant(subjectType: 'ROLE' | 'USER', subjectKey: string): Promise<void> {
  await api.delete(`/ui/grants/${subjectType}/${encodeURIComponent(subjectKey)}`);
}
