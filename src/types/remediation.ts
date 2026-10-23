export interface Remediation {
  id: number;
  remediationCode?: string;
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

export interface RemediationSummary {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}
