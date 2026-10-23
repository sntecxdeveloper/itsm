import { useState } from 'react';
import type { ListLayoutControls, SharedView } from '../../hooks/useListLayout';
import type { SavedView } from '../../hooks/useListView';
import type { View } from '../../utils/listView';
import { toast } from '../common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import WhyThis from '../customization/WhyThis';

interface Props {
  layout: ListLayoutControls;
  shared: SharedView[];
  saved: SavedView[];
  view: View;
  onApply: (id: string) => void;
  close: () => void;
}

/**
 * The shared part of the saved-views menu: views shared with the person's group, role or everyone; their own default columns; and,
 * for people allowed to, setting the default or sharing a view for others (optionally locked).
 */
export default function ListLayoutPanel({ layout, shared, saved, view, onApply, close }: Props) {
  const [target, setTarget] = useState(layout.targets[0]?.value ?? '');
  const [locked, setLocked] = useState(false);
  const [shareId, setShareId] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (what: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await what();
      toast(done, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-slate-200 pt-2">
      {shared.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Shared with you</p>
          <ul>
            {shared.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => { onApply(s.id); close(); }} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-slate-800 hover:bg-slate-50">
                  <span className="min-w-0 truncate">{s.name}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">{s.sharedBy}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex justify-end">
        <WhyThis area={layout.area} />
      </div>
      {layout.lockedByAdmin && <p className="rounded-md bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">An administrator set the columns of this list.</p>}

      {layout.serverViews && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={busy} onClick={() => void run(() => layout.savePersonal({ columns: view.columns, sorts: view.sorts, groupBy: view.groupBy }), 'These columns are now your default')} className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            Make these columns my default
          </button>
          {layout.hasPersonalDefault && (
            <button type="button" disabled={busy} onClick={() => void run(() => layout.resetPersonalDefault(), 'Back to the shared default')} className="rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              Use the shared default
            </button>
          )}
        </div>
      )}

      {layout.targets.length > 0 && (
        <div className="space-y-1.5 rounded-md bg-slate-50 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">For others</p>
          <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Who this is for" className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs">
            {layout.targets.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} className="h-3.5 w-3.5 accent-sky-600" />
            Lock the columns (people cannot change them)
          </label>
          <button type="button" disabled={busy || !target} onClick={() => void run(() => layout.setDefaultFor(target, view, locked), 'Default columns saved')} className="w-full rounded-md bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-900 disabled:opacity-40">
            Make the current columns, sort and grouping their default
          </button>
          {saved.length > 0 && (
            <div className="flex gap-1.5">
              <select value={shareId} onChange={(e) => setShareId(e.target.value)} aria-label="View to share" className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 text-xs">
                <option value="">Share one of my views…</option>
                {saved.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !shareId || !target}
                onClick={() => {
                  const found = saved.find((s) => s.id === shareId);
                  if (found) void run(() => layout.shareView(target, found), `"${found.name}" is shared`);
                }}
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Share
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
