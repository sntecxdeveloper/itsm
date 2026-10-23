import { useCallback, useMemo } from 'react';
import { getLayoutsAt, type LayoutScope, type ResolvedLayout } from '../api/uiLayoutApi';
import { useLayoutArea } from './useLayoutArea';
import type { SavedView } from './useListView';
import type { SortLevel, View } from '../utils/listView';

/** What a list layout can carry: default columns, sort and grouping, and saved views. */
export interface ListLayoutConfig {
  columns?: string[];
  sorts?: SortLevel[];
  groupBy?: string | null;
  views?: SavedView[];
}

export interface SharedView extends SavedView {
  /** Who shares it: "Everyone", "Role: …", "Group: …". */
  sharedBy: string;
}

/** Where a list default or a shared view can be saved: "global", "role:ROLE_X" or "group:<id>". */
export interface LayoutTarget {
  value: string;
  label: string;
}

const ROLE_LABELS: Record<string, string> = {
  ROLE_ADMIN: 'Administrators',
  ROLE_OPERATOR: 'Operators',
  ROLE_ITSM_TECHNICIAN: 'ITSM technicians',
  ROLE_VIEWER: 'Viewers',
};

function asViews(value: unknown): SavedView[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is SavedView => !!v && typeof v === 'object' && typeof (v as SavedView).id === 'string' && typeof (v as SavedView).name === 'string' && !!(v as SavedView).view);
}

function scopeOf(target: string): [LayoutScope, string] {
  if (target === 'global') return ['GLOBAL', ''];
  if (target.startsWith('role:')) return ['ROLE', target.slice(5)];
  return ['GROUP', target.slice(6)];
}

/**
 * The server side of an advanced list (area "list.<storageKey>"): default columns, sort and grouping set for a group, a role or
 * everyone; views shared at those levels; and the person's own views, which then follow them to any browser.
 */
export function useListLayout(storageKey: string) {
  const area = `list.${storageKey}`.toLowerCase();
  const layout = useLayoutArea(area);
  const layers = useMemo(() => (layout.resolved as (ResolvedLayout & { layers?: { source: string; sourceKey: string; locked: boolean; config: Record<string, unknown> }[] }) | null)?.layers ?? [], [layout.resolved]);

  /** The most specific level that sets this property. */
  const pick = useCallback(<K extends keyof ListLayoutConfig>(prop: K): ListLayoutConfig[K] | undefined => {
    for (let i = layers.length - 1; i >= 0; i--) {
      const value = (layers[i].config as ListLayoutConfig)[prop];
      if (value !== undefined) return value;
    }
    return undefined;
  }, [layers]);

  const defaults = useMemo(() => ({ columns: pick('columns'), sorts: pick('sorts'), groupBy: pick('groupBy') }), [pick]);
  const personal = layers.find((l) => l.source === 'USER')?.config as ListLayoutConfig | undefined;

  const shared = useMemo<SharedView[]>(
    () =>
      layers
        .filter((l) => l.source !== 'USER')
        .flatMap((l) =>
          asViews((l.config as ListLayoutConfig).views).map((v) => ({
            ...v,
            id: `shared:${l.source}:${l.sourceKey}:${v.id}`,
            sharedBy: l.source === 'GLOBAL' ? 'Everyone' : l.source === 'ROLE' ? `Role: ${ROLE_LABELS[l.sourceKey] ?? l.sourceKey}` : `Group: ${layout.groups.find((g) => String(g.id) === l.sourceKey)?.name ?? l.sourceKey}`,
          })),
        ),
    [layers, layout.groups],
  );

  const targets = useMemo<LayoutTarget[]>(() => {
    const out: LayoutTarget[] = [];
    if (layout.level === 'TEAM' || layout.level === 'GLOBAL') layout.groups.forEach((g) => out.push({ value: `group:${g.id}`, label: `Group: ${g.name}` }));
    if (layout.level === 'GLOBAL') {
      Object.entries(ROLE_LABELS).forEach(([value, label]) => out.push({ value: `role:${value}`, label: `Role: ${label}` }));
      out.push({ value: 'global', label: 'Everyone' });
    }
    return out;
  }, [layout.level, layout.groups]);

  /** Changes the stored config of one level, keeping what else it holds. */
  const updateAt = useCallback(
    async (target: string, change: (current: ListLayoutConfig) => ListLayoutConfig, locked: boolean) => {
      const [scope, key] = scopeOf(target);
      const stored = (await getLayoutsAt(scope, key)).find((l) => l.area === area);
      await layout.saveAt(scope, key, area, change((stored?.config as ListLayoutConfig) ?? {}) as Record<string, unknown>, locked || !!stored?.locked);
    },
    [area, layout],
  );

  return {
    area,
    ready: layout.ready,
    /** The defaults set above the person (or their own), and whether an administrator locked them. */
    defaults,
    lockedByAdmin: layout.lockedByAdmin,
    version: layout.resolved?.version ?? 0,
    /** Views keep living in this browser only when the person may not save to the server. */
    serverViews: layout.level !== 'NONE' && !layout.lockedByAdmin,
    personalViews: asViews(personal?.views),
    hasPersonalDefault: !!personal?.columns,
    shared,
    targets,
    level: layout.level,
    savePersonal: (config: ListLayoutConfig) => layout.saveMine({ ...(personal ?? {}), ...config } as Record<string, unknown>),
    resetPersonalDefault: () => {
      const rest: ListLayoutConfig = { ...(personal ?? {}) };
      delete rest.columns;
      delete rest.sorts;
      delete rest.groupBy;
      return rest.views && rest.views.length > 0 ? layout.saveMine(rest as Record<string, unknown>) : layout.resetMine();
    },
    setDefaultFor: (target: string, view: View, locked: boolean) =>
      updateAt(target, (c) => ({ ...c, columns: view.columns, sorts: view.sorts, groupBy: view.groupBy }), locked),
    shareView: (target: string, saved: SavedView) =>
      updateAt(target, (c) => ({ ...c, views: [...asViews(c.views).filter((v) => v.name.toLowerCase() !== saved.name.toLowerCase()), saved] }), false),
    unshareView: (target: string, id: string) => updateAt(target, (c) => ({ ...c, views: asViews(c.views).filter((v) => v.id !== id) }), false),
  };
}

export type ListLayoutControls = ReturnType<typeof useListLayout>;
