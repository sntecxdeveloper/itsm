import type { ItsmTicket } from '../types';

/** Next free number for a prefix, e.g. INC00007 after INC00006 (older ITSM-… codes are ignored). */
export function nextTicketNumber(tickets: ItsmTicket[], prefix: string, width = 5): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const highest = tickets.reduce((max, t) => {
    const m = pattern.exec(t.ticketCode);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(width, '0')}`;
}
