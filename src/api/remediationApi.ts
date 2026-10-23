import api from './axios';

export interface Remediation {
  id: number;
  remediationCode: string;
  issueId?: number;
  issueCode?: string;
  agentId?: string;
  hostname?: string;
  action: string;
  details?: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  executedBy?: string;
  result?: string;
  durationMs?: number;
  createdAt?: string;
}

export interface RemediationDefinition {
  code: string;
  name: string;
  description: string;
  severity: string;
  steps: string[];
}

export async function getRemediations(): Promise<Remediation[]> {
  const res = await api.get('/remediations');
  return res.data.data;
}

export async function getRemediation(id: number): Promise<Remediation> {
  const res = await api.get(`/remediations/${id}`);
  return res.data.data;
}

export async function getRemediationsByIssue(issueId: number): Promise<Remediation[]> {
  const res = await api.get(`/remediations/issue/${issueId}`);
  return res.data.data;
}

export interface CreateRemediationInput {
  issueId: number;
  action: string;
  agentId?: string;
}

export async function createRemediation(input: CreateRemediationInput): Promise<Remediation> {
  const res = await api.post('/remediations', input);
  return res.data.data;
}

export async function executeRemediation(id: number, agentId?: string): Promise<Remediation> {
  const res = await api.post(`/remediations/${id}/execute`, agentId ? { agentId } : {});
  return res.data.data;
}

/** Push a KB script to a device as a remediation run (created PENDING — execute it like any other run). */
export async function createRemediationFromScript(
  issueId: number,
  scriptId: number,
  agentId?: string
): Promise<Remediation> {
  const res = await api.post('/remediations/from-script', { issueId, scriptId, ...(agentId ? { agentId } : {}) });
  return res.data.data;
}

export async function cancelRemediation(id: number): Promise<Remediation> {
  const res = await api.post(`/remediations/${id}/cancel`);
  return res.data.data;
}
