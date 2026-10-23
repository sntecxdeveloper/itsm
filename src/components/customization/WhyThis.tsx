import { useState } from 'react';
import { useUiLayouts } from '../../context/UiLayoutContext';
import { formatRelativeTime } from '../../utils/formatDate';

const ROLE_NAMES: Record<string, string> = {
  ROLE_ADMIN: 'administrators',
  ROLE_OPERATOR: 'operators',
  ROLE_ITSM_TECHNICIAN: 'ITSM technicians',
  ROLE_VIEWER: 'viewers',
};

/** Plain words for why an area looks the way it does: who set it, for whom, whether it is locked, and who to ask. */
export function explain(area: string, layouts: ReturnType<typeof useUiLayouts>): string[] {
  const r = layouts.layouts[area];
  if (!r) return ['This is how DEX shows it by default. Nobody has changed it.'];
  const by = r.updatedBy ? ` by ${r.updatedBy}` : '';
  const when = r.updatedAt ? ` ${formatRelativeTime(r.updatedAt)}` : '';
  const lines: string[] = [];
  if (r.source === 'USER') lines.push(`You arranged this yourself${when}.`);
  else if (r.source === 'GROUP') lines.push(`It was set for your group "${layouts.groups.find((g) => String(g.id) === r.sourceKey)?.name ?? r.sourceKey}"${by}${when}.`);
  else if (r.source === 'ROLE') lines.push(`It was set for all ${ROLE_NAMES[r.sourceKey] ?? r.sourceKey}${by}${when}.`);
  else lines.push(`It was set for everyone${by}${when}.`);
  if (r.lockedByWiderLevel || (r.locked && r.source !== 'USER')) lines.push(`It is locked, so it cannot be changed here. Ask ${r.updatedBy ?? 'an administrator'} if you need something different.`);
  else if (r.source !== 'USER' && layouts.level !== 'NONE') lines.push('You can still arrange your own version with Customize.');
  else if (layouts.level === 'NONE') lines.push('You are not allowed to change it. An administrator can give you that right.');
  return lines;
}

/** A small "Why do I see this?" link that opens the explanation of one area. */
export default function WhyThis({ area, className = '' }: { area: string; className?: string }) {
  const layouts = useUiLayouts();
  const [open, setOpen] = useState(false);
  return (
    <span className={`relative inline-block ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-[11px] text-slate-400 underline-offset-2 hover:text-slate-700 hover:underline">
        Why do I see this?
      </button>
      {open && (
        <span role="note" className="absolute right-0 z-40 mt-1 block w-72 rounded-lg border border-line bg-white p-3 text-left text-[12px] leading-relaxed text-slate-700 shadow-lg">
          {explain(area, layouts).map((l) => (
            <span key={l} className="block">
              {l}
            </span>
          ))}
          <button type="button" onClick={() => setOpen(false)} className="mt-2 text-[11px] text-primary-600 hover:text-primary-700">
            Close
          </button>
        </span>
      )}
    </span>
  );
}
