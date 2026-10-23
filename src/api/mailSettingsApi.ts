import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface MailSettings {
  provider: string;
  apiKeyConfigured: boolean;
  fromEmail: string;
  fromName: string;
  replyTo?: string | null;
  usingDefaults: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpTlsMode?: 'NONE' | 'STARTTLS' | 'SSL' | null;
  smtpRequiresAuth: boolean;
  smtpUsername?: string | null;
  smtpPasswordConfigured: boolean;
  incomingEnabled: boolean;
  incomingProtocol?: 'IMAP' | 'POP3' | null;
  incomingHost?: string | null;
  incomingPort?: number | null;
  incomingTlsMode?: 'NONE' | 'STARTTLS' | 'SSL' | null;
  incomingUsername?: string | null;
  incomingPasswordConfigured: boolean;
  notificationRecipients: string[];
  notifyTicketCreated: boolean;
  notifyTicketAssigned: boolean;
  notifyTicketUpdated: boolean;
  notifySlaApproaching: boolean;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface SaveMailSettingsPayload {
  fromEmail: string;
  fromName: string;
  replyTo: string;
  provider?: 'RESEND' | 'SMTP';
  smtpHost?: string;
  smtpPort?: number | null;
  smtpTlsMode?: 'NONE' | 'STARTTLS' | 'SSL';
  smtpRequiresAuth?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  incomingEnabled?: boolean;
  incomingProtocol?: 'IMAP' | 'POP3';
  incomingHost?: string;
  incomingPort?: number | null;
  incomingTlsMode?: 'NONE' | 'STARTTLS' | 'SSL';
  incomingUsername?: string;
  incomingPassword?: string;
  notificationRecipients?: string[];
  notifyTicketCreated?: boolean;
  notifyTicketAssigned?: boolean;
  notifyTicketUpdated?: boolean;
  notifySlaApproaching?: boolean;
}

export interface MailSenderAddress {
  id: number;
  displayName: string;
  email: string;
  replyTo?: string | null;
  isDefault: boolean;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface MailSenderAddressPayload {
  displayName: string;
  email: string;
  replyTo?: string;
  isDefault?: boolean;
}

export async function getMailSettings(): Promise<MailSettings> {
  const response = await api.get<ApiResponse<MailSettings>>('/admin/mail-settings');
  return response.data.data;
}

export async function saveMailSettings(payload: SaveMailSettingsPayload): Promise<MailSettings> {
  const response = await api.put<ApiResponse<MailSettings>>('/admin/mail-settings', payload);
  return response.data.data;
}

export async function sendTestMail(to: string, content?: { subject: string; body: string }): Promise<string> {
  const response = await api.post<ApiResponse<null>>('/admin/mail-settings/test', { to, ...content });
  return response.data.message;
}

export async function testIncomingMail(): Promise<string> {
  const response = await api.post<ApiResponse<null>>('/admin/mail-settings/test/incoming');
  return response.data.message;
}

export async function getMailSenderAddresses(): Promise<MailSenderAddress[]> {
  const response = await api.get<ApiResponse<MailSenderAddress[]>>('/admin/mail-settings/addresses');
  return response.data.data;
}

export async function createMailSenderAddress(payload: MailSenderAddressPayload): Promise<MailSenderAddress> {
  const response = await api.post<ApiResponse<MailSenderAddress>>('/admin/mail-settings/addresses', payload);
  return response.data.data;
}

export async function updateMailSenderAddress(
  id: number,
  payload: MailSenderAddressPayload,
): Promise<MailSenderAddress> {
  const response = await api.put<ApiResponse<MailSenderAddress>>(`/admin/mail-settings/addresses/${id}`, payload);
  return response.data.data;
}

export async function setDefaultMailSenderAddress(id: number): Promise<string> {
  const response = await api.post<ApiResponse<null>>(`/admin/mail-settings/addresses/${id}/default`);
  return response.data.message;
}

export async function deleteMailSenderAddress(id: number): Promise<string> {
  const response = await api.delete<ApiResponse<null>>(`/admin/mail-settings/addresses/${id}`);
  return response.data.message;
}
