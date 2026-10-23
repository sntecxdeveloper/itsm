import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Button } from '../ui/Button';
import { toast } from '../common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import { useLayoutArea } from '../../hooks/useLayoutArea';
import { applyTheme, isHex, PRESETS, THEME_SECTIONS, type ThemeConfig } from '../../utils/themeColors';
import type { LayoutScope } from '../../api/uiLayoutApi';

const ROLES = [
  { value: 'ROLE_ADMIN', label: 'Administrators' },
  { value: 'ROLE_OPERATOR', label: 'Operators' },
  { value: 'ROLE_ITSM_TECHNICIAN', label: 'ITSM technicians' },
  { value: 'ROLE_VIEWER', label: 'Viewers' },
];

function ColorRow({ label, value, fallback, onChange }: { label: string; value?: string; fallback: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="w-36 shrink-0 text-slate-700">{label}</span>
      <input type="color" value={isHex(value) ? value : fallback} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-8 w-12 cursor-pointer rounded border border-line bg-white" />
      <span className="font-mono text-[11px] text-slate-400">{isHex(value) ? value : 'default'}</span>
      {isHex(value) && (
        <button type="button" onClick={() => onChange(undefined)} className="text-[11px] text-slate-400 hover:text-slate-700">
          reset
        </button>
      )}
    </div>
  );
}

/**
 * Colors of the console: a preset or your own main color, background, cards, sidebar and header, plus a color per section. Previewed
 * live while choosing; saved for yourself, or (when allowed) for a group, a role or everyone, optionally locked.
 */
export default function ThemeModal({ onClose }: { onClose: () => void }) {
  const layout = useLayoutArea('theme');
  const location = useLocation();
  const section = location.pathname.split('/')[1] ?? '';
  const [theme, setTheme] = useState<ThemeConfig>(() => (layout.config as ThemeConfig) ?? {});
  const [target, setTarget] = useState('me');
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  // Live preview; the saved theme comes back when the dialog closes without saving.
  useEffect(() => {
    applyTheme(theme, section);
  }, [theme, section]);
  useEffect(() => () => applyTheme((layout.config as ThemeConfig) ?? null, section), [layout.config, section]);

  const targets = [{ value: 'me', label: 'Just me' }];
  if (layout.level === 'TEAM' || layout.level === 'GLOBAL') layout.groups.forEach((g) => targets.push({ value: `group:${g.id}`, label: `Group: ${g.name}` }));
  if (layout.level === 'GLOBAL') {
    ROLES.forEach((r) => targets.push({ value: `role:${r.value}`, label: `Role: ${r.label}` }));
    targets.push({ value: 'global', label: 'Everyone (default)' });
  }
  const scopeOf = (t: string): [LayoutScope, string] =>
    t === 'global' ? ['GLOBAL', ''] : t.startsWith('group:') ? ['GROUP', t.slice(6)] : t.startsWith('role:') ? ['ROLE', t.slice(5)] : ['USER', ''];

  const blocked = target === 'me' && !layout.canPersonalize;

  const run = async (what: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await what();
      toast(done, 'success');
      onClose();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const clean = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    (['primary', 'canvas', 'panel', 'sidebar', 'header'] as const).forEach((k) => isHex(theme[k]) && (out[k] = theme[k]));
    const sections = Object.fromEntries(Object.entries(theme.sections ?? {}).filter(([, v]) => isHex(v)));
    if (Object.keys(sections).length > 0) out.sections = sections;
    return out;
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Colors" onClick={(e) => e.stopPropagation()} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Colors</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">Changes show at once. Nothing is kept until you save.</p>
          {targets.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="theme-target" className="text-[12px] font-medium text-slate-600">
                Save for
              </label>
              <select id="theme-target" value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1 text-[12px]">
                {targets.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {target !== 'me' && (
                <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                  <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} className="h-3.5 w-3.5 accent-sky-600" />
                  Lock
                </label>
              )}
            </div>
          )}
          {blocked && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{layout.lockedByAdmin ? 'An administrator locked the colors.' : 'You are not allowed to change the colors.'}</p>}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => setTheme({ ...p.theme })} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] hover:bg-slate-50">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.theme.primary ?? '#0ea5e9' }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Whole application</p>
            <ColorRow label="Main color" value={theme.primary} fallback="#0ea5e9" onChange={(v) => setTheme({ ...theme, primary: v })} />
            <ColorRow label="Page background" value={theme.canvas} fallback="#eef3f9" onChange={(v) => setTheme({ ...theme, canvas: v })} />
            <ColorRow label="Cards" value={theme.panel} fallback="#ffffff" onChange={(v) => setTheme({ ...theme, panel: v })} />
            <ColorRow label="Sidebar" value={theme.sidebar} fallback="#ffffff" onChange={(v) => setTheme({ ...theme, sidebar: v })} />
            <ColorRow label="Top bar" value={theme.header} fallback="#eef3f9" onChange={(v) => setTheme({ ...theme, header: v })} />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Each section (its main color while open)</p>
            {THEME_SECTIONS.map((s) => (
              <ColorRow
                key={s.key}
                label={s.label}
                value={theme.sections?.[s.key]}
                fallback={theme.primary ?? '#0ea5e9'}
                onChange={(v) => {
                  const next = { ...(theme.sections ?? {}) };
                  if (v) next[s.key] = v;
                  else delete next[s.key];
                  setTheme({ ...theme, sections: next });
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || blocked}
            onClick={() =>
              void run(async () => {
                if (target === 'me') await layout.resetMine();
                else {
                  const [s, k] = scopeOf(target);
                  await layout.resetAt(s, k, 'theme');
                }
              }, 'Colors are back to the default')
            }
          >
            Reset to default
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={busy || blocked}
              onClick={() =>
                void run(async () => {
                  if (target === 'me') await layout.saveMine(clean());
                  else {
                    const [s, k] = scopeOf(target);
                    await layout.saveAt(s, k, 'theme', clean(), locked);
                  }
                }, 'Colors saved')
              }
            >
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
