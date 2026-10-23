import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/Button';
import { toast } from '../common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import { useLayoutArea, type Arrangement } from '../../hooks/useLayoutArea';
import type { LayoutScope } from '../../api/uiLayoutApi';
import { applyTheme, isHex, type ThemeConfig } from '../../utils/themeColors';

export interface ArrangeItem {
  key: string;
  label: string;
  /** Always shown (cannot be hidden), e.g. the Dashboard entry. */
  fixed?: boolean;
}

const ROLES = [
  { value: 'ROLE_ADMIN', label: 'Administrators' },
  { value: 'ROLE_OPERATOR', label: 'Operators' },
  { value: 'ROLE_ITSM_TECHNICIAN', label: 'ITSM technicians' },
  { value: 'ROLE_VIEWER', label: 'Viewers' },
];

/** A few ready colors for one section; the picker takes any other. */
const SWATCHES = ['#0ea5e9', '#2563eb', '#4f46e5', '#9333ea', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#15803d', '#0d9488', '#334155'];

interface Props {
  /** The layout area this arranges, e.g. "sidebar", "dashboard" or "page.devices". */
  area: string;
  title: string;
  /** All items in the page's own order. */
  items: ArrangeItem[];
  onClose: () => void;
  /** Keys hidden until the person turns them on (when nothing is saved yet). */
  defaultHidden?: string[];
  /** The first part of the address of a section ("devices"): gives the panel a Color tab for that section's main color. */
  sectionKey?: string;
}

/**
 * Show, hide and order the parts of one area of the console, and (for a section) choose its color. A panel on the right side so the
 * page stays visible; a color shows at once. Everyone with a customize level saves their own view; people allowed to do more can
 * also save the default of a group, a role or everyone, and lock it so it cannot be changed further down.
 */
export default function ArrangeModal({ area, title, items, onClose, defaultHidden, sectionKey }: Props) {
  const layout = useLayoutArea(area);
  const themeLayout = useLayoutArea('theme');
  const start = useMemo(() => {
    const base: Arrangement = layout.arrangement ?? { order: [], hidden: defaultHidden ?? [] };
    const byKey = new Map(items.map((i) => [i.key, i]));
    const ordered = [...base.order.filter((k) => byKey.has(k)), ...items.map((i) => i.key).filter((k) => !base.order.includes(k))];
    return { order: ordered, hidden: new Set(base.hidden.filter((k) => byKey.has(k) && !byKey.get(k)?.fixed)) };
  }, [layout.arrangement, items, defaultHidden]);

  const hasLayout = items.length > 0;
  const hasColor = !!sectionKey;
  const [tab, setTab] = useState<'layout' | 'color'>(hasLayout ? 'layout' : 'color');
  const [order, setOrder] = useState<string[]>(start.order);
  const [hidden, setHidden] = useState<Set<string>>(start.hidden);
  const [target, setTarget] = useState<string>('me');
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const savedTheme = (themeLayout.config as ThemeConfig | null) ?? null;
  const savedColor = sectionKey && isHex(savedTheme?.sections?.[sectionKey]) ? savedTheme!.sections![sectionKey] : undefined;
  const [color, setColor] = useState<string | undefined>(savedColor);
  const colorChanged = color !== savedColor;

  // The color shows at once; the saved one comes back when the panel closes without saving.
  useEffect(() => {
    if (!sectionKey || !colorChanged) return;
    const sections = { ...(savedTheme?.sections ?? {}) };
    if (color) sections[sectionKey] = color;
    else delete sections[sectionKey];
    applyTheme({ ...(savedTheme ?? {}), sections }, sectionKey);
    return () => applyTheme(savedTheme, sectionKey);
  }, [color, colorChanged, sectionKey, savedTheme]);

  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const move = (key: string, to: number) =>
    setOrder((o) => {
      const without = o.filter((k) => k !== key);
      const at = Math.max(0, Math.min(to, without.length));
      return [...without.slice(0, at), key, ...without.slice(at)];
    });
  const toggle = (key: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Where this can be saved: "me", "group:<id>", "role:<ROLE>", "global".
  const targets: { value: string; label: string }[] = [{ value: 'me', label: 'Just me' }];
  if (layout.level === 'TEAM' || layout.level === 'GLOBAL') layout.groups.forEach((g) => targets.push({ value: `group:${g.id}`, label: `Group: ${g.name}` }));
  if (layout.level === 'GLOBAL') {
    ROLES.forEach((r) => targets.push({ value: `role:${r.value}`, label: `Role: ${r.label}` }));
    targets.push({ value: 'global', label: 'Everyone (default)' });
  }

  const scopeOf = (t: string): [LayoutScope, string] =>
    t === 'global' ? ['GLOBAL', ''] : t.startsWith('group:') ? ['GROUP', t.slice(6)] : t.startsWith('role:') ? ['ROLE', t.slice(5)] : ['USER', ''];

  const withSection = (value: string | undefined): Record<string, unknown> => {
    const sections = { ...(savedTheme?.sections ?? {}) };
    if (value && sectionKey) sections[sectionKey] = value;
    else if (sectionKey) delete sections[sectionKey];
    return { ...(savedTheme ?? {}), sections };
  };

  const save = async () => {
    setBusy(true);
    try {
      if (hasLayout) {
        const config = { order, hidden: [...hidden] };
        if (target === 'me') await layout.saveMine(config);
        else {
          const [scope, key] = scopeOf(target);
          await layout.saveAt(scope, key, area, config, locked);
        }
      }
      if (sectionKey && colorChanged) {
        const config = withSection(color);
        if (target === 'me') await themeLayout.saveMine(config);
        else {
          const [scope, key] = scopeOf(target);
          await themeLayout.saveAt(scope, key, 'theme', config, locked);
        }
      }
      toast(target === 'me' ? 'Your view is saved' : 'Default saved', 'success');
      onClose();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      if (hasLayout) {
        if (target === 'me') await layout.resetMine();
        else {
          const [scope, key] = scopeOf(target);
          await layout.resetAt(scope, key, area);
        }
      }
      if (sectionKey && savedColor && target === 'me') await themeLayout.saveMine(withSection(undefined));
      toast('Back to the default', 'success');
      onClose();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const meBlocked = target === 'me' && !layout.canPersonalize;
  const tabBtn = (id: 'layout' | 'color', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${tab === id ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  );

  // Drawn at the top of the page: inside the top bar (which blurs what is behind it) a fixed panel would be sized to the bar.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/25" role="presentation" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-line bg-white shadow-xl"
      >
        <div className="border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <p className="mt-0.5 text-[12px] text-slate-500">Only you see this, unless you save it for others.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {hasLayout && hasColor && (
            <div className="mt-3 flex gap-1" role="tablist">
              {tabBtn('layout', 'Layout')}
              {tabBtn('color', 'Color')}
            </div>
          )}
          {targets.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="arrange-target" className="text-[12px] font-medium text-slate-600">
                Save for
              </label>
              <select
                id="arrange-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="rounded-lg border border-line bg-white px-2 py-1 text-[12px] text-slate-800"
              >
                {targets.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {target !== 'me' && (
                <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                  <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} className="h-3.5 w-3.5 accent-sky-600" />
                  Lock (people cannot change it)
                </label>
              )}
            </div>
          )}
          {meBlocked && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              {layout.lockedByAdmin ? 'An administrator locked this, so it cannot be changed.' : 'You are not allowed to customize this. Ask an administrator.'}
            </p>
          )}
        </div>

        {tab === 'layout' && hasLayout && (
          <>
            <p className="px-5 pt-3 text-[12px] text-slate-500">Drag to reorder, untick to hide.</p>
            <ul className="flex-1 space-y-1.5 overflow-y-auto px-5 py-3">
              {order.map((key, i) => {
                const item = byKey.get(key);
                if (!item) return null;
                const off = hidden.has(key);
                return (
                  <li
                    key={key}
                    draggable
                    onDragStart={() => setDragKey(key)}
                    onDragEnd={() => setDragKey(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragKey && dragKey !== key) move(dragKey, i);
                      setDragKey(null);
                    }}
                    className={`flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-[13px] ${off ? 'bg-slate-50 text-slate-400' : 'bg-white text-slate-800'} ${dragKey === key ? 'opacity-40' : ''}`}
                  >
                    <span className="cursor-grab select-none text-slate-300" aria-hidden="true">⠿</span>
                    <input
                      type="checkbox"
                      checked={!off}
                      disabled={item.fixed}
                      onChange={() => toggle(key)}
                      aria-label={`Show ${item.label}`}
                      className="h-4 w-4 accent-sky-600"
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.fixed && (
                      <span className="text-[10px] text-slate-400" title="Your administrator keeps this one">
                        required
                      </span>
                    )}
                    <button type="button" disabled={i === 0} onClick={() => move(key, i - 1)} className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${item.label} up`}>
                      ▲
                    </button>
                    <button type="button" disabled={i === order.length - 1} onClick={() => move(key, i + 1)} className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${item.label} down`}>
                      ▼
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {tab === 'color' && hasColor && (
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            <p className="text-[12px] text-slate-500">The main color of this section (buttons, links, highlights) while it is open.</p>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Use ${c}`}
                  className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-slate-900' : 'border-white shadow'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <input type="color" value={color ?? '#0ea5e9'} onChange={(e) => setColor(e.target.value)} aria-label="Pick a color" className="h-8 w-12 cursor-pointer rounded border border-line bg-white" />
              <span className="font-mono text-[11px] text-slate-400">{color ?? 'default'}</span>
              {color && (
                <button type="button" onClick={() => setColor(undefined)} className="text-[11px] text-slate-400 hover:text-slate-700">
                  use the default
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" size="sm" disabled={busy || meBlocked} onClick={() => void reset()}>
            Reset to default
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy || meBlocked} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
