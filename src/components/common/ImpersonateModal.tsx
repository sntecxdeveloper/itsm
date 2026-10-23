import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { getUsers, type ManagedUser } from '../../api/userApi';
import { impersonateUser, rememberImpersonator } from '../../api/authApi';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { setUser } from '../../store/authSlice';
import { Button } from '../ui/Button';
import { getErrorMessage } from '../../utils/errorHandler';

const RECENT_KEY = 'dex.recentImpersonations';

function loadRecent(): number[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function UserRow({ user, selected, onSelect }: { user: ManagedUser; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected ? 'border-primary-500 bg-primary-50' : 'border-line hover:bg-slate-100/70'
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-800 text-sm font-semibold text-white">
        {user.username.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">{user.fullName || user.username}</p>
        <p className="truncate text-xs text-slate-500">{user.username}</p>
      </div>
    </button>
  );
}

export default function ImpersonateModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const admin = useAppSelector((s) => s.auth.user);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [recent] = useState(loadRecent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getUsers()
      .then((u) => setUsers(u.filter((x) => x.enabled)))
      .catch(() => setError('Could not load users.'));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q
        ? users.filter((u) => `${u.username} ${u.fullName ?? ''} ${u.email}`.toLowerCase().includes(q))
        : users.filter((u) => recent.includes(u.id)),
    [users, q, recent],
  );

  const handleImpersonate = async () => {
    if (selectedId == null) return;
    const target = users.find((u) => u.id === selectedId);
    // Admins already have access to the admin page, so no session switch is needed.
    if (target?.role === 'ROLE_ADMIN') {
      window.open('/admin/users', '_blank');
      onClose();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await impersonateUser(selectedId);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify([selectedId, ...recent.filter((i) => i !== selectedId)].slice(0, 5)));
      } catch {
        /* recents are a convenience only */
      }
      if (admin) rememberImpersonator(admin);
      dispatch(setUser(user));
      window.location.assign('/tickets/incidents');
    } catch (e) {
      setError(`Impersonation failed: ${getErrorMessage(e)}`);
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select a user to impersonate"
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain w-full max-w-lg rounded-xl border border-line bg-raised p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-800">Select a user to impersonate</h2>
          <button onClick={onClose} aria-label="Close dialog" title="Close dialog" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100/70 hover:text-slate-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative mt-5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a user"
            className="h-10 w-full rounded-lg border border-line bg-panel px-3 pr-10 text-sm text-slate-800 outline-none focus:border-primary-500"
          />
          <svg className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>

        <p className="mt-5 text-[11px] font-medium uppercase tracking-wide text-primary-700">
          {q ? 'Search results' : 'Recent impersonations'}
        </p>
        <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
          {results.map((u) => (
            <UserRow key={u.id} user={u} selected={u.id === selectedId} onSelect={() => setSelectedId(u.id)} />
          ))}
          {results.length === 0 && (
            <p className="py-3 text-sm text-slate-500">{q ? 'No matching users.' : 'No recent impersonations.'}</p>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImpersonate} disabled={selectedId == null} loading={loading}>Impersonate user</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
