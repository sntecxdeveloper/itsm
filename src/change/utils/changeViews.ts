import type { ItsmTicket } from '../../types';

export interface ChangeView {
  slug: string;
  label: string;
  matches: (t: ItsmTicket, username: string) => boolean;
}

const isOpen = (t: ItsmTicket) => t.status === 'OPEN' || t.status === 'IN_PROGRESS';

export const CHANGE_VIEWS: ChangeView[] = [
  { slug: 'assigned-to-me', label: 'Assigned to me', matches: (t, u) => t.assignedTo === u },
  { slug: 'open', label: 'Open', matches: isOpen },
  { slug: 'open-unassigned', label: 'Open - Unassigned', matches: (t) => isOpen(t) && !t.assignedTo },
  { slug: 'resolved', label: 'Resolved', matches: (t) => t.status === 'RESOLVED' || t.status === 'CLOSED' },
  { slug: 'all', label: 'All', matches: () => true },
];
