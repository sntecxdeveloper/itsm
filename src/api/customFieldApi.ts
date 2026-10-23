import api from './axios';
import type { ItsmTicket } from '../types/itsm';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type CustomFieldType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTISELECT' | 'CHECKBOX';

export interface CustomFieldDef {
  id: number;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options: string[];
  /** Ticket categories this field applies to; empty = all. */
  categories: string[];
  /** Roles that see and fill it; empty = everyone. */
  roles: string[];
  helpText?: string | null;
  position: number;
  active: boolean;
}

export type CustomFieldRequest = Partial<Omit<CustomFieldDef, 'id' | 'position'>>;

/** The fields a ticket form shows to the signed-in person for this category. */
export async function getFormFields(category?: string): Promise<CustomFieldDef[]> {
  const r = await api.get<ApiResponse<CustomFieldDef[]>>('/custom-fields/form', { params: { entity: 'TICKET', category: category || undefined } });
  return r.data.data;
}

export async function getAllFields(): Promise<CustomFieldDef[]> {
  const r = await api.get<ApiResponse<CustomFieldDef[]>>('/custom-fields', { params: { entity: 'TICKET' } });
  return r.data.data;
}

export async function createField(body: CustomFieldRequest): Promise<CustomFieldDef> {
  const r = await api.post<ApiResponse<CustomFieldDef>>('/custom-fields', body);
  return r.data.data;
}

export async function updateField(id: number, body: CustomFieldRequest): Promise<CustomFieldDef> {
  const r = await api.put<ApiResponse<CustomFieldDef>>(`/custom-fields/${id}`, body);
  return r.data.data;
}

export async function deleteField(id: number): Promise<void> {
  await api.delete(`/custom-fields/${id}`);
}

export async function reorderFields(ids: number[]): Promise<CustomFieldDef[]> {
  const r = await api.put<ApiResponse<CustomFieldDef[]>>('/custom-fields/order', ids);
  return r.data.data;
}

export async function saveTicketFields(ticketId: number, values: Record<string, unknown>): Promise<ItsmTicket> {
  const r = await api.patch<ApiResponse<ItsmTicket>>(`/itsm/tickets/${ticketId}/custom-fields`, { values });
  return r.data.data;
}

/** True when a value counts as filled in (for required fields). */
export function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  return true;
}
