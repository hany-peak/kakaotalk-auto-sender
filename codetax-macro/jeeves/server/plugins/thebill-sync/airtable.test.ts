import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideStatus } from './airtable';

test('decideStatus: success → 출금성공 (mode 무관)', () => {
  assert.equal(decideStatus('success', 'withdrawal'), '출금성공');
  assert.equal(decideStatus('success', 'reWithdrawal'), '출금성공');
});

test('decideStatus: failure → 출금실패 (mode 무관)', () => {
  assert.equal(decideStatus('failure', 'withdrawal'), '출금실패');
  assert.equal(decideStatus('failure', 'reWithdrawal'), '출금실패');
});

test('decideStatus: unknown → 출금실패 (진행 중 row 도 일단 미수 처리)', () => {
  assert.equal(decideStatus('unknown', 'withdrawal'), '출금실패');
  assert.equal(decideStatus('unknown', 'reWithdrawal'), '출금실패');
});
