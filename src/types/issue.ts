export interface Issue {
  id: number;
  issueCode?: string;
  title: string;
  description?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  agentId?: string;
  hostname?: string;
  assignedTo?: string;
  aiAnalysis?: string;
  category?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface IssueFilters {
  severity?: string;
  status?: string;
  search?: string;
}

export interface IssueSummary {
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
