import api from './axios';
import type { ItsmTicket } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * The backend runs in UTC and sends times as e.g. "2026-10-10T10:30:48" with no zone, which the browser would read as
 * local time (5h30 early in India). Mark them as UTC so every screen shows and calculates with the right moment.
 */
const NAIVE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const asUtc = (t?: string) => (t && NAIVE_TIME.test(t) ? `${t}Z` : t);
const fixTimes = (t: ItsmTicket): ItsmTicket => ({ ...t, createdAt: asUtc(t.createdAt) as string, updatedAt: asUtc(t.updatedAt) });

export async function getTickets(): Promise<ItsmTicket[]> {
  const response = await api.get<ApiResponse<ItsmTicket[]>>('/itsm/tickets');
  return response.data.data.map(fixTimes);
}

export async function getTicketsByIssue(issueId: number): Promise<ItsmTicket[]> {
  const response = await api.get<ApiResponse<ItsmTicket[]>>('/itsm/tickets', { params: { issueId } });
  return response.data.data.map(fixTimes);
}

export async function getTicketById(id: number): Promise<ItsmTicket> {
  const response = await api.get<ApiResponse<ItsmTicket>>(`/itsm/tickets/${id}`);
  return fixTimes(response.data.data);
}

export async function updateTicketStatus(id: number, status: string): Promise<ItsmTicket> {
  const response = await api.patch<ApiResponse<ItsmTicket>>(`/itsm/tickets/${id}/status`, { status });
  return fixTimes(response.data.data);
}

export async function createTicket(payload: {
  issueId?: number;
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
  assignmentGroupId?: number;
  /** The requester's email address, kept on the ticket so it can be mailed from any browser. */
  requester?: string;
  /** Optional custom number; the backend generates one when omitted. */
  ticketCode?: string;
  /** Values of the custom fields (checked by the server). */
  customValues?: Record<string, unknown>;
}): Promise<ItsmTicket> {
  const response = await api.post<ApiResponse<ItsmTicket>>('/itsm/tickets', payload);
  return fixTimes(response.data.data);
}

/** Fills the email template with this ticket's own data (server side) and sends it to `to`, or to the requester. */
export async function emailTicket(
  id: number,
  payload: { to: string[]; subject: string; body: string; vars?: Record<string, string> },
): Promise<string> {
  const response = await api.post<ApiResponse<null>>(`/itsm/tickets/${id}/email`, payload);
  return response.data.message;
}

/** Expects PATCH /itsm/tickets/{id}/assign { assignedTo }, mirroring PATCH /issues/{id}/assign. */
export async function assignTicket(id: number, assignedTo: string): Promise<ItsmTicket> {
  const response = await api.patch<ApiResponse<ItsmTicket>>(`/itsm/tickets/${id}/assign`, { assignedTo });
  return fixTimes(response.data.data);
}

/** PATCH /itsm/tickets/{id}/assign-group { groupId }: any technician in the group can then handle the ticket. A null groupId clears it. */
export async function assignTicketToGroup(id: number, groupId: number | null): Promise<ItsmTicket> {
  const response = await api.patch<ApiResponse<ItsmTicket>>(`/itsm/tickets/${id}/assign-group`, { groupId });
  return fixTimes(response.data.data);
}
