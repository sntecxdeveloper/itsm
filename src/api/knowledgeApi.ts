import api from './axios';
import type {
  BulkRunResult,
  BulkTarget,
  KbAudience,
  KbScriptRun,
  KnowledgeArticle,
  KnowledgeScript,
  KnowledgeScreenshot,
  ScriptRisk,
  ScriptStatus,
} from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Fills in governance fields an older backend doesn't send yet, so script
 * screens never crash on a missing status/risk/key (they just show defaults).
 */
export function normalizeScript(s: Partial<KnowledgeScript> & { id: number }): KnowledgeScript {
  return {
    ...s,
    scriptKey: s.scriptKey ?? `SCRIPT-${s.id}`,
    version: s.version ?? 1,
    status: s.status ?? 'DRAFT',
    title: s.title ?? 'Untitled script',
    content: s.content ?? '',
    requiresAdmin: s.requiresAdmin ?? false,
    riskLevel: s.riskLevel ?? 'MEDIUM',
    audience: s.audience ?? 'TECHNICIAN',
    timeoutSeconds: s.timeoutSeconds ?? 120,
    autoRun: s.autoRun ?? false,
    signed: s.signed ?? false,
    createdAt: s.createdAt ?? '',
  } as KnowledgeScript;
}
const normalizeAll = (list: KnowledgeScript[] | null | undefined) => (Array.isArray(list) ? list.map(normalizeScript) : []);

export async function getArticles(params?: { search?: string; category?: string }): Promise<KnowledgeArticle[]> {
  const response = await api.get<ApiResponse<KnowledgeArticle[]>>('/knowledge', { params });
  return response.data.data;
}

export async function getArticleById(id: number): Promise<KnowledgeArticle> {
  const response = await api.get<ApiResponse<KnowledgeArticle>>(`/knowledge/${id}`);
  return response.data.data;
}

/** Who may be given an article. Changing it sends the article back to pending review. */
export async function setArticleAudience(id: number, audience: KbAudience): Promise<KnowledgeArticle> {
  const response = await api.put<ApiResponse<KnowledgeArticle>>(`/knowledge/${id}/audience`, { audience });
  return response.data.data;
}

export type ArticleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface CreateArticleInput {
  title: string;
  content?: string;
  category?: string;
  tags?: string;
  author?: string;
  status?: string;
  issue?: string;
  severity?: ArticleSeverity;
}

export async function createArticle(input: CreateArticleInput): Promise<KnowledgeArticle> {
  const response = await api.post<ApiResponse<KnowledgeArticle>>('/knowledge', input);
  return response.data.data;
}

export async function updateArticle(id: number, input: CreateArticleInput): Promise<KnowledgeArticle> {
  const response = await api.put<ApiResponse<KnowledgeArticle>>(`/knowledge/${id}`, input);
  return response.data.data;
}

export async function deleteArticle(id: number): Promise<void> {
  await api.delete(`/knowledge/${id}`);
}

export async function approveArticle(id: number): Promise<KnowledgeArticle> {
  const response = await api.post<ApiResponse<KnowledgeArticle>>(`/knowledge/${id}/approve`);
  return response.data.data;
}

export async function revokeApproval(id: number): Promise<KnowledgeArticle> {
  const response = await api.post<ApiResponse<KnowledgeArticle>>(`/knowledge/${id}/revoke-approval`);
  return response.data.data;
}

export async function getAllScripts(status?: ScriptStatus): Promise<KnowledgeScript[]> {
  const response = await api.get<ApiResponse<KnowledgeScript[]>>('/knowledge/scripts', { params: status ? { status } : undefined });
  return normalizeAll(response.data.data);
}

/** Only approved versions can run on a device. */
export const getApprovedScripts = () => getAllScripts('APPROVED');

export async function getScriptsByArticle(articleId: number): Promise<KnowledgeScript[]> {
  const response = await api.get<ApiResponse<KnowledgeScript[]>>(`/knowledge/${articleId}/scripts`);
  return normalizeAll(response.data.data);
}

export interface CreateScriptInput {
  articleId?: number | null;
  title: string;
  description?: string;
  language?: string;
  content: string;
  author?: string;
  scriptKey?: string;
  requiresAdmin?: boolean;
  riskLevel?: ScriptRisk;
  audience?: KbAudience;
  timeoutSeconds?: number;
  supportedOs?: string;
  parametersSchema?: string | null;
  issueMatch?: string | null;
  autoRun?: boolean;
  checkScript?: string | null;
  verifyScript?: string | null;
  undoScript?: string | null;
  previewText?: string | null;
}

export async function createScript(input: CreateScriptInput): Promise<KnowledgeScript> {
  const response = await api.post<ApiResponse<KnowledgeScript>>('/knowledge/scripts', input);
  return normalizeScript(response.data.data);
}

/** Editing an APPROVED script returns a NEW draft version (different id). */
export async function updateScript(id: number, input: Partial<CreateScriptInput>): Promise<KnowledgeScript> {
  const response = await api.put<ApiResponse<KnowledgeScript>>(`/knowledge/scripts/${id}`, input);
  return normalizeScript(response.data.data);
}

export async function deleteScript(id: number): Promise<void> {
  await api.delete(`/knowledge/scripts/${id}`);
}

export async function submitScript(id: number): Promise<KnowledgeScript> {
  const response = await api.post<ApiResponse<KnowledgeScript>>(`/knowledge/scripts/${id}/submit`);
  return normalizeScript(response.data.data);
}

export async function approveScript(id: number, note?: string): Promise<KnowledgeScript> {
  const response = await api.post<ApiResponse<KnowledgeScript>>(`/knowledge/scripts/${id}/approve`, { note });
  return normalizeScript(response.data.data);
}

export async function rejectScript(id: number, note: string): Promise<KnowledgeScript> {
  const response = await api.post<ApiResponse<KnowledgeScript>>(`/knowledge/scripts/${id}/reject`, { note });
  return normalizeScript(response.data.data);
}

export async function retireScript(id: number): Promise<KnowledgeScript> {
  const response = await api.post<ApiResponse<KnowledgeScript>>(`/knowledge/scripts/${id}/retire`);
  return normalizeScript(response.data.data);
}

export async function getScriptVersions(scriptKey: string): Promise<KnowledgeScript[]> {
  const response = await api.get<ApiResponse<KnowledgeScript[]>>(`/knowledge/scripts/key/${encodeURIComponent(scriptKey)}/versions`);
  return normalizeAll(response.data.data);
}

export async function getScriptRuns(id: number, limit = 20): Promise<KbScriptRun[]> {
  const response = await api.get<ApiResponse<KbScriptRun[]>>(`/knowledge/scripts/${id}/runs`, { params: { limit } });
  return response.data.data;
}

/** Approved scripts whose issue match fits this issue. */
export async function getScriptSuggestions(issueId: number): Promise<KnowledgeScript[]> {
  const response = await api.get<ApiResponse<KnowledgeScript[]>>('/knowledge/scripts/suggestions', { params: { issueId } });
  return normalizeAll(response.data.data);
}

/** Devices with an open issue this script's issue match fits - the "run it where it's needed" set. */
export async function getBulkTargets(scriptId: number): Promise<BulkTarget[]> {
  const response = await api.get<ApiResponse<BulkTarget[]>>(`/knowledge/scripts/${scriptId}/bulk-targets`);
  return response.data.data;
}

/** Runs the approved version of a script on many devices at once. At most 500 device ids. */
export async function runBulk(
  scriptId: number,
  deviceIds: number[],
  parameters: Record<string, string | number | boolean> = {},
): Promise<BulkRunResult> {
  const response = await api.post<ApiResponse<BulkRunResult>>(`/knowledge/scripts/${scriptId}/bulk-run`, { deviceIds, parameters });
  return response.data.data;
}

/** Admin: let agents run this fix's check step by themselves (low-risk, parameter-free fixes only). Not a new version. */
export async function setScriptDetection(id: number, enabled: boolean, intervalHours?: number): Promise<KnowledgeScript> {
  const response = await api.put<ApiResponse<KnowledgeScript>>(`/knowledge/scripts/${id}/detection`, { enabled, intervalHours });
  return normalizeScript(response.data.data);
}

/** Runs belonging to one fleet-wide request, for progress tracking. */
export async function getBulkBatch(batchId: string): Promise<KbScriptRun[]> {
  const response = await api.get<ApiResponse<KbScriptRun[]>>(`/knowledge/scripts/batches/${batchId}`);
  return response.data.data;
}

/** Pulls the backend's error message out of an axios error. */
export function apiError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}
export async function getScreenshotsByArticle(articleId: number): Promise<KnowledgeScreenshot[]> {
  const response = await api.get<ApiResponse<KnowledgeScreenshot[]>>(`/knowledge/${articleId}/screenshots`);
  return response.data.data;
}

export async function addScreenshot(articleId: number, caption: string, imageData: string): Promise<KnowledgeScreenshot> {
  const response = await api.post<ApiResponse<KnowledgeScreenshot>>(`/knowledge/${articleId}/screenshots`, {
    caption,
    imageData,
  });
  return response.data.data;
}

export async function deleteScreenshot(id: number): Promise<void> {
  await api.delete(`/knowledge/screenshots/${id}`);
}
