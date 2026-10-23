import api from './axios';
import type { Issue } from '../types';
import type { PagedResult } from '../types/paged';
import { downloadFile } from '../utils/download';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getIssues(params?: { severity?: string; status?: string }): Promise<Issue[]> {
  const response = await api.get<ApiResponse<Issue[]>>('/issues', { params });
  return response.data.data;
}

export async function getIssuesPaged(params?: {
  page?: number;
  size?: number;
  severity?: string;
  status?: string;
  agentId?: number;
  q?: string;
}): Promise<PagedResult<Issue>> {
  const response = await api.get<ApiResponse<PagedResult<Issue>>>('/issues/paged', { params });
  return response.data.data;
}

export interface IssueStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

export async function getIssueStats(): Promise<IssueStats> {
  const response = await api.get<ApiResponse<IssueStats>>('/issues/stats');
  return response.data.data;
}

export interface SimilarIssue {
  id: number;
  issueCode?: string;
  title: string;
  category?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  hostname?: string;
  resolvedAt?: string;
  fix?: string;
}

export interface IssueTrendPoint {
  date: string;
  count: number;
}

export async function getSimilarIssues(id: number, limit = 5): Promise<SimilarIssue[]> {
  const response = await api.get<ApiResponse<SimilarIssue[]>>(`/issues/${id}/similar`, { params: { limit } });
  return response.data.data;
}

export async function getIssueTrend(days = 14): Promise<IssueTrendPoint[]> {
  const response = await api.get<ApiResponse<IssueTrendPoint[]>>('/issues/trend', { params: { days } });
  return response.data.data;
}

export async function exportIssues(format: 'csv' | 'json'): Promise<void> {
  await downloadFile(`/export/issues?format=${format}`, `issues.${format}`);
}

export async function getIssueById(id: number): Promise<Issue> {
  const response = await api.get<ApiResponse<Issue>>(`/issues/${id}`);
  return response.data.data;
}

export async function updateIssueStatus(id: number, status: string): Promise<Issue> {
  const response = await api.patch<ApiResponse<Issue>>(`/issues/${id}/status`, { status });
  return response.data.data;
}

export async function assignIssue(id: number, assignedTo: string): Promise<Issue> {
  const response = await api.patch<ApiResponse<Issue>>(`/issues/${id}/assign`, { assignedTo });
  return response.data.data;
}

export async function deleteIssue(id: number): Promise<void> {
  await api.delete(`/issues/${id}`);
}

export async function deleteIssues(ids: number[]): Promise<void> {
  await api.delete('/issues', { params: { ids: ids.join(',') } });
}

export async function getDeletedIssues(): Promise<Issue[]> {
  const response = await api.get<ApiResponse<Issue[]>>('/issues/deleted');
  return response.data.data;
}

export async function restoreIssue(id: number): Promise<void> {
  await api.post(`/issues/${id}/restore`);
}

export async function restoreIssues(ids: number[]): Promise<void> {
  await api.post('/issues/restore', null, { params: { ids: ids.join(',') } });
}
