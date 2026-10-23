import api from './axios';
import type {
  GroupCandidate,
  FeatureTab,
  GroupDetail,
  GroupDeviceMember,
  AppliedStatus,
  GroupFeatures,
  GroupKind,
  GroupPersonMember,
  GroupPolicy,
  GroupRequest,
  GroupRule,
  GroupSection,
  GroupSummary,
  RuleFieldInfo,
  RulePreview,
} from '../types/group';
import type { BulkRunResult } from '../types/knowledge';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getGroups(kind?: GroupKind): Promise<GroupSummary[]> {
  const r = await api.get<ApiResponse<GroupSummary[]>>('/groups', { params: kind ? { kind } : undefined });
  return r.data.data;
}

export async function getGroup(id: number): Promise<GroupDetail> {
  const r = await api.get<ApiResponse<GroupDetail>>(`/groups/${id}`);
  return r.data.data;
}

export async function getGroupDevices(id: number): Promise<GroupDeviceMember[]> {
  const r = await api.get<ApiResponse<GroupDeviceMember[]>>(`/groups/${id}/devices`);
  return r.data.data;
}

/** The technicians or the users inside a group. */
export async function getGroupPeople(id: number, section: Exclude<GroupSection, 'DEVICE'>): Promise<GroupPersonMember[]> {
  const r = await api.get<ApiResponse<GroupPersonMember[]>>(`/groups/${id}/people`, { params: { section } });
  return r.data.data;
}

export async function getGroupsOfDevice(agentId: string): Promise<GroupSummary[]> {
  const r = await api.get<ApiResponse<GroupSummary[]>>(`/groups/of-device/${encodeURIComponent(agentId)}`);
  return r.data.data;
}

export async function getRuleFields(): Promise<RuleFieldInfo[]> {
  const r = await api.get<ApiResponse<{ fields: RuleFieldInfo[] }>>('/groups/fields');
  return r.data.data.fields;
}

export async function previewRule(rule: GroupRule): Promise<RulePreview> {
  const r = await api.post<ApiResponse<RulePreview>>('/groups/preview', { rule });
  return r.data.data;
}

export async function getCandidates(section: GroupSection, q?: string, groupId?: number): Promise<GroupCandidate[]> {
  const r = await api.get<ApiResponse<GroupCandidate[]>>('/groups/candidates', { params: { section, q, groupId } });
  return r.data.data;
}

/** The organizations a device group can belong to (names only, readable by anyone who sees groups). */
export async function getGroupOrganizations(): Promise<{ id: number; name: string }[]> {
  const r = await api.get<ApiResponse<{ id: number; name: string }[]>>('/groups/organizations');
  return r.data.data;
}

/** A group of devices: typed DEVICE, or an older general group that holds no technicians or users (ITSM groups are not). */
export function isDeviceGroup(g: GroupSummary): boolean {
  return g.type === 'DEVICE' || (!g.type && g.technicianCount === 0 && g.userCount === 0);
}

export async function createGroup(body: GroupRequest): Promise<GroupDetail> {
  const r = await api.post<ApiResponse<GroupDetail>>('/groups', body);
  return r.data.data;
}

export async function updateGroup(id: number, body: GroupRequest): Promise<GroupDetail> {
  const r = await api.put<ApiResponse<GroupDetail>>(`/groups/${id}`, body);
  return r.data.data;
}

export async function updateGroupPolicy(id: number, policy: GroupPolicy): Promise<GroupDetail> {
  const r = await api.put<ApiResponse<GroupDetail>>(`/groups/${id}/policy`, policy);
  return r.data.data;
}

export async function deleteGroup(id: number): Promise<void> {
  await api.delete(`/groups/${id}`);
}

export async function addGroupMembers(id: number, section: GroupSection, members: string[]): Promise<{ added: number; skipped: string[] }> {
  const r = await api.post<ApiResponse<{ added: number; skipped: string[] }>>(`/groups/${id}/members`, { section, members });
  return r.data.data;
}

export async function removeGroupMember(id: number, section: GroupSection, key: string): Promise<void> {
  await api.delete(`/groups/${id}/members/${section}/${encodeURIComponent(key)}`);
}

/** Runs an approved fix on every device in the group (the same fleet run as picking devices by hand). */
export async function runScriptOnGroup(
  id: number,
  scriptId: number,
  parameters: Record<string, string | number | boolean> = {},
): Promise<BulkRunResult> {
  const r = await api.post<ApiResponse<BulkRunResult>>(`/groups/${id}/run-script/${scriptId}`, { parameters });
  return r.data.data;
}

/**
 * The active groups a ticket can be assigned to: technician groups, and general groups (no type yet, which is every group
 * made before types existed) that have technicians. User and device groups are left out.
 */
export async function getAssignmentGroups(): Promise<GroupSummary[]> {
  const all = await getGroups();
  return all.filter(
    (g) => g.status !== 'INACTIVE' && (g.type === 'TECHNICIAN' || (!g.type && g.technicianCount > 0)),
  );
}

export async function getFeatureCatalog(): Promise<FeatureTab[]> {
  const r = await api.get<ApiResponse<FeatureTab[]>>('/groups/feature-catalog');
  return r.data.data;
}

export async function getGroupFeaturesApplied(id: number): Promise<AppliedStatus> {
  const r = await api.get<ApiResponse<AppliedStatus>>(`/groups/${id}/features/applied`);
  return r.data.data;
}

export async function getGroupFeatures(id: number): Promise<GroupFeatures> {
  const r = await api.get<ApiResponse<GroupFeatures>>(`/groups/${id}/features`);
  return r.data.data;
}

/** Choose what the group's devices hide. Everything not listed stays visible. */
export async function setGroupFeatures(id: number, hidden: string[]): Promise<void> {
  await api.put(`/groups/${id}/features`, { hidden });
}

/** Stop managing features for this group. */
export async function clearGroupFeatures(id: number): Promise<void> {
  await api.delete(`/groups/${id}/features`);
}
