import { conditionMatches, newId, type Condition, type Facts } from './businessRules.ts';

/**
 * SLA definitions: how long the support team has to respond to, or resolve, an incident that matches the conditions.
 * The backend has no SLA tables yet, so the definitions live in this browser (like business rules and categories).
 */

export const SLA_KEY = 'dex.slaDefinitions.v1';

export type SlaType = 'SLA' | 'OLA';
/** 'Response & Resolution' is one definition carrying both targets, plus the escalations for each. */
export type SlaTarget = 'Response' | 'Resolution' | 'Response & Resolution';
export const BOTH_TARGETS: SlaTarget = 'Response & Resolution';
export type EscalationOn = 'response' | 'resolution';
export type EscalationWhen = 'before' | 'after';

/** One escalation level: who is told, and how long before (or after) the target falls due. */
export interface SlaEscalation {
  id: string;
  on: EscalationOn;
  to: string;
  when: EscalationWhen;
  amount: number;
  unit: SlaUnit;
  actions: string;
}
export type SlaUnit = 'minutes' | 'hours' | 'days';
/** 24x7 counts every hour; business counts only Monday to Friday, 9 AM to 6 PM. */
export type SlaSchedule = '24x7' | 'business';

export const BUSINESS_START = 9;
export const BUSINESS_END = 18;
export const BUSINESS_HOURS_PER_DAY = BUSINESS_END - BUSINESS_START;
export const SCHEDULE_LABEL: Record<SlaSchedule, string> = { '24x7': '24x7', business: 'Business hours (Mon–Fri, 9 AM–6 PM)' };

export interface SlaDefinition {
  id: string;
  name: string;
  description: string;
  /** SLA: promised to the user. OLA: a target between internal teams. */
  type: SlaType;
  target: SlaTarget;
  amount: number;
  unit: SlaUnit;
  schedule: SlaSchedule;
  /** Response & Resolution only: the response target ({@code amount}/{@code unit} is then the resolution target). */
  responseAmount?: number;
  responseUnit?: SlaUnit;
  /** Outside operational hours (24x7) the clock may still skip holidays and weekends. */
  includeHolidays?: boolean;
  includeWeekends?: boolean;
  escalations?: SlaEscalation[];
  match: 'all' | 'any';
  conditions: Condition[];
  enabled: boolean;
  /** When several definitions of the same target apply, the lowest order is the one that counts. */
  order: number;
  updatedAt: string;
}

export const blankSla = (): SlaDefinition => ({
  id: newId(),
  name: '',
  description: '',
  type: 'SLA',
  target: 'Resolution',
  amount: 4,
  unit: 'hours',
  schedule: '24x7',
  match: 'all',
  conditions: [{ id: newId(), field: 'priority', op: 'is', value: '' }],
  enabled: true,
  order: 100,
  updatedAt: '',
});

export function loadSlas(): SlaDefinition[] {
  try {
    const raw = localStorage.getItem(SLA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SlaDefinition[];
      if (Array.isArray(parsed)) return parsed.map((s) => ({ ...s, order: typeof s.order === 'number' ? s.order : 100, updatedAt: s.updatedAt ?? '' }));
    }
  } catch {
    /* unreadable or storage blocked: no definitions */
  }
  return [];
}

/** Returns false when the browser refused the write. */
export function saveSlas(list: SlaDefinition[]): boolean {
  try {
    localStorage.setItem(SLA_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

const UNIT_LABEL: Record<SlaUnit, [string, string]> = { minutes: ['Minute', 'Minutes'], hours: ['Hour', 'Hours'], days: ['Day', 'Days'] };

/** "15 Minutes", "1 Hour", "2 Days". */
export function durationLabel(amount: number, unit: SlaUnit): string {
  const [one, many] = UNIT_LABEL[unit];
  return `${amount} ${amount === 1 ? one : many}`;
}

export function slaProblem(s: SlaDefinition): string | null {
  if (!s.name.trim()) return 'Give the definition a name.';
  if (!Number.isFinite(s.amount) || s.amount <= 0) return 'The duration must be more than zero.';
  if (s.target === BOTH_TARGETS) {
    if (!Number.isFinite(s.responseAmount) || (s.responseAmount ?? 0) <= 0) return 'The response time must be more than zero.';
    if (targetMinutes({ amount: s.responseAmount!, unit: s.responseUnit ?? 'minutes', schedule: s.schedule }) > targetMinutes(s)) {
      return 'The response time cannot be longer than the resolution time.';
    }
    for (const e of s.escalations ?? []) {
      if (!e.to.trim()) return 'Say who each escalation goes to.';
      if (!Number.isFinite(e.amount) || e.amount < 0) return 'Escalation times cannot be negative.';
    }
  }
  for (const c of s.conditions) {
    if (!['isEmpty', 'isNotEmpty'].includes(c.op) && !c.value.trim()) return 'Fill in every condition value.';
  }
  return null;
}

export function slaApplies(s: SlaDefinition, facts: Facts): boolean {
  if (!s.enabled) return false;
  if (s.conditions.length === 0) return true;
  const results = s.conditions.map((c) => conditionMatches(c, facts));
  return s.match === 'all' ? results.every(Boolean) : results.some(Boolean);
}

/** The enabled definitions that apply to the incident, one per target (the lowest order wins). */
export function applicableSlas(list: SlaDefinition[], facts: Facts): SlaDefinition[] {
  const out: SlaDefinition[] = [];
  for (const s of [...list].sort((a, b) => a.order - b.order).flatMap(splitSla)) {
    if (slaApplies(s, facts) && !out.some((o) => o.target === s.target && o.type === s.type)) out.push(s);
  }
  return out;
}

/** A combined definition as the two single-target ones it stands for; any other definition as itself. */
export function splitSla(s: SlaDefinition): SlaDefinition[] {
  if (s.target !== BOTH_TARGETS) return [s];
  return [
    { ...s, id: `${s.id}:response`, target: 'Response', amount: s.responseAmount ?? 0, unit: s.responseUnit ?? 'minutes' },
    { ...s, id: `${s.id}:resolution`, target: 'Resolution' },
  ];
}

export const blankEscalation = (on: EscalationOn): SlaEscalation => ({ id: newId(), on, to: '', when: 'before', amount: 1, unit: 'hours', actions: '' });

const MINUTE = 60_000;

/** Moves to the next moment inside business hours (Mon–Fri, 9–18), or stays put when already inside them. */
function intoBusinessHours(d: Date): Date {
  const t = new Date(d);
  for (let guard = 0; guard < 14; guard++) {
    const day = t.getDay();
    const weekend = day === 0 || day === 6;
    const startOfDay = new Date(t);
    startOfDay.setHours(BUSINESS_START, 0, 0, 0);
    const endOfDay = new Date(t);
    endOfDay.setHours(BUSINESS_END, 0, 0, 0);
    if (!weekend && t < startOfDay) return startOfDay;
    if (!weekend && t < endOfDay) return t;
    t.setDate(t.getDate() + 1);
    t.setHours(BUSINESS_START, 0, 0, 0);
  }
  return t;
}

/** Adds working minutes, counting only Monday to Friday, 9 AM to 6 PM. */
export function addBusinessMinutes(from: Date, minutes: number): Date {
  let t = intoBusinessHours(from);
  let left = minutes;
  while (left > 0) {
    const end = new Date(t);
    end.setHours(BUSINESS_END, 0, 0, 0);
    const room = Math.round((end.getTime() - t.getTime()) / MINUTE);
    if (left <= room) return new Date(t.getTime() + left * MINUTE);
    left -= room;
    t = intoBusinessHours(new Date(end.getTime() + MINUTE));
  }
  return t;
}

/** The minutes a definition allows. In business hours a day is one working day (9 hours). */
export function targetMinutes(s: Pick<SlaDefinition, 'amount' | 'unit' | 'schedule'>): number {
  if (s.unit === 'minutes') return s.amount;
  if (s.unit === 'hours') return s.amount * 60;
  return s.amount * (s.schedule === 'business' ? BUSINESS_HOURS_PER_DAY : 24) * 60;
}

/** When the target falls due for an incident created at {@code from}. */
export function dueAt(s: SlaDefinition, from: Date): Date {
  const minutes = targetMinutes(s);
  return s.schedule === 'business' ? addBusinessMinutes(from, minutes) : new Date(from.getTime() + minutes * MINUTE);
}

/** The sample policy from the usual ITSM guidance: response and resolution targets for each priority. */
export function samplePolicy(): SlaDefinition[] {
  const make = (priority: string, target: SlaTarget, amount: number, unit: SlaUnit, schedule: SlaSchedule, name: string): SlaDefinition => ({
    ...blankSla(),
    name,
    description: 'Sample target: change it to match your company.',
    target,
    amount,
    unit,
    schedule,
    conditions: [{ id: newId(), field: 'priority', op: 'is', value: priority }],
  });
  return [
    make('1 - Critical', 'Response', 15, 'minutes', '24x7', 'Priority 1 response (15 minutes)'),
    make('1 - Critical', 'Resolution', 1, 'hours', '24x7', 'Priority 1 resolution (1 hour)'),
    make('2 - High', 'Response', 30, 'minutes', '24x7', 'Priority 2 response (30 minutes)'),
    make('2 - High', 'Resolution', 4, 'hours', '24x7', 'Priority 2 resolution (4 hours)'),
    make('3 - Moderate', 'Response', 2, 'hours', '24x7', 'Priority 3 response (2 hours)'),
    make('3 - Moderate', 'Resolution', 8, 'hours', 'business', 'Priority 3 resolution (8 business hours)'),
    make('4 - Low', 'Response', 4, 'hours', 'business', 'Priority 4 response (4 business hours)'),
    make('4 - Low', 'Resolution', 2, 'days', 'business', 'Priority 4 resolution (2 business days)'),
  ];
}
