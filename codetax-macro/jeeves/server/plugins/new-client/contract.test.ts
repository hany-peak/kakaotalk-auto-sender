import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInputSheetValues, missingRequired } from './contract';
import type { NewClientRecord } from './types';

const baseIndividual: NewClientRecord = {
  id: 'rec1',
  airtableRecordId: 'rec1',
  createdAt: '2026-04-25',
  companyName: '홍길동상점',
  representative: '홍길동',
  startDate: '2026-04-01',
  businessScope: '기장',
  entityType: '개인',
  checklist: {},
  bizRegNumber: '123-45-67890',
  openDate: '2020-01-15',
  bizAddress: '서울시 강남구',
  bizPhone: '010-1234-5678',
  bankName: '국민은행',
  accountNumber: '123-456-789',
  bookkeepingFee: 100000,
};

test('buildInputSheetValues: 개인 — C4/C5는 대표자명, C9는 공란', () => {
  const v = buildInputSheetValues(baseIndividual, '900101-1234567');
  assert.equal(v.C3, '홍길동');
  assert.equal(v.C4, '홍길동');
  assert.equal(v.C5, '홍길동');
  assert.equal(v.C6, '900101-1234567');
  assert.equal(v.C7, '홍길동상점');
  assert.equal(v.C8, '1234567890'); // 하이픈 제거
  assert.equal(v.C9, ''); // 개인 → 공란
  assert.equal(v.C10, '010-1234-5678');
  assert.equal(v.C11, '국민은행');
  assert.equal(v.C12, '123-456-789');
  assert.equal(v.C13, 100000);
  assert.equal(v.C14, '서울시 강남구');
});

test('buildInputSheetValues: 법인 — C4/C5 업체명, C9 법인등록번호', () => {
  const corp: NewClientRecord = {
    ...baseIndividual,
    entityType: '법인',
    companyName: '(주)길동',
    corpRegNumber: '110111-1234567',
  };
  const v = buildInputSheetValues(corp, '900101-1234567');
  assert.equal(v.C4, '(주)길동');
  assert.equal(v.C5, '(주)길동');
  assert.equal(v.C9, '1101111234567');
});

test('missingRequired: 모든 필수값 있으면 빈 배열', () => {
  assert.deepEqual(missingRequired(baseIndividual, '900101-1234567'), []);
});

test('missingRequired: openDate/bankName/accountNumber 누락 보고', () => {
  const rec = { ...baseIndividual, openDate: undefined, bankName: undefined, accountNumber: '' };
  const missing = missingRequired(rec, '900101-1234567');
  assert.ok(missing.includes('개업일'));
  assert.ok(missing.includes('은행명'));
  assert.ok(missing.includes('계좌번호'));
});

test('missingRequired: 법인 + 법인등록번호 누락', () => {
  const rec: NewClientRecord = {
    ...baseIndividual, entityType: '법인', corpRegNumber: undefined,
  };
  const missing = missingRequired(rec, '900101-1234567');
  assert.ok(missing.includes('법인등록번호'));
});

test('missingRequired: 주민번호 null 누락', () => {
  assert.ok(missingRequired(baseIndividual, null).includes('대표자주민번호'));
});
