import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_FACTS } from '../src/utils/businessRules.ts';
import { addBusinessMinutes, applicableSlas, blankSla, dueAt, durationLabel, samplePolicy, slaProblem, targetMinutes } from '../src/utils/sla.ts';

// local-time dates: 2026-10-05 is a Monday
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

test('duration labels read naturally', () => {
  assert.equal(durationLabel(1, 'hours'), '1 Hour');
  assert.equal(durationLabel(15, 'minutes'), '15 Minutes');
  assert.equal(durationLabel(2, 'days'), '2 Days');
});

test('24x7 targets just add the time', () => {
  const s = { ...blankSla(), amount: 4, unit: 'hours' as const, schedule: '24x7' as const };
  assert.equal(dueAt(s, at(5, 22)).getTime(), at(6, 2).getTime());
});

test('business hours skip nights and weekends', () => {
  // Monday 17:00 + 2 working hours = Tuesday 10:00
  assert.equal(addBusinessMinutes(at(5, 17), 120).getTime(), at(6, 10).getTime());
  // Friday 16:00 + 4 working hours = Monday 11:00
  assert.equal(addBusinessMinutes(at(9, 16), 240).getTime(), at(12, 11).getTime());
  // Saturday morning starts counting Monday 09:00
  assert.equal(addBusinessMinutes(at(10, 8), 60).getTime(), at(12, 10).getTime());
  // inside business hours, no skipping
  assert.equal(addBusinessMinutes(at(5, 10), 30).getTime(), at(5, 10, 30).getTime());
});

test('a business day is nine working hours', () => {
  assert.equal(targetMinutes({ amount: 2, unit: 'days', schedule: 'business' }), 2 * 9 * 60);
  assert.equal(targetMinutes({ amount: 2, unit: 'days', schedule: '24x7' }), 2 * 24 * 60);
});

test('the sample policy picks one response and one resolution per priority', () => {
  const policy = samplePolicy();
  assert.equal(policy.length, 8);
  const high = applicableSlas(policy, { ...NO_FACTS, priority: '2 - High' });
  assert.deepEqual(high.map((s) => s.target).sort(), ['Resolution', 'Response']);
  assert.equal(applicableSlas(policy, { ...NO_FACTS, priority: '' }).length, 0);
  assert.equal(slaProblem(blankSla()) ?? '', 'Give the definition a name.');
});
