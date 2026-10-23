import api from './axios';

export interface AlertRule {
  id?: number;
  name: string;
  description?: string;
  metric: string;
  operator: string;
  threshold: number;
  cooldownMinutes: number;
  severity: string;
  targetAgentIds?: string;
  /** Device groups the rule is limited to (comma-separated group ids); empty = every device. */
  targetGroupIds?: string;
  enabled: boolean;
  notifyEmail: boolean;
  notifyInApp: boolean;
  notifyEmails?: string;
  lastTriggeredAt?: string;
  triggerCount?: number;
  createdAt?: string;
}

export const METRICS = [
  { value: 'cpuUsage', label: 'CPU Usage (%)' },
  { value: 'memoryUsage', label: 'Memory Usage (%)' },
  { value: 'diskUsage', label: 'Disk Usage (%)' },
  { value: 'networkIn', label: 'Network In (B/s)' },
  { value: 'networkOut', label: 'Network Out (B/s)' },
  { value: 'processCount', label: 'Process Count' },
];

export const OPERATORS = [
  { value: 'GT', label: 'Greater than (>)' },
  { value: 'LT', label: 'Less than (<)' },
  { value: 'GTE', label: 'Greater or equal (>=)' },
  { value: 'LTE', label: 'Less or equal (<=)' },
  { value: 'EQ', label: 'Equal to (=)' },
];

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export async function getAlertRules(): Promise<AlertRule[]> {
  const res = await api.get('/alert-rules');
  return res.data.data;
}

export async function getAlertRule(id: number): Promise<AlertRule> {
  const res = await api.get(`/alert-rules/${id}`);
  return res.data.data;
}

export async function createAlertRule(rule: AlertRule): Promise<AlertRule> {
  const res = await api.post('/alert-rules', rule);
  return res.data.data;
}

export async function updateAlertRule(id: number, rule: AlertRule): Promise<AlertRule> {
  const res = await api.put(`/alert-rules/${id}`, rule);
  return res.data.data;
}

export async function deleteAlertRule(id: number): Promise<void> {
  await api.delete(`/alert-rules/${id}`);
}
