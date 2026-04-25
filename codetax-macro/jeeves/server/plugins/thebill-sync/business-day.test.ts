import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBusinessDay, adjustToBusinessDay, addBusinessDays } from './business-day';

test('isBusinessDay returns false for Saturday', () => {
  // 2026-04-25 is a Saturday
  assert.equal(isBusinessDay(new Date('2026-04-25')), false);
});

test('isBusinessDay returns false for Sunday', () => {
  // 2026-04-26 is a Sunday
  assert.equal(isBusinessDay(new Date('2026-04-26')), false);
});

test('isBusinessDay returns false for holiday', () => {
  assert.equal(isBusinessDay(new Date('2026-05-05')), false);
});

test('isBusinessDay returns true for weekday non-holiday', () => {
  // 2026-04-27 Monday
  assert.equal(isBusinessDay(new Date('2026-04-27')), true);
});

test('adjustToBusinessDay backward from Saturday returns Friday', () => {
  // 2026-04-25 Sat -> 2026-04-24 Fri
  const result = adjustToBusinessDay(new Date('2026-04-25'), 'backward');
  assert.equal(result.toISOString().slice(0, 10), '2026-04-24');
});

test('adjustToBusinessDay forward from Sunday returns Monday', () => {
  // 2026-04-26 Sun -> 2026-04-27 Mon
  const result = adjustToBusinessDay(new Date('2026-04-26'), 'forward');
  assert.equal(result.toISOString().slice(0, 10), '2026-04-27');
});

test('addBusinessDays 8 days from 2026-04-26 (Sun) skips weekends', () => {
  // 시작: 2026-04-26 Sun (자체가 영업일 아님)
  // 영업일 8개 더하기 → 4/27 Mon=1, 4/28=2, 4/29=3, 4/30=4, 5/1=5, 5/4=6 (5/5 어린이날 skip), 5/6=7, 5/7=8
  const result = addBusinessDays(new Date('2026-04-26'), 8);
  assert.equal(result.toISOString().slice(0, 10), '2026-05-07');
});

test('adjustToBusinessDay returns same date if already business day', () => {
  const d = new Date('2026-04-27'); // Monday
  const result = adjustToBusinessDay(d, 'backward');
  assert.equal(result.toISOString().slice(0, 10), '2026-04-27');
});
