import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface LayoutSuggestion {
  id: string;
  kind: 'CONSOLE_MENU' | 'AGENT_TABS';
  title: string;
  detail: string;
  scopeType: string;
  scopeKey: string;
  hide: string[];
  basedOn: number;
}

export interface AppliedSuggestion {
  id: number;
  kind: string;
  summary: string;
  appliedBy?: string | null;
  appliedAt?: string | null;
  undone: boolean;
}

export interface TemplatePack {
  id: string;
  name: string;
  description: string;
  hiddenInAgent: number;
  fields: number;
  triggers: number;
}

export interface TemplateResult {
  pack: string;
  agentView: boolean;
  console: boolean;
  fieldsAdded: string[];
  fieldsKept: string[];
  triggersAdded: number;
}

/** Counts that the signed-in person opened a section of the console (only the count is kept). */
export async function countUse(item: string): Promise<void> {
  await api.post('/ui/usage', { item });
}

export async function getSuggestions(menu: string[]): Promise<{ suggestions: LayoutSuggestion[]; applied: AppliedSuggestion[] }> {
  const r = await api.get<ApiResponse<{ suggestions: LayoutSuggestion[]; applied: AppliedSuggestion[] }>>('/ui/suggestions', { params: { menu: menu.join(',') } });
  return r.data.data;
}

export async function applySuggestion(id: string, menu: string[]): Promise<AppliedSuggestion> {
  const r = await api.post<ApiResponse<AppliedSuggestion>>(`/ui/suggestions/${encodeURIComponent(id)}/apply`, null, { params: { menu: menu.join(',') } });
  return r.data.data;
}

export async function undoSuggestion(id: number): Promise<void> {
  await api.post(`/ui/suggestions/applied/${id}/undo`);
}

export async function getTemplates(): Promise<TemplatePack[]> {
  const r = await api.get<ApiResponse<TemplatePack[]>>('/templates');
  return r.data.data;
}

export async function applyTemplate(id: string, organizationId: number | null, console: boolean, fields: boolean): Promise<TemplateResult> {
  const r = await api.post<ApiResponse<TemplateResult>>(`/templates/${id}/apply`, { organizationId, console, fields });
  return r.data.data;
}
