import type { PriorityLevel } from '../api/masterApi';

// The impact x urgency -> priority table. The database holds it (itsm_priority_matrix); it is copied here when the person signs
// in, so the form can read it synchronously. Without a copy the built-in rule in derivedPriority is used.
export const PRIORITY_MATRIX_KEY = 'dex.setup.priorityMatrix';

export function loadPriorityMatrix(): PriorityLevel[] {
  try {
    const raw = localStorage.getItem(PRIORITY_MATRIX_KEY);
    const parsed = raw ? (JSON.parse(raw) as PriorityLevel[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
