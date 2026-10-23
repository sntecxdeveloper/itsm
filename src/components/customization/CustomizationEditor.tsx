import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCustomization,
  getCustomizationApplied,
  getCustomizationCatalog,
  promotePilot,
  rollbackPilot,
  type CustomizationApplied,
  resetCustomization,
  saveCustomization,
} from '../../api/customizationApi';
import { getErrorMessage } from '../../utils/errorHandler';
import { toast } from '../common/Toast';
import { Button } from '../ui/Button';
import { formatRelativeTime } from '../../utils/formatDate';
import type { FeatureTab } from '../../types/group';
import type { Customization, CustomizationTarget } from '../../types/customization';
import AgentViewExtras from './AgentViewExtras';

/** The sidebar tabs (key "tabs") and the Home cards (key "overview") can be put in order; the other tabs can only be shown or hidden. */
const TABS = 'tabs';
const ORDERABLE = new Set([TABS, 'overview']);

interface Item {
  key: string;
  label: string;
}

interface SectionInfo {
  key: string;
  title: string;
  hint: string;
  items: Item[];
}

/** Moves `key` to `index` in `list` (inserting it when it is not there yet). */
function place(list: string[], key: string, index: number): string[] {
  const without = list.filter((k) => k !== key);
  const at = Math.max(0, Math.min(index, without.length));
  return [...without.slice(0, at), key, ...without.slice(at)];
}

interface Props {
  target: CustomizationTarget;
  onChanged: () => void;
}

/**
 * Customizes what the DEX agent shows on the computers of a group or an organization. Pick a section on the left; its features are
 * either Shown (in order) or Available (hidden). Move them between the lists by dragging, or with the buttons. The preview shows the agent as it
 * will look.
 */
export default function CustomizationEditor({ target, onChanged }: Props) {
  const [catalog, setCatalog] = useState<FeatureTab[] | null>(null);
  const [saved, setSaved] = useState<Customization | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<Record<string, string[]>>({});
  const [managed, setManaged] = useState(false);
  const [sectionKey, setSectionKey] = useState(TABS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<CustomizationApplied | null>(null);
  const [theme, setTheme] = useState<Record<string, string>>({});
  const [rollout, setRollout] = useState('all');
  const [dragKey, setDragKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [tabs, c] = await Promise.all([getCustomizationCatalog(), getCustomization(target.type, target.id)]);
      setCatalog(tabs);
      setSaved(c);
      setManaged(c.managed);
      setHidden(new Set(c.hidden));
      setOrder(c.layout?.order ?? {});
      setTheme(c.layout?.theme ?? {});
      setRollout('all');
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [target.type, target.id]);

  useEffect(() => {
    setCatalog(null);
    setSaved(null);
    setSectionKey(TABS);
    void load();
  }, [load]);

  // How many devices have the view: checked on open and every 10 seconds while some are still catching up.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const check = () =>
      getCustomizationApplied(target.type, target.id)
        .then((a) => {
          if (cancelled) return;
          setApplied(a);
          if (a.applied < a.total) timer = window.setTimeout(check, 10000);
        })
        .catch(() => undefined);
    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [target.type, target.id, saved?.version]);

  const sections = useMemo<SectionInfo[]>(() => {
    if (!catalog) return [];
    const list: SectionInfo[] = [
      { key: TABS, title: 'Sidebar tabs', hint: 'The tabs down the left side of the agent', items: catalog.map((t) => ({ key: t.key, label: t.label })) },
    ];
    for (const tab of catalog) {
      if (tab.features.length > 0) list.push({ key: tab.key, title: tab.key === 'overview' ? 'Home cards' : tab.label, hint: `What the ${tab.label} tab contains`, items: tab.features });
    }
    return list;
  }, [catalog]);

  const section = sections.find((s) => s.key === sectionKey) ?? sections[0];

  /** The shown items of a section, in the saved order; whatever is not in the order follows in the agent's default order. */
  const shownOf = useCallback(
    (s: SectionInfo): Item[] => {
      const visible = s.items.filter((i) => !hidden.has(i.key));
      const wanted = order[s.key] ?? [];
      const byKey = new Map(visible.map((i) => [i.key, i]));
      const first = wanted.map((k) => byKey.get(k)).filter((i): i is Item => !!i);
      return [...first, ...visible.filter((i) => !wanted.includes(i.key))];
    },
    [hidden, order],
  );

  const dirty = useMemo(() => {
    if (!saved || !catalog) return false;
    if (managed !== saved.managed) return true;
    if (!managed) return false;
    const a = [...hidden].sort().join(',');
    const b = [...saved.hidden].sort().join(',');
    if (a !== b) return true;
    if (JSON.stringify(theme) !== JSON.stringify(saved.layout?.theme ?? {})) return true;
    return JSON.stringify(order) !== JSON.stringify(saved.layout?.order ?? {});
  }, [saved, catalog, managed, hidden, order, theme]);

  if (error && !catalog) return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>;
  if (!catalog || !saved || !section) return <p className="py-6 text-center text-sm text-slate-400">Loading…</p>;

  const reorderable = ORDERABLE.has(section.key);
  const shown = shownOf(section);
  const available = section.items.filter((i) => hidden.has(i.key));
  const tabHidden = section.key !== TABS && hidden.has(section.key);

  const setShownOrder = (keys: string[]) => setOrder((o) => ({ ...o, [section.key]: keys }));

  const remove = (key: string) => {
    if (reorderable) setShownOrder(shown.map((i) => i.key).filter((k) => k !== key));
    setHidden((h) => new Set(h).add(key));
  };

  const add = (key: string, index?: number) => {
    setHidden((h) => {
      const next = new Set(h);
      next.delete(key);
      return next;
    });
    if (reorderable) {
      const keys = shown.map((i) => i.key);
      setShownOrder(place(keys, key, index ?? keys.length));
    }
  };

  const move = (key: string, index: number) => {
    if (!reorderable) return;
    setShownOrder(place(shown.map((i) => i.key), key, index));
  };

  // ── drag and drop (one system for both lists) ───────────────────────────────
  const dropOnShown = (index: number) => {
    if (!dragKey) return;
    if (hidden.has(dragKey)) add(dragKey, index);
    else move(dragKey, index);
    setDragKey(null);
  };
  const dropOnAvailable = () => {
    if (dragKey && !hidden.has(dragKey)) remove(dragKey);
    setDragKey(null);
  };

  const toSave = () => {
    const layoutOrder: Record<string, string[]> = {};
    for (const s of sections) {
      if (!ORDERABLE.has(s.key) || !order[s.key]) continue;
      layoutOrder[s.key] = shownOf(s).map((i) => i.key);
    }
    // Situation rules ("when.*") are kept as chosen.
    Object.entries(order).forEach(([k, v]) => k.startsWith('when.') && v.length > 0 && (layoutOrder[k] = v));
    const hasLayout = Object.keys(layoutOrder).length > 0 || Object.keys(theme).length > 0;
    return { hidden: [...hidden].sort(), layout: hasLayout ? { locked: false, order: layoutOrder, theme } : null };
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (managed) {
        const { hidden: h, layout } = toSave();
        await saveCustomization(target.type, target.id, h, layout, rollout === 'all' ? null : Number(rollout));
      } else {
        await resetCustomization(target.type, target.id);
      }
      await load();
      toast(managed ? 'Saved. Connected computers update within seconds.' : 'No longer customized', 'success');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const tabLabel = (key: string) => catalog.find((t) => t.key === key)?.label ?? key;
  const previewTabs = shownOf(sections[0]);
  const previewCards = section.key === TABS ? shownOf(sections.find((s) => s.key === 'overview') ?? section) : shown;
  const previewTitle = section.key === TABS ? 'Home' : tabLabel(section.key);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-panel p-5">
        <h3 className="text-sm font-semibold text-slate-800">What the agent shows on {target.name}</h3>
        <div className="mt-3 space-y-2 text-[13px] text-slate-700">
          <label className="flex items-start gap-2">
            <input type="radio" name="cust-mode" checked={!managed} onChange={() => setManaged(false)} className="mt-0.5 h-4 w-4 accent-sky-600" />
            <span>
              Do not customize
              <span className="block text-[11px] text-slate-500">These computers follow {target.type === 'group' ? 'their organization, then the global setting' : 'the global setting'}.</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="cust-mode" checked={managed} onChange={() => setManaged(true)} className="mt-0.5 h-4 w-4 accent-sky-600" />
            <span>
              Choose what to show and in which order
              <span className="block text-[11px] text-slate-500">A change reaches connected computers within seconds; offline ones update when they connect.</span>
            </span>
          </label>
        </div>
        {applied && applied.total > 0 && (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600" role="status">
            <span className={applied.applied === applied.total ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>
              Applied on {applied.applied} of {applied.total} computer{applied.total === 1 ? '' : 's'}
            </span>
            {applied.waiting.length > 0 && (
              <span className="text-slate-500">
                {' '}
                — waiting: {applied.waiting.slice(0, 5).map((w) => `${w.hostname ?? w.agentId}${w.status === 'OFFLINE' ? ' (offline)' : ''}`).join(', ')}
                {applied.waiting.length > 5 ? ` and ${applied.waiting.length - 5} more` : ''}
              </span>
            )}
          </div>
        )}
        {saved.managed && saved.updatedBy && (
          <p className="mt-2 text-[11px] text-slate-400">
            Last saved by {saved.updatedBy} {saved.updatedAt ? formatRelativeTime(saved.updatedAt) : ''}
          </p>
        )}
      </section>

      {managed && (
        <section className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_300px]">
          {/* 1. which section */}
          <nav className="rounded-xl border border-line bg-panel p-2" aria-label="Sections of the agent">
            {sections.map((s) => {
              const count = s.items.filter((i) => hidden.has(i.key)).length;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSectionKey(s.key)}
                  aria-current={s.key === section.key}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] ${
                    s.key === section.key ? 'bg-primary-50 font-medium text-primary-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{s.title}</span>
                  {count > 0 && <span className="ml-2 rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">{count} off</span>}
                </button>
              );
            })}
          </nav>

          {/* 2. shown and available */}
          <div className="rounded-xl border border-line bg-panel p-4">
            <h4 className="text-sm font-semibold text-slate-800">{section.title}</h4>
            <p className="text-[11px] text-slate-500">
              {section.hint}.{' '}
              {reorderable ? 'Drag to reorder, drag between the lists to add or remove.' : 'Drag between the lists, or use the buttons, to add or remove.'}
            </p>
            {tabHidden && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                The {tabLabel(section.key)} tab itself is hidden, so none of this shows.
              </p>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div onDragOver={(e) => e.preventDefault()} onDrop={() => dropOnShown(shown.length)} className="min-h-[120px] rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 p-2">
                <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Shown ({shown.length})</p>
                <ul className="space-y-1.5">
                  {shown.map((item, i) => (
                    <li
                      key={item.key}
                      draggable
                      onDragStart={() => setDragKey(item.key)}
                      onDragEnd={() => setDragKey(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.stopPropagation();
                        dropOnShown(i);
                      }}
                      className={`flex items-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 text-[13px] shadow-sm ${dragKey === item.key ? 'opacity-40' : ''}`}
                    >
                      <span className="cursor-grab select-none text-slate-300" aria-hidden="true">⠿</span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {reorderable && (
                        <>
                          <button type="button" className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === 0} onClick={() => move(item.key, i - 1)} aria-label={`Move ${item.label} up`}>▲</button>
                          <button type="button" className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === shown.length - 1} onClick={() => move(item.key, i + 1)} aria-label={`Move ${item.label} down`}>▼</button>
                        </>
                      )}
                      <button type="button" className="px-1 text-slate-400 hover:text-red-600" onClick={() => remove(item.key)} aria-label={`Remove ${item.label}`}>×</button>
                    </li>
                  ))}
                  {shown.length === 0 && <li className="px-1 py-3 text-center text-[12px] text-slate-400">Nothing shown. Drag something here.</li>}
                </ul>
              </div>

              <div onDragOver={(e) => e.preventDefault()} onDrop={dropOnAvailable} className="min-h-[120px] rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-2">
                <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Available ({available.length})</p>
                <ul className="space-y-1.5">
                  {available.map((item) => (
                    <li
                      key={item.key}
                      draggable
                      onDragStart={() => setDragKey(item.key)}
                      onDragEnd={() => setDragKey(null)}
                      className={`flex items-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 text-[13px] text-slate-500 ${dragKey === item.key ? 'opacity-40' : ''}`}
                    >
                      <span className="cursor-grab select-none text-slate-300" aria-hidden="true">⠿</span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <button type="button" className="px-1 text-emerald-600 hover:text-emerald-800" onClick={() => add(item.key)} aria-label={`Add ${item.label}`}>+</button>
                    </li>
                  ))}
                  {available.length === 0 && <li className="px-1 py-3 text-center text-[12px] text-slate-400">Everything is shown.</li>}
                </ul>
              </div>
            </div>
            {section.key === TABS && <p className="mt-3 text-[11px] text-slate-400">The Administrator tab always stays at the bottom and cannot be removed.</p>}
          </div>

          {/* 3. live preview */}
          <aside className="rounded-xl border border-line bg-panel p-3" aria-label="Preview of the agent">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preview</p>
            <div className="flex h-72 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-[10px]">
              <div className="w-24 shrink-0 space-y-1 overflow-hidden border-r border-slate-200 bg-white p-1.5">
                {previewTabs.map((t) => (
                  <div key={t.key} className={`truncate rounded px-1.5 py-1 ${t.key === (section.key === TABS ? 'overview' : section.key) ? 'bg-sky-100 font-medium text-sky-800' : 'text-slate-600'}`}>
                    {t.label}
                  </div>
                ))}
                <div className="truncate rounded px-1.5 py-1 text-slate-400">Administrator</div>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 overflow-hidden p-2">
                <p className="font-semibold text-slate-700">{previewTitle}</p>
                {tabHidden ? (
                  <p className="text-slate-400">Hidden</p>
                ) : (
                  previewCards.map((c) => (
                    <div key={c.key} className="truncate rounded bg-white px-2 py-2 text-slate-600 shadow-sm">
                      {c.label}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      )}

      {managed && catalog && (
        <AgentViewExtras
          homeCards={catalog.find((c) => c.key === 'overview')?.features ?? []}
          order={order}
          setOrder={setOrder}
          theme={theme}
          setTheme={setTheme}
        />
      )}

      {saved.pilotPercent != null && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900" role="status">
          <p className="font-semibold">Pilot running: the new view is on {saved.pilotPercent}% of the computers{applied?.pilotTotal != null ? ` (${applied.pilotTotal})` : ''}.</p>
          {applied?.pilotOpens != null && (
            <p className="mt-1 text-[12px]">
              Agent use in the last 7 days: {applied.pilotOpens} tab opens per computer in the pilot, {applied.restOpens ?? 0} for the others.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void promotePilot(target.type, target.id).then(load).then(() => toast('Every computer has the new view', 'success')).catch((err) => setError(getErrorMessage(err)))}
            >
              Give it to everyone
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void rollbackPilot(target.type, target.id).then(load).then(() => toast('Back to the previous view', 'success')).catch((err) => setError(getErrorMessage(err)))}
            >
              Roll back
            </Button>
          </div>
        </section>
      )}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {managed && (
          <label className="mr-auto flex items-center gap-2 text-[12px] text-slate-600">
            Give the change to
            <select value={rollout} onChange={(e) => setRollout(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1 text-[12px]">
              <option value="all">every computer now</option>
              <option value="10">a pilot of 10% first</option>
              <option value="25">a pilot of 25% first</option>
              <option value="50">a pilot of 50% first</option>
            </select>
          </label>
        )}
        <Button variant="secondary" size="sm" disabled={!dirty || busy} onClick={() => void load()}>
          Undo changes
        </Button>
        <Button size="sm" disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
