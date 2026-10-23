import { useEffect, useState } from 'react';
import { getAssignmentGroups } from '../api/groupApi';
import type { GroupSummary } from '../types/group';

/** The active technician groups, for the "Assignment group" field. Empty if they cannot be loaded. */
export function useAssignmentGroups(): GroupSummary[] {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  useEffect(() => {
    let live = true;
    getAssignmentGroups()
      .then((g) => live && setGroups(g))
      .catch(() => live && setGroups([]));
    return () => {
      live = false;
    };
  }, []);
  return groups;
}
