import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previousMonthView, formatYearMonth } from './airtable';

test('previousMonthView returns the previous-month view name', () => {
  assert.equal(previousMonthView(new Date('2026-05-10')), '[4월] 세금계산서 및 입금현황');
});

test('previousMonthView wraps January to December', () => {
  assert.equal(previousMonthView(new Date('2026-01-10')), '[12월] 세금계산서 및 입금현황');
});

test('formatYearMonth returns previous month YYYY-MM', () => {
  assert.equal(formatYearMonth(new Date('2026-05-10')), '2026-04');
  assert.equal(formatYearMonth(new Date('2026-01-10')), '2025-12');
});
