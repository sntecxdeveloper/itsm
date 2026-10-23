import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { getSection } from '../../utils/itsmSections';
import { CHANGE_VIEWS } from '../utils/changeViews';
import type { TicketPriority, TicketStatus } from '../../types';

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  CRITICAL: '1 - Critical',
  HIGH: '2 - High',
  MEDIUM: '3 - Moderate',
  LOW: '4 - Low',
};
const STATE_LABEL: Record<TicketStatus, string> = { OPEN: 'New', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const stamp = (iso?: string) => (iso ? iso.replace('T', ' ').slice(0, 19) : '');

export default function ChangesPage() {
  const { view } = useParams();
  const dispatch = useAppDispatch();
  const { tickets } = useAppSelector((s) => s.itsm);
  const username = useAppSelector((s) => s.auth.user?.username) ?? '';
  const current = CHANGE_VIEWS.find((v) => v.slug === view);
  const changes = tickets.filter(getSection('change-requests')!.matches);

  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  if (!current) return <Navigate to="/tickets/changes/open" replace />;

  const rows = changes.filter((t) => current.matches(t, username));
  const th = 'whitespace-nowrap px-2.5 py-2 text-left text-xs font-semibold text-slate-900';
  const td = 'px-2.5 py-1.5 align-top text-[11px] text-slate-800';

  return (
    <div className="space-y-4">
      <h1 className="text-sm font-semibold text-slate-900">Change · {current.label}</h1>
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
                  No changes here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
