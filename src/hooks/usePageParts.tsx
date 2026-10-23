import { Fragment, useEffect, useMemo, type ReactNode } from 'react';
import { arrange, useLayoutArea } from './useLayoutArea';
import { usePageCustomizeRegistry } from '../context/PageCustomizeContext';
import type { ArrangeItem } from '../components/customization/ArrangeModal';

/**
 * Tells the top bar's Customize icon what the open page offers (its parts, the area they are saved in, and the access page the
 * permission "<page>.customize" belongs to). Pages that arrange their parts themselves (the dashboard, detail pages) call this directly.
 */
export function useRegisterCustomize(config: { area: string; title: string; page: string; sectionKey?: string; items: ArrangeItem[]; enabled?: boolean }) {
  const registry = usePageCustomizeRegistry();
  const signature = config.items.map((p) => `${p.key}:${p.label}:${p.fixed ? 1 : 0}`).join('|');
  const enabled = config.enabled !== false;
  useEffect(() => {
    if (!enabled) return undefined;
    registry.register({ area: config.area, title: config.title, page: config.page, sectionKey: config.sectionKey, items: config.items });
    return () => registry.clear(config.area);
    // only the list of parts matters, not the identity of the array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.area, config.title, config.page, config.sectionKey, enabled, signature, registry.register, registry.clear]);
}

export interface PagePart {
  key: string;
  label: string;
  node: ReactNode;
  /** Always shown (cannot be hidden). */
  fixed?: boolean;
}

interface Options {
  /** The role-system page this belongs to ("devices"); the Customize icon follows "<page>.customize". */
  page: string;
  title?: string;
  /** Keys hidden until the person turns them on. */
  defaultHidden?: string[];
  /** False leaves the page exactly as built (nothing to customize, no icon); used where a page is shared with ITSM. */
  enabled?: boolean;
}

/**
 * The parts of a page (summary cards, filters, the table...) in the person's own order, with the hidden ones left out. The page also
 * tells the top bar what it offers, so the Customize icon there opens a panel for exactly this page.
 *
 *   const parts = usePageParts('devices', [{ key: 'stats', label: 'Summary cards', node: <Stats/> }, ...]);
 *   return <div>{parts}</div>;
 */
export function usePageParts(page: string, all: PagePart[], options?: Partial<Options>): ReactNode {
  const area = `page.${page}`;
  const layout = useLayoutArea(area);
  const hiddenByDefault = options?.defaultHidden;

  useRegisterCustomize({
    area,
    title: options?.title ?? 'Customize this page',
    page: options?.page ?? page,
    sectionKey: page,
    items: all.map((p) => ({ key: p.key, label: p.label, fixed: p.fixed })),
    enabled: options?.enabled,
  });

  const arrangement = options?.enabled === false ? null : layout.arrangement ?? (hiddenByDefault ? { order: [], hidden: hiddenByDefault } : null);
  const shown = useMemo(() => {
    const required = new Set(all.filter((p) => p.fixed).map((p) => p.key));
    const arranged = arrange(all, arrangement);
    // A part that must stay (fixed) is never hidden, whatever was saved.
    const missing = all.filter((p) => required.has(p.key) && !arranged.includes(p));
    return [...arranged, ...missing];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, arrangement]);

  return (
    <>
      {shown.map((p) => (
        <Fragment key={p.key}>{p.node}</Fragment>
      ))}
    </>
  );
}
