/**
 * Business rules: "when an incident is created, if these conditions match, do these actions". The backend has no
 * rules table yet, so the rules live in this browser (like notification rules and categories) and are applied by the
 * New Incident page.
 */

export const RULES_KEY = 'dex.businessRules.v1';

export type FactKey = 'category' | 'subcategory' | 'impact' | 'urgency' | 'priority' | 'channel' | 'shortDescription' | 'description' | 'requesterEmail';

/** What a rule can look at on the incident being created. */
export type Facts = Record<FactKey, string>;

export const NO_FACTS: Facts = {
  category: '',
  subcategory: '',
  impact: '',
  urgency: '',
  priority: '',
  channel: '',
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

export type ActionType = 'ASSIGN_GROUP' | 'ASSIGN_TO' | 'SET_PRIORITY' | 'EMAIL_GROUP';

export const ACTION_LABEL: Record<ActionType, string> = {
  ASSIGN_GROUP: 'Assign to group',
  ASSIGN_TO: 'Assign to technician',
  SET_PRIORITY: 'Set priority',
  EMAIL_GROUP: 'Email the members of a group',
};

export const PRIORITIES = [
  { value: 'CRITICAL', label: '1 - Critical' },
  { value: 'HIGH', label: '2 - High' },
  { value: 'MEDIUM', label: '3 - Moderate' },
  { value: 'LOW', label: '4 - Low' },
];

export interface RuleAction {
  id: string;
  type: ActionType;
  /** A group id for the group actions, a username for ASSIGN_TO, a priority value for SET_PRIORITY. */
  value: string;
  /** The group's name when the action was saved, so a rule still reads well if the group list cannot load. */
  label?: string;
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /** all = every condition must match; any = one is enough. */
  match: 'all' | 'any';
  conditions: Condition[];
  actions: RuleAction[];
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
  match: 'all',
  conditions: [{ id: newId(), field: 'category', op: 'is', value: '' }],
  actions: [{ id: newId(), type: 'ASSIGN_GROUP', value: '' }],
  stop: false,
  order: 100,
  updatedAt: '',
});

export function loadRules(): BusinessRule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BusinessRule[];
      if (Array.isArray(parsed)) return parsed.map((r) => ({ ...r, order: typeof r.order === 'number' ? r.order : 100, updatedAt: r.updatedAt ?? '' }));
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
  emailGroups: { id: number; name: string }[];
}

/** Runs the enabled rules top to bottom; a later rule overrides an earlier one for the same field. */
export function evaluateRules(rules: BusinessRule[], facts: Facts): RuleOutcome {
  const out: RuleOutcome = { matched: [], emailGroups: [] };
  for (const rule of [...rules].sort((a, b) => a.order - b.order)) {
    if (!rule.enabled || !ruleMatches(rule, facts)) continue;
    out.matched.push(rule);
    for (const a of rule.actions) {
      if (!a.value) continue;
      if (a.type === 'ASSIGN_GROUP') {
        out.assignmentGroupId = Number(a.value);
        out.assignmentGroupName = a.label;
      } else if (a.type === 'ASSIGN_TO') out.assignedTo = a.value;
      else if (a.type === 'SET_PRIORITY') out.priority = a.value;
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
  if (a.type === 'ASSIGN_TO') return `Assign to ${a.value || '…'}`;
  return `${ACTION_LABEL[a.type]} ${a.label || '…'}`;
}

/** A rule is only worth saving when it has a name, complete conditions and at least one complete action. */
export function ruleProblem(rule: BusinessRule): string | null {
  if (!rule.name.trim()) return 'Give the rule a name.';
  for (const c of rule.conditions) {
    const op = OPERATORS.find((o) => o.key === c.op);
    if (op?.needsValue && !c.value.trim()) return `Fill in the value for “${FACT_LABEL[c.field]}”.`;
  }
  if (rule.actions.length === 0) return 'Add at least one action.';
  for (const a of rule.actions) {
    if (!a.value) return `Choose a value for “${ACTION_LABEL[a.type]}”.`;
  }
  return null;
}
