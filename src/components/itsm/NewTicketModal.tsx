import { createPortal } from 'react-dom';
import { useState } from 'react';
import { createTicket, getTickets } from '../../api/itsmApi';
import { getSection, type ItsmSectionKey } from '../../utils/itsmSections';
import { nextTicketNumber } from '../../utils/ticketNumber';
import type { TicketPriority } from '../../types';

const PREFIX_BY_CATEGORY: Record<string, string> = { Incident: 'INC', Problem: 'PRB', 'Service Request': 'RITM', Change: 'CHG' };

const PRIORITIES: TicketPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default function NewTicketModal({
  section,
  onClose,
  onCreated,
}: {
  section: ItsmSectionKey;
  onClose: () => void;
  onCreated: () => void;
}) {
  const def = getSection(section)!;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) return setErr('Subject is required');
    setBusy(true);
    setErr(null);
    try {
      const prefix = PREFIX_BY_CATEGORY[def.createCategory ?? ''];
      const ticketCode = prefix ? nextTicketNumber(await getTickets(), prefix) : undefined;
      await createTicket({ title: title.trim(), description, priority, category: def.createCategory, ticketCode });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create ticket');
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900">New {def.createCategory}</h3>
        <input className={field} placeholder="Subject" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className={field}
          rows={4}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <select className={field} value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
