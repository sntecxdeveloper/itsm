import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyView,
  defaultView,
  describeRule,
  groupRows,
  matchRule,
  operatorsFor,
  optionsFor,
  repairView,
  ruleIsComplete,
  toCsv,
  type Field,
  type QuickFilter,
  type Rule,
  type View,
} from '../src/utils/listView.ts';

interface Row {
  name: string;
  region: string | null;
  devices: number | null;
  seen: number | null;
  kind: string;
  hides: string[];
}

const DAY = 86_400_000;
// local noon, so the calendar-date tests give the same answer in every time zone
const NOW = new Date(2026, 9, 3, 12, 0, 0).getTime();

const rows: Row[] = [
  { name: 'Finance', region: 'South', devices: 12, seen: NOW - 2 * DAY, kind: 'Department', hides: ['logs', 'software'] },
  { name: 'operations', region: 'North', devices: 3, seen: NOW - 40 * DAY, kind: 'Department', hides: [] },
  { name: 'Support', region: null, devices: null, seen: null, kind: 'Team', hides: ['logs'] },
  { name: 'Chennai Site', region: 'South', devices: 30, seen: NOW - 1 * DAY, kind: 'Site', hides: ['chat'] },
];

const fields: Field<Row>[] = [
  { key: 'name', label: 'Name', type: 'text', value: (r) => r.name, fixed: true },
  { key: 'region', label: 'Region', type: 'text', value: (r) => r.region, initial: true },
  { key: 'devices', label: 'Devices', type: 'number', value: (r) => r.devices, initial: true },
  { key: 'seen', label: 'Seen', type: 'date', value: (r) => r.seen },
  { key: 'kind', label: 'Kind', type: 'choice', value: (r) => r.kind, groupable: true },
  { key: 'hides', label: 'Hides', type: 'list', value: (r) => r.hides },
];

const rule = (field: string, op: string, extra: Partial<Rule> = {}): Rule => ({ id: field + op, field, op, value: '', ...extra });
const view = (patch: Partial<View> = {}): View => ({ ...defaultView(fields), ...patch });
const names = (list: Row[]) => list.map((r) => r.name);

// ── conditions ─────────────────────────────────────────────────────────────────────

test('text conditions ignore case and treat empty properly', () => {
  const run = (op: string, value = '') => names(applyView(rows, fields, view({ rules: [rule('region', op, { value })] }), [], NOW));
  assert.deepEqual(run('contains', 'SOU'), ['Finance', 'Chennai Site']);
  assert.deepEqual(run('is', 'north'), ['operations']);
  assert.deepEqual(run('is_not', 'south'), ['operations', 'Support']);
  assert.deepEqual(run('starts_with', 'no'), ['operations']);
  assert.deepEqual(run('ends_with', 'th'), ['Finance', 'operations', 'Chennai Site']);
  assert.deepEqual(run('is_empty'), ['Support']);
  assert.deepEqual(run('is_not_empty'), ['Finance', 'operations', 'Chennai Site']);
});

test('number conditions never match a row with no number', () => {
  const run = (op: string, value: string, value2?: string) =>
    names(applyView(rows, fields, view({ rules: [rule('devices', op, { value, value2 })] }), [], NOW));
  assert.deepEqual(run('gt', '10'), ['Finance', 'Chennai Site']);
  assert.deepEqual(run('lte', '3'), ['operations']);
  assert.deepEqual(run('between', '5', '20'), ['Finance']);
  assert.deepEqual(run('between', '20', '5'), ['Finance'], 'the order of the two numbers does not matter');
  assert.deepEqual(run('neq', '12'), ['operations', 'Chennai Site'], 'a row with no number is not "not 12"');
  assert.deepEqual(names(applyView(rows, fields, view({ rules: [rule('devices', 'is_empty')] }), [], NOW)), ['Support']);
});

test('date conditions use days and calendar dates', () => {
  const run = (op: string, value: string) => names(applyView(rows, fields, view({ rules: [rule('seen', op, { value })] }), [], NOW));
  assert.deepEqual(run('in_last_days', '7'), ['Finance', 'Chennai Site']);
  assert.deepEqual(run('older_than_days', '30'), ['operations']);
  assert.deepEqual(run('before', '2026-09-01'), ['operations']);
  assert.deepEqual(run('after', '2026-10-01'), ['Chennai Site'], 'strictly after that day');
  assert.deepEqual(run('after', '2026-09-30'), ['Finance', 'Chennai Site']);
  assert.deepEqual(run('on', '2026-10-02'), ['Chennai Site']);
  assert.equal(run('on', 'not a date').length, 4, 'not a date yet: the rule is unfinished, so it filters nothing');
  assert.equal(run('on', '2026-02-31').length, 4, 'a day that does not exist counts as unfinished too');
  assert.equal(matchRule(rows[0], rule('seen', 'on', { value: '2026-02-31' }), fields[3], NOW), false, 'and never matches if forced');
  assert.equal(ruleIsComplete(rule('seen', 'on', { value: 'soon' }), 'date'), false);
  assert.equal(ruleIsComplete(rule('seen', 'in_last_days', { value: '7' }), 'date'), true);
});

test('choice and list conditions', () => {
  const choice = (op: string, values: string[]) => names(applyView(rows, fields, view({ rules: [rule('kind', op, { values })] }), [], NOW));
  assert.deepEqual(choice('is_any_of', ['Team', 'Site']), ['Support', 'Chennai Site']);
  assert.deepEqual(choice('is_none_of', ['Department']), ['Support', 'Chennai Site']);
  const list = (op: string, values: string[]) => names(applyView(rows, fields, view({ rules: [rule('hides', op, { values })] }), [], NOW));
  assert.deepEqual(list('has_any', ['logs', 'chat']), ['Finance', 'Support', 'Chennai Site']);
  assert.deepEqual(list('has_all', ['logs', 'software']), ['Finance']);
  assert.deepEqual(list('has_none', ['logs']), ['operations', 'Chennai Site']);
  assert.deepEqual(list('is_empty', []), ['operations']);
});

test('all versus any, and unfinished rules do nothing', () => {
  const both = [rule('region', 'is', { value: 'south' }), rule('devices', 'gt', { value: '20' })];
  assert.deepEqual(names(applyView(rows, fields, view({ rules: both, match: 'ALL' }), [], NOW)), ['Chennai Site']);
  assert.deepEqual(names(applyView(rows, fields, view({ rules: both, match: 'ANY' }), [], NOW)), ['Finance', 'Chennai Site']);
  assert.equal(applyView(rows, fields, view({ rules: [rule('region', 'contains')] }), [], NOW).length, 4, 'no text typed yet: nothing is filtered');
  assert.equal(applyView(rows, fields, view({ rules: [rule('devices', 'gt', { value: 'abc' })] }), [], NOW).length, 4, 'not a number: ignored');
  assert.equal(applyView(rows, fields, view({ rules: [rule('kind', 'is_any_of', { values: [] })] }), [], NOW).length, 4);
  assert.equal(applyView(rows, fields, view({ rules: [rule('gone', 'is', { value: 'x' })] }), [], NOW).length, 4, 'a field that no longer exists is ignored');
});

test('matchRule on its own', () => {
  assert.equal(matchRule(rows[0], rule('devices', 'eq', { value: '12' }), fields[2], NOW), true);
  assert.equal(matchRule(rows[2], rule('devices', 'eq', { value: '12' }), fields[2], NOW), false);
});

test('ruleIsComplete knows what each condition needs', () => {
  assert.equal(ruleIsComplete(rule('region', 'is_empty'), 'text'), true);
  assert.equal(ruleIsComplete(rule('region', 'is'), 'text'), false);
  assert.equal(ruleIsComplete(rule('devices', 'between', { value: '1' }), 'number'), false);
  assert.equal(ruleIsComplete(rule('devices', 'between', { value: '1', value2: '9' }), 'number'), true);
  assert.equal(ruleIsComplete(rule('kind', 'is_any_of', { values: ['x'] }), 'choice'), true);
  assert.equal(ruleIsComplete(rule('kind', 'nope'), 'choice'), false);
});

// ── search, quick filters ──────────────────────────────────────────────────────────

test('search looks in every cell, shown or not', () => {
  assert.deepEqual(names(applyView(rows, fields, view({ search: 'north' }), [], NOW)), ['operations']);
  assert.deepEqual(names(applyView(rows, fields, view({ search: 'department' }), [], NOW)), ['Finance', 'operations']);
  assert.deepEqual(names(applyView(rows, fields, view({ search: 'software' }), [], NOW)), ['Finance'], 'list cells are searched too');
});

test('a quick filter combines with the rules the person added', () => {
  const quick: QuickFilter[] = [{ id: 'south', label: 'South', rules: [{ field: 'region', op: 'is', value: 'south' }] }];
  assert.deepEqual(names(applyView(rows, fields, view({ quick: 'south' }), quick, NOW)), ['Finance', 'Chennai Site']);
  const more = view({ quick: 'south', rules: [rule('devices', 'gt', { value: '20' })] });
  assert.deepEqual(names(applyView(rows, fields, more, quick, NOW)), ['Chennai Site']);
  assert.equal(applyView(rows, fields, view({ quick: 'unknown' }), quick, NOW).length, 4);
});

// ── sorting ────────────────────────────────────────────────────────────────────────

test('sorting is case-insensitive, multi-level, stable, and empty values go last either way', () => {
  const sorted = (sorts: View['sorts']) => names(applyView(rows, fields, view({ sorts }), [], NOW));
  assert.deepEqual(sorted([{ field: 'name', dir: 'asc' }]), ['Chennai Site', 'Finance', 'operations', 'Support']);
  assert.deepEqual(sorted([{ field: 'name', dir: 'desc' }]), ['Support', 'operations', 'Finance', 'Chennai Site']);
  assert.deepEqual(sorted([{ field: 'devices', dir: 'asc' }]), ['operations', 'Finance', 'Chennai Site', 'Support']);
  assert.deepEqual(sorted([{ field: 'devices', dir: 'desc' }]), ['Chennai Site', 'Finance', 'operations', 'Support']);
  assert.deepEqual(sorted([{ field: 'region', dir: 'asc' }, { field: 'devices', dir: 'desc' }]), ['operations', 'Chennai Site', 'Finance', 'Support']);
  assert.deepEqual(sorted([]), ['Finance', 'operations', 'Support', 'Chennai Site'], 'no sort keeps the order given');
  assert.deepEqual(names(rows), ['Finance', 'operations', 'Support', 'Chennai Site'], 'the original list is not touched');
});

// ── grouping, options, words ───────────────────────────────────────────────────────

test('grouping makes sections, a list field puts a row under each item, and empties go last', () => {
  const byKind = groupRows(rows, fields, 'kind');
  assert.deepEqual(byKind.map((g) => [g.label, g.rows.length]), [['Department', 2], ['Site', 1], ['Team', 1]]);
  const byHides = groupRows(rows, fields, 'hides');
  assert.deepEqual(byHides.map((g) => [g.label, g.rows.length]), [['chat', 1], ['logs', 2], ['software', 1], ['(none)', 1]]);
  assert.equal(groupRows(rows, fields, null).length, 1);
  assert.equal(groupRows(rows, fields, 'nope')[0].rows.length, 4);
});

test('options are worked out from the rows with counts', () => {
  assert.deepEqual(optionsFor(fields[4], rows).map((o) => [o.value, o.count]), [['Department', 2], ['Site', 1], ['Team', 1]]);
  assert.deepEqual(optionsFor(fields[5], rows).map((o) => [o.value, o.count]), [['chat', 1], ['logs', 2], ['software', 1]]);
});

test('a rule is described in words', () => {
  assert.equal(describeRule(rule('region', 'contains', { value: 'so' }), fields[1]), 'Region contains so');
  assert.equal(describeRule(rule('region', 'is_empty'), fields[1]), 'Region is empty');
  assert.equal(describeRule(rule('devices', 'between', { value: '1', value2: '9' }), fields[2]), 'Devices is between 1 and 9');
  assert.equal(describeRule(rule('hides', 'has_any', { values: ['a', 'b', 'c', 'd', 'e'] }), fields[5], rows), 'Hides includes any of a, b, c +2');
});

test('operators exist for every kind of field', () => {
  (['text', 'number', 'date', 'choice', 'list'] as const).forEach((t) => assert.ok(operatorsFor(t).length >= 4, t));
});

// ── views and export ───────────────────────────────────────────────────────────────

test('a fresh view shows the fixed and initial columns; a saved one is repaired when fields change', () => {
  assert.deepEqual(defaultView(fields).columns, ['name', 'region', 'devices']);
  const old: View = view({ columns: ['region', 'gone', 'devices'], rules: [rule('gone', 'is', { value: 'x' })], groupBy: 'gone', sorts: [{ field: 'gone', dir: 'asc' }] });
  const fixed = repairView(old, fields);
  assert.deepEqual(fixed.columns, ['name', 'region', 'devices'], 'the fixed column comes back, unknown ones go');
  assert.equal(fixed.rules.length, 0);
  assert.equal(fixed.groupBy, null);
  assert.equal(fixed.sorts.length, 0);
});

test('CSV has the shown columns, quotes where needed, and defuses spreadsheet formulas', () => {
  const tricky: Row[] = [{ name: '=SUM(A1)', region: 'a, "b"', devices: 5, seen: null, kind: 'Team', hides: ['x', 'y'] }];
  const csv = toCsv(tricky, fields, ['name', 'region', 'hides', 'devices']);
  assert.equal(csv, 'Name,Region,Hides,Devices\r\n\'=SUM(A1),"a, ""b""","x, y"' + ',5');
  assert.equal(toCsv([], fields, ['name', 'ghost']).split('\r\n')[0], 'Name');
});
