import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useListLayout } from './useListLayout';
import {
  applyView,
  defaultView,
  groupRows,
  newRuleId,
  repairView,
  type Field,
  type QuickFilter,
  type RowGroup,
  type SortLevel,
  type View,
} from '../utils/listView';

export interface SavedView {
  id: string;
  name: string;
  view: View;
}

interface Options<T> {
  /** Where this list keeps what it remembers in this browser. */
  storageKey: string;
  fields: Field<T>[];
  rows: T[];
  quick?: QuickFilter[];
  defaultSort?: SortLevel;
}

function read<V>(key: string): V | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as V) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private window or blocked storage: it just lasts until the page is closed
  }
}

/**
 * Everything an advanced list needs besides its table: the view (search, conditions, sort, columns, grouping), the rows that
 * result, saved views, and the ways to change them. The columns, sort and grouping are remembered in this browser; the
 * conditions and search are not, unless the person saves a view.
 */
export function useListView<T>({ storageKey, fields, rows, quick = [], defaultSort }: Options<T>) {
  const fresh = useCallback(() => defaultView(fields, defaultSort), [fields, defaultSort]);

  const [view, setViewState] = useState<View>(() => {
    const remembered = read<Partial<View>>(`${storageKey}.state`);
    const base = defaultView(fields, defaultSort);
    return repairView({ ...base, ...(remembered ?? {}), search: '', rules: [], quick: null, match: 'ALL' }, fields);
  });
  const [saved, setSaved] = useState<SavedView[]>(() => (read<SavedView[]>(`${storageKey}.views`) ?? []).map((s) => ({ ...s, view: repairView(s.view, fields) })));

  useEffect(() => {
    write(`${storageKey}.state`, { columns: view.columns, sorts: view.sorts, groupBy: view.groupBy });
  }, [storageKey, view.columns, view.sorts, view.groupBy]);

  // Defaults set on the server (for this person, their group, their role or everyone). A new or changed default replaces what this
  // browser remembers once; a locked one always does.
  const layout = useListLayout(storageKey);
  const appliedRemote = useRef<string | null>(null);
  useEffect(() => {
    if (!layout.ready) return;
    const { columns, sorts, groupBy } = layout.defaults;
    if (!columns && !sorts && groupBy === undefined) return;
    const stamp = `${layout.version}:${JSON.stringify(layout.defaults)}`;
    if (appliedRemote.current === stamp) return;
    appliedRemote.current = stamp;
    const seen = read<string>(`${storageKey}.remote`);
    if (seen === stamp && !layout.lockedByAdmin) return;
    write(`${storageKey}.remote`, stamp);
    setViewState((v) => repairView({ ...v, ...(columns ? { columns } : {}), ...(sorts ? { sorts } : {}), ...(groupBy !== undefined ? { groupBy } : {}) }, fields));
  }, [layout.ready, layout.defaults, layout.version, layout.lockedByAdmin, storageKey, fields]);

  // The person's own views live on the server when they may save there (so they follow them); otherwise in this browser.
  const migrated = useRef(false);
  useEffect(() => {
    if (!layout.ready || !layout.serverViews || migrated.current) return;
    migrated.current = true;
    const local = read<SavedView[]>(`${storageKey}.views`) ?? [];
    if (local.length > 0 && layout.personalViews.length === 0) {
      void layout.savePersonal({ views: local }).then(() => write(`${storageKey}.views`, [])).catch(() => undefined);
    }
  }, [layout, storageKey]);

  const setView = useCallback((next: View | ((v: View) => View)) => setViewState((v) => (typeof next === 'function' ? next(v) : next)), []);

  const processed = useMemo(() => applyView(rows, fields, view, quick), [rows, fields, view, quick]);
  const groups: RowGroup<T>[] = useMemo(() => groupRows(processed, fields, view.groupBy), [processed, fields, view.groupBy]);

  const shown = useMemo(() => view.columns.map((k) => fields.find((f) => f.key === k)).filter((f): f is Field<T> => !!f), [view.columns, fields]);

  const personalSaved = useMemo(
    () => (layout.serverViews ? layout.personalViews.map((s) => ({ ...s, view: repairView(s.view, fields) })) : saved),
    [layout.serverViews, layout.personalViews, saved, fields],
  );
  const sharedSaved = useMemo(() => layout.shared.map((s) => ({ ...s, view: repairView(s.view, fields) })), [layout.shared, fields]);

  const saveCurrent = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (layout.serverViews) {
        void layout.savePersonal({ views: [...layout.personalViews.filter((s) => s.name.toLowerCase() !== trimmed.toLowerCase()), { id: newRuleId(), name: trimmed, view }] });
        return;
      }
      setSaved((prev) => {
        const next = [...prev.filter((s) => s.name.toLowerCase() !== trimmed.toLowerCase()), { id: newRuleId(), name: trimmed, view }];
        write(`${storageKey}.views`, next);
        return next;
      });
    },
    [storageKey, view, layout],
  );

  const deleteSaved = useCallback(
    (id: string) => {
      if (layout.serverViews) {
        void layout.savePersonal({ views: layout.personalViews.filter((s) => s.id !== id) });
        return;
      }
      setSaved((prev) => {
        const next = prev.filter((s) => s.id !== id);
        write(`${storageKey}.views`, next);
        return next;
      });
    },
    [storageKey, layout],
  );

  const applySaved = useCallback((id: string) => {
    const found = personalSaved.find((s) => s.id === id) ?? sharedSaved.find((s) => s.id === id);
    if (found) setViewState(repairView(found.view, fields));
  }, [personalSaved, sharedSaved, fields]);

  const reset = useCallback(() => {
    const base = fresh();
    const { columns, sorts, groupBy } = layout.defaults;
    setViewState(repairView({ ...base, ...(columns ? { columns } : {}), ...(sorts ? { sorts } : {}), ...(groupBy !== undefined ? { groupBy } : {}) }, fields));
  }, [fresh, layout.defaults, fields]);

  return { view, setView, processed, groups, shown, saved: personalSaved, shared: sharedSaved, saveCurrent, deleteSaved, applySaved, reset, fresh, layout };
}
