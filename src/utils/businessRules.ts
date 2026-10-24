/**
 * Business rules: "when an incident is created, if these conditions match, do these actions". The backend has no
 * rules table yet, so the rules live in this browser (like notification rules and categories) and are applied by the
 * New Incident page.
 */

export const RULES_KEY = 'dex.businessRules.v1';

export type FactKey = 'category' | 'subcategory' | 'impact' | 'urgency' | 'priority' | 'channel' | 'assignmentGroup' | 'shortDescription' | 'description' | 'requesterEmail';

/** What a rule can look at on the incident being created. */
export type Facts = Record<FactKey, string>;

export const NO_FACTS: Facts = {
  category: '',
  subcategory: '',
  impact: '',
  urgency: '',
  priority: '',
  channel: '',
  assignmentGroup: '',
  shortDescription: '',
  description: '',
  requesterEmail: '',
};

export const FACT_LABEL: Record<FactKey, string> = {
  category: 'Category',
  subcategory: 'Subcategory',
  impact: 'Impact',
  urgency: 'Urgency',
  priority: 'Priority',
  channel: 'Channel',
  assignmentGroup: 'Assignment group',
  shortDescription: 'Short description',
  description: 'Description',
  requesterEmail: 'Requester email',
};

export const FACT_KEYS = Object.keys(FACT_LABEL) as FactKey[];

export type Operator = 'is' | 'isNot' | 'contains' | 'notContains' | 'isEmpty' | 'isNotEmpty';

export const OPERATORS: { key: Operator; label: string; needsValue: boolean }[] = [
  { key: 'is', label: 'is', needsValue: true },
  { key: 'isNot', label: 'is not', needsValue: true },
  { key: 'contains', label: 'contains', needsValue: true },
  { key: 'notContains', label: 'does not contain', needsValue: true },
  { key: 'isEmpty', label: 'is empty', needsValue: false },
  { key: 'isNotEmpty', label: 'is not empty', needsValue: false },
];

export interface Condition {
  id: string;
  field: FactKey;
  op: Operator;
  value: string;
}

export type ActionType = 'ASSIGN_GROUP' | 'ASSIGN_TO' | 'SET_PRIORITY' | 'SET_STATE' | 'EMAIL_GROUP';

export const ACTION_LABEL: Record<ActionType, string> = {
  ASSIGN_GROUP: 'Assign to group',
  ASSIGN_TO: 'Assign to technician',
  SET_PRIORITY: 'Set priority',
  SET_STATE: 'Set incident state',
  EMAIL_GROUP: 'Email the members of a group',
};

export const PRIORITIES = [
  { value: 'CRITICAL', label: '1 - Critical' },
  { value: 'HIGH', label: '2 - High' },
  { value: 'MEDIUM', label: '3 - Moderate' },
  { value: 'LOW', label: '4 - Low' },
];

/** The incident states a rule can set (the backend's ticket statuses). */
export const STATES = [
  { value: 'OPEN', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export interface RuleAction {
  id: string;
  type: ActionType;
  /** A group id for the group actions, a username for ASSIGN_TO, a priority value for SET_PRIORITY. */
  value: string;
  /** The group's name when the action was saved, so a rule still reads well if the group list cannot load. */
  label?: string;
}

export type RuleWhen = 'before' | 'after' | 'async' | 'display';

export const WHEN_OPTIONS: RuleWhen[] = ['before', 'after', 'async', 'display'];

/** What happens to the incident that makes a rule run. Only Insert (an incident being created) happens in the app today. */
export type RuleEvent = 'insert' | 'update' | 'delete' | 'query';

export const EVENT_LABEL: Record<RuleEvent, string> = { insert: 'Insert', update: 'Update', delete: 'Delete', query: 'Query' };

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /** When the rule runs relative to the save. */
  when: RuleWhen;
  /** The events the rule runs on. */
  events: Record<RuleEvent, boolean>;
  /** all = every condition must match; any = one is enough. */
  match: 'all' | 'any';
  conditions: Condition[];
  actions: RuleAction[];
  /** Show `message` to the person once the incident is created. */
  addMessage: boolean;
  message: string;
  /** Do not create the incident when this rule matches. */
  abort: boolean;
  /** Do not run the rules below this one once it has matched. */
  stop: boolean;
  /** Rules run lowest order first; ties keep the saved order. */
  order: number;
  /** ISO time of the last save. */
  updatedAt: string;
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export const blankRule = (): BusinessRule => ({
  id: newId(),
  name: '',
  description: '',
  enabled: true,
  when: 'before',
  events: { insert: true, update: false, delete: false, query: false },
  match: 'all',
  conditions: [{ id: newId(), field: 'category', op: 'is', value: '' }],
  actions: [],
  addMessage: false,
  message: '',
  abort: false,
  stop: false,
  order: 100,
  updatedAt: '',
});

export function loadRules(): BusinessRule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BusinessRule[];
      if (Array.isArray(parsed)) return parsed.map((r) => ({ ...r, addMessage: r.addMessage ?? false, message: r.message ?? '', abort: r.abort ?? false, when: r.when ?? 'before', events: r.events ?? { insert: true, update: false, delete: false, query: false }, order: typeof r.order === 'number' ? r.order : 100, updatedAt: r.updatedAt ?? '' }));
    }
  } catch {
    /* unreadable or storage blocked: no rules */
  }
  return [];
}

/** Returns false when the browser refused the write. */
export function saveRules(rules: BusinessRule[]): boolean {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(rules));
    return true;
  } catch {
    return false;
  }
}

const norm = (s: string) => s.trim().toLowerCase();

export function conditionMatches(c: Condition, facts: Facts): boolean {
  const actual = norm(facts[c.field] ?? '');
  const wanted = norm(c.value);
  switch (c.op) {
    case 'is':
      return actual === wanted;
    case 'isNot':
      return actual !== wanted;
    case 'contains':
      return actual.includes(wanted);
    case 'notContains':
      return !actual.includes(wanted);
    case 'isEmpty':
      return actual === '';
    case 'isNotEmpty':
      return actual !== '';
  }
}

export function ruleMatches(rule: BusinessRule, facts: Facts): boolean {
  if (rule.conditions.length === 0) return true;
  const results = rule.conditions.map((c) => conditionMatches(c, facts));
  return rule.match === 'all' ? results.every(Boolean) : results.some(Boolean);
}

export interface RuleOutcome {
  /** The enabled rules that matched, in the order they ran. */
  matched: BusinessRule[];
  assignmentGroupId?: number;
  assignmentGroupName?: string;
  assignedTo?: string;
  /** CRITICAL | HIGH | MEDIUM | LOW */
  priority?: string;
  /** OPEN | IN_PROGRESS | RESOLVED | CLOSED */
  state?: string;
  emailGroups: { id: number; name: string }[];
  /** Messages from the matched rules that have "Add message" ticked. */
  messages: string[];
  /** The name of the rule that stops the incident being created, if one matched. */
  abortedBy?: string;
}

/** Runs the enabled rules top to bottom; a later rule overrides an earlier one for the same field. */
export function evaluateRules(rules: BusinessRule[], facts: Facts): RuleOutcome {
  const out: RuleOutcome = { matched: [], emailGroups: [], messages: [] };
  for (const rule of [...rules].sort((a, b) => a.order - b.order)) {
    if (!rule.enabled || !rule.events.insert || !ruleMatches(rule, facts)) continue;
    out.matched.push(rule);
    if (rule.addMessage && rule.message.trim()) out.messages.push(rule.message.trim());
    if (rule.abort) {
      out.abortedBy = rule.name;
      break;
    }
    for (const a of rule.actions) {
      if (!a.value) continue;
      if (a.type === 'ASSIGN_GROUP') {
        out.assignmentGroupId = Number(a.value);
        out.assignmentGroupName = a.label;
      } else if (a.type === 'ASSIGN_TO') out.assignedTo = a.value;
      else if (a.type === 'SET_PRIORITY') out.priority = a.value;
      else if (a.type === 'SET_STATE') out.state = a.value;
      else if (a.type === 'EMAIL_GROUP' && !out.emailGroups.some((g) => g.id === Number(a.value))) {
        out.emailGroups.push({ id: Number(a.value), name: a.label ?? `group ${a.value}` });
      }
    }
    if (rule.stop) break;
  }
  return out;
}

export function describeCondition(c: Condition): string {
  const op = OPERATORS.find((o) => o.key === c.op);
  return `${FACT_LABEL[c.field]} ${op?.label ?? c.op}${op?.needsValue ? ` “${c.value || '…'}”` : ''}`;
}

export function describeAction(a: RuleAction): string {
  if (a.type === 'SET_PRIORITY') return `Set priority to ${PRIORITIES.find((p) => p.value === a.value)?.label ?? '…'}`;
  if (a.type === 'SET_STATE') return `Set state to ${STATES.find((p) => p.value === a.value)?.label ?? '…'}`;
  if (a.type === 'ASSIGN_TO') return `Assign to ${a.value || '…'}`;
  return `${ACTION_LABEL[a.type]} ${a.label || '…'}`;
}

/** A rule is only worth saving when it has a name, complete conditions and at least one complete action. */
export function ruleProblem(rule: BusinessRule): string | null {
  if (!rule.name.trim()) return 'Give the rule a name.';
  if (!Object.values(rule.events).some(Boolean)) return 'Tick at least one of Insert, Update, Delete or Query.';
  for (const c of rule.conditions) {
    const op = OPERATORS.find((o) => o.key === c.op);
    if (op?.needsValue && !c.value.trim()) return `Fill in the value for “${FACT_LABEL[c.field]}”.`;
  }
  if (rule.actions.length === 0 && !rule.abort) return 'Add at least one action.';
  for (const a of rule.actions) {
    if (!a.value) return `Choose a value for “${ACTION_LABEL[a.type]}”.`;
  }
  if (rule.addMessage && !rule.message.trim()) return 'Type the message to show, or untick Add message.';
  return null;
}
