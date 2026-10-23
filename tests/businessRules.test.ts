import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_FACTS, evaluateRules, ruleProblem, blankRule, type BusinessRule } from '../src/utils/businessRules.ts';

const rule = (over: Partial<BusinessRule>): BusinessRule => ({ ...blankRule(), name: 'r', ...over });
const facts = (over: Record<string, string>) => ({ ...NO_FACTS, ...over });

test('a matching rule assigns the group', () => {
  const r = rule({
    conditions: [{ id: 'c', field: 'category', op: 'is', value: 'software' }],
    actions: [{ id: 'a', type: 'ASSIGN_GROUP', value: '7', label: 'Software' }],
  });
  const out = evaluateRules([r], facts({ category: 'Software' }));
  assert.equal(out.assignmentGroupId, 7);
  assert.equal(out.assignmentGroupName, 'Software');
  assert.equal(evaluateRules([r], facts({ category: 'Hardware' })).matched.length, 0);
});

test('all vs any, and disabled rules do not run', () => {
  const conditions = [
    { id: '1', field: 'impact' as const, op: 'is' as const, value: '1 - High' },
    { id: '2', field: 'urgency' as const, op: 'is' as const, value: '1 - High' },
  ];
  const actions = [{ id: 'a', type: 'SET_PRIORITY' as const, value: 'CRITICAL' }];
  const f = facts({ impact: '1 - High', urgency: '3 - Low' });
  assert.equal(evaluateRules([rule({ conditions, actions, match: 'all' })], f).priority, undefined);
  assert.equal(evaluateRules([rule({ conditions, actions, match: 'any' })], f).priority, 'CRITICAL');
  assert.equal(evaluateRules([rule({ conditions, actions, match: 'any', enabled: false })], f).matched.length, 0);
});

test('later rules override earlier ones, and stop ends the run', () => {
  const a = rule({ conditions: [], actions: [{ id: 'x', type: 'ASSIGN_GROUP', value: '1', label: 'A' }] });
  const b = rule({ conditions: [], actions: [{ id: 'y', type: 'ASSIGN_GROUP', value: '2', label: 'B' }] });
  assert.equal(evaluateRules([a, b], facts({})).assignmentGroupId, 2);
  assert.equal(evaluateRules([{ ...a, stop: true }, b], facts({})).assignmentGroupId, 1);
});

test('contains, empty checks and the validation messages', () => {
  const r = rule({
    conditions: [{ id: 'c', field: 'shortDescription', op: 'contains', value: 'OUTLOOK' }, { id: 'd', field: 'subcategory', op: 'isEmpty', value: '' }],
    actions: [{ id: 'a', type: 'EMAIL_GROUP', value: '3', label: 'Mail' }],
  });
  const out = evaluateRules([r], facts({ shortDescription: 'my outlook is down' }));
  assert.deepEqual(out.emailGroups, [{ id: 3, name: 'Mail' }]);
  assert.match(ruleProblem(blankRule()) ?? '', /name/);
  assert.match(ruleProblem({ ...blankRule(), name: 'x' }) ?? '', /value/);
});
