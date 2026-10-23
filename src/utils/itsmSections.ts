import type { ItsmTicket } from '../types';

export type ItsmSectionKey =
  | 'incidents'
  | 'problems'
  | 'service-requests'
  | 'change-requests'
  | 'open-incidents'
  | 'in-progress-incidents'
  | 'closed-tickets';

export interface ItsmSection {
  key: ItsmSectionKey;
  title: string;
  description: string;
  /** Category stamped on tickets created from this section's "+" quick link. */
  createCategory?: string;
  matches: (t: ItsmTicket) => boolean;
}

type Kind = 'problem' | 'service' | 'change' | 'incident' | 'task';

// The backend has no ticket-type column yet: use `type` when it is sent, else the category text.
function kindOf(t: ItsmTicket): Kind {
  const s = `${t.type ?? ''} ${t.category ?? ''}`.toLowerCase();
  if (s.includes('catalog task')) return 'task';
  if (s.includes('problem')) return 'problem';
  if (s.includes('service request') || s.includes('service-request')) return 'service';
  if (s.includes('change')) return 'change';
  return 'incident';
}

const isClosed = (t: ItsmTicket) => t.status === 'CLOSED' || t.status === 'RESOLVED';
const isIncident = (t: ItsmTicket) => kindOf(t) === 'incident';
/** Every incident, open or finished (the "incidents" section only lists the unfinished ones). */
export const isIncidentTicket = isIncident;

export const ITSM_SECTIONS: ItsmSection[] = [
  {
    key: 'incidents',
    title: 'Incidents',
    description: 'Incidents that are still being worked on',
    createCategory: 'Incident',
    matches: (t) => isIncident(t) && !isClosed(t),
  },
  {
    key: 'problems',
    title: 'Problem Ticket(s)',
    description: 'Root-cause investigations',
    createCategory: 'Problem',
    matches: (t) => kindOf(t) === 'problem',
  },
  {
    key: 'service-requests',
    title: 'Service Request(s)',
    description: 'Requests for a service or access',
    createCategory: 'Service Request',
    matches: (t) => kindOf(t) === 'service',
  },
  {
    key: 'change-requests',
    title: 'Change Request(s)',
    description: 'Planned changes awaiting approval or rollout',
    createCategory: 'Change',
    matches: (t) => kindOf(t) === 'change',
  },
  {
    key: 'open-incidents',
    title: 'Open Incident(s)',
    description: 'Incidents nobody has started yet',
    matches: (t) => isIncident(t) && t.status === 'OPEN',
  },
  {
    key: 'in-progress-incidents',
    title: 'In Progress Incident(s)',
    description: 'Incidents currently being worked on',
    matches: (t) => isIncident(t) && t.status === 'IN_PROGRESS',
  },
  {
    key: 'closed-tickets',
    title: 'Closed Tickets',
    description: 'Resolved and closed tickets of every type',
    matches: isClosed,
  },
];

export const getSection = (key?: string) => ITSM_SECTIONS.find((s) => s.key === key);
