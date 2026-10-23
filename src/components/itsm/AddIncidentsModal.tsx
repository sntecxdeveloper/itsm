import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { getSection, type ItsmSectionKey } from '../../utils/itsmSections';
import { Button } from '../ui/Button';
import type { ItsmTicket } from '../../types';

/** Pick existing incidents to link to a problem. */
export default function AddIncidentsModal({
  alreadyLinked,
  onClose,
  onAdd,
  section = 'incidents',
  title = 'Add incidents',
}: {
  section?: ItsmSectionKey;
  title?: string;
  alreadyLinked: number[];
  onClose: () => void;
  onAdd: (picked: ItsmTicket[]) => void;
}) {
  const dispatch = useAppDispatch();
  const { tickets, loading } = useAppSelector((s) => s.itsm);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (tickets.length === 0) dispatch(fetchTickets());
  }, [tickets.length, dispatch]);

  const incidents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets
      .filter(getSection(section)!.matches)
      .filter((t) => !alreadyLinked.includes(t.id))
      .filter((t) => !q || `${t.ticketCode} ${t.title}`.toLowerCase().includes(q));
  }, [tickets, alreadyLinked, query, section]);

  const toggle = (id: number) =>
    setPicked((p) => {
      const next = new Set(p);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by number or short description"
          className="mt-3 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-primary-500 focus:outline-none"
        />
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded border border-slate-200">
          {incidents.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-3 py-2 text-xs hover:bg-slate-50">
              <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} className="mt-0.5 h-4 w-4 accent-primary-600" />
              <span className="font-medium text-primary-700">{t.ticketCode}</span>
              <span className="min-w-0 flex-1 text-slate-800">{t.title}</span>
              <span className="shrink-0 text-slate-500">{t.priority}</span>
            </label>
          ))}
          {incidents.length === 0 && (
            <p className="py-8 text-center text-xs text-slate-400">{loading ? 'Loading…' : 'Nothing to add.'}</p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <span className="mr-auto text-xs text-slate-500">{picked.size} selected</span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={picked.size === 0} onClick={() => onAdd(tickets.filter((t) => picked.has(t.id)))}>
            Add
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
