import { useMemo } from 'react';
import { useUiLayouts } from '../context/UiLayoutContext';

/** The common shape for "which items, in which order, which hidden": sidebar entries, dashboard widgets, detail page sections. */
export interface Arrangement {
  order: string[];
  hidden: string[];
}

/** Puts the listed keys first in their saved order and the rest after them in the page's own order. */
export function arrange<T extends { key: string }>(items: T[], arrangement: Arrangement | null): T[] {
  if (!arrangement) return items;
  const byKey = new Map(items.map((i) => [i.key, i]));
  const first = arrangement.order.map((k) => byKey.get(k)).filter((i): i is T => !!i);
  const rest = items.filter((i) => !arrangement.order.includes(i.key));
  return [...first, ...rest].filter((i) => !arrangement.hidden.includes(i.key));
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** One area's layout for the signed-in person, plus what they may do with it. */
export function useLayoutArea(area: string) {
  const ctx = useUiLayouts();
  const resolved = ctx.layouts[area] ?? null;

  const arrangement = useMemo<Arrangement | null>(
    () => (resolved ? { order: asStrings(resolved.config.order), hidden: asStrings(resolved.config.hidden) } : null),
    [resolved],
  );

  return {
    ready: ctx.ready,
    resolved,
    config: resolved?.config ?? null,
    arrangement,
    level: ctx.level,
    groups: ctx.groups,
    /** False when the person has no customize level or an administrator locked this part. */
    canPersonalize: ctx.level !== 'NONE' && !resolved?.lockedByWiderLevel,
    lockedByAdmin: !!resolved?.lockedByWiderLevel,
    isPersonal: resolved?.source === 'USER',
    saveMine: (config: Record<string, unknown>) => ctx.saveMine(area, config),
    resetMine: () => ctx.resetMine(area),
    saveAt: ctx.saveAt,
    resetAt: ctx.resetAt,
  };
}
