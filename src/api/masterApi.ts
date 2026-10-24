import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface MasterSubcategory {
  name: string;
  /** The assignment group's name; empty when the category's group applies. */
  group?: string | null;
  items: string[];
}

export interface MasterCategory {
  name: string;
  group?: string | null;
  subcategories: MasterSubcategory[];
}

export interface PriorityLevel {
  impact: string;
  urgency: string;
  priority: string;
}

/** The lists the incident forms use, as kept in the database (see MasterDataController). */
export interface Master {
  categories: MasterCategory[];
  /** Leave out when saving to keep the saved table. */
  priorityMatrix?: PriorityLevel[];
}

export async function getMaster(): Promise<Master> {
  const response = await api.get<ApiResponse<Master>>('/itsm/master');
  return response.data.data;
}

/** Replaces the saved lists (administrators only). */
export async function saveMaster(master: Master): Promise<Master> {
  const response = await api.put<ApiResponse<Master>>('/itsm/master', master);
  return response.data.data;
}
