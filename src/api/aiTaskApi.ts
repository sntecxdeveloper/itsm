import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Where a task stands. See the backend's TaskState. */
export type TaskState =
  | 'ASK_KB'
  | 'PICK_RELATED'
  | 'OFFERED'
  | 'NO_FIX'
  | 'NEEDS_INPUT'
  | 'AWAITING_APPROVAL'
  | 'GRANTING'
  | 'RUNNING'
  | 'UNDOING'
  | 'AWAITING_CONFIRM'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'DECLINED';

export interface AiTaskFix {
  title: string;
  scriptKey: string;
  version?: number | null;
  risk: string;
  requiresAdmin: boolean;
  description?: string | null;
  article?: string | null;
  canUndo: boolean;
  selfChecks: boolean;
}

export interface AiTask {
  id: number;
  code: string;
  state: TaskState;
  attempt: number;
  message: string;
  fix?: AiTaskFix | null;
  ticket?: { id: number | null; code: string } | null;
  outcome?: string | null;
  reminder: boolean;
  commandId?: string | null;
  rating?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AiTaskTimelineEntry {
  at: string;
  kind: string;
  actor?: string | null;
  text?: string | null;
}

export interface AiTaskGap {
  request: string;
  count: number;
  lastAsked: string;
  examples: string[];
}

export interface AiTaskQuality {
  scriptKey: string;
  title: string;
  tasks: number;
  resolved: number;
  escalated: number;
  declined: number;
  firstTimeFixes: number;
  averageRating: number | null;
}

export interface AiTaskSummary {
  days: number;
  tasks: number;
  resolved: number;
  escalated: number;
  declined: number;
  open: number;
  noMatch: number;
  resolvedShare: number | null;
  averageRating: number | null;
}

export interface AiTaskSettings {
  enabled: boolean;
  remindMinutes: number;
  escalateHours: number;
  autoTicketOnNoMatch: boolean;
  /** Ask "shall I check the knowledge base?" when someone reports a problem, before looking. */
  askBeforeKbCheck: boolean;
  /** When several devices report the same problem at once, raise one alert and one ticket for all of them. */
  fleetAlertsEnabled: boolean;
  /** How many devices with the same open problem make a fleet. */
  fleetMinDevices: number;
  maxAttempts: number;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

/** One line of the task list: what was asked, by whom, from which device, and where it ended up. */
export interface AiTaskRow {
  id: number;
  code: string;
  state: TaskState;
  request: string;
  requester?: string | null;
  agentId?: string | null;
  hostname?: string | null;
  audience: string;
  fixTitle?: string | null;
  fixKey?: string | null;
  attempt: number;
  outcome?: string | null;
  /** NO_MATCH, FAILED, NOT_FIXED, NO_ANSWER or REQUESTED - why it went to a technician. */
  reason?: string | null;
  ticketCode?: string | null;
  rating?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Letting people ask for shared mailboxes: the Exchange Online app, who may be requested, and whether a technician approves. */
export interface ExchangeSettings {
  enabled: boolean;
  tenantDomain?: string | null;
  appId?: string | null;
  certPath?: string | null;
  pwshPath: string;
  allowedMailboxes?: string | null;
  autoApprove: boolean;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export async function getExchangeSettings(): Promise<ExchangeSettings> {
  const response = await api.get<ApiResponse<ExchangeSettings>>('/ai/tasks/exchange/settings');
  return response.data.data;
}

export async function updateExchangeSettings(settings: Partial<ExchangeSettings>): Promise<ExchangeSettings> {
  const response = await api.put<ApiResponse<ExchangeSettings>>('/ai/tasks/exchange/settings', settings);
  return response.data.data;
}

/** A technician's yes or no on a request that waits for approval (access to a shared mailbox). */
export async function decideAiTaskApproval(id: number, approve: boolean): Promise<void> {
  await api.post(`/ai/tasks/${id}/approval`, { approve });
}

/** One device that needs a fix, as its own check said. */
export interface FleetDevice {
  deviceId: number | null;
  agentId: string;
  hostname: string;
  message?: string | null;
  lastSeen?: string | null;
}

/** The same problem on several devices at once: one alert and one ticket for all of them. */
export interface FleetAlert {
  id: number;
  scriptKey: string;
  scriptId?: number | null;
  title: string;
  status: 'OPEN' | 'RESOLVED';
  deviceCount: number;
  peakDeviceCount: number;
  ticketCode?: string | null;
  firstRaised?: string;
  lastUpdated?: string;
  resolvedAt?: string | null;
  devices: FleetDevice[];
}

/** A device whose own check says a fix is needed. */
export interface OpenDetection {
  id: number;
  agentId: string;
  hostname: string;
  scriptKey: string;
  scriptTitle: string;
  message?: string | null;
  firstSeen?: string;
  lastSeen?: string;
}

export async function getFleetAlerts(): Promise<FleetAlert[]> {
  const response = await api.get<ApiResponse<FleetAlert[]>>('/knowledge/fleet-alerts');
  return response.data.data;
}

export async function getOpenDetections(): Promise<OpenDetection[]> {
  const response = await api.get<ApiResponse<OpenDetection[]>>('/knowledge/detections');
  return response.data.data;
}

/** @param state one state, or OPEN for everything still in progress */
export async function getAiTasks(state?: string, limit = 100): Promise<AiTaskRow[]> {
  const response = await api.get<ApiResponse<AiTaskRow[]>>('/ai/tasks', { params: { state: state || undefined, limit } });
  return response.data.data;
}

export async function getAiTaskTimeline(id: number): Promise<AiTaskTimelineEntry[]> {
  const response = await api.get<ApiResponse<AiTaskTimelineEntry[]>>(`/ai/tasks/${id}/timeline`);
  return response.data.data;
}

export interface AiTaskAttachment {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/** The screenshots the person attached to a task; the picture itself is at {@link aiTaskAttachmentUrl}. */
export async function getAiTaskAttachments(id: number): Promise<AiTaskAttachment[]> {
  const response = await api.get<ApiResponse<AiTaskAttachment[]>>(`/ai/tasks/${id}/attachments`);
  return response.data.data;
}

export function aiTaskAttachmentUrl(attachmentId: number): string {
  return `${api.defaults.baseURL ?? '/api/v1'}/ai/tasks/attachments/${attachmentId}`;
}

export async function getAiTaskSummary(days: number): Promise<AiTaskSummary> {
  const response = await api.get<ApiResponse<AiTaskSummary>>('/ai/tasks/reports/summary', { params: { days } });
  return response.data.data;
}

export async function getAiTaskGaps(days: number): Promise<AiTaskGap[]> {
  const response = await api.get<ApiResponse<AiTaskGap[]>>('/ai/tasks/reports/gaps', { params: { days } });
  return response.data.data;
}

export async function getAiTaskQuality(days: number): Promise<AiTaskQuality[]> {
  const response = await api.get<ApiResponse<AiTaskQuality[]>>('/ai/tasks/reports/quality', { params: { days } });
  return response.data.data;
}

export async function getAiTaskSettings(): Promise<AiTaskSettings> {
  const response = await api.get<ApiResponse<AiTaskSettings>>('/ai/tasks/settings');
  return response.data.data;
}

export async function updateAiTaskSettings(settings: Partial<AiTaskSettings>): Promise<AiTaskSettings> {
  const response = await api.put<ApiResponse<AiTaskSettings>>('/ai/tasks/settings', settings);
  return response.data.data;
}
