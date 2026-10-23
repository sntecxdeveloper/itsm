import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGroupsOfDevice } from '../../api/groupApi';
import type { GroupSummary } from '../../types/group';

/** The groups a device belongs to, as small links under its name. Shows nothing when it is in none. */
export default function DeviceGroupChips({ agentId }: { agentId: string }) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    getGroupsOfDevice(agentId).then((g) => !cancelled && setGroups(g)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (groups.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Groups">
      <span className="text-[11px] text-slate-500">Groups:</span>
      {groups.map((g) => (
        <Link
          key={g.id}
          to={`/groups/${g.id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color || '#64748b' }} aria-hidden="true" />
          {g.name}
        </Link>
      ))}
    </div>
  );
}
