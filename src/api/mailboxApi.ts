import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type MailFolder = 'INBOX' | 'SENT' | 'DRAFTS';

/** One row of a folder list. Inbox rows have a `uid`; Sent and Drafts rows have an `id`. */
export interface MailListItem {
  uid?: number;
  id?: number;
  from?: string;
  from_address?: string;
  to_address?: string;
  subject?: string | null;
  date?: string | null;
  created_at?: string | null;
  seen?: boolean;
  status?: string;
  error?: string | null;
  ticketCode?: string | null;
  ticket_code?: string | null;
}

export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  date: string | null;
  body: string;
  html: boolean;
  ticketCode: string | null;
  draftId?: number;
  status?: string;
  error?: string | null;
}

export interface ComposePayload {
  draftId?: number | null;
  to: string;
  subject: string;
  body: string;
}

export async function listMailbox(folder: MailFolder, page: number, size = 25): Promise<{ items: MailListItem[]; total: number }> {
  const response = await api.get<ApiResponse<{ items: MailListItem[]; total: number }>>('/admin/mailbox/messages', {
    params: { folder, page, size },
  });
  return response.data.data;
}

export async function readInboxMessage(uid: number): Promise<MailMessage> {
  const response = await api.get<ApiResponse<MailMessage>>(`/admin/mailbox/inbox/${uid}`);
  return response.data.data;
}

/** A sent mail or a draft, by its log id. */
export async function readLoggedMessage(id: number): Promise<MailMessage> {
  const response = await api.get<ApiResponse<Record<string, string | null>>>(`/admin/mailbox/log/${id}`);
  const row = response.data.data;
  return {
    from: row.from_address ?? '',
    to: row.to_address ?? '',
    subject: row.subject ?? '',
    date: row.created_at ?? null,
    body: row.body ?? '',
    html: (row.body ?? '').startsWith('<'),
    ticketCode: row.ticket_code ?? null,
    draftId: row.status === 'DRAFT' ? Number(row.id) : undefined,
    status: row.status ?? undefined,
    error: row.error,
  };
}

export async function sendMailbox(payload: ComposePayload): Promise<string> {
  const response = await api.post<ApiResponse<null>>('/admin/mailbox/send', payload);
  return response.data.message;
}

export async function saveDraft(payload: ComposePayload): Promise<number> {
  const response = await api.post<ApiResponse<{ id: number }>>('/admin/mailbox/drafts', payload);
  return response.data.data.id;
}

export async function deleteDraft(id: number): Promise<void> {
  await api.delete(`/admin/mailbox/drafts/${id}`);
}
