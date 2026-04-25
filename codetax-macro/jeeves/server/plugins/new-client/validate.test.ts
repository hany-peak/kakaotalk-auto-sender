import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInput } from './validate';

const BASE = {
  companyName: '테스트업체',
  businessScope: '기장',
  entityType: '개인',
  representative: '홍길동',
  startDate: '2026-04-23',
  industry: '제조업',
  bookkeepingFee: 100000,
  adjustmentFee: 0,
  inflowRoute: '소개1',
  transferStatus: '신규',
  bizRegStatus: '기존',
};

test('validateInput accepts valid 개인 entityType', () => {
  const r = validateInput(BASE);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.entityType, '개인');
});

test('validateInput accepts 법인 entityType', () => {
  const r = validateInput({ ...BASE, entityType: '법인' });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.entityType, '법인');
});

test('validateInput rejects missing entityType', () => {
  const { entityType: _, ...rest } = BASE;
  const r = validateInput(rest);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /entityType/);
});

test('validateInput rejects invalid entityType', () => {
  const r = validateInput({ ...BASE, entityType: '공공기관' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /entityType/);
});
