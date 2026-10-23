export interface ItsmTicket {
  /** Values of the custom fields administrators defined (field key -> value). */
  customValues?: Record<string, unknown>;
  id: number;
  ticketCode: string;
  title: string;
  description?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  assignedTo?: string;
  /** The group the ticket is assigned to; any technician in it can handle the ticket. */
  assignmentGroupId?: number | null;
  assignmentGroup?: string | null;
  category?: string;
  type?: string;
  issueId?: number;
  issueCode?: string;
  createdAt: string;
  updatedAt?: string;
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
