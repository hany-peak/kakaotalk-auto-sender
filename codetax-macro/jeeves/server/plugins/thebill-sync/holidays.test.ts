import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHoliday } from './holidays';

test('isHoliday returns true for 신정 2026-01-01', () => {
  assert.equal(isHoliday(new Date('2026-01-01')), true);
});

test('isHoliday returns true for 어린이날 2026-05-05', () => {
  assert.equal(isHoliday(new Date('2026-05-05')), true);
});

test('isHoliday returns false for 평일 2026-04-25', () => {
  assert.equal(isHoliday(new Date('2026-04-25')), false);
});

test('isHoliday handles year not in dataset by returning false', () => {
  assert.equal(isHoliday(new Date('2099-01-01')), false);
});
