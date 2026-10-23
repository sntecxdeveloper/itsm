import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { addGroupMembers, getCandidates } from '../../api/groupApi';
import { getErrorMessage } from '../../utils/errorHandler';
import { useDebounce } from '../../hooks/useDebounce';
import { SECTION_INFO } from './groupMeta';
import type { GroupCandidate, GroupSection } from '../../types/group';

interface Props {
  groupId: number;
  section: GroupSection;
  /** Keys already in the section, so they are not offered again. */
  existing: Set<string>;
  onClose: () => void;
  onAdded: (added: number, skipped: string[]) => void;
}

/** Search devices, technicians or users and add the ones you tick to the group. */
export default function AddMembersModal({ groupId, section, existing, onClose, onAdded }: Props) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const [loaded, setLoaded] = useState<{ key: string; list: GroupCandidate[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = `${section}|${debounced}`;
    getCandidates(section, debounced.trim() || undefined, section === 'DEVICE' ? groupId : undefined)
      .then((r) => !cancelled && setLoaded({ key, list: r }))
      .catch((err) => {
        if (cancelled) return;
        setLoaded({ key, list: [] });
        setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [section, debounced]);

  // Still searching until the answer for the current text has arrived.
  const results = loaded && loaded.key === `${section}|${debounced}` ? loaded.list : null;
  const visible = (results ?? []).filter((c) => !existing.has(c.key));

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const add = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await addGroupMembers(groupId, section, [...selected]);
      onAdded(r.added, r.skipped);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const info = SECTION_INFO[section];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${info.many}`}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain w-full max-w-lg rounded-2xl bg-white shadow-xl"
      >
        <div className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Add {info.many}</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={section === 'DEVICE' ? 'Search by computer name or system…' : 'Search by name, username or email…'}
            className="h-10 w-full rounded-lg border border-line bg-panel px-3 text-[13px] focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            autoFocus
          />
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {results === null ? (
              <p className="px-2 py-6 text-center text-xs text-slate-400">Searching…</p>
            ) : visible.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-slate-400">
                {query.trim() ? `No ${info.many} match that search.` : `Every ${info.one} is already in this group.`}
              </p>
            ) : (
              visible.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggle(c.key)} className="h-4 w-4 accent-sky-600" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{c.name}</span>
                  <span className="shrink-0 truncate text-[11px] text-slate-400">{(c.detail ?? '').replace('ROLE_', '').replace(/_/g, ' ')}</span>
                </label>
              ))
            )}
          </div>
          {results !== null && results.length >= 50 && <p className="text-[11px] text-slate-400">Showing the first 50. Type to narrow it down.</p>}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Cancel
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || saving}
              onClick={() => void add()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Adding…' : selected.size === 0 ? 'Add' : `Add ${selected.size}`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
