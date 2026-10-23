import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import NewTicketModal from '../../components/itsm/NewTicketModal';
import ErrorMessage from '../../components/common/ErrorMessage';
import { type ItsmSectionKey } from '../../utils/itsmSections';


interface QuickLink {
  label: string;
  kind: 'create' | 'open';
  section: ItsmSectionKey;
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'Report an Incident', kind: 'create', section: 'incidents' },
  { label: 'Request a Service', kind: 'create', section: 'service-requests' },
  { label: 'Report a Problem', kind: 'create', section: 'problems' },
  { label: 'Request a Change', kind: 'create', section: 'change-requests' },
  { label: 'Closed Tickets', kind: 'open', section: 'closed-tickets' },
  { label: 'In Progress Incident(s)', kind: 'open', section: 'in-progress-incidents' },
];

export default function ItsmHomePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { error } = useAppSelector((s) => s.itsm);
  const [creating, setCreating] = useState<ItsmSectionKey | null>(null);
  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  const open = (key: ItsmSectionKey) => navigate(`/tickets/${key}`);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <h1 className="text-2xl font-bold text-slate-900">ITSM</h1>
        <p className="mt-1 text-sm text-slate-500">Incidents, problems, service and change requests</p>
      </motion.div>

      {error && <ErrorMessage message={error} onRetry={() => dispatch(fetchTickets())} />}

      {/* Quick links */}
      <nav aria-label="Quick links" className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
        {QUICK_LINKS.map((l) => (
          <button
            key={l.label}
            onClick={() => (l.kind === 'create' ? (l.section === 'incidents' ? navigate('/tickets/incidents/new') : setCreating(l.section)) : open(l.section))}
            className="rounded-t-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-black transition-colors hover:bg-slate-100"
          >
            {l.label}
          </button>
        ))}
      </nav>

      {creating && (
        <NewTicketModal
          section={creating}
          onClose={() => setCreating(null)}
          onCreated={() => {
            const key = creating;
            setCreating(null);
            dispatch(fetchTickets());
            open(key);
          }}
        />
      )}
    </div>
  );
}
