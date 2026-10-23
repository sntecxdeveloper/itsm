interface Item {
  key: string;
  label: string;
}

export const SITUATIONS: { key: string; label: string; hint: string }[] = [
  { key: 'when.issues', label: 'When the PC has open problems', hint: 'e.g. bring "Needs attention" to the top' },
  { key: 'when.updates', label: 'When updates are waiting', hint: 'e.g. bring the Updates card to the top' },
  { key: 'when.lowdisk', label: 'When the disk is nearly full', hint: 'e.g. bring the gauges or Health to the top' },
  { key: 'when.offline', label: 'When the PC cannot reach DEX', hint: 'e.g. bring Agent status to the top' },
];

const AGENT_COLORS: { key: string; label: string; fallback: string }[] = [
  { key: 'primary', label: 'Main color', fallback: '#0ea5e9' },
  { key: 'sidebar', label: 'Sidebar', fallback: '#ffffff' },
  { key: 'background', label: 'Page background', fallback: '#f1f5f9' },
];

interface Props {
  homeCards: Item[];
  order: Record<string, string[]>;
  setOrder: (next: Record<string, string[]>) => void;
  theme: Record<string, string>;
  setTheme: (next: Record<string, string>) => void;
}

/** The agent's colors, and which Home cards come first in which situation on the PC. */
export default function AgentViewExtras({ homeCards, order, setOrder, theme, setTheme }: Props) {
  const label = (key: string) => homeCards.find((c) => c.key === key)?.label ?? key;
  const setSituation = (key: string, cards: string[]) => {
    const next = { ...order };
    if (cards.length === 0) delete next[key];
    else next[key] = cards;
    setOrder(next);
  };

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-panel p-4">
        <h4 className="text-sm font-semibold text-slate-800">Colors of the agent</h4>
        <p className="text-[11px] text-slate-500">Leave a color on default to keep the agent's own.</p>
        <div className="mt-3 space-y-2">
          {AGENT_COLORS.map((c) => (
            <div key={c.key} className="flex items-center gap-2 text-[13px]">
              <span className="w-32 text-slate-700">{c.label}</span>
              <input
                type="color"
                value={theme[c.key] ?? c.fallback}
                onChange={(e) => setTheme({ ...theme, [c.key]: e.target.value })}
                aria-label={c.label}
                className="h-8 w-12 cursor-pointer rounded border border-line bg-white"
              />
              <span className="font-mono text-[11px] text-slate-400">{theme[c.key] ?? 'default'}</span>
              {theme[c.key] && (
                <button
                  type="button"
                  className="text-[11px] text-slate-400 hover:text-slate-700"
                  onClick={() => {
                    const next = { ...theme };
                    delete next[c.key];
                    setTheme(next);
                  }}
                >
                  reset
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200" aria-label="Color preview">
          <div className="flex h-20 text-[10px]">
            <div className="w-20 p-1.5" style={{ background: theme.sidebar ?? '#ffffff' }}>
              <div className="rounded px-1.5 py-1 font-medium text-white" style={{ background: theme.primary ?? '#0ea5e9' }}>
                Home
              </div>
              <div className="px-1.5 py-1 text-slate-500">Tickets</div>
            </div>
            <div className="flex-1 p-2" style={{ background: theme.background ?? '#f1f5f9' }}>
              <span className="inline-block rounded px-2 py-1 text-white" style={{ background: theme.primary ?? '#0ea5e9' }}>
                Fix it
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel p-4">
        <h4 className="text-sm font-semibold text-slate-800">Smart Home: what comes first, and when</h4>
        <p className="text-[11px] text-slate-500">The agent checks these on the PC and moves the chosen cards to the top while they are true.</p>
        <div className="mt-3 space-y-3">
          {SITUATIONS.map((s) => {
            const chosen = order[s.key] ?? [];
            const left = homeCards.filter((c) => !chosen.includes(c.key));
            return (
              <div key={s.key}>
                <p className="text-[12px] font-medium text-slate-700">{s.label}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {chosen.map((k, i) => (
                    <span key={k} className="flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] text-primary-800">
                      {i + 1}. {label(k)}
                      <button type="button" aria-label={`Remove ${label(k)}`} onClick={() => setSituation(s.key, chosen.filter((x) => x !== k))} className="text-primary-400 hover:text-primary-700">
                        ×
                      </button>
                    </span>
                  ))}
                  <select
                    value=""
                    onChange={(e) => e.target.value && setSituation(s.key, [...chosen, e.target.value])}
                    aria-label={`Add a card for: ${s.label}`}
                    className="rounded border border-line bg-white px-1.5 py-0.5 text-[11px] text-slate-600"
                  >
                    <option value="">+ add a card</option>
                    {left.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {chosen.length === 0 && <span className="text-[11px] text-slate-400">{s.hint}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
