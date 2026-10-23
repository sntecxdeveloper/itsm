/**
 * Incident life cycle: which state an incident may move to from each state.
 * The backend has no life-cycle tables yet, so the transitions live in this browser (like SLAs and business rules).
 */

export const LIFECYCLE_KEY = 'dex.incidentLifecycle.v1';

export type LifecycleState = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export const LIFECYCLE_STATES: LifecycleState[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  OPEN: 'New',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

/** from state -> the states it may move to (staying in the same state is always allowed). */
export type Transitions = Record<LifecycleState, LifecycleState[]>;

export const defaultTransitions = (): Transitions => ({
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'IN_PROGRESS', 'CLOSED'],
  CLOSED: ['OPEN', 'IN_PROGRESS', 'RESOLVED'],
});

export function loadTransitions(): Transitions {
  const base = defaultTransitions();
  try {
    const raw = localStorage.getItem(LIFECYCLE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Transitions>;
      for (const s of LIFECYCLE_STATES) {
        const to = parsed?.[s];
        if (Array.isArray(to)) base[s] = to.filter((t) => LIFECYCLE_STATES.includes(t) && t !== s);
      }
    }
  } catch {
    /* unreadable or storage blocked: defaults */
  }
  return base;
}

/** Returns false when the browser refused the write. */
export function saveTransitions(t: Transitions): boolean {
  try {
    localStorage.setItem(LIFECYCLE_KEY, JSON.stringify(t));
    return true;
  } catch {
    return false;
  }
}

/** The states an incident currently in `from` can be set to, including `from` itself. */
export function allowedStates(from: LifecycleState, t: Transitions): LifecycleState[] {
  return LIFECYCLE_STATES.filter((s) => s === from || t[from].includes(s));
}

export const canMove = (from: LifecycleState, to: LifecycleState, t: Transitions) => allowedStates(from, t).includes(to);
