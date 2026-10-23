import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { updateTicketStatus } from '../../api/itsmApi';
import DataTable, { type Column } from '../../components/common/DataTable';
import ErrorMessage from '../../components/common/ErrorMessage';
import { getUsers, type ManagedUser } from '../../api/userApi';
import { formatDateTime } from '../../utils/formatDate';
import { getSection } from '../../utils/itsmSections';
import type { ItsmTicket, TicketPriority, TicketStatus } from '../../types';

type FilterKey = 'ALL' | TicketStatus;

const STATUS_TABS: { key: FilterKey; label: string; tone: 'danger' | 'info' | 'success' | 'neutral' }[] = [
  { key: 'ALL', label: 'All', tone: 'neutral' },
  { key: 'OPEN', label: 'Open', tone: 'danger' },
  { key: 'IN_PROGRESS', label: 'In progress', tone: 'info' },
  { key: 'RESOLVED', label: 'Resolved', tone: 'success' },
  { key: 'CLOSED', label: 'Closed', tone: 'neutral' },
];

const STATUS_FLOW: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

// Target resolution times (hours) per priority — drives the SLA countdown chip.
const SLA_HOURS: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 8,
  MEDIUM: 24,
  LOW: 72,
};

interface SlaInfo {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}

function slaInfo(ticket: ItsmTicket): SlaInfo {
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    return { label: 'Met', tone: 'neutral' };
  }
  const targetHours = SLA_HOURS[ticket.priority] ?? 24;
  const created = new Date(ticket.createdAt).getTime();
  if (Number.isNaN(created)) return { label: '—', tone: 'neutral' };
  const elapsedHours = (Date.now() - created) / 3_600_000;
  const remaining = targetHours - elapsedHours;
  if (remaining <= 0) {
    return { label: `${Math.ceil(-remaining)}h overdue`, tone: 'danger' };
  }
  if (remaining <= targetHours * 0.25) {
    return { label: `${Math.ceil(remaining)}h left`, tone: 'warning' };
  }
  return { label: `${Math.round(remaining)}h left`, tone: 'success' };
}

export default function TicketsPage({ sectionKey: forcedSection }: { sectionKey?: string }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { section: routeSection } = useParams();
  const sectionKey = forcedSection ?? routeSection;
  const section = getSection(sectionKey);
  const { tickets: allTickets, loading, error } = useAppSelector((state) => state.itsm);
  // Only this section's tickets are ever shown on the page.
  const tickets = useMemo(
    () => (section ? allTickets.filter(section.matches) : allTickets),
    [allTickets, section],
  );
  // Sections that already pin a status (Open / In Progress / Closed) don't need status tabs.
  const isIncidents = section?.key === 'incidents';
  const showStatusTabs = !isIncidents && !section;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [selected, setSelected] = useState<ItsmTicket | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: tickets.length };
    for (const t of tickets) {
      c[t.status] = (c[t.status] ?? 0) + 1;
    }
    return c;
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filter !== 'ALL' && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.ticketCode.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.assignedTo && t.assignedTo.toLowerCase().includes(q)) ||
        (t.issueCode && t.issueCode.toLowerCase().includes(q))
      );
    });
  }, [tickets, filter, search]);

  const changeStatus = async (next: TicketStatus) => {
    if (!selected) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      const updated = await updateTicketStatus(selected.id, next);
      setSelected(updated);
      dispatch(fetchTickets());
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update ticket status');
    } finally {
      setStatusBusy(false);
    }
  };

  const pickedTicket = tickets.find((t) => t.id === picked) ?? null;

  const act = async (next: TicketStatus) => {
    if (!pickedTicket) return;
    setNotice(null);
    try {
      await updateTicketStatus(pickedTicket.id, next);
      dispatch(fetchTickets());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to update ticket');
    }
  };

  const openAssign = () => {
    setAssignOpen((v) => !v);
    if (users.length === 0) getUsers().then(setUsers).catch(() => setUsers([]));
  };

  const columns: Column<ItsmTicket>[] = [
    ...(isIncidents
      ? [
          {
            key: 'pick',
            label: '',
            sortable: false,
            render: (t: ItsmTicket) => (
              <input
                type="radio"
                name="picked-incident"
                checked={picked === t.id}
                onClick={(e) => e.stopPropagation()}
                onChange={() => setPicked(t.id)}
                aria-label={`Select ${t.ticketCode}`}
              />
            ),
          },
        ]
      : []),
    {
      key: 'ticketCode',
      label: 'Ticket ID',
      sortable: true,
      render: (t) =>
        section?.key === 'service-requests' ? (
          <Link
            to={`/tickets/service-requests/items/${t.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs font-medium text-primary-600 hover:underline"
          >
            {t.ticketCode}
          </Link>
        ) : (
          <span className="font-mono text-xs font-medium text-slate-900">{t.ticketCode}</span>
        ),
    },
    {
      key: 'title',
      label: 'Subject',
      sortable: true,
      render: (t) => (
        <span className="block max-w-md truncate font-medium text-slate-900" title={t.title}>
          {t.title}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (t) => <span>{t.status.replace('_', ' ')}</span>,
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (t) => <span>{t.priority}</span>,
    },
    {
      key: 'sla',
      label: 'SLA',
      sortable: false,
      render: (t) => {
        const sla = slaInfo(t);
        return <span>{sla.label}</span>;
      },
    },
    {
      key: 'issueCode',
      label: 'Linked issue',
      sortable: false,
      render: (t) =>
        t.issueId && t.issueCode ? (
          <Link
            to={`/issues/${t.issueId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            {t.issueCode}
          </Link>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (t) => <span className="text-slate-500">{formatDateTime(t.createdAt)}</span>,
    },
    {
      key: 'assignedTo',
      label: 'Assigned To',
      sortable: false,
      render: (t) => <span className="text-slate-600">{t.assignedTo || '—'}</span>,
    },
  ];

  if (sectionKey && !section) return <Navigate to="/tickets" replace />;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{section?.title ?? 'ITSM Tickets'}</h1>
          <p className="mt-1 text-sm text-slate-500">{section?.description ?? 'Manage IT Service Management tickets'}</p>
        </div>
        <div className="flex items-center gap-4 self-start sm:self-auto">
          <Link to="/tickets" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
            ← ITSM
          </Link>
        <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 sm:self-auto">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-sky-500" />
          </span>
          SLA clocks run from ticket creation
        </span>
        </div>
      </motion.div>

      {isIncidents && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => navigate('/tickets/incidents/new')}
            className="text-[13px] font-medium text-primary-600 hover:text-primary-800 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
          >
            New Incident
          </button>
          {[
            { label: 'Edit', onClick: () => pickedTicket && setSelected(pickedTicket), enabled: !!pickedTicket },
            { label: 'Pickup', onClick: () => void act('IN_PROGRESS'), enabled: !!pickedTicket && pickedTicket.status === 'OPEN' },
            { label: 'Close', onClick: () => void act('CLOSED'), enabled: !!pickedTicket && pickedTicket.status !== 'CLOSED' },
            { label: 'Merge', onClick: () => setNotice('Merge is not available yet: the backend has no merge endpoint.'), enabled: !!pickedTicket },
            { label: 'Link Request', onClick: () => setNotice('Link Request is not available yet: the backend has no link endpoint.'), enabled: !!pickedTicket },
          ].map((b) => (
            <button
              key={b.label}
              disabled={!b.enabled}
              onClick={b.onClick}
              className="text-[13px] font-medium text-primary-600 hover:text-primary-800 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              {b.label}
            </button>
          ))}
          <div className="relative">
            <button
              disabled={!pickedTicket}
              onClick={openAssign}
              aria-expanded={assignOpen}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-primary-600 hover:text-primary-800 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              Assign
              <svg className={`h-3.5 w-3.5 transition-transform ${assignOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {assignOpen && (
              <ul className="absolute left-0 z-20 mt-1 max-h-60 w-52 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {users.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">No users to show</li>}
                {users.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => {
                        setAssignOpen(false);
                        setNotice(`Assign to ${u.username} is not available yet: the backend cannot change a ticket's assignee.`);
                      }}
                      className="w-full px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                    >
                      {u.username}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {notice && <p className="w-full text-xs text-amber-600">{notice}</p>}
        </div>
      )}

      {/* Status filter tabs with live counts */}
      <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 pb-2 ${showStatusTabs ? '' : 'hidden'}`}>
        {STATUS_TABS.map((tab) => {
          const active = filter === tab.key;
          const count = counts[tab.key] ?? 0;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`text-[13px] hover:underline ${
                active ? 'font-semibold text-primary-700 underline' : 'font-medium text-primary-600'
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.04 }}
      >
        <div className="relative max-w-md">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search tickets, subjects, assignees…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition-all duration-200 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      </motion.div>

      {error ? (
        <ErrorMessage message={error} onRetry={() => dispatch(fetchTickets())} />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.06 }}>
          <DataTable
            columns={columns}
            data={filtered}
            loading={loading}
            onRowClick={(t) => {
              setStatusError(null);
              setSelected(t);
            }}
            keyExtractor={(t) => t.id}
            plain
            emptyMessage="No tickets found"
          />
        </motion.div>
      )}


      {/* ── Ticket detail modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-primary-600">{selected.ticketCode}</span>
                  <span className="text-xs text-slate-600">{selected.status.replace('_', ' ')}</span>
                  <span className="text-xs text-slate-600">{selected.priority} priority</span>
                  {selected.category && <span className="text-xs text-slate-600">{selected.category}</span>}
                </div>
                <h2 className="mt-2 text-lg font-semibold leading-snug text-slate-900">{selected.title}</h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
              {selected.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {selected.description}
                </p>
              ) : (
                <p className="text-sm italic text-slate-400">No description provided.</p>
              )}

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <div>
                  <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">Created</dt>
                  <dd className="mt-0.5 text-xs text-slate-700">{formatDateTime(selected.createdAt)}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">Assigned to</dt>
                  <dd className="mt-0.5 text-xs text-slate-700">{selected.assignedTo || 'Unassigned'}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">SLA</dt>
                  <dd className="mt-0.5">
                    <span className="text-xs text-slate-700">{slaInfo(selected).label}</span>
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">Source issue</dt>
                  <dd className="mt-0.5 text-xs">
                    {selected.issueId && selected.issueCode ? (
                      <Link
                        to={`/issues/${selected.issueId}`}
                        onClick={() => setSelected(null)}
                        className="font-mono font-medium text-primary-600 hover:text-primary-700"
                      >
                        {selected.issueCode}
                      </Link>
                    ) : (
                      <span className="text-slate-400">Not linked</span>
                    )}
                  </dd>
                </div>
                {selected.updatedAt && (
                  <div>
                    <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">Last update</dt>
                    <dd className="mt-0.5 text-xs text-slate-700">{formatDateTime(selected.updatedAt)}</dd>
                  </div>
                )}
              </div>

              {statusError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {statusError}
                </p>
              )}

              {/* Status stepper */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Update status
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {STATUS_FLOW.map((s) => {
                    const active = selected.status === s;
                    return (
                      <button
                        key={s}
                        disabled={statusBusy || active}
                        onClick={() => void changeStatus(s)}
                        className={`text-xs hover:underline disabled:cursor-not-allowed disabled:no-underline ${
                          active ? 'font-semibold text-slate-900' : 'font-medium text-primary-600'
                        }`}
                      >
                        {s.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-3.5">
              <button
                onClick={() => setSelected(null)}
                className="text-sm font-medium text-primary-600 hover:underline"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
