/**
 * The engine behind the advanced lists: filters with conditions that fit each kind of field, a search box, multi-level
 * sorting, grouping, and CSV export. Pure functions only (no React), so it can be tested on its own.
 */

export type FieldType = 'text' | 'number' | 'date' | 'choice' | 'list';

/** What a field's value can be: numbers (dates as milliseconds), text, a list of text, or nothing. */
export type Cell = string | number | string[] | null | undefined;

export interface ChoiceOption {
  value: string;
  label: string;
  count?: number;
  /** Options with the same group are shown together under a heading (a tab and its features, for example). */
  group?: string;
}

export interface Field<T> {
  key: string;
  label: string;
  type: FieldType;
  /** The raw value used to filter and sort. Dates are milliseconds since 1970. */
  value: (row: T) => Cell;
  /** What the cell says in words (also used by search and export). Defaults to the raw value. */
  text?: (row: T) => string;
  /** Choices for choice and list fields. When left out they are worked out from the rows. */
  options?: (rows: T[]) => ChoiceOption[];
  /** Always shown, cannot be turned off. */
  fixed?: boolean;
  /** Shown in a fresh view. */
  initial?: boolean;
  /** Can be used to group the list. */
  groupable?: boolean;
}

export type Needs = 'none' | 'one' | 'two' | 'many';

export interface OperatorInfo {
  op: string;
  label: string;
  needs: Needs;
}

export interface Rule {
  id: string;
  field: string;
  op: string;
  value: string;
  value2?: string;
  values?: string[];
}

export interface SortLevel {
  field: string;
  dir: 'asc' | 'desc';
}

export interface View {
  search: string;
  match: 'ALL' | 'ANY';
  rules: Rule[];
  sorts: SortLevel[];
  /** The columns shown, in order. */
  columns: string[];
  groupBy: string | null;
  /** The id of a quick filter chip that is switched on. */
  quick: string | null;
}

export interface QuickFilter {
  id: string;
  label: string;
  rules: Omit<Rule, 'id'>[];
}

const OPERATORS: Record<FieldType, OperatorInfo[]> = {
  text: [
    { op: 'contains', label: 'contains', needs: 'one' },
    { op: 'not_contains', label: 'does not contain', needs: 'one' },
    { op: 'is', label: 'is', needs: 'one' },
    { op: 'is_not', label: 'is not', needs: 'one' },
    { op: 'starts_with', label: 'starts with', needs: 'one' },
    { op: 'ends_with', label: 'ends with', needs: 'one' },
    { op: 'is_empty', label: 'is empty', needs: 'none' },
    { op: 'is_not_empty', label: 'is not empty', needs: 'none' },
  ],
  number: [
    { op: 'eq', label: 'equals', needs: 'one' },
    { op: 'neq', label: 'does not equal', needs: 'one' },
    { op: 'gt', label: 'is more than', needs: 'one' },
    { op: 'gte', label: 'is at least', needs: 'one' },
    { op: 'lt', label: 'is less than', needs: 'one' },
    { op: 'lte', label: 'is at most', needs: 'one' },
    { op: 'between', label: 'is between', needs: 'two' },
    { op: 'is_empty', label: 'is empty', needs: 'none' },
    { op: 'is_not_empty', label: 'is not empty', needs: 'none' },
  ],
  date: [
    { op: 'in_last_days', label: 'is within the last (days)', needs: 'one' },
    { op: 'older_than_days', label: 'is older than (days)', needs: 'one' },
    { op: 'on', label: 'is on', needs: 'one' },
    { op: 'before', label: 'is before', needs: 'one' },
    { op: 'after', label: 'is after', needs: 'one' },
    { op: 'is_empty', label: 'is empty', needs: 'none' },
    { op: 'is_not_empty', label: 'is not empty', needs: 'none' },
  ],
  choice: [
    { op: 'is_any_of', label: 'is any of', needs: 'many' },
    { op: 'is_none_of', label: 'is none of', needs: 'many' },
    { op: 'is_empty', label: 'is empty', needs: 'none' },
    { op: 'is_not_empty', label: 'is not empty', needs: 'none' },
  ],
  list: [
    { op: 'has_any', label: 'includes any of', needs: 'many' },
    { op: 'has_all', label: 'includes all of', needs: 'many' },
    { op: 'has_none', label: 'includes none of', needs: 'many' },
    { op: 'is_empty', label: 'is empty', needs: 'none' },
    { op: 'is_not_empty', label: 'is not empty', needs: 'none' },
  ],
};

export const operatorsFor = (type: FieldType): OperatorInfo[] => OPERATORS[type];

export const operatorInfo = (type: FieldType, op: string): OperatorInfo | undefined => OPERATORS[type].find((o) => o.op === op);

let counter = 0;
export const newRuleId = () => `r${Date.now().toString(36)}${(counter++).toString(36)}`;

/** A fresh rule for a field, with the first condition that fits it. */
export function newRule(field: Field<unknown>): Rule {
  return { id: newRuleId(), field: field.key, op: OPERATORS[field.type][0].op, value: '' };
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

const isEmptyCell = (v: Cell) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** Has the person filled the rule in enough for it to filter anything? An unfinished rule is ignored, not applied. */
export function ruleIsComplete(rule: Rule, type: FieldType): boolean {
  const info = operatorInfo(type, rule.op);
  if (!info) return false;
  switch (info.needs) {
    case 'none':
      return true;
    case 'one':
      if (rule.value.trim() === '') return false;
      if (type === 'number') return !Number.isNaN(Number(rule.value));
      if (type === 'date') return rule.op === 'in_last_days' || rule.op === 'older_than_days' ? !Number.isNaN(Number(rule.value)) : !Number.isNaN(parseDay(rule.value));
      return true;
    case 'two':
      return rule.value.trim() !== '' && (rule.value2 ?? '').trim() !== '' && !Number.isNaN(Number(rule.value)) && !Number.isNaN(Number(rule.value2));
    case 'many':
      return (rule.values ?? []).length > 0;
  }
}

/** A calendar date typed as 2026-10-03, read as that day on this computer's clock (not midnight UTC). NaN if it is not one. */
function parseDay(text: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return Number.NaN;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d.getTime() : Number.NaN;
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Does one row satisfy one rule? The rule must be complete. */
export function matchRule<T>(row: T, rule: Rule, field: Field<T>, now: number = Date.now()): boolean {
  const raw = field.value(row);
  switch (rule.op) {
    case 'is_empty':
      return isEmptyCell(raw);
    case 'is_not_empty':
      return !isEmptyCell(raw);
  }

  if (field.type === 'text') {
    const v = norm(raw);
    const w = norm(rule.value);
    switch (rule.op) {
      case 'contains': return v.includes(w);
      case 'not_contains': return !v.includes(w);
      case 'is': return v === w;
      case 'is_not': return v !== w;
      case 'starts_with': return v.startsWith(w);
      case 'ends_with': return v.endsWith(w);
    }
    return false;
  }

  if (field.type === 'number') {
    if (typeof raw !== 'number') return false;
    const a = Number(rule.value);
    const b = Number(rule.value2);
    switch (rule.op) {
      case 'eq': return raw === a;
      case 'neq': return raw !== a;
      case 'gt': return raw > a;
      case 'gte': return raw >= a;
      case 'lt': return raw < a;
      case 'lte': return raw <= a;
      case 'between': return raw >= Math.min(a, b) && raw <= Math.max(a, b);
    }
    return false;
  }

  if (field.type === 'date') {
    if (typeof raw !== 'number') return false;
    const day = 86_400_000;
    switch (rule.op) {
      case 'in_last_days': return raw >= now - Number(rule.value) * day && raw <= now;
      case 'older_than_days': return raw < now - Number(rule.value) * day;
      case 'on': {
        const t = parseDay(rule.value);
        return !Number.isNaN(t) && startOfDay(raw) === t;
      }
      case 'before': {
        const t = parseDay(rule.value);
        return !Number.isNaN(t) && raw < t;
      }
      case 'after': {
        const t = parseDay(rule.value);
        if (Number.isNaN(t)) return false;
        const next = new Date(t);
        next.setDate(next.getDate() + 1);
        return raw >= next.getTime();
      }
    }
    return false;
  }

  if (field.type === 'choice') {
    const v = String(raw ?? '');
    const chosen = rule.values ?? [];
    if (rule.op === 'is_any_of') return chosen.includes(v);
    if (rule.op === 'is_none_of') return !chosen.includes(v);
    return false;
  }

  // list
  const items = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const chosen = rule.values ?? [];
  if (rule.op === 'has_any') return chosen.some((c) => items.includes(c));
  if (rule.op === 'has_all') return chosen.every((c) => items.includes(c));
  if (rule.op === 'has_none') return !chosen.some((c) => items.includes(c));
  return false;
}

/** The rules that currently filter: complete ones, plus the switched-on quick filter. */
export function activeRules<T>(view: View, fields: Field<T>[], quick: QuickFilter[] = []): { user: Rule[]; quick: Rule[] } {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const user = view.rules.filter((r) => {
    const f = byKey.get(r.field);
    return !!f && ruleIsComplete(r, f.type);
  });
  const preset = quick.find((q) => q.id === view.quick);
  const quickRules = preset ? preset.rules.map((r, i) => ({ ...r, id: `${preset.id}-${i}` })) : [];
  return { user, quick: quickRules };
}

/** Does the row contain the search text anywhere in its cells? */
export function matchesSearch<T>(row: T, fields: Field<T>[], search: string): boolean {
  const q = norm(search);
  if (!q) return true;
  return fields.some((f) => {
    const t = f.text ? f.text(row) : textOf(f.value(row));
    return norm(t).includes(q);
  });
}

function textOf(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function compareCells(a: Cell, b: Cell, type: FieldType): number {
  const aEmpty = isEmptyCell(a);
  const bEmpty = isEmptyCell(b);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // empty values always go last, whichever way it is sorted
  if (bEmpty) return -1;
  if (type === 'number' || type === 'date') return (a as number) - (b as number);
  if (type === 'list') return (a as string[]).length - (b as string[]).length || textOf(a).localeCompare(textOf(b));
  return textOf(a).localeCompare(textOf(b), undefined, { sensitivity: 'base', numeric: true });
}

/** Filters, searches and sorts the rows for a view. The original array is left alone. */
export function applyView<T>(rows: T[], fields: Field<T>[], view: View, quick: QuickFilter[] = [], now: number = Date.now()): T[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const { user, quick: preset } = activeRules(view, fields, quick);

  const passes = (row: T) => {
    if (!matchesSearch(row, fields, view.search)) return false;
    const test = (r: Rule) => matchRule(row, r, byKey.get(r.field) as Field<T>, now);
    if (preset.length > 0 && !preset.every(test)) return false;
    if (user.length === 0) return true;
    return view.match === 'ANY' ? user.some(test) : user.every(test);
  };

  const kept = rows.filter(passes);
  const levels = view.sorts.filter((s) => byKey.has(s.field));
  if (levels.length === 0) return kept;
  return kept
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      for (const level of levels) {
        const f = byKey.get(level.field) as Field<T>;
        const a = f.value(x.row);
        const b = f.value(y.row);
        const c = compareCells(a, b, f.type);
        const emptyCase = isEmptyCell(a) || isEmptyCell(b);
        if (c !== 0) return level.dir === 'asc' || emptyCase ? c : -c;
      }
      return x.index - y.index; // stable
    })
    .map((x) => x.row);
}

export interface RowGroup<T> {
  key: string;
  label: string;
  rows: T[];
}

/** Splits already filtered and sorted rows into sections by a field. A list field puts a row under each of its items. */
export function groupRows<T>(rows: T[], fields: Field<T>[], groupBy: string | null): RowGroup<T>[] {
  const field = fields.find((f) => f.key === groupBy);
  if (!field) return [{ key: '', label: '', rows }];
  const sections = new Map<string, T[]>();
  const empty = '(none)';
  rows.forEach((row) => {
    const raw = field.value(row);
    const keys = Array.isArray(raw) ? (raw.length ? raw : [empty]) : [isEmptyCell(raw) ? empty : field.text ? field.text(row) : textOf(raw)];
    keys.forEach((k) => {
      if (!sections.has(k)) sections.set(k, []);
      sections.get(k)!.push(row);
    });
  });
  return [...sections.entries()]
    .sort(([a], [b]) => (a === empty ? 1 : b === empty ? -1 : a.localeCompare(b, undefined, { numeric: true })))
    .map(([key, list]) => ({ key, label: key, rows: list }));
}

/** The choices to offer for a choice or list field, with how many rows have each. */
export function optionsFor<T>(field: Field<T>, rows: T[]): ChoiceOption[] {
  if (field.options) return field.options(rows);
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const raw = field.value(row);
    const items = Array.isArray(raw) ? raw : isEmptyCell(raw) ? [] : [String(raw)];
    items.forEach((i) => counts.set(i, (counts.get(i) ?? 0) + 1));
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([value, count]) => ({ value, label: value, count }));
}

/** A rule in words, for the pills above the table. */
export function describeRule<T>(rule: Rule, field: Field<T>, rows: T[] = []): string {
  const info = operatorInfo(field.type, rule.op);
  const opText = info?.label ?? rule.op;
  if (!info || info.needs === 'none') return `${field.label} ${opText}`;
  if (info.needs === 'two') return `${field.label} ${opText} ${rule.value} and ${rule.value2}`;
  if (info.needs === 'many') {
    const labels = new Map(optionsFor(field, rows).map((o) => [o.value, o.label]));
    const picked = (rule.values ?? []).map((v) => labels.get(v) ?? v);
    return `${field.label} ${opText} ${picked.length > 3 ? picked.slice(0, 3).join(', ') + ` +${picked.length - 3}` : picked.join(', ')}`;
  }
  return `${field.label} ${opText} ${rule.value}`;
}

/** The view a list starts with. */
export function defaultView<T>(fields: Field<T>[], sortBy?: SortLevel): View {
  return {
    search: '',
    match: 'ALL',
    rules: [],
    sorts: sortBy ? [sortBy] : [],
    columns: fields.filter((f) => f.fixed || f.initial).map((f) => f.key),
    groupBy: null,
    quick: null,
  };
}

/** Keeps a saved view usable after fields were added or removed: unknown fields drop out, fixed ones come back. */
export function repairView<T>(view: View, fields: Field<T>[]): View {
  const known = new Set(fields.map((f) => f.key));
  const columns = view.columns.filter((c) => known.has(c));
  fields.forEach((f) => f.fixed && !columns.includes(f.key) && columns.unshift(f.key));
  return {
    ...view,
    columns,
    rules: view.rules.filter((r) => known.has(r.field)),
    sorts: view.sorts.filter((s) => known.has(s.field)),
    groupBy: view.groupBy && known.has(view.groupBy) ? view.groupBy : null,
  };
}

const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The rows as CSV text with the shown columns. Cells that start with = + - @ get a quote in front so a spreadsheet never runs them. */
export function toCsv<T>(rows: T[], fields: Field<T>[], columns: string[]): string {
  const shown = columns.map((k) => fields.find((f) => f.key === k)).filter((f): f is Field<T> => !!f);
  const safe = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
  const lines = [shown.map((f) => csvCell(f.label)).join(',')];
  rows.forEach((row) => lines.push(shown.map((f) => csvCell(safe(f.text ? f.text(row) : textOf(f.value(row))))).join(',')));
  return lines.join('\r\n');
}
