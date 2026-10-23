import { useState } from 'react';
import { getGroupDevices, getGroupPeople } from '../../api/groupApi';
import type { GroupSection, GroupSummary } from '../../types/group';
import { HEALTH_INFO, KIND_INFO, SECTIONS, SECTION_INFO, countLabel, initials } from './groupMeta';

const FALLBACK_COLOR = '#64748b';
const PREVIEW = 6;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function countOf(group: GroupSummary, section: GroupSection): number {
  return section === 'DEVICE' ? group.deviceCount : section === 'TECHNICIAN' ? group.technicianCount : group.userCount;
}

interface Props {
  group: GroupSummary;
  onOpen: (group: GroupSummary) => void;
  /** Fixed width for the dashboard strip; the Groups page lets the grid size it. */
  compact?: boolean;
}

/**
 * An organisation unit. The unit itself is the card; its devices, technicians and users are dropdowns inside it that open to
 * show the first few names without leaving the page.
 */
export default function GroupCard({ group, onOpen, compact = false }: Props) {
  const color = group.color || FALLBACK_COLOR;
  const health = HEALTH_INFO[group.health];
  const [open, setOpen] = useState<GroupSection | null>(null);
  const [names, setNames] = useState<Partial<Record<GroupSection, string[] | 'error'>>>({});

  const toggle = (section: GroupSection) => {
    const next = open === section ? null : section;
    setOpen(next);
    if (!next || names[next] !== undefined) return;
    const load =
      next === 'DEVICE'
        ? getGroupDevices(group.id).then((d) => d.map((x) => x.hostname || x.agentId))
        : getGroupPeople(group.id, next).then((p) => p.map((x) => x.fullName || x.username));
    load
      .then((list) => setNames((prev) => ({ ...prev, [next]: list })))
      .catch(() => setNames((prev) => ({ ...prev, [next]: 'error' })));
  };

  return (
    <div
      className={`relative flex flex-col self-start overflow-hidden rounded-xl border border-line bg-panel shadow-card transition-shadow hover:shadow-md ${
        compact ? 'w-[260px] shrink-0' : 'w-full'
      }`}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden="true" />

      {/* The group itself */}
      <button
        type="button"
        onClick={() => onOpen(group)}
        title={group.description || undefined}
        className="flex items-start gap-3 p-4 pl-5 text-left hover:bg-slate-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold text-white" style={{ backgroundColor: color }} aria-hidden="true">
          {initials(group.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-slate-900">{group.name}</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">{KIND_INFO[group.kind].label}</span>
        </span>
        {group.deviceCount > 0 && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${health.ring} ${health.text}`}>{health.label}</span>
        )}
      </button>

      {group.deviceCount > 0 && (
        <div className="px-5 pb-3">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className="bg-emerald-500" style={{ width: `${(group.online / group.deviceCount) * 100}%` }} />
            <div className="bg-amber-400" style={{ width: `${(group.offline / group.deviceCount) * 100}%` }} />
          </div>
          <p className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {group.online} online · {group.offline} offline
            </span>
            {group.openIssues > 0 && <span className="font-medium text-red-600">{group.openIssues} open issue{group.openIssues === 1 ? '' : 's'}</span>}
          </p>
        </div>
      )}

      {/* What is inside: one dropdown per section */}
      <div className="border-t border-line/70">
        {SECTIONS.map((section) => {
          const isOpen = open === section;
          const loaded = names[section];
          const count = countOf(group, section);
          return (
            <div key={section} className="border-b border-line/60 last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(section)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-2 px-5 py-2 text-left text-[12px] hover:bg-slate-50"
              >
                <span className="font-medium text-slate-700">{SECTION_INFO[section].title}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-500">{count}</span>
                  <Chevron open={isOpen} />
                </span>
              </button>
              {isOpen && (
                <div className="bg-slate-50/70 px-5 pb-2.5 pt-1">
                  {loaded === undefined ? (
                    <p className="py-1 text-[11px] text-slate-400">Loading…</p>
                  ) : loaded === 'error' ? (
                    <p className="py-1 text-[11px] text-red-600">Could not load the list.</p>
                  ) : loaded.length === 0 ? (
                    <p className="py-1 text-[11px] text-slate-400">No {SECTION_INFO[section].many} yet.</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {loaded.slice(0, PREVIEW).map((n) => (
                        <li key={n} className="truncate text-[12px] text-slate-700">
                          {n}
                        </li>
                      ))}
                      {loaded.length > PREVIEW && (
                        <li>
                          <button type="button" onClick={() => onOpen(group)} className="text-[11px] font-medium text-primary-600 hover:text-primary-700">
                            and {loaded.length - PREVIEW} more · open group →
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <span className="sr-only">{SECTIONS.map((s) => countLabel(s, countOf(group, s))).join(', ')}</span>
    </div>
  );
}
