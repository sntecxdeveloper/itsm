import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { getDevices } from '../../api/deviceApi';
import { Button } from '../ui/Button';
import type { Device } from '../../types';

/** Pick devices (configuration items) to mark as affected by a problem. */
export default function AddDevicesModal({
  alreadyLinked,
  onClose,
  onAdd,
}: {
  alreadyLinked: number[];
  onClose: () => void;
  onAdd: (picked: Device[]) => void;
}) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());

  useEffect(() => {
    getDevices()
      .then((d) => setDevices(d ?? []))
      .catch(() => setError('Could not load devices.'))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices
      .filter((d) => !alreadyLinked.includes(d.id))
      .filter((d) => !q || `${d.hostname} ${d.ipAddress ?? ''} ${d.os ?? ''}`.toLowerCase().includes(q));
  }, [devices, alreadyLinked, query]);

  const toggle = (id: number) =>
    setPicked((p) => {
      const next = new Set(p);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Add configuration items" className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-slate-900">Add configuration items</h2>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by hostname, IP or OS"
          className="mt-3 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-primary-500 focus:outline-none"
        />
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded border border-slate-200">
          {shown.map((d) => (
            <label key={d.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-3 py-2 text-xs hover:bg-slate-50">
              <input type="checkbox" checked={picked.has(d.id)} onChange={() => toggle(d.id)} className="mt-0.5 h-4 w-4 accent-primary-600" />
              <span className="font-medium text-primary-700">{d.hostname}</span>
              <span className="min-w-0 flex-1 text-slate-600">{[d.ipAddress, d.os].filter(Boolean).join(' · ')}</span>
              <span className="shrink-0 text-slate-500">{d.status}</span>
            </label>
          ))}
          {shown.length === 0 && (
            <p className="py-8 text-center text-xs text-slate-400">{loading ? 'Loading…' : error ?? 'No devices to add.'}</p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <span className="mr-auto text-xs text-slate-500">{picked.size} selected</span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={picked.size === 0} onClick={() => onAdd(devices.filter((d) => picked.has(d.id)))}>
            Add
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
