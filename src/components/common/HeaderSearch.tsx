import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDevices } from '../../api/deviceApi';
import { getIssues } from '../../api/issueApi';
import { getArticles } from '../../api/knowledgeApi';
import type { Device, Issue } from '../../types';
import type { KnowledgeArticle } from '../../types/knowledge';
import { Kbd } from '../ui/Kbd';

interface Result {
  key: string;
  group: 'Devices' | 'Issues' | 'Articles';
  title: string;
  subtitle?: string;
  to: string;
}

const MAX_PER_GROUP = 5;

const matches = (q: string, ...fields: (string | null | undefined)[]) =>
  fields.some((f) => f?.toLowerCase().includes(q));

export default function HeaderSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ devices: Device[]; issues: Issue[]; articles: KnowledgeArticle[] } | null>(null);

  // Load the searchable data once, on first focus. A role that can't read one
  // of the lists (e.g. viewers and devices) just gets no results from it.
  const ensureLoaded = async () => {
    if (data || loading) return;
    setLoading(true);
    const [d, i, a] = await Promise.allSettled([getDevices(), getIssues(), getArticles()]);
    setData({
      devices: d.status === 'fulfilled' ? d.value ?? [] : [],
      issues: i.status === 'fulfilled' ? i.value ?? [] : [],
      articles: a.status === 'fulfilled' ? a.value ?? [] : [],
    });
    setLoading(false);
  };

  // "/" focuses the search from anywhere outside a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const results = useMemo<Result[]>(() => {
    if (!q || !data) return [];
    const devices = data.devices
      .filter((d) => matches(q, d.hostname, d.ipAddress, d.agentId, d.os))
      .slice(0, MAX_PER_GROUP)
      .map<Result>((d) => ({ key: `d${d.id}`, group: 'Devices', title: d.hostname, subtitle: [d.ipAddress, d.status].filter(Boolean).join(' · '), to: `/devices/${d.id}` }));
    const issues = data.issues
      .filter((i) => matches(q, i.title, i.issueCode, i.hostname, i.category))
      .slice(0, MAX_PER_GROUP)
      .map<Result>((i) => ({ key: `i${i.id}`, group: 'Issues', title: i.title, subtitle: [i.issueCode, i.hostname, i.severity].filter(Boolean).join(' · '), to: `/issues/${i.id}` }));
    const articles = data.articles
      .filter((a) => matches(q, a.title, a.category, a.tags))
      .slice(0, MAX_PER_GROUP)
      .map<Result>((a) => ({ key: `a${a.id}`, group: 'Articles', title: a.title, subtitle: a.category, to: `/knowledge/${a.id}` }));
    return [...devices, ...issues, ...articles];
  }, [q, data]);

  const go = (r: Result) => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    navigate(r.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      go(results[active]);
    }
  };

  const showPanel = open && q.length > 0;

  return (
    <div ref={boxRef} className="relative hidden w-full max-w-sm md:block">
      <div className="flex h-9 items-center gap-2.5 rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-500 transition-colors focus-within:border-primary-500 hover:border-line-strong">
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            void ensureLoaded();
          }}
          onKeyDown={onKeyDown}
          placeholder="Search devices, issues, articles…"
          aria-label="Search devices, issues, articles"
          className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none placeholder:text-slate-500"
        />
        <Kbd>/</Kbd>
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-line bg-raised p-1.5 shadow-pop">
          {loading && <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>}
          {!loading && results.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No results for "{query.trim()}".</p>}
          {results.map((r, idx) => (
            <div key={r.key}>
              {(idx === 0 || results[idx - 1].group !== r.group) && (
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{r.group}</p>
              )}
              <button
                onMouseEnter={() => setActive(idx)}
                onClick={() => go(r)}
                className={`flex w-full flex-col rounded-lg px-3 py-1.5 text-left ${idx === active ? 'bg-slate-100/70' : ''}`}
              >
                <span className="truncate text-[13px] font-medium text-slate-800">{r.title}</span>
                {r.subtitle && <span className="truncate text-xs text-slate-500">{r.subtitle}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
