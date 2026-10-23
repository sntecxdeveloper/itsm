import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { getSection } from '../../utils/itsmSections';
import NewProblemPage from './NewProblemPage';
import type { ItsmTicket, TicketPriority, TicketStatus } from '../../types';

export interface ProblemView {
  slug: string;
  label: string;
  /** Null for the pages that aren't a ticket list (Create New, Overview). */
  matches: ((t: ItsmTicket, username: string) => boolean) | null;
}

const isOpen = (t: ItsmTicket) => t.status === 'OPEN' || t.status === 'IN_PROGRESS';

export const PROBLEM_VIEWS: ProblemView[] = [
  { slug: 'create-new', label: 'Create New', matches: null },
  { slug: 'assigned-to-me', label: 'Assigned to me', matches: (t, u) => t.assignedTo === u },
  { slug: 'open', label: 'Open', matches: isOpen },
  { slug: 'open-unassigned', label: 'Open - Unassigned', matches: (t) => isOpen(t) && !t.assignedTo },
  { slug: 'resolved', label: 'Resolved', matches: (t) => t.status === 'RESOLVED' || t.status === 'CLOSED' },
  // The backend has no "risk accepted" state yet, so nothing can match.
  { slug: 'risk-accepted', label: 'Risk Accepted', matches: () => false },
  { slug: 'all', label: 'All', matches: () => true },
  { slug: 'overview', label: 'Overview', matches: null },
];

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  CRITICAL: '1 - Critical',
  HIGH: '2 - High',
  MEDIUM: '3 - Moderate',
  LOW: '4 - Low',
};
const STATE_LABEL: Record<TicketStatus, string> = { OPEN: 'New', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const stamp = (iso?: string) => (iso ? iso.replace('T', ' ').slice(0, 19) : '');

export default function ProblemsPage() {
  const { view } = useParams();
  const dispatch = useAppDispatch();
  const { tickets } = useAppSelector((s) => s.itsm);
  const username = useAppSelector((s) => s.auth.user?.username) ?? '';
  const current = PROBLEM_VIEWS.find((v) => v.slug === view);
  const problems = tickets.filter(getSection('problems')!.matches);

  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  if (!current) return <Navigate to="/tickets/problems/open" replace />;
  if (current.slug === 'create-new') return <NewProblemPage />;

  const rows = current.matches ? problems.filter((t) => current.matches!(t, username)) : [];
  const th = 'whitespace-nowrap px-2.5 py-2 text-left text-xs font-semibold text-slate-900';
  const td = 'px-2.5 py-1.5 align-top text-[11px] text-slate-800';

  return (
    <div className="space-y-4">
      <h1 className="text-sm font-semibold text-slate-900">Problem · {current.label}</h1>

      {current.slug === 'overview' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEM_VIEWS.filter((v) => v.matches).map((v) => (
            <Link key={v.slug} to={`/tickets/problems/${v.slug}`} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-primary-400">
              <p className="text-xs text-slate-500">{v.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{problems.filter((t) => v.matches!(t, username)).length}</p>
            </Link>
          ))}
        </div>
      )}

      {current.matches && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-300">
                {['Number', 'Opened', 'Subject', 'Priority', 'State', 'Assigned to', 'Updated'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={t.id} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50' : ''}`}>
                  <td className={`${td} whitespace-nowrap`}>
                    <Link to={`/tickets/incidents/${t.id}`} className="font-medium text-primary-700 hover:underline">
                      {t.ticketCode}
                    </Link>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{stamp(t.createdAt)}</td>
                  <td className={`${td} max-w-xs`}>{t.title}</td>
                  <td className={`${td} whitespace-nowrap`}>{PRIORITY_LABEL[t.priority]}</td>
                  <td className={`${td} whitespace-nowrap`}>{STATE_LABEL[t.status]}</td>
                  <td className={td}>{t.assignedTo || '(empty)'}</td>
                  <td className={`${td} whitespace-nowrap`}>{stamp(t.updatedAt ?? t.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-xs text-slate-400">
                    {current.slug === 'risk-accepted' ? 'Risk-accepted problems are not tracked yet.' : 'No problems here.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
