import type { ItsmTicket } from '../types';

export interface IncidentView {
  slug: string;
  label: string;
  /** Null for the pages that aren't a plain incident list (Create New, Overview). */
  matches: ((t: ItsmTicket, username: string) => boolean) | null;
}

const isOpen = (t: ItsmTicket) => t.status === 'OPEN' || t.status === 'IN_PROGRESS';

// The backend has no location data yet: the "Critical Incidents Map" lists the open critical-priority incidents.
export const INCIDENT_VIEWS: IncidentView[] = [
  { slug: 'create-new', label: 'Create New', matches: null },
  { slug: 'assigned-to-me', label: 'Assigned to me', matches: (t, u) => t.assignedTo === u && isOpen(t) },
  { slug: 'open', label: 'Assigned to group', matches: isOpen },
  { slug: 'closed', label: 'Closed', matches: (t) => t.status === 'CLOSED' },
  { slug: 'all', label: 'All', matches: () => true },
  { slug: 'overview', label: 'Overview', matches: null },
  { slug: 'critical-incidents-map', label: 'Critical Incidents Map', matches: (t) => t.priority === 'CRITICAL' && isOpen(t) },
];
