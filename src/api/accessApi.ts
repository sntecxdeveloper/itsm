import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type PageLevel = 'HIDDEN' | 'VIEW' | 'FULL';

/** What one person may see and use. */
export interface EffectiveAccess {
  roleId: number | null;
  roleName: string;
  baseRole: string;
  pages: Record<string, PageLevel>;
  actions: Record<string, boolean>;
  required: string[];
  explicit: Record<string, boolean>;
}

export interface CatalogItem {
  key: string;
  label: string;
  kind: 'PAGE' | 'ACTION';
  page: string;
  defaultRoles: string[];
}

export interface AccessRoleView {
  id: number;
  name: string;
  description?: string | null;
  baseRole: string;
  builtIn: boolean;
  people: number;
  updatedAt?: string | null;
}

export interface GrantEntry {
  key: string;
  value: string;
  explicit: boolean;
  required: boolean;
}

export interface PersonAccess {
  username: string;
  fullName?: string | null;
  signInRole: string;
  roleId: number | null;
  roleName: string;
  exceptions: number;
}

export interface RoleHistory {
  id: number;
  changedBy?: string | null;
  changedAt?: string | null;
  grants: number;
}

export const getMyAccess = async () => (await api.get<ApiResponse<EffectiveAccess>>('/access/me')).data.data;
export const getAccessCatalog = async () => (await api.get<ApiResponse<CatalogItem[]>>('/access/catalog')).data.data;
export const getAccessRoles = async () => (await api.get<ApiResponse<AccessRoleView[]>>('/access/roles')).data.data;

/** Either (name, baseRole, description, copyFrom) or one object { name, baseRole, description?, copyFrom? }. */
export async function createAccessRole(
  name: string | { name: string; baseRole: string; description?: string; copyFrom?: number | null },
  baseRole?: string,
  description?: string,
  copyFrom?: number | null,
): Promise<AccessRoleView> {
  const body = typeof name === 'string' ? { name, baseRole, description, copyFrom } : name;
  return (await api.post<ApiResponse<AccessRoleView>>('/access/roles', body)).data.data;
}

export async function updateAccessRole(id: number, name: string, description: string): Promise<AccessRoleView> {
  return (await api.put<ApiResponse<AccessRoleView>>(`/access/roles/${id}`, { name, description })).data.data;
}

export const deleteAccessRole = async (id: number) => {
  await api.delete(`/access/roles/${id}`);
};

export const getRoleGrants = async (id: number) => (await api.get<ApiResponse<GrantEntry[]>>(`/access/roles/${id}/grants`)).data.data;

export async function saveRoleGrants(id: number, grants: { key: string; level: string; required: boolean }[]): Promise<GrantEntry[]> {
  return (await api.put<ApiResponse<GrantEntry[]>>(`/access/roles/${id}/grants`, grants)).data.data;
}

export const getRoleHistory = async (id: number) => (await api.get<ApiResponse<RoleHistory[]>>(`/access/roles/${id}/history`)).data.data;

export const restoreRoleVersion = async (id: number, historyId: number) => {
  await api.post(`/access/roles/${id}/history/${historyId}/restore`);
};

export const getPeopleAccess = async () => (await api.get<ApiResponse<PersonAccess[]>>('/access/people')).data.data;

export const assignAccessRole = async (username: string, roleId: number) =>
  (await api.put<ApiResponse<PersonAccess>>(`/access/people/${encodeURIComponent(username)}/role`, { roleId })).data.data;

export const getExceptions = async (username: string) =>
  (await api.get<ApiResponse<Record<string, string>>>(`/access/people/${encodeURIComponent(username)}/exceptions`)).data.data;

export const saveExceptions = async (username: string, exceptions: Record<string, string>) =>
  (await api.put<ApiResponse<Record<string, string>>>(`/access/people/${encodeURIComponent(username)}/exceptions`, exceptions)).data.data;

export const getPersonPreview = async (username: string) =>
  (await api.get<ApiResponse<EffectiveAccess>>(`/access/people/${encodeURIComponent(username)}/preview`)).data.data;

// ── names the Setup → Roles page (ITSM Setup) uses for the same server API ──
export type MyAccess = EffectiveAccess;
export type AccessRole = AccessRoleView;
export type AccessEntry = GrantEntry;
export type AccessPerson = PersonAccess;
export const getAccessPeople = getPeopleAccess;
export const setRoleGrants = saveRoleGrants;
