import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  getAccessCatalog,
  getPersonPreview,
  getRoleGrants,
  getRoleHistory,
  restoreRoleVersion,
  saveExceptions,
  saveRoleGrants,
  type AccessRoleView,
  type CatalogItem,
  type PageLevel,
  type PersonAccess,
  type RoleHistory,
} from '../../api/accessApi';
import { getLayoutsAt, saveLayoutAt } from '../../api/uiLayoutApi';
import { Button } from '../ui/Button';
import { toast } from '../common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import { formatRelativeTime } from '../../utils/formatDate';

/** The dashboard's blocks (same keys as the dashboard page), and the page each one needs. */
export const WIDGETS: { key: string; label: string; needs?: string }[] = [
  { key: 'groups', label: 'Groups', needs: 'groups' },
  { key: 'quick-actions', label: 'Quick actions' },
  { key: 'alerts', label: 'Alert banners' },
  { key: 'kpis', label: 'Key numbers' },
  { key: 'charts', label: 'Health and issue charts' },
  { key: 'fleet-health', label: 'Fleet health table', needs: 'devices' },
  { key: 'trends', label: 'Issue trend and activity', needs: 'issues' },
  { key: 'recent', label: 'Remediations and recent issues', needs: 'issues' },
];

type Mode = { kind: 'role'; role: AccessRoleView } | { kind: 'person'; person: PersonAccess; role: AccessRoleView | undefined };

interface Draft {
  pages: Record<string, PageLevel>;
  required: Set<string>;
  actions: Set<string>;
  menuOrder: string[];
  widgets: string[];
  requiredWidgets: Set<string>;
}

const DRAG_PAGE = 'dex/page';
const DRAG_ACTION = 'dex/action';
const DRAG_WIDGET = 'dex/widget';
const DRAG_MENU = 'dex/menu';

function defaultLevel(item: CatalogItem, baseRole: string): PageLevel {
  if (!item.defaultRoles.includes(baseRole)) return 'HIDDEN';
  return baseRole === 'ROLE_VIEWER' ? 'VIEW' : 'FULL';
}

/**
 * The visual role builder: drag pages into the role's menu, drag their actions onto the page, drag widgets onto its dashboard, and
 * see the console exactly as people with this role (or this one person) will. Must-haves are starred and cannot be hidden by people.
 */
export default function RoleBuilder({ mode, onSaved }: { mode: Mode; onSaved: () => void }) {
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [selected, setSelected] = useState('dashboard');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<RoleHistory[] | null>(null);
  const [rolePages, setRolePages] = useState<Record<string, string>>({});      // person mode: what the role gives, to show exceptions

  const baseRole = mode.kind === 'role' ? mode.role.baseRole : mode.person.signInRole;
  const layoutKey = mode.kind === 'role' ? (mode.role.builtIn ? mode.role.baseRole : `ACCESS_${mode.role.id}`) : null;
  const pages = useMemo(() => (catalog ?? []).filter((i) => i.kind === 'PAGE'), [catalog]);
  const actionsOf = useCallback((page: string) => (catalog ?? []).filter((i) => i.kind === 'ACTION' && i.page === page), [catalog]);

  const load = useCallback(async () => {
    const cat = await getAccessCatalog();
    setCatalog(cat);
    let entries: { key: string; value: string; required: boolean }[];
    if (mode.kind === 'role') {
      entries = await getRoleGrants(mode.role.id);
    } else {
      const eff = await getPersonPreview(mode.person.username);
      entries = cat.map((i) => ({ key: i.key, value: i.kind === 'PAGE' ? eff.pages[i.key] : eff.actions[i.key] ? 'ALLOW' : 'DENY', required: eff.required.includes(i.key) }));
      const roleEntries = mode.role ? await getRoleGrants(mode.role.id) : [];
      setRolePages(Object.fromEntries(roleEntries.map((e) => [e.key, e.value])));
    }
    const pageLevels: Record<string, PageLevel> = {};
    const required = new Set<string>();
    const actions = new Set<string>();
    for (const e of entries) {
      const item = cat.find((c) => c.key === e.key);
      if (!item) continue;
      if (item.kind === 'PAGE') {
        pageLevels[e.key] = e.value as PageLevel;
        if (e.required) required.add(e.key);
      } else if (e.value === 'ALLOW') actions.add(e.key);
    }
    let menuOrder: string[] = cat.filter((i) => i.kind === 'PAGE').map((i) => i.key);
    let widgets = WIDGETS.map((w) => w.key);
    const requiredWidgets = new Set<string>();
    if (layoutKey) {
      try {
        const stored = await getLayoutsAt('ROLE', layoutKey);
        const menu = stored.find((l) => l.area === 'sidebar')?.config as { order?: string[] } | undefined;
        const dash = stored.find((l) => l.area === 'dashboard')?.config as { order?: string[]; hidden?: string[]; required?: string[] } | undefined;
        if (menu?.order) menuOrder = [...menu.order.filter((k) => menuOrder.includes(k)), ...menuOrder.filter((k) => !menu.order!.includes(k))];
        if (dash?.order) widgets = [...dash.order.filter((k) => widgets.includes(k)), ...widgets.filter((k) => !dash.order!.includes(k))];
        if (dash?.hidden) widgets = widgets.filter((k) => !dash.hidden!.includes(k));
        dash?.required?.forEach((k) => requiredWidgets.add(k));
      } catch {
        /* no layouts yet: the built-in order */
      }
    }
    const next = { pages: pageLevels, required, actions, menuOrder, widgets, requiredWidgets };
    setDraft(next);
    setSaved(JSON.stringify({ ...next, required: [...required], actions: [...actions], requiredWidgets: [...requiredWidgets] }));
  }, [mode, layoutKey]);

  useEffect(() => {
    load().catch((err) => toast(getErrorMessage(err), 'error'));
  }, [load]);

  if (!catalog || !draft) return <p className="py-8 text-center text-sm text-slate-400">Loading…</p>;

  const snapshot = JSON.stringify({ ...draft, required: [...draft.required], actions: [...draft.actions], requiredWidgets: [...draft.requiredWidgets] });
  const dirty = snapshot !== saved;
  const given = draft.menuOrder.filter((k) => draft.pages[k] && draft.pages[k] !== 'HIDDEN');
  const notGiven = pages.filter((p) => !given.includes(p.key));
  const label = (key: string) => catalog.find((c) => c.key === key)?.label ?? key;
  const set = (change: (d: Draft) => Draft) => setDraft((d) => (d ? change(d) : d));

  // ── changes ──
  const givePage = (key: string, at?: number) =>
    set((d) => {
      const order = d.menuOrder.filter((k) => k !== key);
      const visible = order.filter((k) => d.pages[k] && d.pages[k] !== 'HIDDEN');
      const before = at != null && at < visible.length ? order.indexOf(visible[at]) : order.length;
      order.splice(before < 0 ? order.length : before, 0, key);
      const level: PageLevel = d.pages[key] && d.pages[key] !== 'HIDDEN' ? d.pages[key] : 'FULL';
      return { ...d, pages: { ...d.pages, [key]: level }, menuOrder: order };
    });
  const takePage = (key: string) =>
    set((d) => {
      const required = new Set(d.required);
      required.delete(key);
      const actions = new Set([...d.actions].filter((a) => !a.startsWith(`${key}.`)));
      return { ...d, pages: { ...d.pages, [key]: 'HIDDEN' }, required, actions };
    });
  const setLevel = (key: string, level: PageLevel) =>
    set((d) => {
      // "View only" means look, not use: its actions go.
      const actions = level === 'VIEW' ? new Set([...d.actions].filter((a) => !a.startsWith(`${key}.`))) : d.actions;
      return { ...d, pages: { ...d.pages, [key]: level }, actions };
    });
  const toggleRequired = (key: string) =>
    set((d) => {
      const required = new Set(d.required);
      if (required.has(key)) required.delete(key);
      else required.add(key);
      return { ...d, required };
    });
  const allow = (action: string, on: boolean) =>
    set((d) => {
      const actions = new Set(d.actions);
      if (on) actions.add(action);
      else actions.delete(action);
      const page = action.split('.')[0];
      return { ...d, actions, pages: on && d.pages[page] === 'VIEW' ? { ...d.pages, [page]: 'FULL' } : d.pages };
    });
  const addWidget = (key: string, at?: number) =>
    set((d) => {
      const list = d.widgets.filter((w) => w !== key);
      list.splice(at ?? list.length, 0, key);
      return { ...d, widgets: list };
    });
  const removeWidget = (key: string) =>
    set((d) => {
      const req = new Set(d.requiredWidgets);
      req.delete(key);
      return { ...d, widgets: d.widgets.filter((w) => w !== key), requiredWidgets: req };
    });
  const toggleWidgetRequired = (key: string) =>
    set((d) => {
      const req = new Set(d.requiredWidgets);
      if (req.has(key)) req.delete(key);
      else req.add(key);
      return { ...d, requiredWidgets: req };
    });

  // ── drag and drop ──
  const drag = (type: string, key: string) => (e: DragEvent) => {
    e.dataTransfer.setData(type, key);
    e.dataTransfer.effectAllowed = 'move';
  };
  const accept = (e: DragEvent) => e.preventDefault();
  const dropOnMenu = (at?: number) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const page = e.dataTransfer.getData(DRAG_PAGE) || e.dataTransfer.getData(DRAG_MENU);
    if (page) givePage(page, at);
  };
  const dropOnPalette = (e: DragEvent) => {
    e.preventDefault();
    const page = e.dataTransfer.getData(DRAG_MENU);
    if (page && page !== 'dashboard') takePage(page);
    const widget = e.dataTransfer.getData(DRAG_WIDGET);
    if (widget && draft.widgets.includes(widget)) removeWidget(widget);
  };
  const dropOnDashboard = (at?: number) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const widget = e.dataTransfer.getData(DRAG_WIDGET);
    if (widget) addWidget(widget, at);
  };
  const dropOnToolbar = (e: DragEvent) => {
    e.preventDefault();
    const action = e.dataTransfer.getData(DRAG_ACTION);
    if (action) allow(action, true);
  };
  const dropOnActionPalette = (e: DragEvent) => {
    e.preventDefault();
    const action = e.dataTransfer.getData(DRAG_ACTION);
    if (action) allow(action, false);
  };

  // ── saving ──
  const save = async () => {
    setBusy(true);
    try {
      if (mode.kind === 'role') {
        const builtIn = mode.role.builtIn;
        const grants: { key: string; level: string; required: boolean }[] = [];
        for (const item of catalog) {
          if (item.kind === 'PAGE') {
            const level = draft.pages[item.key] ?? 'HIDDEN';
            const req = draft.required.has(item.key) && level !== 'HIDDEN';
            // A built-in role only stores what differs from its old rules, so everything else keeps working exactly as before.
            if (!builtIn || level !== defaultLevel(item, baseRole) || req) grants.push({ key: item.key, level, required: req });
          } else {
            const on = draft.actions.has(item.key);
            if (!builtIn || on !== item.defaultRoles.includes(baseRole)) grants.push({ key: item.key, level: on ? 'ALLOW' : 'DENY', required: false });
          }
        }
        await saveRoleGrants(mode.role.id, grants);
        if (layoutKey) {
          await saveLayoutAt('ROLE', layoutKey, 'sidebar', { order: draft.menuOrder }, false);
          await saveLayoutAt('ROLE', layoutKey, 'dashboard', {
            order: draft.widgets,
            hidden: WIDGETS.map((w) => w.key).filter((k) => !draft.widgets.includes(k)),
            required: [...draft.requiredWidgets],
          }, false);
        }
      } else {
        // A person: only what differs from their role becomes an exception.
        const exceptions: Record<string, string> = {};
        const roleEntries = mode.role ? await getRoleGrants(mode.role.id) : [];
        const fromRole = Object.fromEntries(roleEntries.map((e) => [e.key, e.value]));
        for (const item of catalog) {
          const mine = item.kind === 'PAGE' ? draft.pages[item.key] ?? 'HIDDEN' : draft.actions.has(item.key) ? 'ALLOW' : 'DENY';
          if (fromRole[item.key] !== mine) exceptions[item.key] = mine;
        }
        await saveExceptions(mode.person.username, exceptions);
      }
      toast('Saved. People get it the next time a page loads.', 'success');
      await load();
      onSaved();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const resetPerson = async () => {
    if (mode.kind !== 'person') return;
    setBusy(true);
    try {
      await saveExceptions(mode.person.username, {});
      await load();
      onSaved();
      toast('Exceptions removed: this person has exactly their role', 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectedLevel = draft.pages[selected] ?? 'HIDDEN';
  const selectedActions = actionsOf(selected);
  const allowedHere = selectedActions.filter((a) => draft.actions.has(a.key));
  const availableHere = selectedActions.filter((a) => !draft.actions.has(a.key));
  const availableWidgets = WIDGETS.filter((w) => !draft.widgets.includes(w.key));
  const widgetBlocked = (w: (typeof WIDGETS)[number]) => !!w.needs && (draft.pages[w.needs] ?? 'HIDDEN') === 'HIDDEN';
  const isException = (key: string, value: string) => mode.kind === 'person' && rolePages[key] !== undefined && rolePages[key] !== value;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {mode.kind === 'role' ? mode.role.name : `${mode.person.username} (${mode.person.roleName})`}
          </p>
          <p className="text-[11px] text-slate-500">
            {mode.kind === 'role'
              ? `Built on ${baseRole.replace('ROLE_', '').replace('_', ' ').toLowerCase()} sign-in. Drag pages into the menu, actions onto a page, widgets onto the dashboard.`
              : 'Changes here are exceptions for this one person, on top of their role.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode.kind === 'role' && (
            <Button variant="ghost" size="sm" onClick={() => void getRoleHistory(mode.role.id).then(setHistory)}>
              Earlier versions
            </Button>
          )}
          {mode.kind === 'person' && (
            <Button variant="ghost" size="sm" disabled={busy || mode.person.exceptions === 0} onClick={() => void resetPerson()}>
              Remove exceptions
            </Button>
          )}
          <Button variant="secondary" size="sm" disabled={!dirty || busy} onClick={() => void load()}>
            Undo changes
          </Button>
          <Button size="sm" disabled={!dirty || busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {history && mode.kind === 'role' && (
        <div className="rounded-xl border border-line bg-panel p-3 text-[12px]">
          <div className="mb-1 flex justify-between">
            <span className="font-semibold text-slate-700">Earlier versions</span>
            <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setHistory(null)}>
              Close
            </button>
          </div>
          {history.length === 0 && <p className="text-slate-400">No earlier versions.</p>}
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between py-1">
              <span className="text-slate-600">
                Before a change by {h.changedBy ?? 'unknown'} {h.changedAt ? formatRelativeTime(h.changedAt) : ''} ({h.grants} setting(s))
              </span>
              <button
                type="button"
                className="text-primary-600 hover:text-primary-700"
                onClick={() => void restoreRoleVersion(mode.role.id, h.id).then(load).then(() => { setHistory(null); toast('Put back', 'success'); })}
              >
                Put back
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        {/* ── palette ── */}
        <aside className="space-y-3 rounded-xl border border-line bg-panel p-3" onDragOver={accept} onDrop={dropOnPalette} aria-label="Available to add">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pages not given</p>
            <div className="space-y-1">
              {notGiven.map((p) => (
                <div key={p.key} draggable onDragStart={drag(DRAG_PAGE, p.key)} className="flex cursor-grab items-center justify-between rounded-md border border-dashed border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-700 hover:border-primary-300">
                  <span>⠿ {p.label}</span>
                  <button type="button" onClick={() => givePage(p.key)} className="text-primary-600" aria-label={`Give ${p.label}`}>
                    +
                  </button>
                </div>
              ))}
              {notGiven.length === 0 && <p className="text-[11px] text-slate-400">Every page is given.</p>}
            </div>
          </div>
          {mode.kind === 'role' && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dashboard widgets</p>
              <div className="space-y-1">
                {availableWidgets.map((w) => (
                  <div key={w.key} draggable={!widgetBlocked(w)} onDragStart={drag(DRAG_WIDGET, w.key)} title={widgetBlocked(w) ? `Needs the ${label(w.needs!)} page` : undefined}
                    className={`flex items-center justify-between rounded-md border border-dashed px-2 py-1.5 text-[12px] ${widgetBlocked(w) ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' : 'cursor-grab border-slate-300 bg-white text-slate-700 hover:border-primary-300'}`}>
                    <span>⠿ {w.label}</span>
                    {!widgetBlocked(w) && (
                      <button type="button" onClick={() => addWidget(w.key)} className="text-primary-600" aria-label={`Add ${w.label}`}>
                        +
                      </button>
                    )}
                  </div>
                ))}
                {availableWidgets.length === 0 && <p className="text-[11px] text-slate-400">All widgets are on the dashboard.</p>}
              </div>
            </div>
          )}
          <p className="text-[10px] text-slate-400">Drag something back here to take it away.</p>
        </aside>

        {/* ── live preview ── */}
        <section className="overflow-hidden rounded-xl border border-line bg-slate-100" aria-label="Preview of the console">
          <div className="border-b border-line bg-white px-3 py-1.5 text-[11px] text-slate-500">Preview: the console as {mode.kind === 'role' ? 'people with this role' : 'this person'} will see it</div>
          <div className="flex min-h-[420px]">
            <nav className="w-44 shrink-0 space-y-1 border-r border-line bg-white p-2" onDragOver={accept} onDrop={dropOnMenu()} aria-label="Menu">
              {given.map((key, i) => (
                <div
                  key={key}
                  draggable={key !== 'dashboard'}
                  onDragStart={drag(DRAG_MENU, key)}
                  onDragOver={accept}
                  onDrop={dropOnMenu(i)}
                  onClick={() => setSelected(key)}
                  className={`flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[12px] ${selected === key ? 'bg-primary-100 font-medium text-primary-800' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <span className="truncate">
                    {draft.required.has(key) && <span className="mr-1 text-amber-500" title="Must-have">★</span>}
                    {label(key)}
                  </span>
                  <span className={`ml-1 rounded px-1 text-[9px] ${draft.pages[key] === 'VIEW' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'} ${isException(key, draft.pages[key]) ? 'ring-1 ring-amber-400' : ''}`}>
                    {draft.pages[key] === 'VIEW' ? 'view' : 'full'}
                  </span>
                </div>
              ))}
              <div className="mt-2 rounded-md border border-dashed border-slate-300 px-2 py-2 text-center text-[10px] text-slate-400">Drop pages here</div>
            </nav>

            <div className="min-w-0 flex-1 p-3">
              {selected === 'dashboard' && mode.kind === 'role' ? (
                <div onDragOver={accept} onDrop={dropOnDashboard()} className="min-h-[360px] rounded-lg border border-dashed border-slate-300 p-2">
                  <p className="mb-2 text-[12px] font-semibold text-slate-700">Dashboard</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {draft.widgets.map((w, i) => {
                      const def = WIDGETS.find((x) => x.key === w);
                      const blocked = def ? widgetBlocked(def) : false;
                      return (
                        <div key={w} draggable onDragStart={drag(DRAG_WIDGET, w)} onDragOver={accept} onDrop={dropOnDashboard(i)}
                          className={`flex h-16 cursor-grab items-start justify-between rounded-lg border bg-white p-2 text-[12px] shadow-sm ${blocked ? 'border-amber-300 opacity-60' : 'border-line'}`}>
                          <span className="text-slate-700">
                            {draft.requiredWidgets.has(w) && <span className="mr-1 text-amber-500">★</span>}
                            {def?.label ?? w}
                            {blocked && <span className="block text-[10px] text-amber-700">Hidden: needs {label(def!.needs!)}</span>}
                          </span>
                          <span className="flex gap-1">
                            <button type="button" title="Must-have" onClick={() => toggleWidgetRequired(w)} className={draft.requiredWidgets.has(w) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}>
                              ★
                            </button>
                            <button type="button" aria-label={`Remove ${def?.label}`} onClick={() => removeWidget(w)} className="text-slate-300 hover:text-red-600">
                              ×
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {draft.widgets.length === 0 && <p className="py-10 text-center text-[12px] text-slate-400">Drop widgets here</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-slate-800">{label(selected)}</p>
                    {selectedLevel === 'VIEW' && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">look only</span>}
                  </div>
                  <div onDragOver={accept} onDrop={dropOnToolbar} className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white p-2" aria-label="Buttons on this page">
                    {allowedHere.map((a) => (
                      <span key={a.key} draggable onDragStart={drag(DRAG_ACTION, a.key)}
                        className={`flex cursor-grab items-center gap-1 rounded-md bg-primary-600 px-2 py-1 text-[11px] text-white ${isException(a.key, 'ALLOW') ? 'ring-2 ring-amber-400' : ''}`}>
                        {a.label}
                        <button type="button" onClick={() => allow(a.key, false)} aria-label={`Take away ${a.label}`} className="text-white/70 hover:text-white">
                          ×
                        </button>
                      </span>
                    ))}
                    {allowedHere.length === 0 && <span className="text-[11px] text-slate-400">{selectedActions.length ? 'No buttons: drop actions here' : 'This page has no actions'}</span>}
                  </div>
                  <div className="space-y-1.5 rounded-lg bg-white p-3">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-6 rounded bg-slate-100" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── inspector ── */}
        <aside className="space-y-3 rounded-xl border border-line bg-panel p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label(selected)}</p>
          {selected !== 'dashboard' || mode.kind === 'person' ? (
            <>
              <div className="flex gap-1.5">
                {(['VIEW', 'FULL'] as PageLevel[]).map((l) => (
                  <button key={l} type="button" disabled={selectedLevel === 'HIDDEN'} onClick={() => setLevel(selected, l)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] ${selectedLevel === l ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-line text-slate-600'} disabled:opacity-40`}>
                    {l === 'VIEW' ? 'View only' : 'Full use'}
                  </button>
                ))}
              </div>
              {mode.kind === 'role' && (
                <label className="flex items-center gap-2 text-[12px] text-slate-700">
                  <input type="checkbox" checked={draft.required.has(selected)} disabled={selectedLevel === 'HIDDEN'} onChange={() => toggleRequired(selected)} className="h-3.5 w-3.5 accent-amber-500" />
                  Must-have (people cannot hide it from their menu)
                </label>
              )}
              {selectedLevel !== 'HIDDEN' && selected !== 'dashboard' && (
                <Button variant="ghost" size="sm" onClick={() => takePage(selected)}>
                  Take this page away
                </Button>
              )}
              {selectedActions.length > 0 && (
                <div onDragOver={accept} onDrop={dropOnActionPalette}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Actions to add</p>
                  {availableHere.map((a) => (
                    <div key={a.key} draggable={selectedLevel !== 'HIDDEN'} onDragStart={drag(DRAG_ACTION, a.key)}
                      className="mb-1 flex cursor-grab items-center justify-between rounded-md border border-dashed border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-700">
                      <span>⠿ {a.label}</span>
                      <button type="button" disabled={selectedLevel === 'HIDDEN'} onClick={() => allow(a.key, true)} className="text-primary-600 disabled:opacity-30" aria-label={`Allow ${a.label}`}>
                        +
                      </button>
                    </div>
                  ))}
                  {availableHere.length === 0 && <p className="text-[11px] text-slate-400">Everything on this page is allowed.</p>}
                  {selectedLevel === 'VIEW' && <p className="mt-1 text-[10px] text-slate-400">Adding an action switches the page to full use.</p>}
                </div>
              )}
            </>
          ) : (
            <p className="text-[12px] text-slate-500">Drag widgets onto the dashboard, drag them to reorder, ★ makes one a must-have that people cannot remove from their dashboard.</p>
          )}
          {mode.kind === 'person' && <p className="text-[10px] text-slate-400">An amber outline marks an exception to the role.</p>}
        </aside>
      </div>
    </div>
  );
}
