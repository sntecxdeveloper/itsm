import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCategories, parseReference } from '../src/setup/utils/parseReference.ts';

const cats = [
  ['Category', 'Subcategory', 'Item', 'Assignment group'],
  ['Software', 'Outlook', 'Not opening', 'Service Desk'],
  ['Software', 'Outlook', 'Not syncing', 'Service Desk'],
  ['Software', 'Teams', 'No audio', 'Service Desk'],
  ['software', 'Teams', 'no audio', 'Service Desk'], // the same item again, other case
  ['Network', 'VPN', 'Down', 'Network Team'],
  ['Network', 'Wi-Fi', 'Weak', 'Service Desk'],
  ['Hardware', '', '', ''],
];

test('rows become categories, subcategories and items, without repeats', () => {
  const plan = parseReference({ Categories: cats }, ['Service Desk', 'Network Team']);
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(plan.categories.map((c) => c.name), ['Software', 'Network', 'Hardware']);
  const software = plan.categories[0];
  assert.deepEqual(software.subcategories.map((s) => [s.name, s.items]), [['Outlook', ['Not opening', 'Not syncing']], ['Teams', ['No audio']]]);
  assert.equal(software.group, 'Service Desk', 'a group every row agrees on is the category group');
  assert.equal(software.subcategories[0].group, null, 'and its subcategories inherit it');
  const network = plan.categories[1];
  assert.equal(network.group, null, 'rows that disagree leave the category without a group');
  assert.deepEqual(network.subcategories.map((s) => s.group), ['Network Team', 'Service Desk']);
  assert.deepEqual(plan.categories[2].subcategories, []);
  assert.equal(plan.hasCategories, true);
});

test('headings are matched by name, in any order and case', () => {
  const plan = parseReference({ categories: [['ITEM', 'subcategory', 'CATEGORY'], ['Slow', 'Wi-Fi', 'Network']] });
  assert.deepEqual(plan.categories[0].subcategories[0].items, ['Slow']);
});

test('problems stop the import: missing columns, an item without a subcategory, a half priority row, no known sheet', () => {
  assert.match(parseReference({ Categories: [['Name'], ['x']] }).problems[0], /needs the column "category"/);
  assert.match(parseReference({ Categories: [['Category', 'Subcategory', 'Item'], ['A', '', 'x']] }).problems[0], /Item but no Subcategory/);
  assert.match(parseReference({ Priority: [['Impact', 'Urgency', 'Priority'], ['1 - High', '', '1 - Critical']] }).problems[0], /all needed/);
  assert.match(parseReference({ Other: [['a']] }).problems[0], /none of the sheets/);
});

test('priority, groups and technicians are read, and unknown groups are warned about', () => {
  const plan = parseReference(
    {
      Priority: [['Impact', 'Urgency', 'Priority'], ['1 - High', '1 - High', '1 - Critical']],
      'Assignment groups': [['Group', 'Description'], ['Service Desk', 'First line']],
      Technicians: [['Username', 'Assignment groups'], ['asha', 'Service Desk, Network Team']],
      Categories: [['Category', 'Subcategory', 'Item', 'Assignment group'], ['A', 'B', 'c', 'Ghost']],
    },
    [],
  );
  assert.deepEqual(plan.priority, [{ impact: '1 - High', urgency: '1 - High', priority: '1 - Critical' }]);
  assert.deepEqual(plan.groups, [{ name: 'Service Desk', description: 'First line' }]);
  assert.deepEqual(plan.technicians, [{ username: 'asha', groups: ['Service Desk', 'Network Team'] }]);
  assert.match(plan.warnings[0], /Ghost.*Network Team|Network Team.*Ghost/);
  assert.equal(parseReference({ Priority: [['Impact', 'Urgency', 'Priority']] }, []).priority, null, 'an empty Priority sheet changes nothing');
  assert.equal(parseReference({ 'Assignment groups': [['Group']] }).hasCategories, false);
});

test('adding merges by name and keeps what was there', () => {
  const current = [{ name: 'Software', group: 'A', subcategories: [{ name: 'Outlook', group: null, items: ['x'] }] }];
  const merged = mergeCategories(current, [
    { name: 'software', group: 'B', subcategories: [{ name: 'OUTLOOK', group: null, items: ['X', 'y'] }, { name: 'Teams', group: null, items: [] }] },
    { name: 'Network', group: null, subcategories: [] },
  ]);
  assert.deepEqual(merged.map((c) => c.name), ['Software', 'Network']);
  assert.equal(merged[0].group, 'B');
  assert.deepEqual(merged[0].subcategories.map((s) => [s.name, s.items]), [['Outlook', ['x', 'y']], ['Teams', []]]);
  assert.equal(current[0].group, 'A', 'the saved list is not changed in place');
});
