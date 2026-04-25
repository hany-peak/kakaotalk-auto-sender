import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, formatAmount } from './message';

test('formatAmount inserts thousand separators', () => {
  assert.equal(formatAmount(110000), '110,000');
  assert.equal(formatAmount(88000), '88,000');
});

test('buildMessage substitutes month, amount, and bank account', () => {
  const msg = buildMessage(
    { recordId: 'r1', name: 'ABC세무', bizNo: '1234567890', amount: 110000 },
    { yearMonth: '2026-04', bankAccount: '카카오뱅크 / 3333367093297' },
  );

  assert.match(msg, /04월 기장료 110,000원/);
  assert.match(msg, /카카오뱅크 \/ 3333367093297/);
  assert.match(msg, /안녕하세요 대표님/);
});

test('buildMessage handles single-digit month with zero pad', () => {
  const msg = buildMessage(
    { recordId: 'r1', name: 'XYZ', bizNo: '111', amount: 50000 },
    { yearMonth: '2026-03', bankAccount: '카카오뱅크 / 1' },
  );
  assert.match(msg, /03월 기장료 50,000원/);
});
