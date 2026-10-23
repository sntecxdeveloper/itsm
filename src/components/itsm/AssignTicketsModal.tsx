import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { getUsers } from '../../api/userApi';
import { useAssignmentGroups } from '../../hooks/useAssignmentGroups';
import { Button } from '../ui/Button';

/** Who the incidents go to: one user, or a technician group whose members can all handle them. */
export type AssignTarget = { kind: 'user'; username: string } | { kind: 'group'; groupId: number };

type Mode = 'user' | 'group';

export default function AssignTicketsModal({
  count,
  onClose,
  onAssign,
}: {
  count: number;
  onClose: () => void;
  /** Resolves when the assignment is done; rejects with a message to show. */
  onAssign: (target: AssignTarget) => Promise<void>;
}) {
  const groups = useAssignmentGroups();
  const [mode, setMode] = useState<Mode>('user');
  const [users, setUsers] = useState<string[]>([]);
  const [assignee, setAssignee] = useState('');
  const [groupId, setGroupId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUsers()
      .then((u) => setUsers(u.filter((x) => x.enabled).map((x) => x.username)))
      .catch(() => setError('Could not load users.'));
  }, []);

  const ready = mode === 'user' ? !!assignee : !!groupId;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAssign(mode === 'user' ? { kind: 'user', username: assignee } : { kind: 'group', groupId: Number(groupId) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign');
      setBusy(false);
    }
  };

  const select =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-slate-900">
          Assign {count} incident{count === 1 ? '' : 's'}
        </h2>

        <div className="inline-flex w-full overflow-hidden rounded-lg border border-slate-300 text-sm" role="group" aria-label="Assign to">
          {(['user', 'group'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`flex-1 px-3 py-1.5 font-medium ${mode === m ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {m === 'user' ? 'A user' : 'A group'}
            </button>
          ))}
        </div>

        {mode === 'user' ? (
          <select autoFocus value={assignee} onChange={(e) => setAssignee(e.target.value)} className={select}>
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-1.5">
            <select autoFocus value={groupId} onChange={(e) => setGroupId(e.target.value)} className={select}>
              <option value="">Select an assignment group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.technicianCount} technician{g.technicianCount === 1 ? '' : 's'})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              {groups.length === 0
                ? 'No active technician groups yet. Create one under Groups.'
                : 'Every technician in the group will see these incidents and can handle them.'}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!ready} loading={busy}>
            Assign
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
