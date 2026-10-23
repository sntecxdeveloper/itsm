import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { formatDateTime } from '../../utils/formatDate';

interface KeyInfo {
  hasKey: boolean;
  prefix?: string | null;
  issuedAt?: string | null;
  revoked: boolean;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

/**
 * Admin view of how this device authenticates to DEX: its own key (only the
 * prefix is ever shown), the shared key (not migrated yet), or revoked.
 * Revoking locks the device out of every agent endpoint; restoring lets it
 * collect a fresh key on its next contact.
 */
export default function DeviceAccessCard({ deviceId }: { deviceId: number }) {
  const [info, setInfo] = useState<KeyInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ApiResponse<KeyInfo>>(`/devices/${deviceId}/api-key`)
      .then((r) => !cancelled && setInfo(r.data.data))
      .catch(() => !cancelled && setError('Could not load this device’s access status.'));
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  const act = async (action: 'revoke' | 'restore') => {
    const question =
      action === 'revoke'
        ? 'Revoke this device’s access? It will be refused on every agent endpoint until restored.'
        : 'Restore access? The device collects a new key the next time it connects.';
    if (!confirm(question)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<ApiResponse<KeyInfo>>(`/devices/${deviceId}/api-key/${action}`);
      setInfo(r.data.data);
    } catch {
      setError('That didn’t work - please try again.');
    } finally {
      setBusy(false);
    }
  };

  const state = !info
    ? null
    : info.revoked
      ? { label: 'Revoked', tone: 'bg-red-50 text-red-700 ring-red-200', text: 'This device is locked out of DEX until an admin restores it.' }
      : info.hasKey
        ? {
            label: 'Own key',
            tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            text: `Authenticates with its own key ${info.prefix ?? ''}…${info.issuedAt ? `, issued ${formatDateTime(info.issuedAt)}` : ''}.`,
          }
        : {
            label: 'Shared key',
            tone: 'bg-amber-50 text-amber-700 ring-amber-200',
            text: 'Still uses the shared agent key. It collects its own key the next time the agent starts.',
          };

  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Device access</p>
          {state ? (
            <p className="mt-1 text-[13px] text-slate-700">
              <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${state.tone}`}>
                {state.label}
              </span>
              {state.text}
            </p>
          ) : (
            !error && <p className="mt-1 text-[13px] text-slate-400">Loading…</p>
          )}
          {error && <p className="mt-1 text-[12px] text-red-500">{error}</p>}
        </div>
        {info &&
          (info.revoked ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act('restore')}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Restore access
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act('revoke')}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 disabled:opacity-50"
            >
              Revoke access
            </button>
          ))}
      </div>
    </div>
  );
}
