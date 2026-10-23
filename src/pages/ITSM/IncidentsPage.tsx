import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { assignTicket, assignTicketToGroup, updateTicketStatus } from '../../api/itsmApi';
import { emailTicketsWithTemplate, groupMemberEmails, savedRequester } from '../../utils/ticketNotifications';
import ErrorMessage from '../../components/common/ErrorMessage';
import AssignTicketsModal from '../../components/itsm/AssignTicketsModal';
import NotificationTemplateModal from '../../components/itsm/NotificationTemplateModal';
import { getSection, isIncidentTicket } from '../../utils/itsmSections';
import { INCIDENT_VIEWS } from '../../utils/incidentViews';
import type { ItsmTicket, TicketPriority, TicketStatus } from '../../types';

const PAGE_SIZE = 20;
const EMPTY = '(empty)';

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  CRITICAL: '1 - Critical',
  HIGH: '2 - High',
  MEDIUM: '3 - Moderate',
  LOW: '4 - Low',
};

const STATE_LABEL: Record<TicketStatus, string> = {
  OPEN: 'New',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

// Backend has no caller / updated-by fields yet: those columns show (empty).
const FIELDS: { key: string; label: string; get: (t: ItsmTicket) => string }[] = [
  { key: 'number', label: 'Number', get: (t) => t.ticketCode },
  { key: 'requester', label: 'Requester name', get: (t) => savedRequester(t.id).name },
  { key: 'description', label: 'Short description', get: (t) => t.title },
  { key: 'priority', label: 'Priority', get: (t) => PRIORITY_LABEL[t.priority] },
  { key: 'state', label: 'State', get: (t) => STATE_LABEL[t.status] },
  { key: 'category', label: 'Category', get: (t) => t.category ?? '' },
  { key: 'assignmentGroup', label: 'Assignment group', get: (t) => t.assignmentGroup ?? '' },
  { key: 'assignedTo', label: 'Assigned to', get: (t) => t.assignedTo ?? '' },
];

type SortKey = 'number' | 'opened' | 'requester' | 'description' | 'priority' | 'state' | 'category' | 'assignedTo' | 'updated';

const SORT_VALUE: Record<SortKey, (t: ItsmTicket) => string | number> = {
  number: (t) => t.ticketCode,
  opened: (t) => new Date(t.createdAt).getTime(),
  requester: (t) => savedRequester(t.id).name.toLowerCase(),
  description: (t) => t.title.toLowerCase(),
  priority: (t) => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(t.priority),
  state: (t) => STATE_LABEL[t.status],
  category: (t) => (t.category ?? '').toLowerCase(),
  assignedTo: (t) => (t.assignedTo ?? '').toLowerCase(),
  updated: (t) => new Date(t.updatedAt ?? t.createdAt).getTime(),
};

const stamp = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const input =
  'border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

export default function IncidentsPage({ view }: { view?: string }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { tickets: all, loading, error } = useAppSelector((s) => s.itsm);
  const username = useAppSelector((s) => s.auth.user?.username) ?? '';
  const section = getSection('incidents')!;
  const current = INCIDENT_VIEWS.find((v) => v.slug === view);
  const incidents = useMemo(
    () =>
      current?.matches
        ? all.filter(isIncidentTicket).filter((t) => current.matches!(t, username))
        : all.filter(section.matches),
    [all, section, current, username],
  );

  const [field, setField] = useState('number');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const get = FIELDS.find((f) => f.key === field)!.get;
    const filtered = q ? incidents.filter((t) => get(t).toLowerCase().includes(q)) : incidents;
    const val = SORT_VALUE[sortKey];
    return [...filtered].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sortDir === 'asc' ? c : -c;
    });
  }, [incidents, field, search, sortKey, sortDir]);

  useEffect(() => {
    setPage(0);
    setChecked(new Set());
  }, [field, search]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const allChecked = visible.length > 0 && visible.every((t) => checked.has(t.id));
  const picked = rows.filter((t) => checked.has(t.id));

  const sortBy = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setStatusFor = async (list: ItsmTicket[], status: TicketStatus) => {
    setBusy(true);
    setNotice(null);
    try {
      await Promise.all(list.map((t) => updateTicketStatus(t.id, status)));
      dispatch(fetchTickets());
      setChecked(new Set());
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Failed to update the selected incidents');
    } finally {
      setBusy(false);
    }
  };

  const sendEmails = async () => {
    if (picked.length === 0) return setNotice('Select one or more incidents first.');
    setBusy(true);
    setNotice(null);
    try {
      // Incidents assigned to a group are also mailed to every enabled technician/user in that group.
      const byGroup = await groupMemberEmails(picked.map((t) => t.assignmentGroupId).filter((g): g is number => typeof g === 'number'));
      const extraByTicket: Record<number, string[]> = {};
      picked.forEach((t) => {
        if (t.assignmentGroupId != null) extraByTicket[t.id] = byGroup[t.assignmentGroupId] ?? [];
      });
      setNotice(await emailTicketsWithTemplate(picked, 'TICKET_CREATED', undefined, [], { extraByTicket }));
    } finally {
      setBusy(false);
    }
  };

  const runAction = (action: string) => {
    if (!action) return;
    if (picked.length === 0) return setNotice('Select one or more incidents first.');
    if (action === 'pickup') {
      const open = picked.filter((t) => t.status === 'OPEN');
      return open.length ? void setStatusFor(open, 'IN_PROGRESS') : setNotice('Only New incidents can be picked up.');
    }
    if (action === 'close') return void setStatusFor(picked.filter((t) => t.status !== 'CLOSED'), 'CLOSED');
    if (action === 'edit') return picked.length === 1 ? navigate(`/tickets/incidents/${picked[0].id}`) : setNotice('Select a single incident to edit.');
    if (action === 'assign') return setAssigning(true);
    if (action === 'notify') return setNotifying(true);
    const names: Record<string, string> = { merge: 'Merge', link: 'Link Request' };
    setNotice(`${names[action]} is not available yet: the backend has no endpoint for it.`);
  };

  const th = (children: string, k?: SortKey) => (
    <th
      key={children}
      onClick={k ? () => sortBy(k) : undefined}
      className={`whitespace-nowrap px-2.5 py-2 text-left text-xs font-semibold text-slate-900 ${k ? 'cursor-pointer select-none' : ''}`}
    >
      {children}
      {k === sortKey && <span className="ml-1 text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );

  return (
    <div className="-mx-1 space-y-0">
      {/* Title bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <Link to="/tickets" className="text-sm text-slate-500 hover:text-slate-800" aria-label="Back to ITSM" title="Back to ITSM">
          ☰
        </Link>
        <h1 className="text-sm font-semibold text-slate-900">{current ? `Incidents · ${current.label}` : 'Incidents'}</h1>
        <div className="flex items-center">
          <select value={field} onChange={(e) => setField(e.target.value)} className={`${input} w-40 rounded-l`} aria-label="Search field">
            {FIELDS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className={`${input} -ml-px w-56 rounded-r`}
            aria-label="Search"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <select
            value=""
            disabled={busy}
            onChange={(e) => runAction(e.target.value)}
            className={`${input} w-56 rounded`}
            aria-label="Actions on selected rows"
          >
            <option value="">Actions on selected rows...</option>
            <option value="edit">Edit</option>
            <option value="pickup">Pickup</option>
            <option value="close">Close</option>
            <option value="merge">Merge</option>
            <option value="link">Link Request</option>
            <option value="assign">Assign</option>
            <option value="notify">Notification template…</option>
          </select>
          <button
            disabled={busy || picked.length === 0}
            onClick={() => void sendEmails()}
            title="Email the selected incidents (requester and assignment group members) using the Ticket created template"
            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
          >
            Send email
          </button>
          <button onClick={() => navigate('/tickets/incidents/new')} className="rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900">
            New
          </button>
        </div>
      </div>

      <div className="px-3 py-2 text-xs">
        <span className="font-medium text-primary-700">{current?.label ?? 'All'}</span>
        <span className="ml-1 text-slate-400">({incidents.length})</span>
        {notice && <span className="ml-4 text-amber-600">{notice}</span>}
      </div>

      {error ? (
        <ErrorMessage message={error} onRetry={() => dispatch(fetchTickets())} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-y border-slate-300">
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => setChecked(e.target.checked ? new Set(visible.map((t) => t.id)) : new Set())}
                    aria-label="Select all"
                  />
                </th>
                {th('Number', 'number')}
                {th('Opened', 'opened')}
                {th('Requester name', 'requester')}
                {th('Short description', 'description')}
                {th('Priority', 'priority')}
                {th('State', 'state')}
                {th('Category', 'category')}
                {th('Assignment group')}
                {th('Assigned to', 'assignedTo')}
                {th('Updated', 'updated')}
                {th('Updated by')}
                {th('Action')}
              </tr>
            </thead>
            <tbody>
              {visible.map((t, i) => (
                <tr key={t.id} className={`border-b border-slate-100 hover:bg-primary-50/40 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                  <td className="px-2.5 py-1.5 align-top">
                    <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select ${t.ticketCode}`} />
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 align-top">
                    <button onClick={() => navigate(`/tickets/incidents/${t.id}`)} className="font-medium text-primary-700 hover:underline">
                      {t.ticketCode}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 align-top text-slate-700">{stamp(t.createdAt)}</td>
                  <td className="px-2.5 py-1.5 align-top text-slate-800">{savedRequester(t.id).name || EMPTY}</td>
                  <td className="max-w-xs px-2.5 py-1.5 align-top text-slate-800">{t.title}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 align-top">
                    {t.priority === 'CRITICAL' ? (
                      <span className="rounded bg-red-400 px-2 py-0.5 font-medium text-white">{PRIORITY_LABEL[t.priority]}</span>
                    ) : (
                      <span className="text-slate-800">{PRIORITY_LABEL[t.priority]}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 align-top text-slate-800">{STATE_LABEL[t.status]}</td>
                  <td className="px-2.5 py-1.5 align-top text-slate-800">{t.category ?? EMPTY}</td>
                  <td className="px-2.5 py-1.5 align-top text-slate-800">{t.assignmentGroup || EMPTY}</td>
                  <td className="px-2.5 py-1.5 align-top text-slate-800">{t.assignedTo || EMPTY}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 align-top text-slate-700">{stamp(t.updatedAt ?? t.createdAt)}</td>
                  <td className="px-2.5 py-1.5 align-top text-slate-500">{EMPTY}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 align-top">
                    {t.status === 'RESOLVED' || t.status === 'CLOSED' ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => void setStatusFor([t], 'RESOLVED')}
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-12 text-center text-slate-400">
                    {loading ? 'Loading…' : 'No records to display'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-3 border-t border-slate-200 py-2.5 text-xs text-slate-600">
        <button disabled={page === 0} onClick={() => setPage(0)} aria-label="First page" className="px-1 disabled:text-slate-300">
          «
        </button>
        <button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page" className="px-1 disabled:text-slate-300">
          ‹
        </button>
        <span>
          {rows.length === 0 ? 0 : page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
        </span>
        <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page" className="px-1 disabled:text-slate-300">
          ›
        </button>
        <button disabled={page >= pages - 1} onClick={() => setPage(pages - 1)} aria-label="Last page" className="px-1 disabled:text-slate-300">
          »
        </button>
      </div>

      {notifying && (
        <NotificationTemplateModal
          tickets={picked}
          onClose={() => setNotifying(false)}
          onDone={(note) => {
            setNotifying(false);
            setNotice(note);
          }}
        />
      )}
      {assigning && (
        <AssignTicketsModal
          count={picked.length}
          onClose={() => setAssigning(false)}
          onAssign={async (target) => {
            try {
              await Promise.all(
                picked.map((t) => (target.kind === 'user' ? assignTicket(t.id, target.username) : assignTicketToGroup(t.id, target.groupId))),
              );
            } catch {
              throw new Error('Assigning failed. The server may not support it yet.');
            }
            setAssigning(false);
            setChecked(new Set());
            setNotice(null);
            dispatch(fetchTickets());
          }}
        />
      )}

    </div>
  );
}
