import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideStatus } from './airtable';

test('decideStatus withdrawal mode: success → 출금성공', () => {
  assert.equal(decideStatus('success', 'withdrawal'), '출금성공');
});

test('decideStatus withdrawal mode: failure → 자동재출금', () => {
  assert.equal(decideStatus('failure', 'withdrawal'), '자동재출금');
});

test('decideStatus reWithdrawal mode: success → 출금성공', () => {
  assert.equal(decideStatus('success', 'reWithdrawal'), '출금성공');
});

test('decideStatus reWithdrawal mode: failure → 출금실패', () => {
  assert.equal(decideStatus('failure', 'reWithdrawal'), '출금실패');
});

test('decideStatus unknown returns null (skip update)', () => {
  assert.equal(decideStatus('unknown', 'withdrawal'), null);
  assert.equal(decideStatus('unknown', 'reWithdrawal'), null);
});
